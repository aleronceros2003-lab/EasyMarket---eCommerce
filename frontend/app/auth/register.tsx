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

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'El nombre es obligatorio';
    if (!email.trim()) errs.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Correo inválido';
    if (!password) errs.password = 'La contraseña es obligatoria';
    else if (password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        emailAlerts,
      });
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error en el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="storefront" size={40} color="#fff" />
            </View>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Regístrate en EasyMarket</Text>
          </View>

          <View style={styles.form}>
            <Input label="Nombre completo *" value={name} onChangeText={setName} placeholder="Juan Pérez" error={errors.name} />
            <Input
              label="Correo electrónico *"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />
            <View style={styles.passwordWrapper}>
              <Input
                label="Contraseña *"
                value={password}
                onChangeText={setPassword}
                placeholder="Al menos 6 caracteres"
                secureTextEntry={!showPwd}
                style={{ paddingRight: 44 }}
                error={errors.password}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd((v) => !v)}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Input
              label="Teléfono (opcional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="+51 999 000 000"
              keyboardType="phone-pad"
            />
            <Input
              label="Dirección de envío (opcional)"
              value={address}
              onChangeText={setAddress}
              placeholder="Av. Siempre Viva 123, Lima"
              multiline
              numberOfLines={2}
            />

            <View style={styles.alertRow}>
              <Text style={styles.alertText}>Recibir alertas de ofertas por correo</Text>
              <Switch
                value={emailAlerts}
                onValueChange={setEmailAlerts}
                trackColor={{ true: Colors.primaryLight }}
                thumbColor={emailAlerts ? Colors.primary : undefined}
              />
            </View>

            <Button title="Crear cuenta" onPress={handleRegister} loading={loading} fullWidth style={styles.submitBtn} />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/auth/login')}>
              <Text style={styles.loginText}>
                ¿Ya tienes una cuenta? <Text style={styles.loginBold}>Iniciar sesión</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  passwordWrapper: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 14, top: 36 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  alertText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  submitBtn: { marginTop: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: 13 },
  loginLink: { alignItems: 'center' },
  loginText: { color: Colors.textSecondary, fontSize: 14 },
  loginBold: { color: Colors.primary, fontWeight: '700' },
});
