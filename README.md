# EasyMarket — eCommerce Platform

Proyecto realizado para el curso de Sistemas Móviles y Plataformas Menores.

An Expo Go mobile eCommerce application with a Node.js/Express backend.

---

## Features

- 🛍️ **Product Catalog** — Browse products with search, category filters and sorting
- 🛒 **Shopping Cart** — Add, update quantities, and remove items
- 👤 **Account Management** — Register, login, and edit your profile (name, phone, address, password)
- 📦 **Purchase History** — View all past orders with full detail view
- 🔒 **Authentication** — JWT-based auth with secure token storage

---

## Project Structure

```
EasyMarket/
├── backend/          # Node.js + Express REST API
│   └── src/
│       ├── routes/   # auth, products, cart, orders
│       ├── middleware/
│       └── data/     # JSON file-based storage
└── frontend/         # Expo (React Native) app
    ├── app/
    │   ├── (tabs)/   # Home, Cart, History, Profile tabs
    │   ├── auth/     # Login & Register screens
    │   ├── product/  # Product Detail screen
    │   └── order/    # Order Detail screen
    ├── components/   # Reusable UI components
    ├── context/      # AuthContext, CartContext
    ├── services/     # API client
    └── constants/    # Colors, etc.
```

---

## Getting Started

### 1. Start the Backend

```bash
cd backend
npm install
npm start
# Runs on http://localhost:3001
```

### 2. Start the Frontend

```bash
cd frontend
npm install
npm start
# Scan the QR code with the Expo Go app
```

> **Note:** If running on a physical device, update `API_BASE` in `frontend/services/api.ts`
> to use your machine's local IP address (e.g., `http://192.168.1.X:3001/api`).

---

## Backend API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register a new user |
| POST | `/api/auth/login` | — | Login and receive JWT |
| GET | `/api/auth/profile` | ✅ | Get current user profile |
| PUT | `/api/auth/profile` | ✅ | Update profile / password |
| GET | `/api/products` | — | List products (search, filter, sort) |
| GET | `/api/products/categories` | — | List categories |
| GET | `/api/products/:id` | — | Get product detail |
| GET | `/api/cart` | ✅ | Get current cart |
| POST | `/api/cart/items` | ✅ | Add item to cart |
| PUT | `/api/cart/items/:productId` | ✅ | Update item quantity |
| DELETE | `/api/cart/items/:productId` | ✅ | Remove item from cart |
| DELETE | `/api/cart` | ✅ | Clear cart |
| POST | `/api/orders/checkout` | ✅ | Place order from cart |
| GET | `/api/orders` | ✅ | Get purchase history |
| GET | `/api/orders/:id` | ✅ | Get order detail |

---

## Technologies

- **Frontend:** React Native, Expo SDK 53, expo-router, TypeScript
- **Backend:** Node.js, Express, JWT (jsonwebtoken), bcryptjs
- **Storage:** JSON file-based (no database required)
