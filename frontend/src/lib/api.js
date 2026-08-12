import {db} from "./db";
import axios from "axios";
// Detecta automáticamente la IP desde la barra de direcciones del navegador (Celular o PC local)
const IP_ACTUAL = window.location.hostname;

// Armamos la URL local dinámica
const LOCAL_URL = `http://${IP_ACTUAL}:4000`;

// Si estamos en desarrollo usa la URL dinámica. Si estamos en producción, usa Render.
const BASE = import.meta.env.DEV ? LOCAL_URL : "https://recorridos-api-backend.onrender.com";
export async function guardarPiquete(datosPiquete) {
  // Comprobamos si el dispositivo tiene conexión a internet
  if (navigator.onLine) {
    try {
      const response = await axios.post('/api/piquetes', datosPiquete);
      return { exito: true, modo: 'online', data: response.data };
    } catch (error) {
      // Si el servidor falla o la red se corta a mitad de petición, caemos al guardado local
      console.warn('Fallo el envio online. Guardando en modo offline...', error);
    }
  }

  // Guardado local en IndexedDB si estamos offline o si falló la red
  await db.piquetesPendientes.add({
    ...datosPiquete,
    sincronizado: 0,
    creadoEn: new Date().toISOString()
  });

  return { exito: true, modo: 'offline', mensaje: 'Guardado localmente sin conexión' };
}

export async function api(path, { method = "GET", body, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const txt = await res.text();
    const data = txt ? safeJson(txt) : null;

    if (!res.ok) {
      const msg = data?.error || res.statusText || "Error de red";
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Timeout de red. Verifique su conexión.");
    throw err;
  } finally {
    clearTimeout(t);
  }
}

function safeJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}