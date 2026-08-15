// backend/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { errorHandler } from './middlewares/errorHandler.js';
import recorridosRoutes from './routes/recorridos.js';
import piquetesRoutes from './routes/piquetes.js';
import { sequelize } from './models/index.js';

dotenv.config();

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Healthchecks
app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Rutas de la API (soportan tanto /api/recorridos como /recorridos)
app.use('/api/recorridos', recorridosRoutes);
app.use('/recorridos', recorridosRoutes);

app.use('/api/piquetes', piquetesRoutes);
app.use('/piquetes', piquetesRoutes);

// Manejador global de errores (siempre al final de todas las rutas)
app.use(errorHandler);

// Puerto
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Arranque y sincronización de base de datos
(async () => {
  try {
    console.log('→ Cargando .env...');
    console.log(`   DB_NAME=${process.env.DB_NAME}  DB_USER=${process.env.DB_USER}  HOST=${process.env.DB_HOST}  PORT=${PORT}`);

    console.log('→ Probando conexión a PostgreSQL...');
    await sequelize.authenticate();
    console.log('✔ DB conectada');

    // Sincroniza modelos con la base de datos
    await sequelize.sync();
    console.log('✔ Tablas OK (sync)');

    app.listen(PORT, () => {
      console.log(`✔ API lista en http://localhost:${PORT}`);
      console.log('  Endpoints disponibles:');
      console.log('   - /api/recorridos y /recorridos');
      console.log('   - /api/piquetes y /piquetes');
      console.log('   - /health');
    });
  } catch (e) {
    console.error('✖ Fallo al iniciar API:', e);
    process.exit(1);
  }
})();