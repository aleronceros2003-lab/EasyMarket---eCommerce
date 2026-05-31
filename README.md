Para correrlo

cd backend
npm install        # ahora incluye pdfkit y nodemailer
npm run seed       # reinicia usuarios/carritos/pedidos/reseñas (no toca catálogo)
npm run dev

cd frontend
npx expo install expo-file-system expo-sharing
npx expo start
