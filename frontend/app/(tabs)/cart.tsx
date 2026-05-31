import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import {
  CouponValidation,
  DeliveryType,
  PaymentMethod,
  couponsApi,
  ordersApi,
} from '../../services/api';
import { formatMoney } from '../../utils/format';

const PICKUP_CENTERS = ['Tienda Miraflores', 'Tienda San Isidro', 'Tienda Surco'];

export default function CartScreen() {
  const { cart, loading, updateItem, removeItem, refreshCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [address, setAddress] = useState(user?.address ?? '');
  const [pickupCenter, setPickupCenter] = useState(PICKUP_CENTERS[0]);

  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Estimación de totales según las opciones elegidas. El total definitivo lo
  // calcula el backend al confirmar el pedido.
  const totals = useMemo(() => {
    const { subtotal, productDiscount, shipping: deliveryShipping } = cart.totals;
    const couponDiscount = coupon?.discount ?? 0;
    const shipping =
      deliveryType === 'pickup' || coupon?.type === 'shipping' ? 0 : deliveryShipping;
    const total = Math.max(0, subtotal - couponDiscount) + shipping;
    return { subtotal, productDiscount, couponDiscount, shipping, total };
  }, [cart.totals, coupon, deliveryType]);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      setValidatingCoupon(true);
      setCouponError('');
      const validated = await couponsApi.validate(couponInput.trim(), cart.totals.subtotal);
      setCoupon(validated);
    } catch (e: unknown) {
      setCoupon(null);
      setCouponError(e instanceof Error ? e.message : 'Cupón inválido');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  const handleCheckout = async () => {
    if (deliveryType === 'delivery' && !address.trim()) {
      Alert.alert('Falta la dirección', 'Ingresa una dirección de envío para continuar.');
      return;
    }
    try {
      setCheckingOut(true);
      const order = await ordersApi.checkout({
        paymentMethod,
        deliveryType,
        shippingAddress: deliveryType === 'delivery' ? address.trim() : undefined,
        pickupCenter: deliveryType === 'pickup' ? pickupCenter : undefined,
        couponCode: coupon?.code,
      });
      await refreshCart();
      removeCoupon();
      Alert.alert('¡Pedido realizado!', 'Tu pedido fue confirmado. ¡Gracias por tu compra!', [
        { text: 'Ver pedido', onPress: () => router.push(`/order/${order.id}` as never) },
        { text: 'Seguir comprando', onPress: () => router.push('/(tabs)') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo completar el pago');
    } finally {
      setCheckingOut(false);
    }
  };

  // --- Estados sin sesión / vacío / cargando ---
  if (!user) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Ionicons name="cart-outline" size={72} color={Colors.border} />
        <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
        <Text style={styles.emptySubtitle}>Inicia sesión para guardar artículos y pagar</Text>
        <Button title="Iniciar sesión" onPress={() => router.push('/auth/login')} style={styles.btn} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Ionicons name="cart-outline" size={72} color={Colors.border} />
        <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
        <Text style={styles.emptySubtitle}>Agrega productos para comenzar</Text>
        <Button title="Buscar productos" onPress={() => router.push('/(tabs)')} style={styles.btn} />
      </SafeAreaView>
    );
  }

  const itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Ítems */}
        {cart.items.map((item) => (
          <View key={item.productId} style={styles.cartItem}>
            <Image source={{ uri: item.product.image }} style={styles.itemImage} resizeMode="cover" />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product.name}
              </Text>
              <Text style={styles.itemPrice}>{formatMoney(item.product.finalPrice)}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() =>
                    item.quantity <= 1
                      ? removeItem(item.productId)
                      : updateItem(item.productId, item.quantity - 1)
                  }
                >
                  <Ionicons name="remove" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateItem(item.productId, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() =>
                Alert.alert('Eliminar artículo', '¿Eliminar este artículo del carrito?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Eliminar', style: 'destructive', onPress: () => removeItem(item.productId) },
                ])
              }
            >
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Cupón */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cupón de descuento</Text>
          {coupon ? (
            <View style={styles.couponApplied}>
              <Ionicons name="pricetag" size={18} color={Colors.secondary} />
              <Text style={styles.couponAppliedText}>
                {coupon.code} aplicado (−{formatMoney(coupon.discount)})
              </Text>
              <TouchableOpacity onPress={removeCoupon}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Ingresa tu código"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                value={couponInput}
                onChangeText={setCouponInput}
              />
              <TouchableOpacity
                style={styles.couponBtn}
                onPress={handleApplyCoupon}
                disabled={validatingCoupon}
              >
                {validatingCoupon ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.couponBtnText}>Aplicar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
        </View>

        {/* Tipo de entrega */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entrega</Text>
          <View style={styles.segment}>
            <SegmentButton
              icon="bicycle-outline"
              label="Delivery"
              active={deliveryType === 'delivery'}
              onPress={() => setDeliveryType('delivery')}
            />
            <SegmentButton
              icon="storefront-outline"
              label="Recojo en tienda"
              active={deliveryType === 'pickup'}
              onPress={() => setDeliveryType('pickup')}
            />
          </View>

          {deliveryType === 'delivery' ? (
            <TextInput
              style={styles.addressInput}
              placeholder="Dirección de envío"
              placeholderTextColor={Colors.textMuted}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          ) : (
            <View style={styles.pickupList}>
              {PICKUP_CENTERS.map((center) => (
                <TouchableOpacity
                  key={center}
                  style={styles.pickupOption}
                  onPress={() => setPickupCenter(center)}
                >
                  <Ionicons
                    name={pickupCenter === center ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={pickupCenter === center ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={styles.pickupText}>{center}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Método de pago */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de pago</Text>
          <View style={styles.segment}>
            <SegmentButton
              icon="card-outline"
              label="Tarjeta"
              active={paymentMethod === 'card'}
              onPress={() => setPaymentMethod('card')}
            />
            <SegmentButton
              icon="cash-outline"
              label="Contraentrega"
              active={paymentMethod === 'cash_on_delivery'}
              onPress={() => setPaymentMethod('cash_on_delivery')}
            />
          </View>
        </View>

        {/* Desglose */}
        <View style={styles.section}>
          <TotalRow label="Subtotal" value={formatMoney(totals.subtotal)} />
          {totals.productDiscount > 0 && (
            <TotalRow label="Descuento productos" value={`− ${formatMoney(totals.productDiscount)}`} muted />
          )}
          {totals.couponDiscount > 0 && (
            <TotalRow label={`Cupón ${coupon?.code ?? ''}`} value={`− ${formatMoney(totals.couponDiscount)}`} muted />
          )}
          <TotalRow
            label="Envío"
            value={totals.shipping ? formatMoney(totals.shipping) : 'Gratis'}
          />
        </View>
      </ScrollView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total ({itemCount} artículos)</Text>
          <Text style={styles.totalAmount}>{formatMoney(totals.total)}</Text>
        </View>
        <Button
          title={checkingOut ? 'Procesando pedido...' : 'Pagar'}
          onPress={handleCheckout}
          loading={checkingOut}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

// --- Subcomponentes ---
const SegmentButton = ({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Ionicons name={icon} size={18} color={active ? '#fff' : Colors.textSecondary} />
    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const TotalRow = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <View style={styles.breakdownRow}>
    <Text style={styles.breakdownLabel}>{label}</Text>
    <Text style={[styles.breakdownValue, muted && { color: Colors.secondary }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 12 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 20, paddingHorizontal: 40 },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemImage: { width: 72, height: 72, borderRadius: 10, backgroundColor: Colors.border },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  removeBtn: { padding: 6, marginLeft: 8 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  couponBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
  },
  couponAppliedText: { flex: 1, color: Colors.secondary, fontWeight: '600', fontSize: 14 },
  errorText: { color: Colors.danger, fontSize: 13 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: '#fff' },
  addressInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  pickupList: { gap: 8 },
  pickupOption: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickupText: { fontSize: 14, color: Colors.textPrimary },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 14, color: Colors.textSecondary },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  footer: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 14,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: Colors.primary },
});
