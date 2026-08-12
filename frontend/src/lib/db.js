import Dexie from 'dexie';

// Inicializamos la base de datos local en el navegador
export const db = new Dexie('InspeccionesPWA');

// Definimos las tablas e índices para búsquedas rápidas
db.version(1).stores({
  recorridosPendientes: '++id, fecha, linea, sincronizado',
  piquetesPendientes: '++id, recorridoId, numeroPiquete, sincronizado'
});