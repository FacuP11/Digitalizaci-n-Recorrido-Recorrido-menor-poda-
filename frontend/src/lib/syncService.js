import { db } from './db';
import axios from 'axios';

export async function sincronizarDatosPendientes() {
  if (!navigator.onLine) return;

  const piquetesNoSincronizados = await db.piquetesPendientes
    .where('sincronizado')
    .equals(0)
    .toArray();

  if (piquetesNoSincronizados.length === 0) return;

  console.log(`Iniciando sincronización de ${piquetesNoSincronizados.length} registros...`);

  for (const piquete of piquetesNoSincronizados) {
    try {
      // Intentamos enviar al backend
      await axios.post('/api/piquetes', piquete);
      
      // Si el backend responde OK (200/201), marcamos o eliminamos de la BD local
      await db.piquetesPendientes.delete(piquete.id);
    } catch (err) {
      console.error(`Error al sincronizar piquete ID local ${piquete.id}:`, err);
    }
  }
}

// Listener global para detectar cuando vuelve el internet automáticamente
window.addEventListener('online', () => {
  sincronizarDatosPendientes();
});