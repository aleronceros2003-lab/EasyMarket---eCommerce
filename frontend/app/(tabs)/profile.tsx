import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Gradients } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { PaymentMethodSaved, PointsHistoryItem, authApi, pointsApi } from '../../services/api';
import { formatDate, formatMoney } from '../../utils/format';

const BRAND_COLORS: Record<string, string> = {
  visa: '#1A1F71',
  mastercard: '#EB001B',
  amex: '#007BC1',
  other: Colors.primary,
};

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSaved[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const [points, setPoints] = useState<number>(0);
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (user) {
      setLoadingCards(true);
      authApi.getPaymentMethods()
        .then(setPaymentMethods)
        .catch(() => {})
        .finally(() => setLoadingCards(false));

      pointsApi.get()
        .then((res) => { setPoints(res.points); setPointsHistory(res.history); })
        .catch(() => {});
    }
  }, [user]);

  const handleDeleteCard = (id: string) => {
    Alert.alert('Eliminar tarjeta', '¿Estás seguro de que deseas eliminar este método de pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await authApi.deletePaymentMethod(id);
            setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <LinearGradient colors={Gradients.primary} style={styles.guestIcon}>
          <Ionicons name="person-outline" size={40} color="#fff" />
        </LinearGradient>
        <Text style={styles.guestTitle}>Bienvenido a EasyMarket</Text>
        <Text style={styles.guestSubtitle}>Inicia sesión para gestionar tu cuenta</Text>
        <Button title="Iniciar sesión" onPress={() => router.push('/auth/login')} style={styles.btn} />
        <TouchableOpacity onPress={() => router.push('/auth/register')} style={styles.registerLink}>
          <Text style={styles.registerLinkText}>¿No tienes cuenta? Regístrate gratis</Text>
        </TouchableOpacity>

      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validación', 'El nombre no puede estar vacío'); return; }
    try {
      setSaving(true);
      await updateProfile({ name, phone, address, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined });
      setCurrentPassword(''); setNewPassword(''); setEditing(false);
      Alert.alert('Listo', 'Perfil actualizado');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  };

  const toggleAlerts = async (value: boolean) => {
    try {
      setSavingAlerts(true);
      await updateProfile({ emailAlerts: value });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Avatar header */}
        <LinearGradient colors={Gradients.hero} style={styles.avatarHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{user.name}</Text>
          <Text style={styles.displayEmail}>{user.email}</Text>
        </LinearGradient>

        {/* Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Información de cuenta</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                <Ionicons name="pencil" size={15} color={Colors.primary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>
          {editing ? (
            <>
              <Input label="Nombre completo" value={name} onChangeText={setName} placeholder="Tu nombre" />
              <Input label="Teléfono" value={phone} onChangeText={setPhone} placeholder="Número de teléfono" keyboardType="phone-pad" />
              <Input label="Dirección" value={address} onChangeText={setAddress} placeholder="Dirección de envío" multiline numberOfLines={2} />
              <Text style={styles.sectionLabel}>Cambiar contraseña (opcional)</Text>
              <Input label="Contraseña actual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Contraseña actual" />
              <Input label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Nueva contraseña" />
              <View style={styles.editActions}>
                <Button title="Cancelar" variant="outline" onPress={() => { setEditing(false); setName(user.name); setPhone(user.phone); setAddress(user.address); setCurrentPassword(''); setNewPassword(''); }} style={styles.actionBtn} />
                <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.actionBtn} />
              </View>
            </>
          ) : (
            <>
              <ProfileRow icon="person-outline" label="Nombre" value={user.name} />
              <ProfileRow icon="mail-outline" label="Correo" value={user.email} />
              <ProfileRow icon="call-outline" label="Teléfono" value={user.phone || '—'} />
              <ProfileRow icon="location-outline" label="Dirección" value={user.address || '—'} />
            </>
          )}
        </View>

        {/* Métodos de pago */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Métodos de pago</Text>
            <View style={styles.cardTitleBadge}>
              <Text style={styles.cardTitleBadgeText}>{paymentMethods.length}/5</Text>
            </View>
          </View>
          {loadingCards ? (
            <Text style={styles.cardSubtext}>Cargando...</Text>
          ) : paymentMethods.length === 0 ? (
            <View style={styles.noCards}>
              <Ionicons name="card-outline" size={32} color={Colors.border} />
              <Text style={styles.noCardsText}>No tienes tarjetas guardadas</Text>
              <Text style={styles.noCardsSub}>Guarda una tarjeta al hacer tu próxima compra</Text>
            </View>
          ) : (
            paymentMethods.map((m) => (
              <View key={m.id} style={styles.savedCard}>
                <View style={[styles.brandIcon, { backgroundColor: BRAND_COLORS[m.brand] || Colors.primary }]}>
                  <Ionicons name="card" size={16} color="#fff" />
                </View>
                <View style={styles.savedCardInfo}>
                  <Text style={styles.savedCardHolder}>{m.holderName}</Text>
                  <Text style={styles.savedCardNum}>•••• •••• •••• {m.last4}</Text>
                  <Text style={styles.savedCardExp}>
                    {String(m.expiryMonth).padStart(2, '0')}/{String(m.expiryYear).slice(-2)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.deleteCardBtn} onPress={() => handleDeleteCard(m.id)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Puntos de fidelización */}
        <View style={styles.card}>
          <LinearGradient colors={Gradients.warm} style={styles.pointsHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointsLabel}>Mis puntos</Text>
              <Text style={styles.pointsValue}>{points} pts</Text>
              <Text style={styles.pointsEquiv}>= {formatMoney(Math.floor(points / 100) * 1)} de descuento disponible</Text>
            </View>
            <View style={styles.pointsCoin}>
              <Ionicons name="trophy" size={28} color="#fff" />
            </View>
          </LinearGradient>
          <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory((v) => !v)}>
            <Text style={styles.historyToggleText}>
              {showHistory ? 'Ocultar historial' : 'Ver historial de puntos'}
            </Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
          </TouchableOpacity>
          {showHistory && (
            <View style={styles.historyList}>
              {pointsHistory.length === 0 ? (
                <Text style={styles.cardSubtext}>Sin movimientos aún</Text>
              ) : (
                pointsHistory.slice(0, 8).map((item, idx) => (
                  <View key={idx} style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyReason}>{item.reason}</Text>
                      <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.historyAmount, { color: item.amount >= 0 ? Colors.secondary : Colors.danger }]}>
                      {item.amount >= 0 ? '+' : ''}{item.amount} pts
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Alertas */}
        <View style={styles.card}>
          <View style={styles.alertRow}>
            <View style={styles.alertInfo}>
              <Text style={styles.cardTitle}>Alertas de ofertas</Text>
              <Text style={styles.alertSubtitle}>
                Recibe por correo ofertas con más de 50% de descuento.
              </Text>
            </View>
            <Switch
              value={Boolean(user.emailAlerts)}
              onValueChange={toggleAlerts}
              disabled={savingAlerts}
              trackColor={{ true: Colors.primaryLight }}
              thumbColor={user.emailAlerts ? Colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ProfileRow = ({
  icon, label, value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string;
}) => (
  <View style={rowStyles.row}>
    <View style={rowStyles.iconWrap}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  </View>
);

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: Colors.background,
  },
  guestIcon: {
    width: 90, height: 90, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  guestTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  guestSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 20, paddingHorizontal: 48 },
  registerLink: { marginTop: 14 },
  registerLinkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  avatarHeader: { alignItems: 'center', paddingTop: 40, paddingBottom: 36, paddingHorizontal: 24 },
  avatar: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  displayName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  displayEmail: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3, marginHorizontal: 16, marginTop: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardTitleBadge: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cardTitleBadgeText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  cardSubtext: { fontSize: 14, color: Colors.textMuted },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10, marginTop: 6 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1 },
  noCards: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  noCardsText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  noCardsSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  savedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, backgroundColor: Colors.background,
    borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  brandIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  savedCardInfo: { flex: 1 },
  savedCardHolder: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  savedCardNum: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  savedCardExp: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  deleteCardBtn: { padding: 6 },
  alertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  alertInfo: { flex: 1 },
  alertSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 15, marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.danger,
  },
  logoutText: { color: Colors.danger, fontWeight: '700', fontSize: 15 },
  pointsHeader: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 14,
  },
  pointsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  pointsValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  pointsEquiv: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  pointsCoin: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyToggleText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  historyList: { marginTop: 12, gap: 10 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  historyReason: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: '800' },
});
