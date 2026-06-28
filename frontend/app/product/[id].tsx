import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { Colors, Gradients } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { API_SOCKET_BASE, Product, ProductReview, productsApi, reviewsApi, wishlistApi } from '../../services/api';
import { formatDate, formatMoney } from '../../utils/format';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wished, setWished] = useState<boolean>(
    Array.isArray(user?.wishlist) && user.wishlist.includes(id)
  );
  const [togglingWish, setTogglingWish] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const handleWish = async () => {
    if (!user) { router.push('/auth/login'); return; }
    try {
      setTogglingWish(true);
      if (wished) { await wishlistApi.remove(id); setWished(false); }
      else { await wishlistApi.add(id); setWished(true); }
    } catch { /* fail silently */ } finally { setTogglingWish(false); }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    productsApi.getById(id)
      .then((p) => active && setProduct(p))
      .catch(() => active && setProduct(null))
      .finally(() => active && setLoading(false));
    reviewsApi.forProduct(id)
      .then((r) => active && setReviews(r))
      .catch(() => active && setReviews([]));
    return () => { active = false; };
  }, [id]);

  // Socket.io: real-time stock updates
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const socket = io(API_SOCKET_BASE, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_product', id);
    socket.on('stock_updated', ({ productId, stock }: { productId: string; stock: number }) => {
      if (productId === id) {
        setProduct((prev) => (prev ? { ...prev, stock } : prev));
      }
    });
    return () => {
      socket.emit('leave_product', id);
      socket.disconnect();
    };
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert('Inicia sesión', 'Para agregar productos al carrito necesitas una cuenta.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar sesión', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    if (!product) return;
    try {
      setAddingToCart(true);
      await addItem(product.id, qty);
      Alert.alert('¡Agregado!', `${product.name} (×${qty}) en tu carrito.`, [
        { text: 'Seguir comprando', style: 'cancel' },
        { text: 'Ver carrito', onPress: () => router.push('/(tabs)/cart') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo agregar');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={60} color={Colors.border} />
        <Text style={styles.errorText}>Producto no encontrado</Text>
        <Button title="Volver" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const hasDiscount = product.discount > 0;
  const savingAmount = hasDiscount ? product.price - product.finalPrice : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Imagen */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="contain" />
          {hasDiscount && (
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{product.discount}%</Text>
            </LinearGradient>
          )}
          {product.stock === 0 && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Agotado</Text>
            </View>
          )}
          <TouchableOpacity style={styles.heartBtn} onPress={handleWish} disabled={togglingWish}>
            <Ionicons
              name={wished ? 'heart' : 'heart-outline'}
              size={24}
              color={wished ? Colors.danger : 'rgba(255,255,255,0.9)'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Categoría y rating */}
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.category}>{product.category}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color={Colors.star} />
              <Text style={styles.rating}>
                {product.rating.toFixed(1)}
                {product.ratingCount ? ` (${product.ratingCount})` : ''}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{product.name}</Text>

          {/* Precios */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatMoney(product.finalPrice)}</Text>
              {hasDiscount && <Text style={styles.oldPrice}>{formatMoney(product.price)}</Text>}
            </View>
            {hasDiscount && (
              <View style={styles.savingBadge}>
                <Ionicons name="trending-down" size={13} color={Colors.secondary} />
                <Text style={styles.savingText}>Ahorras {formatMoney(savingAmount)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.description}>{product.description}</Text>

          {/* Stock */}
          <View style={[styles.stockRow, { backgroundColor: product.stock > 0 ? '#ECFDF5' : Colors.dangerLight }]}>
            <Ionicons
              name={product.stock > 0 ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={product.stock > 0 ? Colors.secondary : Colors.danger}
            />
            <Text style={[styles.stockText, { color: product.stock > 0 ? Colors.secondary : Colors.danger }]}>
              {product.stock > 0 ? `${product.stock} unidades disponibles` : 'Sin stock'}
            </Text>
          </View>

          {/* Cantidad */}
          {product.stock > 0 && (
            <View style={styles.qtySection}>
              <Text style={styles.qtyLabel}>Cantidad</Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity
                  style={[styles.qtyBtn, qty <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                >
                  <Ionicons name="remove" size={20} color={qty <= 1 ? Colors.textMuted : Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  style={[styles.qtyBtn, qty >= product.stock && styles.qtyBtnDisabled]}
                  onPress={() => setQty((q) => Math.min(product.stock, q + 1))}
                  disabled={qty >= product.stock}
                >
                  <Ionicons name="add" size={20} color={qty >= product.stock ? Colors.textMuted : Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Reseñas */}
          {reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Reseñas de clientes</Text>
              {reviews.slice(0, 5).map((r, idx) => (
                <View key={idx} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <StarRating value={r.rating} size={14} readonly />
                    <Text style={styles.reviewDate}>{formatDate(r.createdAt)}</Text>
                  </View>
                  {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.subtotalRow}>
          <View>
            <Text style={styles.subtotalLabel}>Subtotal ({qty} ud.)</Text>
            <Text style={styles.subtotalAmount}>{formatMoney(product.finalPrice * qty)}</Text>
          </View>
          <Button
            title="Agregar al carrito"
            onPress={handleAddToCart}
            loading={addingToCart}
            disabled={product.stock === 0}
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 18, color: Colors.textSecondary, marginTop: 12 },
  imageContainer: { backgroundColor: Colors.surface, position: 'relative' },
  image: { width: '100%', height: 320, backgroundColor: Colors.borderLight },
  discountBadge: {
    position: 'absolute', top: 16, left: 16,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
  },
  discountBadgeText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  outOfStockBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  outOfStockText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  heartBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 20 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  category: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  rating: { fontSize: 13, fontWeight: '700', color: Colors.warning },
  name: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, lineHeight: 28, marginBottom: 14, letterSpacing: -0.3 },
  priceSection: { marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 6 },
  price: { fontSize: 28, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5 },
  oldPrice: { fontSize: 17, color: Colors.textMuted, textDecorationLine: 'line-through', marginBottom: 4 },
  savingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  savingText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 23, marginBottom: 16 },
  stockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, marginBottom: 20,
  },
  stockText: { fontSize: 14, fontWeight: '600' },
  qtySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  qtyLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  qtyBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnDisabled: { borderColor: Colors.border },
  qtyText: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, minWidth: 28, textAlign: 'center' },
  reviewsSection: { marginTop: 4 },
  reviewsTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14, letterSpacing: -0.2 },
  reviewCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewDate: { fontSize: 12, color: Colors.textMuted },
  reviewComment: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  footer: {
    backgroundColor: Colors.surface, padding: 20,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtotalLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  subtotalAmount: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },
});
