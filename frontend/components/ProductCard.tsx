import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Product } from '../services/api';
import { formatMoney } from '../utils/format';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, compact = false }) => {
  const router = useRouter();
  const hasDiscount = product.discount > 0;

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      activeOpacity={0.85}
      onPress={() => router.push(`/product/${product.id}` as never)}
    >
      <View>
        <Image
          source={{ uri: product.image }}
          style={[styles.image, compact && styles.imageCompact]}
          resizeMode="cover"
        />
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{product.discount}%</Text>
          </View>
        )}
      </View>

      <View style={[styles.info, compact && styles.infoCompact]}>
        <Text style={styles.category}>{product.category}</Text>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.footer}>
          <View style={styles.priceWrap}>
            <Text style={[styles.price, compact && styles.priceCompact]}>
              {formatMoney(product.finalPrice)}
            </Text>
            {hasDiscount && <Text style={styles.oldPrice}>{formatMoney(product.price)}</Text>}
          </View>
          <View style={styles.rating}>
            <Text style={styles.star}>★</Text>
            <Text style={styles.ratingText}>{product.rating}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardCompact: { marginBottom: 12 },
  image: { width: '100%', height: 160, backgroundColor: Colors.border },
  imageCompact: { height: 120 },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.discount,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  info: { padding: 12 },
  infoCompact: { padding: 10 },
  category: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
  },
  nameCompact: { fontSize: 14, marginBottom: 6, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceWrap: { flexDirection: 'column' },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  priceCompact: { fontSize: 15 },
  oldPrice: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { color: Colors.star, fontSize: 14 },
  ratingText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
});
