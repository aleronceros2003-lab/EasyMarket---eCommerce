const { MongoClient } = require('mongodb');

// URL de conexión 
const uri = "mongodb+srv://EM-adm:easypassword123@easymarket.2likkyr.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("Conectado exitosamente al cluster de MongoDB");

    // Seleccionar la base de datos
    const database = client.db('easymarket_db'); 
    const products = database.collection('products');

    // Datos de prueba (Seed data) - MongoDB crea el ID automáticamente
    const mockProducts = [
      {
        name: "Camiseta Deportiva Pro",
        type: "Ropa",
        price: 29.99,
        image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500"
      },
      {
        name: "Zapatillas Running Nitro",
        type: "Calzado",
        price: 89.99,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"
      },
      {
        name: "Termo Inteligente",
        type: "Accesorios",
        price: 19.99,
        image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500"
      }
    ];

    // Insertar los productos en la colección
    const result = await products.insertMany(mockProducts);
    console.log(`${result.insertedCount} productos insertados correctamente en el cluster.`);

  } finally {
    await client.close();
  }
}

run().catch(console.dir);