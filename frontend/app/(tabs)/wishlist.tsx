import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/Button';
import { Colors, Gradients } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { Product, wishlistApi } from '../../services/api';
import { formatMoney } from '../../utils/format';

export default function WishlistScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setProducts(await wishlistApi.get());
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchWishlist(); }, [fetchWishlist]));

  const handleRemove = (product: Product) => {
    Alert.alert('Quitar de favoritos', `¿Quitar "${product.name}" de tu lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive',
        onPress: async () => {
          try {
            await wishlistApi.remove(product.id);
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <LinearGradient colors={Gradients.primary} style={styles.emptyIcon}>
          <Ionicons name="heart-outline" size={36} color="#fff" />
        </LinearGradient>
        <Text style={styles.emptyTitle}>Guarda tus favoritos</Text>
        <Text style={styles.emptySubtitle}>Inicia sesión para ver tu lista de deseos</Text>
        <Button title="Iniciar sesión" onPress={() => router.push('/auth/login')} style={styles.btn} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchWishlist(); }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          products.length > 0 ? (
            <LinearGradient colors={Gradients.primaryDark} style={styles.header}>
              <Ionicons name="heart" size={24} color="#fff" />
              <Text style={styles.headerText}>{products.length} producto{products.length !== 1 ? 's' : ''} guardado{products.length !== 1 ? 's' : ''}</Text>
            </LinearGradient>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.88}
            onPress={() => router.push(`/product/${item.id}` as never)}
          >
            <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            {item.discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{item.discount}%</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatMoney(item.finalPrice)}</Text>
                {item.discount > 0 && <Text style={styles.oldPrice}>{formatMoney(item.price)}</Text>}
              </View>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color={Colors.star} />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                <View style={[styles.stock, { backgroundColor: item.stock > 0 ? '#ECFDF5' : Colors.dangerLight }]}>
                  <Text style={[styles.stockText, { color: item.stock > 0 ? Colors.secondary : Colors.danger }]}>
                    {item.stock > 0 ? 'En stock' : 'Agotado'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
              <Ionicons name="heart-dislike-outline" size={20} color={Colors.danger} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <LinearGradient colors={Gradients.primary} style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Sin favoritos aún</Text>
            <Text style={styles.emptySubtitle}>Toca el corazón en cualquier producto para guardarlo aquí</Text>
            <Button title="Explorar productos" onPress={() => router.push('/(tabs)')} style={styles.btn} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 20 },
  list: { padding: 16, gap: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 16, marginBottom: 4,
  },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 18,
    overflow: 'hidden', alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  image: { width: 90, height: 90, backgroundColor: Colors.borderLight },
  discountBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: Colors.danger, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  info: { flex: 1, padding: 12 },
  category: { fontSize: 10, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, lineHeight: 19, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  oldPrice: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: Colors.warning, fontWeight: '700', marginRight: 4 },
  stock: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  stockText: { fontSize: 11, fontWeight: '600' },
  removeBtn: { padding: 16 },
});
