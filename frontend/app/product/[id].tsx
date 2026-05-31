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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { Product, ProductReview, productsApi, reviewsApi } from '../../services/api';
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    productsApi
      .getById(id)
      .then((p) => active && setProduct(p))
      .catch(() => active && setProduct(null))
      .finally(() => active && setLoading(false));

    reviewsApi
      .forProduct(id)
      .then((r) => active && setReviews(r))
      .catch(() => active && setReviews([]));

    return () => {
      active = false;
    };
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert(
        'Se requiere inicio de sesión',
        'Por favor, inicia sesión para agregar artículos a tu carrito.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar sesión', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    if (!product) return;
    try {
      setAddingToCart(true);
      await addItem(product.id, qty);
      Alert.alert('¡Agregado al carrito!', `${product.name} (×${qty}) agregado a tu carrito.`, [
        { text: 'Seguir comprando', style: 'cancel' },
        { text: 'Ver carrito', onPress: () => router.push('/(tabs)/cart') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo agregar el artículo');
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="contain" />
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{product.discount}%</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.categoryRow}>
            <Text style={styles.category}>{product.category}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={Colors.star} />
              <Text style={styles.rating}>
                {product.rating} {product.ratingCount ? `(${product.ratingCount})` : ''}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, hasDiscount && { color: Colors.discount }]}>
              {formatMoney(product.finalPrice)}
            </Text>
            {hasDiscount && <Text style={styles.oldPrice}>{formatMoney(product.price)}</Text>}
          </View>

          <Text style={styles.description}>{product.description}</Text>

          <View style={styles.stockRow}>
            <Ionicons
              name={product.stock > 0 ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={product.stock > 0 ? Colors.secondary : Colors.danger}
            />
            <Text
              style={[
                styles.stockText,
                { color: product.stock > 0 ? Colors.secondary : Colors.danger },
              ]}
            >
              {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
            </Text>
          </View>

          <View style={styles.qtySection}>
            <Text style={styles.qtyLabel}>Cantidad</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Ionicons name="remove" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQty((q) => Math.min(product.stock, q + 1))}
                disabled={qty >= product.stock}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={qty >= product.stock ? Colors.textMuted : Colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Reseñas */}
          {reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Reseñas ({reviews.length})</Text>
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

      <View style={styles.footer}>
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalAmount}>{formatMoney(product.finalPrice * qty)}</Text>
        </View>
        <Button
          title="Agregar al carrito"
          onPress={handleAddToCart}
          loading={addingToCart}
          disabled={product.stock === 0}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 18, color: Colors.textSecondary, marginTop: 12 },
  image: { width: '100%', height: 360, backgroundColor: Colors.border, alignSelf: 'center' },
  discountBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: Colors.discount,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  discountBadgeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  content: { padding: 20 },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: 10,
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 14 },
  price: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  oldPrice: {
    fontSize: 17,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    marginBottom: 3,
  },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  stockText: { fontSize: 14, fontWeight: '600' },
  qtySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  reviewsSection: { marginTop: 28 },
  reviewsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewDate: { fontSize: 12, color: Colors.textMuted },
  reviewComment: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  footer: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtotalLabel: { fontSize: 15, color: Colors.textSecondary },
  subtotalAmount: { fontSize: 20, fontWeight: '800', color: Colors.primary },
});
