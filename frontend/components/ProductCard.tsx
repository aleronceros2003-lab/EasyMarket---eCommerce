import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { Product, wishlistApi } from '../services/api';
import { formatMoney } from '../utils/format';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, compact = false }) => {
  const router = useRouter();
  const { user } = useAuth();
  const scale = useRef(new Animated.Value(1)).current;
  const hasDiscount = product.discount > 0;

  const [wished, setWished] = useState<boolean>(
    Array.isArray(user?.wishlist) && user.wishlist.includes(product.id)
  );
  const [togglingWish, setTogglingWish] = useState(false);

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const handleWish = async (e: { stopPropagation?: () => void }) => {
    if (e.stopPropagation) e.stopPropagation();
    if (!user) { router.push('/auth/login'); return; }
    try {
      setTogglingWish(true);
      if (wished) {
        await wishlistApi.remove(product.id);
        setWished(false);
      } else {
        await wishlistApi.add(product.id);
        setWished(true);
      }
    } catch {
      // fail silently
    } finally {
      setTogglingWish(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.card, compact && styles.cardCompact]}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
          {product.stock === 0 && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>Agotado</Text>
            </View>
          )}
          {/* Wishlist heart */}
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={handleWish}
            disabled={togglingWish}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons
              name={wished ? 'heart' : 'heart-outline'}
              size={20}
              color={wished ? Colors.danger : 'rgba(255,255,255,0.9)'}
            />
          </TouchableOpacity>
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
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11} color={Colors.star} />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardCompact: { marginBottom: 12 },
  image: { width: '100%', height: 170, backgroundColor: Colors.borderLight },
  imageCompact: { height: 130 },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { padding: 14 },
  infoCompact: { padding: 10 },
  category: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    lineHeight: 21,
  },
  nameCompact: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  priceWrap: {},
  price: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  priceCompact: { fontSize: 15 },
  oldPrice: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through', marginTop: 1 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: { fontSize: 12, color: Colors.warning, fontWeight: '700' },
});
