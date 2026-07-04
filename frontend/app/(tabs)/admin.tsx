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
  ComplaintMessage,
  ComplaintWithUser,
  Order,
  OrderStatus,
  Product,
  User,
  adminApi,
} from '../../services/api';
import { ORDER_STATUS_LABELS, formatDate, formatMoney } from '../../utils/format';

type AdminTab = 'stats' | 'orders' | 'products' | 'users' | 'complaints';

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');

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

  const tabDefs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'stats', label: 'Resumen', icon: 'bar-chart-outline' },
    { id: 'orders', label: 'Pedidos', icon: 'receipt-outline' },
    { id: 'products', label: 'Productos', icon: 'cube-outline' },
    { id: 'users', label: 'Usuarios', icon: 'people-outline' },
    { id: 'complaints', label: 'Reclamos', icon: 'alert-circle-outline' },
  ];

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
      {activeTab === 'complaints' && <ComplaintsTab />}
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
const STATUS_BG: Record<string, string> = {
  preparing: '#FFFBEB',
  on_the_way: '#EFF6FF',
  at_door: '#F5F3FF',
  delivered: '#ECFDF5',
  finalized: '#D1FAE5',
};
const STATUS_COLOR: Record<string, string> = {
  preparing: Colors.warning,
  on_the_way: Colors.statusOnTheWay,
  at_door: '#7C3AED',
  delivered: Colors.secondary,
  finalized: '#047857',
};

// Secuencia lineal para el botón "Avanzar"
const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  preparing: 'on_the_way',
  on_the_way: 'at_door',
  at_door: 'delivered',
  delivered: 'finalized',
};

