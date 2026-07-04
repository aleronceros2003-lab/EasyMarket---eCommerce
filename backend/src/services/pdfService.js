'use strict';

const PDFDocument = require('pdfkit');

const STATUS_LABELS = {
  preparing: 'En almacén',
  on_the_way: 'En camino',
  at_door: 'En domicilio',
  delivered: 'Entregado',
  finalized: 'Finalizado',
};

const money = (n) => `S/ ${Number(n).toFixed(2)}`;

const _buildDoc = (order, user, doc) => {
  // Encabezado
  doc.fontSize(22).fillColor('#1a73e8').text('EasyMarket', { align: 'left' });
  doc.fontSize(10).fillColor('#666').text('Boleta de Venta Electrónica');
  doc.moveDown(0.5);
  doc.fillColor('#000').fontSize(10);
  doc.text(`N° de pedido: ${order.id}`);
  doc.text(`Fecha: ${new Date(order.createdAt).toLocaleString('es-PE')}`);
  doc.text(`Estado: ${STATUS_LABELS[order.status] || order.status}`);
  doc.moveDown();

  // Datos del cliente
  doc.fontSize(12).fillColor('#1a73e8').text('Datos del cliente');
  doc.fontSize(10).fillColor('#000');
  doc.text(`Cliente: ${user?.name || '—'}`);
  doc.text(`Correo: ${user?.email || '—'}`);
  if (order.deliveryType === 'pickup') {
    doc.text(`Entrega: Recojo en tienda — ${order.pickupCenter || '—'}`);
  } else {
    doc.text(`Entrega: Delivery — ${order.shippingAddress || '—'}`);
  }
  doc.text(`Pago: ${order.paymentMethod === 'cash_on_delivery' ? 'Contraentrega' : 'Tarjeta'}`);
  doc.moveDown();

  // Tabla de ítems
  const tableTop = doc.y;
  const colX = { name: 50, qty: 320, price: 380, subtotal: 470 };

  doc.fontSize(10).fillColor('#1a73e8');
  doc.text('Producto', colX.name, tableTop);
  doc.text('Cant.', colX.qty, tableTop);
  doc.text('P. Unit.', colX.price, tableTop);
  doc.text('Subtotal', colX.subtotal, tableTop);
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#cccccc').stroke();

  let y = tableTop + 22;
  doc.fillColor('#000');
  for (const item of order.items) {
    doc.text(item.name, colX.name, y, { width: 260 });
    doc.text(String(item.quantity), colX.qty, y);
    doc.text(money(item.price), colX.price, y);
    doc.text(money(item.subtotal), colX.subtotal, y);
    y += 20;
  }

  // Totales
  doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#cccccc').stroke();
  y += 15;

  const totalLine = (label, value, opts = {}) => {
    doc.fontSize(opts.bold ? 12 : 10).fillColor(opts.bold ? '#000' : '#444');
    doc.text(label, 350, y);
    doc.text(value, 470, y);
    y += opts.bold ? 22 : 16;
  };

  totalLine('Subtotal:', money(order.subtotal));
  if (order.productDiscount) totalLine('Desc. productos:', `- ${money(order.productDiscount)}`);
  if (order.couponDiscount) {
    totalLine(`Cupón (${order.couponCode || ''}):`, `- ${money(order.couponDiscount)}`);
  }
  totalLine('Envío:', order.shipping ? money(order.shipping) : 'Gratis');
  totalLine('TOTAL:', money(order.total), { bold: true });

  // Pie
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text('Gracias por tu compra en EasyMarket.', 50, 760, { align: 'center', width: 495 });
};

/**
 * Genera la boleta como PDF y la escribe en el stream de respuesta.
 */
const streamReceipt = (order, user, stream) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(stream);
  _buildDoc(order, user, doc);
  doc.end();
};

/**
 * Genera la boleta como Buffer (para adjuntar en emails).
 */
const generateReceiptBuffer = (order, user) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    _buildDoc(order, user, doc);
    doc.end();
  });

module.exports = { streamReceipt, generateReceiptBuffer };
