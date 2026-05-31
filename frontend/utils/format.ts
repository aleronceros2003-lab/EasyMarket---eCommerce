import type { OrderStatus, PaymentMethod, DeliveryType } from '../services/api';

/** Formatea un monto en soles peruanos. */
export const formatMoney = (n: number): string => `S/ ${Number(n || 0).toFixed(2)}`;

/** Fecha corta en español (Perú). */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

/** Fecha y hora largas en español (Perú). */
export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Etiquetas legibles de los estados de pedido. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  preparing: 'En preparación',
  on_the_way: 'En camino',
  delivered: 'Entregado',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card: 'Tarjeta',
  cash_on_delivery: 'Contraentrega',
};

export const DELIVERY_LABELS: Record<DeliveryType, string> = {
  delivery: 'Envío a domicilio',
  pickup: 'Recojo en tienda',
};
