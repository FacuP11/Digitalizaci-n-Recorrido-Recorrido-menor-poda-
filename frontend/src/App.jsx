import { useEffect, useState } from "react";
import { api } from "./lib/api.js";
import "./index.css"; // asegurate de importar Tailwind

export default function App() {
  const [recorridos, setRecorridos] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await api("/recorridos"); // GET lista
        setRecorridos(list);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Recorridos</h1>

      {loading && <div className="text-sm text-gray-600">Cargando...</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}

      <ul className="divide-y">
        {recorridos.map(r => (
          <li key={r.id} className="py-3">
            <div className="font-medium">Línea {r.linea} ({r.kv} kV)</div>
            <div className="text-sm text-gray-600">Entre {r.entre_desde} y {r.entre_hasta}</div>
            <div className="text-xs text-gray-500">OT {r.ot_numero} • {r.estado}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
