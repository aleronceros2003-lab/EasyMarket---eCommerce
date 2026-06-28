import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Colors, Gradients } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import {
  AdminStats,
  Order,
  OrderStatus,
  Product,
  User,
  adminApi,
} from '../../services/api';
import { ORDER_STATUS_LABELS, formatDate, formatMoney } from '../../utils/format';

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'stats' | 'orders' | 'products' | 'users'>('stats');

  if (!user) {
    return (
      <View style={styles.centered}>
        <Ionicons name="shield-outline" size={60} color={Colors.border} />
        <Text style={styles.errorTitle}>Inicia sesión</Text>
        <Button title="Iniciar sesión" onPress={() => router.push('/auth/login')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (user.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.accessIcon}>
          <Ionicons name="lock-closed" size={36} color="#fff" />
        </LinearGradient>
        <Text style={styles.errorTitle}>Acceso restringido</Text>
        <Text style={styles.errorSubtitle}>Solo los administradores pueden acceder a este panel.</Text>
      </View>
    );
  }

  const tabDefs = [
    { id: 'stats', label: 'Resumen', icon: 'bar-chart-outline' },
    { id: 'orders', label: 'Pedidos', icon: 'receipt-outline' },
    { id: 'products', label: 'Productos', icon: 'cube-outline' },
    { id: 'users', label: 'Usuarios', icon: 'people-outline' },
  ] as const;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabDefs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, active && styles.tabActive]}>
              {active ? (
                <LinearGradient colors={Gradients.primary} style={styles.tabGradient}>
                  <Ionicons name={tab.icon as React.ComponentProps<typeof Ionicons>['name']} size={16} color="#fff" />
                  <Text style={[styles.tabLabel, styles.tabLabelActive]}>{tab.label}</Text>
                </LinearGradient>
              ) : (
                <>
                  <Ionicons name={tab.icon as React.ComponentProps<typeof Ionicons>['name']} size={16} color={Colors.textMuted} />
                  <Text style={styles.tabLabel}>{tab.label}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeTab === 'stats' && <StatsTab />}
      {activeTab === 'orders' && <OrdersTab />}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'users' && <UsersTab />}
    </View>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!stats) return <View style={styles.centered}><Text style={styles.errorSubtitle}>No se pudieron cargar las estadísticas</Text></View>;

  const statCards = [
    { label: 'Usuarios', value: String(stats.totalUsers), icon: 'people', colors: Gradients.primary },
    { label: 'Pedidos', value: String(stats.totalOrders), icon: 'receipt', colors: Gradients.primaryDark },
    { label: 'Ingresos', value: formatMoney(stats.totalRevenue), icon: 'cash', colors: Gradients.success },
    { label: 'Productos', value: String(stats.totalProducts), icon: 'cube', colors: Gradients.warm },
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.statsGrid}>
        {statCards.map((card) => (
          <LinearGradient key={card.label} colors={card.colors} style={styles.statCard}>
            <Ionicons name={card.icon as React.ComponentProps<typeof Ionicons>['name']} size={28} color="rgba(255,255,255,0.8)" />
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </LinearGradient>
        ))}
      </View>

      {stats.topProducts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>🏆 Top productos vendidos</Text>
          {stats.topProducts.map((p) => (
            <View key={p.productId} style={styles.topRow}>
              <Image source={{ uri: p.image }} style={styles.topImage} resizeMode="cover" />
              <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
              <View style={styles.soldBadge}>
                <Text style={styles.soldText}>{p.totalSold} vendidos</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {stats.recentOrders.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>🕐 Pedidos recientes</Text>
          {stats.recentOrders.map((o) => (
            <View key={o.id} style={styles.recentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.recentDate}>{formatDate(o.createdAt)}</Text>
              </View>
              <Text style={styles.recentTotal}>{formatMoney(o.total)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  preparing: 'on_the_way',
  on_the_way: 'delivered',
};
const STATUS_BG: Record<OrderStatus, string> = {
  preparing: '#FFFBEB',
  on_the_way: '#EFF6FF',
  delivered: '#ECFDF5',
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  preparing: Colors.warning,
  on_the_way: Colors.statusOnTheWay,
  delivered: Colors.secondary,
};

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try { setOrders((await adminApi.getOrders()).orders); }
    catch { setOrders([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAdvance = async (order: Order) => {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    try {
      setAdvancing(order.id);
      const updated = await adminApi.updateOrderStatus(order.id, next);
      setOrders((prev) => prev.map((o) => o.id === order.id ? updated : o));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setAdvancing(null);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={Colors.primary} />}
      renderItem={({ item }) => (
        <View style={styles.orderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_BG[item.status] }]}>
              <Text style={[styles.statusPillText, { color: STATUS_COLOR[item.status] }]}>
                {ORDER_STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Text style={styles.orderTotal}>{formatMoney(item.total)}</Text>
            {STATUS_NEXT[item.status] && (
              <TouchableOpacity
                style={styles.advanceBtn}
                onPress={() => handleAdvance(item)}
                disabled={advancing === item.id}
              >
                {advancing === item.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.advanceBtnText}>Avanzar →</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={[styles.errorSubtitle, { textAlign: 'center', marginTop: 40 }]}>Sin pedidos</Text>}
    />
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', discount: '0', category: '', image: '', stock: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', discount: '0', category: '', image: '', stock: '' });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description, price: String(p.price), discount: String(p.discount), category: p.category, image: p.image, stock: String(p.stock) });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name, description: form.description, price: Number(form.price),
      discount: Number(form.discount), category: form.category, image: form.image, stock: Number(form.stock),
    };
    try {
      setSaving(true);
      if (editing) {
        const updated = await adminApi.updateProduct(editing.id, payload);
        setProducts((prev) => prev.map((p) => p.id === editing.id ? updated : p));
      } else {
        const created = await adminApi.createProduct(payload);
        setProducts((prev) => [created, ...prev]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Product) => {
    Alert.alert('Eliminar producto', `¿Eliminar "${p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await adminApi.deleteProduct(p.id); setProducts((prev) => prev.filter((x) => x.id !== p.id)); }
          catch (e: unknown) { Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar'); }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const FIELDS = ['name', 'description', 'price', 'discount', 'category', 'image', 'stock'] as const;
  const FIELD_LABELS: Record<typeof FIELDS[number], string> = {
    name: 'Nombre', description: 'Descripción', price: 'Precio', discount: 'Descuento %',
    category: 'Categoría', image: 'URL de imagen', stock: 'Stock',
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.tabContent}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addBtn} onPress={openNew}>
            <LinearGradient colors={Gradients.primary} style={styles.addBtnGradient}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Nuevo producto</Text>
            </LinearGradient>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <View style={styles.productRow}>
            <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.productMeta}>{formatMoney(item.price)} · Stock: {item.stock}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Editar producto' : 'Nuevo producto'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {FIELDS.map((field) => (
            <View key={field} style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>{FIELD_LABELS[field]}</Text>
              <TextInput
                style={[styles.fieldInput, field === 'description' && { minHeight: 80, textAlignVertical: 'top' }]}
                value={form[field]}
                onChangeText={(v) => setForm((prev) => ({ ...prev, [field]: v }))}
                keyboardType={(['price', 'discount', 'stock'] as string[]).includes(field) ? 'numeric' : 'default'}
                multiline={field === 'description'}
                placeholderTextColor={Colors.textMuted}
                placeholder={FIELD_LABELS[field]}
              />
            </View>
          ))}
          <Button title={saving ? 'Guardando...' : 'Guardar'} onPress={handleSave} loading={saving} fullWidth />
        </ScrollView>
      </Modal>
    </View>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getUsers().then((res) => setUsers(res.users)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRoleToggle = async (u: User, newRole: 'user' | 'admin') => {
    try {
      setToggling(u.id);
      const updated = await adminApi.updateUserRole(u.id, newRole);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: updated.role } : x));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id}
      contentContainerStyle={styles.tabContent}
      renderItem={({ item }) => (
        <View style={styles.userRow}>
          <LinearGradient colors={item.role === 'admin' ? Gradients.primary : ['#E5E7EB', '#D1D5DB']} style={styles.userAvatar}>
            <Text style={styles.userInitial}>{item.name[0].toUpperCase()}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            <Text style={[styles.userRole, { color: item.role === 'admin' ? Colors.primary : Colors.textMuted }]}>
              {item.role === 'admin' ? '⭐ Admin' : 'Usuario'}
            </Text>
          </View>
          <Switch
            value={item.role === 'admin'}
            onValueChange={(v) => handleRoleToggle(item, v ? 'admin' : 'user')}
            disabled={toggling === item.id}
            trackColor={{ true: Colors.primaryLight }}
            thumbColor={item.role === 'admin' ? Colors.primary : '#f4f3f4'}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  accessIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  errorSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  tabBar: { maxHeight: 60, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBarContent: { paddingHorizontal: 12, alignItems: 'center', gap: 8, paddingVertical: 10 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
  },
  tabActive: { borderColor: Colors.primary },
  tabGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14,
  },
  tabLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabLabelActive: { color: '#fff' },
  tabContent: { padding: 16, gap: 12, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  statCard: { width: '47%', borderRadius: 18, padding: 16, gap: 4, alignItems: 'flex-start' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginTop: 4, marginBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 12 },
  topImage: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.borderLight },
  topName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  soldBadge: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  soldText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  recentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 14 },
  recentId: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  recentDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  recentTotal: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  orderRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
  },
  orderId: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  orderDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  orderTotal: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  advanceBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  advanceBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  addBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  addBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 12 },
  productImage: { width: 50, height: 50, borderRadius: 10, backgroundColor: Colors.borderLight },
  productName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  productMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 14 },
  userAvatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  userInitial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  userName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  userEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  userRole: { fontSize: 12, fontWeight: '600', marginTop: 3 },
});
