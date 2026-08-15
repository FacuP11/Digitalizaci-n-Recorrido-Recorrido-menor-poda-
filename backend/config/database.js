import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Si existe DATABASE_URL en la nube, la usa. Si no, usa tu local para cuando programes en tu PC.
const dbUrl = process.env.DATABASE_URL;

const sequelize = dbUrl 
  ? new Sequelize(dbUrl, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false } // Obligatorio para Neon y Render
      }
    })
  : new Sequelize('planillas', process.env.DB_USER, process.env.DB_PASS, { // <-- Pon tus datos locales aquí
      host: 'localhost',
      dialect: 'postgres',
    });

export default sequelize;
