import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

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

  if (!user) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Ionicons name="person-circle-outline" size={80} color={Colors.border} />
        <Text style={styles.guestTitle}>Bienvenido a EasyMarket</Text>
        <Text style={styles.guestSubtitle}>Inicia sesión para gestionar tu cuenta</Text>
        <Button title="Iniciar sesión" onPress={() => router.push('/auth/login')} style={styles.btn} />
        <TouchableOpacity onPress={() => router.push('/auth/register')} style={styles.registerLink}>
          <Text style={styles.registerLinkText}>¿No tienes una cuenta? Regístrate</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validación', 'El nombre no puede estar vacío');
      return;
    }
    try {
      setSaving(true);
      await updateProfile({
        name,
        phone,
        address,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      setEditing(false);
      Alert.alert('Listo', 'Perfil actualizado correctamente');
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
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar la preferencia');
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{user.name}</Text>
          <Text style={styles.displayEmail}>{user.email}</Text>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Información de la cuenta</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                <Ionicons name="pencil" size={16} color={Colors.primary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <Input label="Nombre completo" value={name} onChangeText={setName} placeholder="Tu nombre completo" />
              <Input
                label="Teléfono"
                value={phone}
                onChangeText={setPhone}
                placeholder="Número de teléfono"
                keyboardType="phone-pad"
              />
              <Input
                label="Dirección"
                value={address}
                onChangeText={setAddress}
                placeholder="Dirección de envío"
                multiline
                numberOfLines={2}
              />

              <Text style={styles.sectionLabel}>Cambiar contraseña (opcional)</Text>
              <Input
                label="Contraseña actual"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Contraseña actual"
              />
              <Input
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Nueva contraseña"
              />

              <View style={styles.editActions}>
                <Button
                  title="Cancelar"
                  variant="outline"
                  onPress={() => {
                    setEditing(false);
                    setName(user.name);
                    setPhone(user.phone);
                    setAddress(user.address);
                    setCurrentPassword('');
                    setNewPassword('');
                  }}
                  style={styles.actionBtn}
                />
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

        {/* Notificaciones */}
        <View style={styles.card}>
          <View style={styles.alertRow}>
            <View style={styles.alertInfo}>
              <Text style={styles.cardTitle}>Alertas de ofertas</Text>
              <Text style={styles.alertSubtitle}>
                Recibe por correo ofertas con más de 50% de descuento relacionadas a tus búsquedas.
              </Text>
            </View>
            <Switch
              value={Boolean(user.emailAlerts)}
              onValueChange={toggleAlerts}
              disabled={savingAlerts}
              trackColor={{ true: Colors.primaryLight }}
              thumbColor={user.emailAlerts ? Colors.primary : undefined}
            />
          </View>
        </View>

        {/* Cerrar sesión */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ProfileRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) => (
  <View style={rowStyles.row}>
    <Ionicons name={icon} size={18} color={Colors.textSecondary} style={rowStyles.icon} />
    <View>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  </View>
);

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
  icon: { marginTop: 2 },
  label: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  guestTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  guestSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 20, paddingHorizontal: 48 },
  registerLink: { marginTop: 14 },
  registerLinkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  displayName: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  displayEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    marginTop: 6,
  },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1 },
  alertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  alertInfo: { flex: 1 },
  alertSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  logoutText: { color: Colors.danger, fontWeight: '600', fontSize: 15 },
});
