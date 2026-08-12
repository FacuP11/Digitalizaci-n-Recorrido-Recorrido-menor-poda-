import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { sincronizarDatosPendientes } from '../lib/syncService';

export function BannerConectividad() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Cuenta automáticamente cuántos registros pendientes hay en IndexedDB
  const pendientesCount = useLiveQuery(
    () => db.piquetesPendientes.where('sincronizado').equals(0).count(),
    []
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`p-2 text-center font-bold text-white ${isOnline ? 'bg-green-600' : 'bg-amber-600'}`}>
      {isOnline ? 'Conectado (En línea)' : 'Sin conexión (Modo Offline activo)'}
      {pendientesCount > 0 && (
        <span className="ml-3 underline cursor-pointer" onClick={sincronizarDatosPendientes}>
          ({pendientesCount} pendientes por sincronizar - Haz clic para subir)
        </span>
      )}
    </div>
  );
}
export default  BannerConectividad();