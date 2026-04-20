import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/register" options={{ headerShown: false }} />
          <Stack.Screen
            name="product/[id]"
            options={{
              headerShown: true,
              title: 'Product Detail',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="order/[id]"
            options={{
              headerShown: true,
              title: 'Order Detail',
              headerBackTitle: 'Back',
            }}
          />
        </Stack>
      </CartProvider>
    </AuthProvider>
  );
}
