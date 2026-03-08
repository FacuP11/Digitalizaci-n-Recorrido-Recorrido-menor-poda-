import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function RecorridosList() {
  const [data, setData] = useState(null); // Iniciamos en null para saber que aún no cargó
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
      setLoading(true); // Prendemos el spinner
      const list = await api("/recorridos");
      
      // Aseguramos que lo que llegue sea una lista válida, si no, ponemos array vacío
      setData(Array.isArray(list) ? list : []); 
      
    } catch (e) {
      setErr("Error de conexión: " + e.message);
      setData([]); // Si falla, ponemos array vacío para que no explote
    } finally {
      setLoading(false); // APAGAMOS EL SPINNER SÍ O SÍ
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
  // (Deja tu función borrarFiltrados tal cual la tienes)
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
      for (const r of listaABorrar) {
        await api(`/recorridos/${r.id}`, { method: "DELETE" });
      }
      setData(list => list.filter(r => !listaABorrar.some(borrado => borrado.id === r.id)));
      setFiltroLinea("");
      alert(`✅ Limpieza exitosa: Se borraron ${cantidad} recorridos.`);
    } catch (e) {
      setErr("Ocurrió un error al borrar masivamente: " + e.message);
    } finally {
      setDeletingBulk(false);
    }
  }

  // ==========================================
  // PANTALLA DE CARGA 
  // ==========================================
  if (loading) {
      return (
          <div className="max-w-md mx-auto p-10 mt-20 text-center space-y-4">
              <div className="animate-spin text-4xl text-blue-600 mx-auto w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="text-gray-500 font-extrabold text-sm uppercase tracking-widest">Cargando recorridos...</p>
          </div>
      );
  }

  if (!data) {
      return <div className="p-10 text-center text-red-600 font-bold mt-10">❌ Error cargando la lista. {err}</div>;
  }

  // ==========================================
  // LÓGICA DE FILTRADO 
  // ==========================================
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
            <h1 className="text-2xl font-black text-blue-900 tracking-wide">Mis Recorridos</h1>
            <Link to="/recorridos/nuevo" className="px-5 py-2.5 rounded-lg bg-blue-700 text-white font-extrabold text-sm shadow-md hover:bg-blue-800 transition-colors uppercase tracking-wider">
                + Nuevo
            </Link>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN */}
        <div className="flex bg-gray-200 p-1.5 rounded-xl border-2 border-gray-300 shadow-inner">
            <button 
                onClick={() => setTab("PENDIENTES")}
                className={`flex-1 py-2 text-xs font-extrabold rounded-lg uppercase transition-all duration-200 ${tab === "PENDIENTES" ? "bg-white text-blue-900 shadow-md border-2 border-blue-600 scale-[1.02]" : "text-gray-600 hover:bg-gray-300 border-2 border-transparent"}`}
            >
                Pendientes ({pendientes.length})
            </button>
            <button 
                onClick={() => setTab("HISTORIAL")}
                className={`flex-1 py-2 text-xs font-extrabold rounded-lg uppercase transition-all duration-200 ${tab === "HISTORIAL" ? "bg-white text-blue-900 shadow-md border-2 border-blue-600 scale-[1.02]" : "text-gray-600 hover:bg-gray-300 border-2 border-transparent"}`}
            >
                Historial ({historial.length})
            </button>
        </div>

        {/* CONTROLES EXTRA (SOLO PARA HISTORIAL) */}
        {tab === "HISTORIAL" && historial.length > 0 && (
          <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border-2 border-gray-300 shadow-sm">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wide">Filtro de Limpieza</span>
             </div>
             
             <div className="flex gap-2">
                <select 
                   className="flex-1 border-2 border-gray-400 rounded-lg text-sm p-2 bg-white font-bold text-gray-800 outline-none focus:border-blue-600 transition-colors"
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
                  className={`px-4 py-2 text-xs font-extrabold text-white rounded-lg shadow-sm border-2 transition-all active:scale-95 ${deletingBulk ? 'bg-gray-500 border-gray-600 cursor-not-allowed' : 'bg-red-600 border-red-800 hover:bg-red-700'}`}
                >
                   {deletingBulk ? "⏳" : `Borrar (${historialFiltrado.length})`}
                </button>
             </div>
          </div>
        )}

      </header>

      {err && <div className="bg-red-100 border-2 border-red-500 text-red-800 p-3 rounded-xl text-sm text-center font-extrabold shadow-sm">{err}</div>}

      {listaVisible.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 mt-6">
            <span className="text-4xl block mb-2">{tab === "PENDIENTES" ? "📭" : "📂"}</span>
            <p className="text-gray-500 font-bold text-sm">
              {tab === "PENDIENTES" ? "No tienes recorridos en curso." : "El historial está limpio."}
            </p>
        </div>
      )}

      <ul className="space-y-4">
        {listaVisible.map(r => {
            let borderClass = "border-l-[6px] border-l-blue-600 border-blue-900"; 
            let bgClass = "bg-white";
            let estadoLabel = "EN PROCESO";
            let estadoBg = "bg-blue-100 text-blue-800 border-blue-300";
            
            if (r.estado === 'COMPLETO') {
                borderClass = "border-l-[6px] border-l-emerald-500 border-emerald-800";
                estadoLabel = "COMPLETO";
                estadoBg = "bg-emerald-100 text-emerald-800 border-emerald-300";
            } else if (r.estado === 'EMERGENCIA') {
                borderClass = "border-l-[6px] border-l-orange-500 border-orange-800 bg-orange-50";
                estadoLabel = "EMERGENCIA";
                estadoBg = "bg-orange-200 text-orange-900 border-orange-400 animate-pulse";
            }

            return (
              <li key={r.id} className={`relative rounded-xl border-2 shadow-sm overflow-hidden ${bgClass} ${borderClass}`}>
                <div className="p-4">
                  
                  {/* Fila 1: Títulos y Badges */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                        <div className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest mb-1">
                            Línea {r.linea} <span className="text-gray-400 font-normal">({r.kv} kV)</span>
                        </div>
                        <div className="text-xl font-black text-gray-900 leading-tight">
                            OT: {r.ot_numero}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-2">
                        <span className={`px-2 py-1 border text-[9px] font-extrabold rounded-md uppercase tracking-wider ${estadoBg}`}>
                            {estadoLabel}
                        </span>
                    </div>
                  </div>

                  {/* Fila 2: Detalles */}
                  <div className="text-sm font-bold text-gray-600 bg-gray-100 p-2 rounded-lg border border-gray-200 inline-block">
                      Tramo: {r.entre_desde} ➝ {r.entre_hasta}
                  </div>
                        
                  {tab === "HISTORIAL" && r.fecha_fin && (
                      <div className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide">
                          Finalizado el: {new Date(r.fecha_fin).toLocaleDateString()}
                      </div>
                  )}

                  {r.estado === 'EMERGENCIA' && r.motivo_cierre && (
                    <div className="mt-3 text-xs text-orange-900 bg-orange-100 p-2.5 rounded-lg border-2 border-orange-200 font-bold">
                        ⚠️ <span className="uppercase text-[10px]">Motivo:</span> {r.motivo_cierre}
                    </div>
                  )}

                  {/* Fila 3: Acciones (Botones) */}
                  <div className="mt-4 flex items-center justify-between border-t-2 border-gray-100 pt-3">
                     <Link to={`/recorridos/${r.id}/piquetes`} className="text-blue-700 font-extrabold text-sm uppercase tracking-wide flex items-center gap-1 hover:text-blue-900 transition-colors">
                        {tab === "PENDIENTES" ? "Continuar →" : "Ver Reporte →"}
                     </Link>

                     <button
                        onClick={() => borrar(r.id)}
                        disabled={deletingId === r.id || deletingBulk}
                        className="text-xs font-extrabold text-red-500 hover:text-red-700 uppercase tracking-wide disabled:text-gray-400 transition-colors"
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