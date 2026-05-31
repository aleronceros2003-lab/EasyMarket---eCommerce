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

module.exports = { sendMail, notifyOffer, getTransporter };