const STATUS_NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  preparing: 'En camino',
  on_the_way: 'En domicilio',
  at_door: 'Marcar entregado',
  delivered: 'Finalizar',
};

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState<string | null>(null);

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

  const handleFinalize = (order: Order) => {
    Alert.alert(
      'Finalizar pedido',
      `¿Confirmas que el pedido #${order.id.slice(0, 8).toUpperCase()} fue entregado al cliente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar', onPress: async () => {
            try {
              setFinalizing(order.id);
              const updated = await adminApi.updateOrderStatus(order.id, 'finalized');
              setOrders((prev) => prev.map((o) => o.id === order.id ? updated : o));
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo finalizar');
            } finally {
              setFinalizing(null);
            }
          },
        },
      ]
    );
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
            <View style={[styles.statusPill, { backgroundColor: STATUS_BG[item.status] ?? '#F3F4F6' }]}>
              <Text style={[styles.statusPillText, { color: STATUS_COLOR[item.status] ?? Colors.textMuted }]}>
                {ORDER_STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={styles.orderTotal}>{formatMoney(item.total)}</Text>
            {item.status !== 'finalized' && (
              <>
                {STATUS_NEXT[item.status] && (
                  <TouchableOpacity
                    style={styles.advanceBtn}
                    onPress={() => handleAdvance(item)}
                    disabled={advancing === item.id || finalizing === item.id}
                  >
                    {advancing === item.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.advanceBtnText}>{STATUS_NEXT_LABEL[item.status]} →</Text>
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.finalizeBtn}
                  onPress={() => handleFinalize(item)}
                  disabled={advancing === item.id || finalizing === item.id}
                >
                  {finalizing === item.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.finalizeBtnText}>FINALIZAR</Text>
                  }
                </TouchableOpacity>
              </>
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

// ─── Complaints Tab ───────────────────────────────────────────────────────────
const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  valid: 'Válido',
  invalid: 'Inválido',
};
const COMPLAINT_STATUS_COLOR: Record<string, string> = {
  pending: Colors.warning,
  valid: Colors.secondary,
  invalid: Colors.danger,
};

function ComplaintCard({
  item,
  onResolve,
  onMessageSent,
}: {
  item: ComplaintWithUser;
  onResolve: (id: string, status: 'valid' | 'invalid') => void;
  onMessageSent: (updated: ComplaintWithUser) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!chatText.trim()) return;
    try {
      setSending(true);
      const updated = await adminApi.sendComplaintMessage(item.id, chatText.trim());
      setChatText('');
      onMessageSent(updated as ComplaintWithUser);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  const messages = item.complaint?.messages ?? [];

  return (
    <View style={styles.complaintCard}>
      {/* Header */}
      <TouchableOpacity style={styles.complaintHeader} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.complaintOrderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.complaintUser}>
            {item.user?.name ?? 'Usuario desconocido'} · {item.user?.email ?? '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.statusPill, { backgroundColor: `${COMPLAINT_STATUS_COLOR[item.complaint?.status ?? 'pending']}18` }]}>
            <Text style={[styles.statusPillText, { color: COMPLAINT_STATUS_COLOR[item.complaint?.status ?? 'pending'] }]}>
              {COMPLAINT_STATUS_LABEL[item.complaint?.status ?? 'pending']}
            </Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      <View style={styles.complaintOrderStatus}>
        <Text style={styles.complaintOrderStatusLabel}>Pedido:</Text>
        <Text style={[styles.complaintOrderStatusValue, { color: STATUS_COLOR[item.status] ?? Colors.textMuted }]}>
          {ORDER_STATUS_LABELS[item.status] ?? item.status}
        </Text>
      </View>

      {expanded && (
        <>
          {/* Hilo de mensajes */}
          <View style={styles.chatThread}>
            {messages.map((msg: ComplaintMessage, idx: number) => (
              <View key={idx} style={[styles.bubble, msg.sender === 'admin' ? styles.bubbleAdmin : styles.bubbleUser]}>
                <Text style={[styles.bubbleSender, msg.sender === 'admin' ? styles.bubbleSenderAdmin : styles.bubbleSenderUser]}>
                  {msg.sender === 'admin' ? 'Tú (Admin)' : item.user?.name ?? 'Cliente'}
                </Text>
                <Text style={[styles.bubbleText, msg.sender === 'admin' ? styles.bubbleTextAdmin : styles.bubbleTextUser]}>
                  {msg.text}
                </Text>
              </View>
            ))}
          </View>

          {/* Input de respuesta del admin */}
          {item.complaint?.status === 'pending' && (
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Responder al cliente..."
                placeholderTextColor={Colors.textMuted}
                value={chatText}
                onChangeText={setChatText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.chatSendBtn, !chatText.trim() && styles.chatSendBtnDisabled]}
                onPress={handleSend}
                disabled={!chatText.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={16} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Botones de resolución */}
          {item.complaint?.status === 'pending' && (
            <View style={styles.complaintActions}>
              <TouchableOpacity
                style={[styles.resolveBtn, { backgroundColor: '#FEF2F2' }]}
                onPress={() => onResolve(item.id, 'invalid')}
              >
                <Text style={[styles.resolveBtnText, { color: Colors.danger }]}>Marcar inválido</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resolveBtn, { backgroundColor: '#F0FDF4' }]}
                onPress={() => onResolve(item.id, 'valid')}
              >
                <Text style={[styles.resolveBtnText, { color: Colors.secondary }]}>Marcar válido</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function ComplaintsTab() {
  const [complaints, setComplaints] = useState<ComplaintWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'valid' | 'invalid'>('pending');
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchComplaints = useCallback(async () => {
    try { setComplaints((await adminApi.getComplaints({ status: filter })).orders); }
    catch { setComplaints([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); fetchComplaints(); }, [fetchComplaints]);

  const handleResolve = (orderId: string, status: 'valid' | 'invalid') => {
    const label = status === 'valid' ? 'válido' : 'inválido';
    Alert.alert('Resolver reclamo', `¿Marcar este reclamo como ${label}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          try {
            setResolving(orderId);
            await adminApi.resolveComplaint(orderId, status);
            setComplaints((prev) => prev.filter((c) => c.id !== orderId));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo resolver');
          } finally {
            setResolving(null);
          }
        },
      },
    ]);
  };

  const handleMessageSent = (updated: ComplaintWithUser) => {
    setComplaints((prev) => prev.map((c) => c.id === updated.id ? { ...updated, user: c.user } : c));
  };

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'pending', label: 'Pendientes' },
    { key: 'valid', label: 'Válidos' },
    { key: 'invalid', label: 'Inválidos' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterRow}>
        {filterTabs.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.tabContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchComplaints(); }} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <ComplaintCard
              item={item}
              onResolve={handleResolve}
              onMessageSent={handleMessageSent}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.border} />
              <Text style={[styles.errorSubtitle, { marginTop: 12 }]}>
                Sin reclamos {filter === 'pending' ? 'pendientes' : filter === 'valid' ? 'válidos' : 'inválidos'}
              </Text>
            </View>
          }
        />
      )}
    </View>
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
  soldBadge: { backgroundColor: Colors.borderLight, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
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
  advanceBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  finalizeBtn: { backgroundColor: '#047857', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  finalizeBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  addBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  addBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 12 },
  productImage: { width: 50, height: 50, borderRadius: 10, backgroundColor: Colors.borderLight },
  productName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  productMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
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
  // Complaints
  filterRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '20' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  filterChipTextActive: { color: Colors.primary },
  complaintCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.warning,
  },
  complaintHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  complaintOrderId: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  complaintUser: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  complaintOrderStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  complaintOrderStatusLabel: { fontSize: 12, color: Colors.textMuted },
  complaintOrderStatusValue: { fontSize: 12, fontWeight: '700' },
  complaintText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, backgroundColor: Colors.borderLight, borderRadius: 10, padding: 12 },
  complaintActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  resolveBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  resolveBtnText: { fontSize: 13, fontWeight: '800' },
  // Chat
  chatThread: { gap: 8, marginBottom: 8 },
  bubble: { maxWidth: '82%', borderRadius: 14, padding: 10 },
  bubbleAdmin: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleUser: { alignSelf: 'flex-start', backgroundColor: Colors.borderLight, borderBottomLeftRadius: 4 },
  bubbleSender: { fontSize: 9, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  bubbleSenderAdmin: { color: 'rgba(255,255,255,0.7)' },
  bubbleSenderUser: { color: Colors.textMuted },
  bubbleText: { fontSize: 13, lineHeight: 18 },
  bubbleTextAdmin: { color: '#fff' },
  bubbleTextUser: { color: Colors.textPrimary },
  chatInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary,
    maxHeight: 80, textAlignVertical: 'top',
  },
  chatSendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  chatSendBtnDisabled: { backgroundColor: Colors.border },
});
