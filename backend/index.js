// index.js
import { errorHandler } from './middlewares/errorHandler.js';
import recorridosRoutes from './routes/recorridos.js';
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Importa sequelize y modelos (esto inicializa la conexión)
const { sequelize } = require('./models');
const app = express();
// Middlewares
app.use(cors());
app.use(express.json());
// Healthchecks
app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/recorridos', recorridosRoutes);
app.use('/api/piquetes', piquetesRoutes);
app.use('/api/recorridos', recorridosRoutes);
// Rutas reales 
try {
  app.use('/recorridos', require('./routes/recorridos'));
} catch (e) {
  console.warn('Aviso: no se pudo montar /recorridos (¿archivo faltante?):', e.message);
}
try {
  app.use('/piquetes', require('./routes/piquetes'));
} catch (e) {
  console.warn('Aviso: no se pudo montar /piquetes (¿archivo faltante?):', e.message);
}

// Puerto
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Arranque
(async () => {
  try {
    console.log('→ Cargando .env...');
    console.log(`   DB_NAME=${process.env.DB_NAME}  DB_USER=${process.env.DB_USER}  HOST=${process.env.DB_HOST}  PORT=${PORT}`);

    console.log('→ Probando conexión a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✔ DB conectada');

    // Crea/actualiza tablas en dev
    await sequelize.sync(/* {force: true} */);
    console.log('✔ Tablas OK (sync)');

    app.listen(PORT, () => {
      console.log(`✔ API lista en http://localhost:${PORT}`);
      console.log('  Endpoints: /, /health, /recorridos, /piquetes');
    });
  } catch (e) {
    console.error('✖ Fallo al iniciar API:', e);
    process.exit(1);
  }
})()
app.use(errorHandler);
