import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { Order, ordersApi } from '../../services/api';
import { Button } from '../../components/Button';

const STATUS_COLORS: Record<string, string> = {
  confirmed: Colors.secondary,
  shipped: Colors.primary,
  delivered: Colors.secondary,
  cancelled: Colors.danger,
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.getOrders();
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchOrders();
    else setLoading(false);
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Ionicons name="receipt-outline" size={72} color={Colors.border} />
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptySubtitle}>Sign in to view your purchase history</Text>
        <Button title="Sign In" onPress={() => router.push('/auth/login')} style={styles.btn} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.orderCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/order/${item.id}` as never)}
          >
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderId}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || Colors.textMuted }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.itemsPreview}>
              {item.items.slice(0, 3).map((oi, idx) => (
                <Image
                  key={idx}
                  source={{ uri: oi.image }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ))}
              {item.items.length > 3 && (
                <View style={styles.moreItems}>
                  <Text style={styles.moreItemsText}>+{item.items.length - 3}</Text>
                </View>
              )}
            </View>

            <View style={styles.orderFooter}>
              <Text style={styles.itemCount}>
                {item.items.reduce((s, i) => s + i.quantity, 0)} items
              </Text>
              <Text style={styles.orderTotal}>${item.total.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="receipt-outline" size={72} color={Colors.border} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>Your purchase history will appear here</Text>
            <Button
              title="Start Shopping"
              onPress={() => router.push('/(tabs)/')}
              style={styles.btn}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  btn: { marginTop: 20, paddingHorizontal: 40 },
  list: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  itemsPreview: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  thumbImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  moreItems: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moreItemsText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  orderTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
});
