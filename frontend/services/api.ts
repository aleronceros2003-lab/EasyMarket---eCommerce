import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Cambia esto a la IP de tu backend al usar un dispositivo físico.
// Android Emulator: http://10.0.2.2:3001/api  |  Web/iOS Simulator: localhost
const API_BASE = 'http://192.168.68.119:3001/api';

const getToken = (): Promise<string | null> => AsyncStorage.getItem('token');

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  auth = false
): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) Object.assign(headers, await authHeaders());

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204/sin contenido: no intentamos parsear.
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }
  return data as T;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authApi = {
  register: (payload: RegisterPayload) =>
    request<AuthResponse>('POST', '/auth/register', payload),

  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/login', { email, password }),

  getProfile: () => request<User>('GET', '/auth/profile', undefined, true),

  updateProfile: (payload: UpdateProfilePayload) =>
    request<User>('PUT', '/auth/profile', payload, true),
};

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
export const productsApi = {
  getAll: (params?: ProductQuery) => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.sort) query.append('sort', params.sort);
    if (params?.minPrice != null) query.append('minPrice', String(params.minPrice));
    if (params?.maxPrice != null) query.append('maxPrice', String(params.maxPrice));
    const qs = query.toString();
    return request<Product[]>('GET', `/products${qs ? `?${qs}` : ''}`);
  },

  getCategories: () => request<string[]>('GET', '/products/categories'),

  // Carrusel promocional: productos con descuento.
  getOffers: () => request<Product[]>('GET', '/products/offers'),

  // Recomendaciones personalizadas (requiere sesión).
  getRecommendations: (limit = 8) =>
    request<Product[]>('GET', `/products/recommendations?limit=${limit}`, undefined, true),

  // auth=true para que el backend registre la vista si hay sesión (optionalAuth).
  getById: (id: string) => request<Product>('GET', `/products/${id}`, undefined, true),
};

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------
export const cartApi = {
  getCart: () => request<Cart>('GET', '/cart', undefined, true),

  addItem: (productId: string, quantity = 1) =>
    request<CartMutationResponse>('POST', '/cart/items', { productId, quantity }, true),

  updateItem: (productId: string, quantity: number) =>
    request<CartMutationResponse>('PUT', `/cart/items/${productId}`, { quantity }, true),

  removeItem: (productId: string) =>
    request<CartMutationResponse>('DELETE', `/cart/items/${productId}`, undefined, true),

  clearCart: () => request<CartMutationResponse>('DELETE', '/cart', undefined, true),
};

// ---------------------------------------------------------------------------
// Cupones
// ---------------------------------------------------------------------------
export const couponsApi = {
  list: () => request<CouponSummary[]>('GET', '/coupons'),

  validate: (code: string, subtotal: number) =>
    request<CouponValidation>('POST', '/coupons/validate', { code, subtotal }, true),
};

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
export const ordersApi = {
  checkout: (payload: CheckoutPayload) =>
    request<Order>('POST', '/orders/checkout', payload, true),

  getOrders: () => request<Order[]>('GET', '/orders', undefined, true),

  getOrder: (id: string) => request<Order>('GET', `/orders/${id}`, undefined, true),

  updateStatus: (id: string, status: OrderStatus) =>
    request<Order>('PATCH', `/orders/${id}/status`, { status }, true),

  /**
   * Descarga la boleta en PDF. En web fuerza la descarga; en nativo guarda el
   * archivo y abre el diálogo de compartir.
   */
  downloadReceipt: async (orderId: string): Promise<string | void> => {
    const token = await getToken();
    const url = `${API_BASE}/orders/${orderId}/receipt`;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    if (Platform.OS === 'web') {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('No se pudo generar la boleta');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = (globalThis as any).document;
      const a = doc.createElement('a');
      a.href = objectUrl;
      a.download = `boleta-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      return;
    }

    const fileUri = `${FileSystem.documentDirectory}boleta-${orderId}.pdf`;
    const { uri } = await FileSystem.downloadAsync(url, fileUri, { headers });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    return uri;
  },
};

// ---------------------------------------------------------------------------
// Reseñas / Valoraciones
// ---------------------------------------------------------------------------
export const reviewsApi = {
  create: (payload: ReviewPayload) => request<Review>('POST', '/reviews', payload, true),

  forProduct: (productId: string) =>
    request<ProductReview[]>('GET', `/reviews/product/${productId}`),
};

// ===========================================================================
// Tipos
// ===========================================================================
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  avatar?: string;
  emailAlerts?: boolean;
  viewedProductIds?: string[];
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  avatar?: string;
  emailAlerts?: boolean;
}

export type UpdateProfilePayload = Partial<
  Pick<User, 'name' | 'phone' | 'address' | 'avatar' | 'emailAlerts'>
> & {
  currentPassword?: string;
  newPassword?: string;
};

export type SortOption = '' | 'price_asc' | 'price_desc' | 'rating';

export interface ProductQuery {
  category?: string;
  search?: string;
  sort?: SortOption;
  minPrice?: number;
  maxPrice?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount: number; // % de descuento (0 = sin oferta)
  finalPrice: number; // precio ya con descuento aplicado
  category: string;
  image: string;
  stock: number;
  rating: number;
  ratingCount?: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
  subtotal: number;
}

export interface CartTotals {
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  shipping: number;
  total: number;
}

export interface Cart {
  items: CartItem[];
  totals: CartTotals;
}

export interface CartMutationResponse extends Cart {
  message: string;
}

export type CouponType = 'percentage' | 'fixed' | 'shipping';

export interface CouponSummary {
  code: string;
  type: CouponType;
  value: number;
  minPurchase: number;
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  type: CouponType;
  value: number;
  discount: number;
}

export type PaymentMethod = 'card' | 'cash_on_delivery';
export type DeliveryType = 'delivery' | 'pickup';
export type OrderStatus = 'preparing' | 'on_the_way' | 'delivered';

export interface CheckoutPayload {
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  shippingAddress?: string;
  pickupCenter?: string;
  couponCode?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  discount: number;
  finalPrice: number;
  quantity: number;
  image: string;
  subtotal: number;
}

export interface OrderStatusEntry {
  status: OrderStatus;
  at: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  productDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  shipping: number;
  total: number;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  shippingAddress: string | null;
  pickupCenter: string | null;
  status: OrderStatus;
  statusHistory: OrderStatusEntry[];
  rated: boolean;
  createdAt: string;
}

export interface ReviewPayload {
  orderId: string;
  appRating: number;
  deliveryRating: number;
  comment?: string;
  products: { productId: string; rating: number }[];
}

export interface Review extends ReviewPayload {
  id: string;
  userId: string;
  createdAt: string;
}

export interface ProductReview {
  rating: number;
  comment: string;
  createdAt: string;
}
