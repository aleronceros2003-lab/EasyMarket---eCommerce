import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartApi, Cart, CartTotals } from '../services/api';
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

const emptyTotals: CartTotals = {
  subtotal: 0,
  productDiscount: 0,
  couponDiscount: 0,
  shipping: 0,
  total: 0,
};

const emptyCart: Cart = { items: [], totals: emptyTotals };

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

  // Las mutaciones devuelven el carrito completo: lo usamos directamente
  // en lugar de hacer un GET extra.
  const addItem = async (productId: string, quantity = 1) => {
    const { items, totals } = await cartApi.addItem(productId, quantity);
    setCart({ items, totals });
  };

  const updateItem = async (productId: string, quantity: number) => {
    const { items, totals } = await cartApi.updateItem(productId, quantity);
    setCart({ items, totals });
  };

  const removeItem = async (productId: string) => {
    const { items, totals } = await cartApi.removeItem(productId);
    setCart({ items, totals });
  };

  const clearCart = async () => {
    const { items, totals } = await cartApi.clearCart();
    setCart({ items, totals });
  };

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, itemCount, loading, refreshCart, addItem, updateItem, removeItem, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
