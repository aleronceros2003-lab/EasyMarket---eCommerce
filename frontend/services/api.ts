import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const normalizeApiUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const getApiBase = (): string => {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig as { extra?: { apiUrl?: string } } | null)?.extra?.apiUrl;

  if (configuredUrl) return normalizeApiUrl(configuredUrl);

  if (Platform.OS === 'web') return 'http://localhost:3001/api';
  // En Expo Go, hostUri tiene la forma "192.168.x.x:8081"
  const hostUri: string | undefined =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    // Expo SDK 47+ manifest2 format (Expo Go)
    ((Constants as Record<string, unknown>).manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | null)?.extra?.expoClient?.hostUri ??
    // Legacy format
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3001/api`;
  }
  // Fallback: emulador Android
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  return 'http://localhost:3001/api';
};

const API_BASE = getApiBase();
export const API_SOCKET_BASE = API_BASE.replace('/api', '');

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

  getPaymentMethods: () =>
    request<PaymentMethodSaved[]>('GET', '/auth/payment-methods', undefined, true),

  addPaymentMethod: (payload: AddPaymentMethodPayload) =>
    request<PaymentMethodSaved>('POST', '/auth/payment-methods', payload, true),

  deletePaymentMethod: (id: string) =>
    request<{ message: string }>('DELETE', `/auth/payment-methods/${id}`, undefined, true),
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export interface PickupCenter {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const configApi = {
  getPickupCenters: () => request<PickupCenter[]>('GET', '/config/pickup-centers'),
  getShipping: () => request<{ deliveryCost: number; freeShippingThreshold: number }>('GET', '/config/shipping'),
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
  getOffers: () => request<Product[]>('GET', '/products/offers'),
  getRecommendations: (limit = 8) =>
    request<Product[]>('GET', `/products/recommendations?limit=${limit}`, undefined, true),
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
  submitComplaint: (id: string, text: string) =>
    request<Order>('POST', `/orders/${id}/complaint`, { text }, true),
  sendComplaintMessage: (id: string, text: string) =>
    request<Order>('POST', `/orders/${id}/complaint/message`, { text }, true),
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
// Reseñas
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
  paymentMethods?: PaymentMethodSaved[];
  role?: 'user' | 'admin';
  points?: number;
  wishlist?: string[];
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

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other';

export interface PaymentMethodSaved {
  id: string;
  brand: CardBrand;
  last4: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface AddPaymentMethodPayload {
  brand: CardBrand;
  last4: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
}

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
  discount: number;
  finalPrice: number;
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
export type OrderStatus = 'preparing' | 'on_the_way' | 'at_door' | 'delivered' | 'finalized';
export type ComplaintStatus = 'pending' | 'valid' | 'invalid';

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

export interface ComplaintMessage {
  sender: 'user' | 'admin';
  text: string;
  sentAt: string;
}

export interface OrderComplaint {
  text: string;
  status: ComplaintStatus;
  submittedAt: string;
  resolvedAt: string | null;
  messages: ComplaintMessage[];
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
  complaint: OrderComplaint | null;
  createdAt: string;
}

export interface ComplaintWithUser extends Order {
  user: { _id: string; name: string; email: string } | null;
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

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------
export const wishlistApi = {
  get: () => request<Product[]>('GET', '/wishlist', undefined, true),
  add: (productId: string) => request<Product[]>('POST', `/wishlist/${productId}`, undefined, true),
  remove: (productId: string) => request<Product[]>('DELETE', `/wishlist/${productId}`, undefined, true),
};

// ---------------------------------------------------------------------------
// Recomendaciones
// ---------------------------------------------------------------------------
export const recommendationsApi = {
  get: () => request<Product[]>('GET', '/recommendations', undefined, true),
};

// ---------------------------------------------------------------------------
// Puntos
// ---------------------------------------------------------------------------
export const pointsApi = {
  get: () => request<{ points: number; history: PointsHistoryItem[] }>('GET', '/points', undefined, true),
  redeem: (points: number) => request<{ discount: number; remainingPoints: number }>('POST', '/points/redeem', { points }, true),
};

// ---------------------------------------------------------------------------
// Notificaciones push
// ---------------------------------------------------------------------------
export const notificationsApi = {
  registerToken: (token: string) => request<void>('POST', '/notifications/token', { token }, true),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminApi = {
  getStats: () => request<AdminStats>('GET', '/admin/stats', undefined, true),
  getOrders: (params?: { status?: string; page?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ orders: Order[]; total: number }>('GET', `/admin/orders${qs ? `?${qs}` : ''}`, undefined, true);
  },
  updateOrderStatus: (id: string, status: OrderStatus) =>
    request<Order>('PATCH', `/admin/orders/${id}/status`, { status }, true),
  getUsers: (page = 1) =>
    request<{ users: User[]; total: number }>('GET', `/admin/users?page=${page}`, undefined, true),
  updateUserRole: (id: string, role: 'user' | 'admin') =>
    request<User>('PATCH', `/admin/users/${id}/role`, { role }, true),
  getProducts: () => request<Product[]>('GET', '/admin/products', undefined, true),
  createProduct: (data: Partial<Product>) => request<Product>('POST', '/admin/products', data, true),
  updateProduct: (id: string, data: Partial<Product>) => request<Product>('PUT', `/admin/products/${id}`, data, true),
  deleteProduct: (id: string) => request<void>('DELETE', `/admin/products/${id}`, undefined, true),
  getComplaints: (params?: { status?: string; page?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ orders: ComplaintWithUser[]; total: number }>('GET', `/admin/complaints${qs ? `?${qs}` : ''}`, undefined, true);
  },
  resolveComplaint: (orderId: string, status: 'valid' | 'invalid') =>
    request<Order>('PATCH', `/admin/complaints/${orderId}`, { status }, true),
  sendComplaintMessage: (orderId: string, text: string) =>
    request<Order>('POST', `/admin/complaints/${orderId}/message`, { text }, true),
};

// ---------------------------------------------------------------------------
// Tipos adicionales
// ---------------------------------------------------------------------------
export interface PointsHistoryItem {
  amount: number;
  reason: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  ordersByStatus: Record<string, number>;
  recentOrders: Order[];
  topProducts: { productId: string; name: string; image: string; totalSold: number }[];
  revenueByDay: { date: string; revenue: number }[];
}
