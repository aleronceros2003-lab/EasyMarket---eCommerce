import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
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
    else if (password.length < 6) errs.password = 'Mínimo 6 caracteres';
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
      Alert.alert('Error en el registro', e instanceof Error ? e.message : 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Hero mini */}
          <LinearGradient colors={Gradients.hero} style={styles.hero}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={[
                styles.logoImage,
                Platform.OS === 'web'
                  ? ({ filter: 'brightness(0) invert(1)' } as any)
                  : { tintColor: '#FFFFFF' },
              ]}
              resizeMode="contain"
            />
            <Text style={styles.heroTitle}>Crear cuenta</Text>
            <Text style={styles.heroSub}>Únete a miles de compradores</Text>
          </LinearGradient>

          {/* Form card */}
          <View style={styles.card}>
            <Input
              label="Nombre completo *"
              value={name}
              onChangeText={setName}
              placeholder="Juan Pérez"
              error={errors.name}
            />
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
                placeholder="Mínimo 6 caracteres"
                secureTextEntry={!showPwd}
                style={{ paddingRight: 48 }}
                error={errors.password}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd((v) => !v)}>
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
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
              placeholder="Av. Ejemplo 123, Lima"
              multiline
              numberOfLines={2}
            />

            <View style={styles.alertRow}>
              <View style={styles.alertTextWrap}>
                <Ionicons name="mail-outline" size={16} color={Colors.primary} />
                <Text style={styles.alertText}>Recibir alertas de ofertas por correo</Text>
              </View>
              <Switch
                value={emailAlerts}
                onValueChange={setEmailAlerts}
                trackColor={{ true: Colors.primaryLight }}
                thumbColor={emailAlerts ? Colors.primary : '#f4f3f4'}
              />
            </View>

            <Button
              title="Crear cuenta"
              onPress={handleRegister}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.altLink} onPress={() => router.replace('/auth/login')}>
              <Text style={styles.altText}>
                ¿Ya tienes cuenta?{' '}
                <Text style={styles.altBold}>Iniciar sesión</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1 },
  logoImage: { width: 80, height: 80, marginBottom: 10 },
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 70,
    height: 70,
    display: 'none',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    padding: 28,
    paddingTop: 32,
  },
  passwordWrapper: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 14, top: 34 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  alertTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  submitBtn: { marginTop: 4 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: 13 },
  altLink: { alignItems: 'center', marginBottom: 8 },
  altText: { color: Colors.textSecondary, fontSize: 14 },
  altBold: { color: Colors.primary, fontWeight: '700' },
});
