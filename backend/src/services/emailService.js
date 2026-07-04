'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/env');

/**
 * Crea el transporte de nodemailer.
 * - Si hay SMTP configurado (SMTP_HOST + SMTP_USER), envía de verdad.
 * - Si no, usa `jsonTransport`: "envía" a la consola sin red. Ideal para dev.
 */
let transporter;
const getTransporter = () => {
  if (transporter) return transporter;

  if (config.email.host && config.email.user) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: { user: config.email.user, pass: config.email.pass },
      tls: { rejectUnauthorized: false },
    });
  } else {
    // Sin SMTP real: no envía nada, solo loguea el contenido.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
};

/**
 * Envía un correo. Nunca lanza: si falla, loguea y devuelve false, para no
 * romper el flujo principal (las alertas son secundarias).
 * @param {{ to: string, subject: string, html: string, text?: string }} mail
 * @returns {Promise<boolean>}
 */
const sendMail = async ({ to, subject, html, text, attachments }) => {
  try {
    const info = await getTransporter().sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html,
      ...(attachments?.length ? { attachments } : {}),
    });
    if (!config.email.host) {
      console.log(`[EMAIL:simulado] Para: ${to} | Asunto: ${subject}`);
    }
    return Boolean(info);
  } catch (err) {
    console.error('[EMAIL] Error al enviar:', err.message);
    return false;
  }
};

/**
 * Notifica a un usuario sobre productos en oferta relacionados a sus intereses.
 * Pensado para descuentos por encima del umbral (config.email.offerThreshold).
 * @param {object} user
 * @param {object[]} products  Productos en oferta (con name, discount, price).
 */
const notifyOffer = async (user, products) => {
  if (!user?.emailAlerts || !products.length) return false;

  const rows = products
    .map(
      (p) =>
        `<li><strong>${p.name}</strong> — ${p.discount}% de descuento ` +
        `(antes S/ ${p.price.toFixed(2)})</li>`
    )
    .join('');

  const html = `
    <h2>¡Ofertas para ti en EasyMarket!</h2>
    <p>Hola ${user.name}, encontramos ofertas relacionadas a tus intereses:</p>
    <ul>${rows}</ul>
    <p>Aprovecha antes de que se agoten.</p>
  `;

  return sendMail({
    to: user.email,
    subject: '🔥 Ofertas con más de 50% de descuento para ti',
    html,
    text: products.map((p) => `${p.name}: ${p.discount}% OFF`).join('\n'),
  });
};

/**
 * Notifica a un usuario que un producto de su lista de favoritos está en oferta.
 * @param {object} user  Usuario con { name, email, emailAlerts }
 * @param {object} product  Producto con { name, price, discount }
 */
