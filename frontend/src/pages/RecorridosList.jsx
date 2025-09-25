// PANTALLA 1
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function RecorridosList() {
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function cargar() {
    try {
      setErr("");
      setLoading(true);
      const list = await api("/recorridos");
      setData(list);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function borrar(id) {
    const ok = window.confirm("¿Seguro que querés eliminar este recorrido? Se borrarán sus piquetes y anomalías.");
    if (!ok) return;

    try {
      setDeletingId(id);
      await api(`/recorridos/${id}`, { method: "DELETE" });
      
      // refrescar
      setData(list => list.filter(r => r.id !== id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recorridos</h1>
        <Link to="/recorridos/nuevo" className="px-3 py-2 rounded bg-blue-600 text-white">Nuevo</Link>
      </header>

      {loading && <p className="text-sm text-gray-600">Cargando…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && data.length === 0 && (
        <p className="text-sm text-gray-600">No hay recorridos aún.</p>
      )}

      <ul className="divide-y">
        {data.map(r => (
          <li key={r.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Línea {r.linea} ({r.kv} kV)</div>
                <div className="text-sm text-gray-600">Entre {r.entre_desde} y {r.entre_hasta}</div>
                <div className="text-xs text-gray-500">OT {r.ot_numero} • {r.estado}</div>
              </div>

              <div className="flex items-center gap-2">
                <Link className="text-blue-700 underline" to={`/recorridos/${r.id}/piquetes`}>Abrir</Link>
                <button
                  onClick={() => borrar(r.id)}
                  disabled={deletingId === r.id}
                  className={`px-2 py-1 rounded ${
                    deletingId === r.id
                      ? "bg-red-400 text-white cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                  title="Eliminar recorrido"
                >
                  {deletingId === r.id ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
