import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Product } from '../services/api';
import { formatMoney } from '../utils/format';

interface ProductCarouselProps {
  title: string;
  products: Product[];
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products }) => {
  const router = useRouter();

  if (products.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={products}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const hasDiscount = item.discount > 0;
          return (
            <TouchableOpacity
              style={styles.slide}
              activeOpacity={0.85}
              onPress={() => router.push(`/product/${item.id}` as never)}
            >
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              {hasDiscount && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>-{item.discount}%</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, hasDiscount && styles.priceDiscount]}>
                    {formatMoney(item.finalPrice)}
                  </Text>
                  {hasDiscount && <Text style={styles.oldPrice}>{formatMoney(item.price)}</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 16, gap: 12 },
  slide: {
    width: 200,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  image: { width: '100%', height: 120, backgroundColor: Colors.border },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.discount,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  info: { padding: 12 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  priceDiscount: { color: Colors.discount },
  oldPrice: {
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