const sendWishlistOfferEmail = async (user, product) => {
  if (!user?.email) return false;
  const discountedPrice = Math.round(product.price * (1 - product.discount / 100) * 100) / 100;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">
      <div style="background:linear-gradient(135deg,#052E1C,#10B981);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">¡Tu favorito está en oferta!</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB;">
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Un producto que guardaste en favoritos acaba de recibir un descuento exclusivo:</p>
        <div style="border:2px solid #10B981;border-radius:12px;padding:20px;margin:20px 0;text-align:center;background:#F0FDF4;">
          <p style="font-size:18px;font-weight:bold;color:#052E1C;margin:0 0 8px;">${product.name}</p>
          <p style="font-size:32px;color:#EF4444;font-weight:900;margin:0;">${product.discount}% OFF</p>
          <p style="color:#6B7280;margin:8px 0 0;">
            Antes: <s>S/ ${product.price.toFixed(2)}</s>&nbsp;&nbsp;→&nbsp;&nbsp;
            <span style="color:#10B981;font-weight:bold;font-size:18px;">S/ ${discountedPrice.toFixed(2)}</span>
          </p>
        </div>
        <p>Aprovecha antes de que se agote el stock.</p>
        <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
          Recibiste este correo porque activaste las alertas de EasyMarket.
          Puedes desactivarlas en tu perfil.
        </p>
      </div>
    </div>
  `;
  return sendMail({
    to: user.email,
    subject: `🔥 Tu favorito "${product.name}" tiene ${product.discount}% OFF`,
    html,
    text: `Hola ${user.name}! "${product.name}" ahora tiene ${product.discount}% de descuento. Precio: S/ ${discountedPrice.toFixed(2)}`,
  });
};

const STATUS_LABELS = {
  preparing: 'En almacén',
  on_the_way: 'En camino',
  at_door: 'En domicilio',
  delivered: 'Entregado',
  finalized: 'Finalizado',
};

const STATUS_ICONS = {
  preparing: '📦',
  on_the_way: '🚴',
  at_door: '🏠',
  delivered: '✅',
  finalized: '🎉',
};

const _baseWrapper = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">
    <div style="background:linear-gradient(135deg,#052E1C,#10B981);padding:28px 24px;border-radius:16px 16px 0 0;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;">EasyMarket</h1>
    </div>
    <div style="background:#fff;padding:28px 24px;border-radius:0 0 16px 16px;border:1px solid #E5E7EB;">
      ${content}
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0;">
        © EasyMarket · Este correo fue enviado automáticamente, no respondas a este mensaje.
      </p>
    </div>
  </div>`;

/**
 * Bienvenida al registrarse.
 */
const sendWelcomeEmail = async (user) => {
  if (!user?.email) return false;
  const html = _baseWrapper(`
    <h2 style="color:#052E1C;margin-top:0;">¡Bienvenido a EasyMarket, ${user.name}! 🎉</h2>
    <p>Tu cuenta ha sido creada exitosamente. Ya puedes disfrutar de todos nuestros productos con los mejores precios.</p>
    <div style="background:#F0FDF4;border:1px solid #10B981;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#052E1C;"><strong>📧 Correo:</strong> ${user.email}</p>
    </div>
    <p>Explora nuestras ofertas, guarda tus favoritos y recibe notificaciones cuando bajen de precio.</p>
    <p>¡Gracias por unirte!</p>`);
  return sendMail({
    to: user.email,
    subject: '¡Bienvenido a EasyMarket! Tu cuenta está lista',
    html,
    text: `Bienvenido ${user.name}! Tu cuenta en EasyMarket fue creada exitosamente.`,
  });
};

/**
 * Confirmación de compra con boleta PDF adjunta.
 * @param {object} user
 * @param {object} order
 * @param {Buffer} pdfBuffer  Buffer del PDF generado por generateReceiptBuffer()
 */
const sendOrderConfirmationEmail = async (user, order, pdfBuffer) => {
  if (!user?.email) return false;

  const itemRows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 4px;border-bottom:1px solid #F3F4F6;">${i.name}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #F3F4F6;text-align:center;">${i.quantity}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #F3F4F6;text-align:right;">S/ ${Number(i.subtotal).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const html = _baseWrapper(`
    <h2 style="color:#052E1C;margin-top:0;">✅ ¡Compra confirmada!</h2>
    <p>Hola <strong>${user.name}</strong>, recibimos tu pedido y ya está en proceso.</p>
    <div style="background:#F0FDF4;border:1px solid #10B981;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 6px;color:#052E1C;"><strong>N° de pedido:</strong> #${order.id.slice(-8).toUpperCase()}</p>
      <p style="margin:0;color:#052E1C;"><strong>Estado:</strong> 📦 En almacén</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#F9FAFB;">
          <th style="padding:8px 4px;text-align:left;color:#6B7280;">Producto</th>
          <th style="padding:8px 4px;text-align:center;color:#6B7280;">Cant.</th>
          <th style="padding:8px 4px;text-align:right;color:#6B7280;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="margin-top:16px;text-align:right;">
      ${order.productDiscount ? `<p style="margin:4px 0;color:#6B7280;">Desc. productos: -S/ ${Number(order.productDiscount).toFixed(2)}</p>` : ''}
      ${order.couponDiscount ? `<p style="margin:4px 0;color:#6B7280;">Cupón: -S/ ${Number(order.couponDiscount).toFixed(2)}</p>` : ''}
      <p style="margin:4px 0;color:#6B7280;">Envío: ${order.shipping ? `S/ ${Number(order.shipping).toFixed(2)}` : 'Gratis'}</p>
      <p style="margin:8px 0 0;font-size:18px;font-weight:bold;color:#052E1C;">Total: S/ ${Number(order.total).toFixed(2)}</p>
    </div>
    <p style="margin-top:20px;color:#6B7280;font-size:13px;">
      Te notificaremos por correo cada vez que cambie el estado de tu pedido.<br>
      La boleta electrónica está adjunta en este correo.
    </p>`);

  return sendMail({
    to: user.email,
    subject: `✅ Pedido confirmado #${order.id.slice(-8).toUpperCase()} — EasyMarket`,
    html,
    text: `Compra confirmada. Total: S/ ${Number(order.total).toFixed(2)}. Pedido: #${order.id.slice(-8).toUpperCase()}`,
    attachments: pdfBuffer
      ? [{ filename: `boleta-${order.id.slice(-8)}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [],
  });
};

/**
 * Notificación de cambio de estado del pedido.
 * @param {object} user
 * @param {object} order  Pedido ya con el nuevo status
 * @param {string} newStatus
 */
const sendOrderStatusEmail = async (user, order, newStatus) => {
  if (!user?.email) return false;
  const label = STATUS_LABELS[newStatus] || newStatus;
  const icon = STATUS_ICONS[newStatus] || '📦';

  const messages = {
    on_the_way: 'Tu pedido ya salió y está en camino hacia ti. El repartidor lo llevará a tu dirección.',
    at_door: '¡El repartidor está en tu puerta! Por favor, prepárate para recibirlo.',
    delivered: 'El repartidor confirmó la entrega de tu pedido. ¡Esperamos que lo disfrutes!',
    finalized: '¡Tu pedido ha sido finalizado! Ya puedes confirmar la entrega y calificarnos en la app.',
  };

  const bodyText = messages[newStatus] || `Tu pedido ha cambiado de estado a: ${label}.`;

  const html = _baseWrapper(`
    <h2 style="color:#052E1C;margin-top:0;">${icon} Actualización de tu pedido</h2>
    <p>Hola <strong>${user.name}</strong>,</p>
    <p>${bodyText}</p>
    <div style="background:#F0FDF4;border:2px solid #10B981;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 8px;color:#6B7280;font-size:13px;">Estado actual</p>
      <p style="margin:0;font-size:22px;font-weight:bold;color:#052E1C;">${icon} ${label}</p>
      <p style="margin:8px 0 0;color:#6B7280;font-size:13px;">Pedido #${order.id.slice(-8).toUpperCase()}</p>
    </div>
    ${newStatus === 'finalized' ? `
    <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:#92400E;">⭐ <strong>¿Te gustó tu experiencia?</strong> Abre la app y califícanos. Tu opinión nos ayuda a mejorar.</p>
    </div>` : ''}
    <p style="color:#9CA3AF;font-size:13px;">Total del pedido: <strong>S/ ${Number(order.total).toFixed(2)}</strong></p>`);

  return sendMail({
    to: user.email,
    subject: `${icon} Tu pedido está ${label} — EasyMarket`,
    html,
    text: `${bodyText} Pedido #${order.id.slice(-8).toUpperCase()}`,
  });
};

module.exports = { sendMail, notifyOffer, sendWishlistOfferEmail, sendWelcomeEmail, sendOrderConfirmationEmail, sendOrderStatusEmail, getTransporter };
