
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * Llamada genérica a la API.
 * - Agrega headers JSON
 * - Soporta body como objeto
 * - Lanza error si status != 2xx
 * - Timeout opcional con AbortController
 */
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
    // Mensajes más claros para UI
    if (err.name === "AbortError") throw new Error("Timeout de red");
    throw err;
  } finally {
    clearTimeout(t);
  }
}

function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}
