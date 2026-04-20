import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your backend IP when running on a physical device
// Use 10.0.2.2 for Android Emulator, localhost for web/iOS simulator
const API_BASE = 'http://localhost:3001/api';

const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem('token');
};

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
  if (auth) {
    Object.assign(headers, await authHeaders());
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
};

// Auth
export const authApi = {
  register: (payload: { name: string; email: string; password: string; phone?: string; address?: string }) =>
    request<{ token: string; user: User }>('POST', '/auth/register', payload),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/login', { email, password }),

  getProfile: () => request<User>('GET', '/auth/profile', undefined, true),

  updateProfile: (payload: Partial<User> & { currentPassword?: string; newPassword?: string }) =>
    request<User>('PUT', '/auth/profile', payload, true),
};

// Products
export const productsApi = {
  getAll: (params?: { category?: string; search?: string; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.sort) query.append('sort', params.sort);
    const qs = query.toString();
    return request<Product[]>('GET', `/products${qs ? `?${qs}` : ''}`);
  },

  getCategories: () => request<string[]>('GET', '/products/categories'),

  getById: (id: string) => request<Product>('GET', `/products/${id}`),
};

// Cart
export const cartApi = {
  getCart: () => request<Cart>('GET', '/cart', undefined, true),

  addItem: (productId: string, quantity = 1) =>
    request<{ message: string; cart: CartItem[] }>('POST', '/cart/items', { productId, quantity }, true),

  updateItem: (productId: string, quantity: number) =>
    request<{ message: string; cart: CartItem[] }>('PUT', `/cart/items/${productId}`, { quantity }, true),

  removeItem: (productId: string) =>
    request<{ message: string; cart: CartItem[] }>('DELETE', `/cart/items/${productId}`, undefined, true),

  clearCart: () => request<{ message: string }>('DELETE', '/cart', undefined, true),
};

// Orders
export const ordersApi = {
  checkout: (shippingAddress: string, paymentMethod?: string) =>
    request<Order>('POST', '/orders/checkout', { shippingAddress, paymentMethod }, true),

  getOrders: () => request<Order[]>('GET', '/orders', undefined, true),

  getOrder: (id: string) => request<Order>('GET', `/orders/${id}`, undefined, true),
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  rating: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product?: Product;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  subtotal: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  shippingAddress: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}
