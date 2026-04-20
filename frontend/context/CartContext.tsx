import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartApi, Cart, CartItem } from '../services/api';
import { useAuth } from './AuthContext';

interface CartContextType {
  cart: Cart;
  itemCount: number;
  loading: boolean;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const emptyCart: Cart = { items: [], total: 0 };

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!token) {
      setCart(emptyCart);
      return;
    }
    try {
      setLoading(true);
      const data = await cartApi.getCart();
      setCart(data);
    } catch {
      setCart(emptyCart);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = async (productId: string, quantity = 1) => {
    await cartApi.addItem(productId, quantity);
    await refreshCart();
  };

  const updateItem = async (productId: string, quantity: number) => {
    await cartApi.updateItem(productId, quantity);
    await refreshCart();
  };

  const removeItem = async (productId: string) => {
    await cartApi.removeItem(productId);
    await refreshCart();
  };

  const clearCart = async () => {
    await cartApi.clearCart();
    setCart(emptyCart);
  };

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, itemCount, loading, refreshCart, addItem, updateItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
