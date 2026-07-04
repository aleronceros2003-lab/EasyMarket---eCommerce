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
const sendMail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html,
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

module.exports = { sendMail, notifyOffer, sendWishlistOfferEmail, getTransporter };