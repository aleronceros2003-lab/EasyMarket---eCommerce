import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { ProductCard } from '../../components/ProductCard';
import { ProductCarousel } from '../../components/ProductCarousel';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { Product, productsApi, SortOption } from '../../services/api';

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Por defecto', value: '' },
  { label: 'Precio ↑', value: 'price_asc' },
  { label: 'Precio ↓', value: 'price_desc' },
  { label: 'Calificación', value: 'rating' },
];

const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: 'Todos' },
  { label: '< S/ 30', max: 30 },
  { label: 'S/ 30 – 80', min: 30, max: 80 },
  { label: '> S/ 80', min: 80 },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { token } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [offers, setOffers] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState<SortOption>('');
  const [priceIndex, setPriceIndex] = useState(0);
  const [error, setError] = useState('');

  const isWeb = Platform.OS === 'web';
  const numColumns = isWeb ? 3 : 1;
  const listMaxWidth = isWeb ? Math.min(width - 24, 1320) : width;

  const fetchProducts = useCallback(async () => {
    try {
      setError('');
      const range = PRICE_RANGES[priceIndex];
      const [prods, cats, offs] = await Promise.all([
        productsApi.getAll({
          category: selectedCategory || undefined,
          search: search || undefined,
          sort: sort || undefined,
          minPrice: range.min,
          maxPrice: range.max,
        }),
        productsApi.getCategories(),
        productsApi.getOffers(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setOffers(offs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, search, sort, priceIndex]);

  const fetchRecommendations = useCallback(async () => {
    if (!token) {
      setRecommendations([]);
      return;
    }
    try {
      setRecommendations(await productsApi.getRecommendations(8));
    } catch {
      setRecommendations([]);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    fetchProducts();
  }, [fetchProducts]);

  // Refresca recomendaciones cada vez que se vuelve a esta pantalla,
  // para reflejar los productos vistos recientemente.
  useFocusEffect(
    useCallback(() => {
      fetchRecommendations();
    }, [fetchRecommendations])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
    fetchRecommendations();
  };

  const ListHeader = (
    <View>
      <ProductCarousel title="🔥 Ofertas destacadas" products={offers} />

      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Categorías</Text>
        <ChipScroll isWeb={isWeb}>
          <Chip label="Todas" active={selectedCategory === ''} onPress={() => setSelectedCategory('')} />
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              active={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
            />
          ))}
        </ChipScroll>

        <Text style={styles.filterTitle}>Precio</Text>
        <ChipScroll isWeb={isWeb}>
          {PRICE_RANGES.map((r, idx) => (
            <Chip
              key={r.label}
              label={r.label}
              active={priceIndex === idx}
              onPress={() => setPriceIndex(idx)}
            />
          ))}
        </ChipScroll>

        <Text style={styles.filterTitle}>Ordenar por</Text>
        <ChipScroll isWeb={isWeb}>
          {SORT_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              variant="sort"
              active={sort === opt.value}
              onPress={() => setSort(opt.value)}
            />
          ))}
        </ChipScroll>
      </View>

      {recommendations.length > 0 && (
        <ProductCarousel title="Recomendado para ti" products={recommendations} />
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando productos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barra de búsqueda fija */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar productos..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        key={`products-${numColumns}`}
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? styles.gridItem : undefined}>
            <ProductCard product={item} compact={numColumns > 1} />
          </View>
        )}
        columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={[styles.list, { maxWidth: listMaxWidth }]}
        style={styles.listWrapper}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No se encontraron productos</Text>
          </View>
        }
      />
    </View>
  );
}

// --- Subcomponentes de UI ---

const Chip = ({
  label,
  active,
  onPress,
  variant = 'category',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  variant?: 'category' | 'sort';
}) => (
  <TouchableOpacity
    style={[
      variant === 'sort' ? styles.sortChip : styles.chip,
      active && (variant === 'sort' ? styles.sortChipActive : styles.chipActive),
    ]}
    onPress={onPress}
  >
    <Text
      style={[
        variant === 'sort' ? styles.sortChipText : styles.chipText,
        active && (variant === 'sort' ? styles.sortChipTextActive : styles.chipTextActive),
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const ChipScroll = ({ children, isWeb }: { children: React.ReactNode; isWeb: boolean }) =>
  isWeb ? (
    <View style={styles.wrapRow}>{children}</View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScrollContent}
    >
      {children}
    </ScrollView>
  );

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 15 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  filtersContainer: { marginHorizontal: 16, marginBottom: 8, gap: 8 },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipScrollContent: { paddingVertical: 2, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight },
  sortChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  sortChipTextActive: { color: '#fff' },
  list: { width: '100%', alignSelf: 'center', padding: 16, paddingTop: 4 },
  listWrapper: { flex: 1 },
  gridRow: { gap: 12 },
  gridItem: { flex: 1, minWidth: 0 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  errorText: { color: Colors.danger, fontSize: 14, flex: 1 },
  emptyText: { marginTop: 12, color: Colors.textMuted, fontSize: 16 },
});
