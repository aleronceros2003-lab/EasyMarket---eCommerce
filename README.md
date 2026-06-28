# EasyMarket — eCommerce

## Requisitos previos
- Node.js 18+
- npm
- Expo Go instalado en tu celular (o emulador Android/iOS)

---

## Backend

```bash
cd backend
npm install
npm start
```

El servidor corre en: `http://localhost:3001`

---

## Frontend

```bash
cd frontend
npm install
npx expo start
```

Luego en la terminal aparece un QR. Escanealo con la app **Expo Go** desde tu celular.

### Otras opciones de arranque

```bash
# Solo para Android (emulador o USB):
npx expo start --android

# Solo para iOS (solo Mac):
npx expo start --ios

# En el navegador web:
npx expo start --web
```

---

## Orden de arranque recomendado

1. Primero levanta el **backend** (`npm run dev`)
2. Luego arranca el **frontend** (`npx expo start`)
3. Abre Expo Go en tu celular y escanea el QR
