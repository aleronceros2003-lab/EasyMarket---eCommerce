import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { Colors } from '../../constants/Colors';
import { Order, OrderStatus, ordersApi, reviewsApi } from '../../services/api';
import {
  DELIVERY_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_LABELS,
  formatDateTime,
  formatMoney,
} from '../../utils/format';

const STATUS_FLOW: OrderStatus[] = ['preparing', 'on_the_way', 'delivered'];
const STATUS_ICONS: Record<OrderStatus, React.ComponentProps<typeof Ionicons>['name']> = {
  preparing: 'cube-outline',
  on_the_way: 'bicycle-outline',
  delivered: 'checkmark-done-outline',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Estado del formulario de valoración
  const [appRating, setAppRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadOrder = () => {
    ordersApi
      .getOrder(id)
      .then((o) => {
        setOrder(o);
        const init: Record<string, number> = {};
        o.items.forEach((it) => (init[it.productId] = 5));
        setProductRatings(init);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  };

  useEffect(loadOrder, [id]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await ordersApi.downloadReceipt(id);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo descargar la boleta');
    } finally {
      setDownloading(false);
    }
  };

  // Demo: avanza el estado (en producción lo haría el sistema/operaciones).
  const handleAdvance = async () => {
    if (!order) return;
    const next = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
    if (!next) return;
    try {
      setAdvancing(true);
      const updated = await ordersApi.updateStatus(id, next);
      setOrder(updated);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar el estado');
    } finally {
      setAdvancing(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!order) return;
    try {
      setSubmittingReview(true);
      await reviewsApi.create({
        orderId: order.id,
        appRating,
        deliveryRating,
        comment: comment.trim() || undefined,
        products: order.items.map((it) => ({
          productId: it.productId,
          rating: productRatings[it.productId] ?? 5,
        })),
      });
      Alert.alert('¡Gracias!', 'Tu valoración fue registrada.');
      loadOrder();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la valoración');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Ionicons name="receipt-outline" size={60} color={Colors.border} />
        <Text style={styles.errorText}>Pedido no encontrado</Text>
        <Button title="Volver" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Seguimiento de estado */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Estado del pedido</Text>
        <View style={styles.timeline}>
          {STATUS_FLOW.map((s, idx) => {
            const reached = idx <= currentIndex;
            return (
              <View key={s} style={styles.timelineStep}>
                <View style={[styles.timelineDot, reached && styles.timelineDotActive]}>
                  <Ionicons name={STATUS_ICONS[s]} size={18} color={reached ? '#fff' : Colors.textMuted} />
                </View>
                <Text style={[styles.timelineLabel, reached && styles.timelineLabelActive]}>
                  {ORDER_STATUS_LABELS[s]}
                </Text>
                {idx < STATUS_FLOW.length - 1 && (
                  <View style={[styles.timelineLine, idx < currentIndex && styles.timelineLineActive]} />
                )}
              </View>
            );
          })}
        </View>

        {order.status !== 'delivered' && (
          <Button
            title="Simular avance de estado"
            variant="outline"
            onPress={handleAdvance}
            loading={advancing}
            style={{ marginTop: 8 }}
          />
        )}
      </View>

      {/* Resumen */}
      <View style={styles.card}>
        <SummaryRow label="N° de pedido" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
        <SummaryRow label="Fecha" value={formatDateTime(order.createdAt)} />
        <SummaryRow label="Pago" value={PAYMENT_LABELS[order.paymentMethod]} />
        <SummaryRow label="Entrega" value={DELIVERY_LABELS[order.deliveryType]} />
        <SummaryRow
          label={order.deliveryType === 'pickup' ? 'Tienda' : 'Dirección'}
          value={(order.deliveryType === 'pickup' ? order.pickupCenter : order.shippingAddress) || '—'}
        />
        <Button
          title={downloading ? 'Generando boleta...' : 'Descargar boleta (PDF)'}
          variant="outline"
          onPress={handleDownload}
          loading={downloading}
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Ítems */}
      <Text style={styles.listTitle}>Productos</Text>
      {order.items.map((item, idx) => (
        <View key={idx} style={styles.itemRow}>
          <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.itemPrice}>
              {formatMoney(item.finalPrice)} × {item.quantity}
            </Text>
          </View>
          <Text style={styles.itemSubtotal}>{formatMoney(item.subtotal)}</Text>
        </View>
      ))}

      {/* Totales */}
      <View style={styles.card}>
        <SummaryRow label="Subtotal" value={formatMoney(order.subtotal)} />
        {order.productDiscount > 0 && (
          <SummaryRow label="Descuento productos" value={`− ${formatMoney(order.productDiscount)}`} />
        )}
        {order.couponDiscount > 0 && (
          <SummaryRow label={`Cupón ${order.couponCode ?? ''}`} value={`− ${formatMoney(order.couponDiscount)}`} />
        )}
        <SummaryRow label="Envío" value={order.shipping ? formatMoney(order.shipping) : 'Gratis'} />
        <View style={styles.totalDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatMoney(order.total)}</Text>
        </View>
      </View>

      {/* Valoración (solo si entregado y no valorado) */}
      {order.status === 'delivered' && !order.rated && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Valora tu experiencia</Text>

          <Text style={styles.ratingLabel}>Servicio / aplicativo</Text>
          <StarRating value={appRating} onChange={setAppRating} />

          <Text style={styles.ratingLabel}>Entrega</Text>
          <StarRating value={deliveryRating} onChange={setDeliveryRating} />

          <Text style={styles.ratingLabel}>Productos</Text>
          {order.items.map((it) => (
            <View key={it.productId} style={styles.productRatingRow}>
              <Text style={styles.productRatingName} numberOfLines={1}>
                {it.name}
              </Text>
              <StarRating
                value={productRatings[it.productId] ?? 5}
                onChange={(v) => setProductRatings((prev) => ({ ...prev, [it.productId]: v }))}
                size={20}
              />
            </View>
          ))}

          <TextInput
            style={styles.commentInput}
            placeholder="Comentario (opcional)"
            placeholderTextColor={Colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
          />

          <Button
            title="Enviar valoración"
            onPress={handleSubmitReview}
            loading={submittingReview}
            fullWidth
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      {order.rated && (
        <View style={styles.ratedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
          <Text style={styles.ratedText}>Ya valoraste este pedido. ¡Gracias!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 18, color: Colors.textSecondary, marginTop: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  timeline: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineStep: { flex: 1, alignItems: 'center' },
  timelineDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  timelineLabelActive: { color: Colors.textPrimary, fontWeight: '600' },
  timelineLine: {
    position: 'absolute',
    top: 20,
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 1,
  },
  timelineLineActive: { backgroundColor: Colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  summaryValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  itemImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: Colors.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  itemPrice: { fontSize: 13, color: Colors.textSecondary },
  itemSubtotal: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  totalAmount: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  productRatingName: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  commentInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 12,
  },
  ratedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
  },
  ratedText: { color: Colors.secondary, fontWeight: '600', fontSize: 14 },
});
