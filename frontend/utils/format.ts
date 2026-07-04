export const ORDER_STATUS_LABELS: Record<string, string> = {
  preparing: 'En almacÃ©n',
  on_the_way: 'En camino',
  at_door: 'En domicilio',
  delivered: 'Entregado',
  finalized: 'Finalizado',
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: 'Efectivo al entregar',
  card: 'Tarjeta',
};

export const DELIVERY_LABELS: Record<string, string> = {
  delivery: 'Delivery a domicilio',
  pickup: 'Recojo en tienda',
};

export function formatMoney(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}