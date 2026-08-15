import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function RecorridosList() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const [tab, setTab] = useState("PENDIENTES");
  const [filtroLinea, setFiltroLinea] = useState("");
  const [deletingBulk, setDeletingBulk] = useState(false);

  const handleDescargarExcel = (recorridoId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    window.open(`${API_URL}/recorridos/${recorridoId}/excel`, '_blank');
  };

  async function cargar() {
    try {
      setErr("");
      setLoading(true);
      const list = await api("/recorridos");
      setData(Array.isArray(list) ? list : []); 
    } catch (e) {
      setErr("Error de conexión: " + e.message);
      setData([]);
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

  if (loading) {
    return (
      <div className="max-w-md md:max-w-2xl mx-auto p-10 mt-20 text-center space-y-4">
        <div className="animate-spin text-4xl text-blue-600 mx-auto w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        <p className="text-slate-500 dark:text-slate-400 font-black text-sm uppercase tracking-widest">Cargando recorridos...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-10 text-center text-red-600 font-bold mt-10">❌ Error cargando la lista. {err}</div>;
  }

  const pendientes = data.filter(r => !r.estado || r.estado === 'PENDIENTE' || r.estado === 'EN_CURSO');
  const historial = data.filter(r => r.estado === 'COMPLETO' || r.estado === 'EMERGENCIA' || r.estado === 'FINALIZADO');

  historial.sort((a, b) => new Date(b.fecha_fin || b.updatedAt) - new Date(a.fecha_fin || a.updatedAt));
  const lineasDisponibles = [...new Set(historial.map(r => r.linea))].filter(Boolean);

  const historialFiltrado = filtroLinea 
    ? historial.filter(r => r.linea === filtroLinea) 
    : historial;

  const listaVisible = tab === "PENDIENTES" ? pendientes : historialFiltrado;

  return (
    <div className="layout-container">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest block">Gestión de Líneas</span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-wide">Mis Recorridos</h1>
          </div>
          <Link to="/recorridos/nuevo" className="btn-primary !min-h-[42px] !text-xs">
            + Nuevo
          </Link>
        </div>

        {/* PESTAÑAS */}
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-inner">
          <button 
            onClick={() => setTab("PENDIENTES")}
            className={`flex-1 min-h-[42px] text-xs font-black rounded-xl uppercase transition-all ${tab === "PENDIENTES" ? "bg-white dark:bg-blue-600 text-blue-900 dark:text-white shadow-md" : "text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"}`}
          >
            Pendientes ({pendientes.length})
          </button>
          <button 
            onClick={() => setTab("HISTORIAL")}
            className={`flex-1 min-h-[42px] text-xs font-black rounded-xl uppercase transition-all ${tab === "HISTORIAL" ? "bg-white dark:bg-blue-600 text-blue-900 dark:text-white shadow-md" : "text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"}`}
          >
            Historial ({historial.length})
          </button>
        </div>

        {/* FILTRO HISTORIAL */}
        {tab === "HISTORIAL" && historial.length > 0 && (
          <div className="card-base bg-slate-50 dark:bg-slate-900/60 space-y-2">
            <div className="label-title">Filtro de Limpieza</div>
            <div className="flex gap-2">
              <select 
                className="input-field flex-1 !p-2 !text-xs"
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
                className="btn-danger !min-h-[38px] !text-xs"
              >
                {deletingBulk ? "⏳" : `Borrar (${historialFiltrado.length})`}
              </button>
            </div>
          </div>
        )}
      </header>

      {err && <div className="bg-red-500 text-white p-3 rounded-xl text-center text-sm font-black shadow-md border-2 border-red-700">{err}</div>}

      {listaVisible.length === 0 && (
        <div className="text-center py-14 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 mt-6 shadow-sm">
          <span className="text-4xl block mb-2">{tab === "PENDIENTES" ? "📭" : "📂"}</span>
          <p className="text-slate-500 dark:text-slate-400 font-black text-sm">
            {tab === "PENDIENTES" ? "No tienes recorridos en curso." : "El historial está limpio."}
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {listaVisible.map(r => {
          const esCompleto = r.estado === 'COMPLETO' || r.estado === 'FINALIZADO';
          const esEmergencia = r.estado === 'EMERGENCIA';

          return (
            <li key={r.id} className="card-base !p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-all">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-0.5">
                    Línea {r.linea} <span className="font-bold">({r.kv} kV)</span>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    OT: {r.ot_numero}
                  </div>
                </div>
                
                <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${
                  esCompleto 
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' 
                    : esEmergencia 
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-700 animate-pulse'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                }`}>
                  {r.estado || "EN CURSO"}
                </span>
              </div>

              <div className="text-xs md:text-sm font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 inline-block mt-1">
                Tramo: {r.entre_desde} ➝ {r.entre_hasta}
              </div>
                    
              {tab === "HISTORIAL" && r.fecha_fin && (
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-wide">
                  Finalizado el: {new Date(r.fecha_fin).toLocaleDateString()}
                </div>
              )}

              {esEmergencia && r.motivo_cierre && (
                <div className="mt-2 text-xs text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 font-extrabold">
                  ⚠️ <span className="uppercase text-[10px]">Motivo:</span> {r.motivo_cierre}
                </div>
              )}

              <div className="mt-4 flex items-stretch justify-between gap-2.5 border-t-2 border-slate-100 dark:border-slate-800 pt-3">
                <Link 
                  to={`/recorridos/${r.id}/piquetes`} 
                  className={`flex-1 ${tab === "PENDIENTES" ? "btn-primary" : "btn-success"} !min-h-[42px] !text-xs`}
                >
                  {tab === "PENDIENTES" ? "🚀 Continuar" : "📊 Ver Piquetes"}
                </Link>

                {tab === "HISTORIAL" && (
                  <button
                    onClick={() => handleDescargarExcel(r.id)}
                    className="btn-secondary !min-h-[42px] !text-xs !bg-emerald-50 dark:!bg-emerald-950/40 !text-emerald-700 dark:!text-emerald-300 !border-emerald-300 dark:!border-emerald-700"
                  >
                    📥 Excel
                  </button>
                )}

                <button
                  onClick={() => borrar(r.id)}
                  disabled={deletingId === r.id || deletingBulk}
                  className="btn-danger !min-h-[42px] !text-xs !px-3.5"
                >
                  {deletingId === r.id ? "⏳" : "🗑️"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}