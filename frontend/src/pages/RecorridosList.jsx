import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function RecorridosList() {
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  // Estado para controlar qué pestaña vemos
  const [tab, setTab] = useState("PENDIENTES"); // 'PENDIENTES' | 'HISTORIAL'

  // ESTADOS PARA EL FILTRO Y BORRADO MASIVO
  const [filtroLinea, setFiltroLinea] = useState("");
  const [deletingBulk, setDeletingBulk] = useState(false);
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
      setData(list => list.filter(r => r.id !== id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setDeletingId(null);
    }
  } 

  // --- FUNCIÓN: BORRADO MASIVO ---
  async function borrarFiltrados(listaABorrar) {
    const cantidad = listaABorrar.length;
    if (cantidad === 0) return;

    const confirmacion = window.prompt(
      `⚠️ ATENCIÓN: ACCIÓN DESTRUCTIVA\n\nEstás por eliminar permanentemente ${cantidad} recorridos finalizados (incluyendo sus anomalías).\n\nPara confirmar, escribe la palabra BORRAR en mayúsculas:`
    );

    if (confirmacion !== "BORRAR") {
      if (confirmacion !== null) alert("Operación cancelada: No se escribió la palabra exacta.");
      return;
    }

    try {
      setDeletingBulk(true);
      // Borramos uno por uno de forma segura para no saturar el servidor
      for (const r of listaABorrar) {
        await api(`/recorridos/${r.id}`, { method: "DELETE" });
      }
      
      // Actualizamos la lista local sacando los que acabamos de borrar
      setData(list => list.filter(r => !listaABorrar.some(borrado => borrado.id === r.id)));
      setFiltroLinea(""); // Reseteamos el filtro
      alert(`✅ Limpieza exitosa: Se borraron ${cantidad} recorridos.`);
      
    } catch (e) {
      setErr("Ocurrió un error al borrar masivamente: " + e.message);
    } finally {
      setDeletingBulk(false);
    }
  }


  // --- LÓGICA DE FILTRADO ---
  const pendientes = data.filter(r => !r.estado || r.estado === 'PENDIENTE');
  const historial = data.filter(r => r.estado === 'COMPLETO' || r.estado === 'EMERGENCIA');

  // Ordenar historial: Lo último finalizado arriba
  historial.sort((a, b) => new Date(b.fecha_fin || b.updatedAt) - new Date(a.fecha_fin || a.updatedAt));

  // Extraer las líneas únicas que existen en el historial para armar el select
  const lineasDisponibles = [...new Set(historial.map(r => r.linea))].filter(Boolean);

  // Aplicar filtro de línea si hay uno seleccionado
  const historialFiltrado = filtroLinea 
    ? historial.filter(r => r.linea === filtroLinea) 
    : historial;

  // Seleccionamos cuál lista mostrar según la pestaña
  const listaVisible = tab === "PENDIENTES" ? pendientes : historialFiltrado;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-900">Mis Recorridos</h1>
            <Link to="/recorridos/nuevo" className="px-4 py-2 rounded bg-blue-600 text-white font-bold text-sm shadow hover:bg-blue-700">
                + Nuevo
            </Link>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN */}
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button 
                onClick={() => setTab("PENDIENTES")}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${tab === "PENDIENTES" ? "bg-white text-blue-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
                PENDIENTES ({pendientes.length})
            </button>
            <button 
                onClick={() => setTab("HISTORIAL")}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${tab === "HISTORIAL" ? "bg-white text-blue-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
                HISTORIAL ({historial.length})
            </button>
        </div>

        {/* CONTROLES EXTRA (SOLO PARA HISTORIAL) */}
        {tab === "HISTORIAL" && historial.length > 0 && (
          <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
             <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">Filtro de Limpieza</span>
             </div>
             
             <div className="flex gap-2">
                <select 
                   className="flex-1 border-gray-300 rounded text-sm p-2 bg-white"
                   value={filtroLinea}
                   onChange={(e) => setFiltroLinea(e.target.value)}
                >
                   <option value="">Todas las líneas</option>
                   {lineasDisponibles.map(linea => (
                      <option key={linea} value={linea}>{linea}</option>
                   ))}
                </select>
                
                <button 
                   onClick={() => borrarFiltrados(historialFiltrado)}
                   disabled={deletingBulk}
                   className={`px-3 py-2 text-xs font-bold text-white rounded shadow-sm ${deletingBulk ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}
                >
                   {deletingBulk ? "Borrando..." : `Borrar (${historialFiltrado.length})`}
                </button>
             </div>
          </div>
        )}

      </header>

      {loading && <p className="text-center text-gray-500 py-4">Cargando datos...</p>}
      {err && <div className="bg-red-100 text-red-700 p-3 rounded text-sm text-center font-bold">{err}</div>}

      {!loading && listaVisible.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-400">
              {tab === "PENDIENTES" ? "No hay recorridos en curso." : "El historial está limpio."}
            </p>
        </div>
      )}

      <ul className="space-y-3">
        {listaVisible.map(r => {
            let borderClass = "border-l-4 border-l-blue-500"; 
            let bgClass = "bg-white";
            
            if (r.estado === 'COMPLETO') {
                borderClass = "border-l-4 border-l-emerald-500";
            } else if (r.estado === 'EMERGENCIA') {
                borderClass = "border-l-4 border-l-orange-500 bg-orange-50";
            }

            return (
              <li key={r.id} className={`relative rounded-r-lg border border-gray-200 shadow-sm overflow-hidden ${bgClass} ${borderClass}`}>
                <div className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                            Línea {r.linea} <span className="text-gray-400 font-normal">({r.kv} kV)</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                            OT: {r.ot_numero}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            Tramo: {r.entre_desde} ➝ {r.entre_hasta}
                        </div>
                        
                        {tab === "HISTORIAL" && r.fecha_fin && (
                            <div className="text-xs text-gray-400 mt-1">
                                Finalizado: {new Date(r.fecha_fin).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {(!r.estado || r.estado === 'PENDIENTE') && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded uppercase">En Proceso</span>}
                        {r.estado === 'COMPLETO' && <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase">Completo</span>}
                        {r.estado === 'EMERGENCIA' && <span className="px-2 py-1 bg-orange-200 text-orange-900 text-[10px] font-bold rounded uppercase animate-pulse">Emergencia</span>}
                    </div>
                  </div>

                  {r.estado === 'EMERGENCIA' && r.motivo_cierre && (
                    <div className="mt-2 text-xs text-orange-800 bg-orange-100 p-2 rounded">
                        <strong>Motivo:</strong> {r.motivo_cierre}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2">
                     <Link to={`/recorridos/${r.id}/piquetes`} className="text-blue-600 font-bold text-sm hover:underline">
                        {tab === "PENDIENTES" ? "Continuar Recorrido →" : "Ver Reporte →"}
                     </Link>

                     <button
                        onClick={() => borrar(r.id)}
                        disabled={deletingId === r.id || deletingBulk}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                     >
                        {deletingId === r.id ? "Eliminando..." : "Eliminar"}
                     </button>
                  </div>
                </div>
              </li>
            );
        })}
      </ul>
    </div>
  );
}