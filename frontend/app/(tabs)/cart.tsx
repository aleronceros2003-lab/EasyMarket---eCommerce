import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { PaymentGateway } from '../../components/PaymentGateway';
import { Colors, Gradients } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import * as Location from 'expo-location';
import {
  AddPaymentMethodPayload,
  CouponValidation,
  DeliveryType,
  PaymentMethod,
  PaymentMethodSaved,
  PickupCenter,
  authApi,
  configApi,
  couponsApi,
  ordersApi,
  pointsApi,
} from '../../services/api';
import { formatMoney } from '../../utils/format';

export default function CartScreen() {
  const { cart, loading, updateItem, removeItem, refreshCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [address, setAddress] = useState(user?.address ?? '');
  const [pickupCenters, setPickupCenters] = useState<PickupCenter[]>([]);
  const [pickupCenter, setPickupCenter] = useState<PickupCenter | null>(null);
  const [locating, setLocating] = useState(false);
  const [savedCards, setSavedCards] = useState<PaymentMethodSaved[]>([]);
  const [showGateway, setShowGateway] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsInput, setPointsInput] = useState('');
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [redeemingPoints, setRedeemingPoints] = useState(false);

  useEffect(() => {
    configApi.getPickupCenters().then((centers) => {
      setPickupCenters(centers);
      if (centers.length > 0 && !pickupCenter) setPickupCenter(centers[0]);
    }).catch(() => {});

    if (user) {
      authApi.getPaymentMethods().then(setSavedCards).catch(() => {});
      pointsApi.get().then((res) => setAvailablePoints(res.points)).catch(() => {});
    }
  }, [user]);

  const handleFindNearest = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa el permiso de ubicación para encontrar la tienda más cercana.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const nearest = pickupCenters.reduce((best, center) => {
        const dist = Math.hypot(center.lat - latitude, center.lng - longitude);
        const bestDist = Math.hypot(best.lat - latitude, best.lng - longitude);
        return dist < bestDist ? center : best;
      });
      setPickupCenter(nearest);
      Alert.alert('Tienda más cercana', `${nearest.name}\n${nearest.address}`);
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación.');
    } finally {
      setLocating(false);
    }
  };

  const totals = useMemo(() => {
    const { subtotal, productDiscount, shipping: deliveryShipping } = cart.totals;
    const couponDiscount = coupon?.discount ?? 0;
    const shipping = deliveryType === 'pickup' || coupon?.type === 'shipping' ? 0 : deliveryShipping;
    const total = Math.max(0, subtotal - couponDiscount - pointsDiscount) + shipping;
    return { subtotal, productDiscount, couponDiscount, pointsDiscount, shipping, total };
  }, [cart.totals, coupon, deliveryType, pointsDiscount]);

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

  const handleRedeemPoints = async () => {
    const pts = Number(pointsInput);
    if (!pts || pts < 100) { Alert.alert('Mínimo 100 puntos', 'Debes canjear al menos 100 puntos.'); return; }
    if (pts > availablePoints) { Alert.alert('Puntos insuficientes', `Solo tienes ${availablePoints} puntos.`); return; }
    try {
      setRedeemingPoints(true);
      const res = await pointsApi.redeem(pts);
      setPointsDiscount(res.discount);
      setAvailablePoints(res.remainingPoints);
      setPointsInput('');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo canjear');
    } finally {
      setRedeemingPoints(false);
    }
  };

  const removePointsDiscount = () => {
    setPointsDiscount(0);
    setAvailablePoints((prev) => prev + Math.round(pointsDiscount * 100));
  };

  const doCheckout = async () => {
    const order = await ordersApi.checkout({
      paymentMethod,
      deliveryType,
      shippingAddress: deliveryType === 'delivery' ? address.trim() : undefined,
      pickupCenter: deliveryType === 'pickup' ? pickupCenter?.name : undefined,
      couponCode: coupon?.code,
    });
    await refreshCart();
    removeCoupon();
    return order;
  };

  const handlePay = async () => {
    if (deliveryType === 'delivery' && !address.trim()) {
      Alert.alert('Falta la dirección', 'Ingresa una dirección de envío para continuar.');
      return;
    }
    if (paymentMethod === 'card') {
      setShowGateway(true);
      return;
    }
    // Contraentrega — cobro directo sin modal
    try {
      setCheckingOut(true);
      const order = await doCheckout();
      Alert.alert('¡Pedido realizado!', 'Tu pedido fue confirmado. ¡Gracias por tu compra!', [
        { text: 'Ver pedido', onPress: () => router.push(`/order/${order.id}` as never) },
        { text: 'Seguir comprando', onPress: () => router.push('/(tabs)') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo completar el pedido');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleGatewaySuccess = async (cardData: AddPaymentMethodPayload | null) => {
    setShowGateway(false);
    try {
      setCheckingOut(true);
      if (cardData) {
        // Guardar tarjeta en paralelo (no bloqueante)
        authApi.addPaymentMethod(cardData)
          .then((m) => setSavedCards((prev) => [...prev, m]))
          .catch(() => {});
      }
      const order = await doCheckout();
      Alert.alert('¡Pedido realizado!', 'Tu pedido fue confirmado. ¡Gracias por tu compra!', [
        { text: 'Ver pedido', onPress: () => router.push(`/order/${order.id}` as never) },
        { text: 'Seguir comprando', onPress: () => router.push('/(tabs)') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo completar el pedido');
    } finally {
      setCheckingOut(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <LinearGradient colors={Gradients.primary} style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={40} color="#fff" />
        </LinearGradient>
        <Text style={styles.emptyTitle}>Inicia sesión para continuar</Text>
        <Text style={styles.emptySubtitle}>Agrega productos y guarda tu carrito</Text>
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
        <LinearGradient colors={Gradients.primary} style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={40} color="#fff" />
        </LinearGradient>
        <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
        <Text style={styles.emptySubtitle}>Agrega productos para comenzar</Text>
        <Button title="Buscar productos" onPress={() => router.push('/(tabs)')} style={styles.btn} />
      </SafeAreaView>
    );
  }

  const itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <PaymentGateway
        visible={showGateway}
        total={totals.total}
        savedCards={savedCards}
        onSuccess={handleGatewaySuccess}
        onCancel={() => setShowGateway(false)}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Ítems */}
        <Text style={styles.sectionHeader}>
          {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
        </Text>
        {cart.items.map((item) => (
          <View key={item.productId} style={styles.cartItem}>
            <Image source={{ uri: item.product.image }} style={styles.itemImage} resizeMode="cover" />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
              <Text style={styles.itemPrice}>{formatMoney(item.product.finalPrice)}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() =>
                    item.quantity <= 1 ? removeItem(item.productId) : updateItem(item.productId, item.quantity - 1)
                  }
                >
                  <Ionicons name="remove" size={15} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateItem(item.productId, item.quantity + 1)}
                >
                  <Ionicons name="add" size={15} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.itemSubtotal}>{formatMoney(item.subtotal)}</Text>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() =>
                  Alert.alert('Eliminar', '¿Eliminar este artículo del carrito?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => removeItem(item.productId) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Cupón */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetag-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Cupón de descuento</Text>
          </View>
          {coupon ? (
            <View style={styles.couponApplied}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
              <Text style={styles.couponAppliedText}>
                {coupon.code} — −{formatMoney(coupon.discount)}
              </Text>
              <TouchableOpacity onPress={removeCoupon}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Código de cupón"
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

        {/* Puntos */}
        {availablePoints >= 100 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="trophy-outline" size={16} color={Colors.warning} />
              <Text style={styles.sectionTitle}>Puntos de fidelización</Text>
            </View>
            <Text style={styles.pointsAvail}>Tienes {availablePoints} puntos (100 pts = S/ 1.00 off)</Text>
            {pointsDiscount > 0 ? (
              <View style={styles.couponApplied}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
                <Text style={styles.couponAppliedText}>{Math.round(pointsDiscount * 100)} pts canjeados — −{formatMoney(pointsDiscount)}</Text>
                <TouchableOpacity onPress={removePointsDiscount}>
                  <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Puntos a canjear (mín. 100)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  value={pointsInput}
                  onChangeText={setPointsInput}
                />
                <TouchableOpacity style={styles.couponBtn} onPress={handleRedeemPoints} disabled={redeemingPoints}>
                  {redeemingPoints ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.couponBtnText}>Canjear</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Entrega */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Tipo de entrega</Text>
          </View>
          <View style={styles.segment}>
            <SegmentButton icon="bicycle-outline" label="Delivery" active={deliveryType === 'delivery'} onPress={() => setDeliveryType('delivery')} />
            <SegmentButton icon="storefront-outline" label="Recojo en tienda" active={deliveryType === 'pickup'} onPress={() => setDeliveryType('pickup')} />
          </View>

          {deliveryType === 'delivery' ? (
            <TextInput
              style={styles.addressInput}
              placeholder="Dirección de envío completa"
              placeholderTextColor={Colors.textMuted}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          ) : (
            <View style={styles.pickupList}>
              <TouchableOpacity style={styles.nearestBtn} onPress={handleFindNearest} disabled={locating}>
                <Ionicons name="navigate-outline" size={15} color={Colors.primary} />
                <Text style={styles.nearestBtnText}>
                  {locating ? 'Buscando...' : 'Encontrar tienda más cercana'}
                </Text>
              </TouchableOpacity>
              {pickupCenters.map((center) => (
                <TouchableOpacity
                  key={center.name}
                  style={styles.pickupOption}
                  onPress={() => setPickupCenter(center)}
                >
                  <View style={[styles.radioOuter, pickupCenter?.name === center.name && styles.radioOuterActive]}>
                    {pickupCenter?.name === center.name && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickupText}>{center.name}</Text>
                    <Text style={styles.pickupAddress}>{center.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Método de pago */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="card-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Método de pago</Text>
          </View>
          <View style={styles.segment}>
            <SegmentButton icon="card-outline" label="Tarjeta" active={paymentMethod === 'card'} onPress={() => setPaymentMethod('card')} />
            <SegmentButton icon="cash-outline" label="Contraentrega" active={paymentMethod === 'cash_on_delivery'} onPress={() => setPaymentMethod('cash_on_delivery')} />
          </View>
          {paymentMethod === 'card' && savedCards.length > 0 && (
            <View style={styles.savedCardHint}>
              <Ionicons name="shield-checkmark-outline" size={14} color={Colors.secondary} />
              <Text style={styles.savedCardHintText}>
                Tienes {savedCards.length} tarjeta{savedCards.length > 1 ? 's' : ''} guardada{savedCards.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Resumen */}
        <View style={styles.section}>
          <TotalRow label="Subtotal" value={formatMoney(totals.subtotal)} />
          {totals.productDiscount > 0 && (
            <TotalRow label="Ahorro en productos" value={`−${formatMoney(totals.productDiscount)}`} accent />
          )}
          {totals.couponDiscount > 0 && (
            <TotalRow label={`Cupón ${coupon?.code ?? ''}`} value={`−${formatMoney(totals.couponDiscount)}`} accent />
          )}
          {totals.pointsDiscount > 0 && (
            <TotalRow label="Puntos canjeados" value={`−${formatMoney(totals.pointsDiscount)}`} accent />
          )}
          <TotalRow label="Envío" value={totals.shipping > 0 ? formatMoney(totals.shipping) : 'Gratis 🎉'} />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>{itemCount} artículos</Text>
            <Text style={styles.totalAmount}>{formatMoney(totals.total)}</Text>
          </View>
          <Button
            title={
              checkingOut
                ? 'Procesando...'
                : paymentMethod === 'card'
                ? 'Pagar con tarjeta'
                : 'Confirmar pedido'
            }
            onPress={handlePay}
            loading={checkingOut}
            style={styles.payBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const SegmentButton = ({
  icon, label, active, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    {active ? (
      <LinearGradient colors={Gradients.primary} style={styles.segmentGradient}>
        <Ionicons name={icon} size={16} color="#fff" />
        <Text style={[styles.segmentText, styles.segmentTextActive]}>{label}</Text>
      </LinearGradient>
    ) : (
      <>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
        <Text style={styles.segmentText}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

const TotalRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <View style={styles.breakdownRow}>
    <Text style={styles.breakdownLabel}>{label}</Text>
    <Text style={[styles.breakdownValue, accent && { color: Colors.secondary }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 8 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: Colors.background,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 20, paddingHorizontal: 40 },
  sectionHeader: {
    fontSize: 13, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  cartItem: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 18, padding: 14, alignItems: 'flex-start',
    shadowColor: Colors.primary, shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3, gap: 12,
  },
  itemImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.borderLight },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginBottom: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1.5,
    borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },
  itemRight: { alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 },
  itemSubtotal: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  removeBtn: { padding: 4 },
  section: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  couponRow: { flexDirection: 'row', gap: 10 },
  couponInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary,
  },
  couponBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  couponBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  couponApplied: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12,
  },
  couponAppliedText: { flex: 1, color: Colors.secondary, fontWeight: '600', fontSize: 14 },
  errorText: { color: Colors.danger, fontSize: 13 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
  },
  segmentBtnActive: { borderColor: Colors.primary },
  segmentGradient: {
    position: 'absolute', inset: 0, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, padding: 13,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: '#fff' },
  addressInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary,
    minHeight: 64, textAlignVertical: 'top',
  },
  pickupList: { gap: 10 },
  pickupOption: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  pickupText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  pickupAddress: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  nearestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start',
  },
  nearestBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  savedCardHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10,
  },
  savedCardHintText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 14, color: Colors.textSecondary },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  footer: {
    backgroundColor: Colors.surface, padding: 20,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: Colors.textMuted },
  totalAmount: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  payBtn: { minWidth: 180 },
  pointsAvail: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
});
