import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Colors, Gradients } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderStatus, ordersApi } from '../../services/api';
import { ORDER_STATUS_LABELS, formatDate, formatMoney } from '../../utils/format';

const STATUS_CONFIG: Record<OrderStatus, { colors: string[]; icon: React.ComponentProps<typeof Ionicons>['name']; bg: string }> = {
  preparing:  { colors: ['#D97706', '#F59E0B'], icon: 'cube-outline',          bg: '#FFFBEB' },
  on_the_way: { colors: ['#0284C7', '#38BDF8'], icon: 'bicycle-outline',       bg: '#EFF6FF' },
  at_door:    { colors: ['#7C3AED', '#A78BFA'], icon: 'home-outline',           bg: '#F5F3FF' },
  delivered:  { colors: ['#059669', '#34D399'], icon: 'checkmark-circle-outline', bg: '#ECFDF5' },
  finalized:  { colors: ['#047857', '#10B981'], icon: 'checkmark-done',         bg: '#D1FAE5' },
};

function OrderCard({ item, onPress }: { item: Order; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status];
  const totalQty = item.items.reduce((s, i) => s + i.quantity, 0);
  const preview = item.items.slice(0, 3);
  const extra = item.items.length - 3;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={onPress}>
      {/* Top stripe */}
      <LinearGradient colors={cfg.colors as [string, string]} style={styles.cardStripe} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />

      <View style={styles.cardBody}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>#{item.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={13} color={cfg.colors[0]} />
            <Text style={[styles.statusText, { color: cfg.colors[0] }]}>
              {ORDER_STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>

        {/* Product thumbnails */}
        <View style={styles.thumbRow}>
          {preview.map((oi, idx) => (
            <Image key={idx} source={{ uri: oi.image }} style={styles.thumb} resizeMode="cover" />
          ))}
          {extra > 0 && (
            <View style={styles.extraBubble}>
              <Text style={styles.extraText}>+{extra}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text style={styles.qtyLabel}>{totalQty} {totalQty === 1 ? 'artículo' : 'artículos'}</Text>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatMoney(item.total)}</Text>
          </View>
          <View style={styles.chevronWrap}>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setOrders(await ordersApi.getOrders());
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchOrders(); }, [fetchOrders]));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <LinearGradient colors={Gradients.primaryDark} style={styles.emptyIcon}>
          <Ionicons name="receipt-outline" size={38} color="#fff" />
        </LinearGradient>
        <Text style={styles.emptyTitle}>Inicia sesión primero</Text>
        <Text style={styles.emptySubtitle}>Accede a tu cuenta para ver tu historial de pedidos</Text>
        <Button title="Iniciar sesión" onPress={() => router.push('/auth/login')} style={styles.btn} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchOrders(); }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          orders.length > 0 ? (
            <LinearGradient colors={Gradients.primaryDark} style={styles.listHeader}>
              <Ionicons name="receipt-outline" size={20} color="rgba(255,255,255,0.8)" />
              <Text style={styles.listHeaderText}>{orders.length} pedido{orders.length !== 1 ? 's' : ''}</Text>
            </LinearGradient>
          ) : null
        }
        renderItem={({ item }) => (
          <OrderCard item={item} onPress={() => router.push(`/order/${item.id}` as never)} />
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <LinearGradient colors={Gradients.primaryDark} style={styles.emptyIcon}>
              <Ionicons name="bag-outline" size={38} color="#fff" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Sin pedidos aún</Text>
            <Text style={styles.emptySubtitle}>Tu historial de compras aparecerá aquí</Text>
            <Button title="Comenzar a comprar" onPress={() => router.push('/(tabs)')} style={styles.btn} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 22 },
  list: { padding: 16, gap: 14, paddingBottom: 24 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 16, marginBottom: 4,
  },
  listHeaderText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.primaryDark,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  cardStripe: { height: 4 },
  cardBody: { padding: 16 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  orderId: { fontSize: 15, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.3 },
  orderDate: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: Colors.borderLight },
  extraBubble: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: Colors.surfaceTinted, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  extraText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  qtyLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  totalRow: { flex: 1 },
  totalLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmount: { fontSize: 20, fontWeight: '900', color: Colors.primary, marginTop: 2 },
  chevronWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center',
  },
});
