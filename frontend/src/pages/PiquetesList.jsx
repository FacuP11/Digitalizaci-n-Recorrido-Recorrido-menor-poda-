import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

function obtenerTextoCadena(p) {
  const tipos = [];
  if (p.tc_ss) tipos.push("SS");
  if (p.tc_sd) tipos.push("SD");
  if (p.tc_sv) tipos.push("SV");
  if (p.tc_scm) tipos.push("SCM");
  if (p.tc_rs) tipos.push("RS");
  if (p.tc_rd) tipos.push("RD");
  let res = tipos.join(" / ");
  if (p.tc_lado) res += ` (Lado ${p.tc_lado})`;
  return res || "S/D";
}

export default function PiquetesList() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  const order = sp.get("order") === "desc" ? "desc" : "asc";
  
  const [rec, setRec] = useState(null);
  const [piquetes, setPiquetes] = useState([]);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("ALL"); 
  const [todosRecorridos, setTodosRecorridos] = useState([]);
  
  const [partnerId, setPartnerId] = useState(() => {
    return localStorage.getItem(`partner_for_${id}`) || "";
  });

  async function cargar() {
    try {
      setErr("");
      const [r, list, recs] = await Promise.all([
        api(`/recorridos/${id}`),
        api(`/recorridos/${id}/piquetes/detalle`), 
        api(`/recorridos`),
      ]);
      setRec(r);
      setPiquetes(list);
      setTodosRecorridos(recs);

      const k = `partner_for_${id}`;
      const saved = localStorage.getItem(k);
      if (saved && saved !== String(id) && recs.some(x => String(x.id) === saved)) {
        setPartnerId(saved);
      } else {
        setPartnerId("");
        localStorage.removeItem(k);
      }
    } catch (e) { 
      setErr(e.message); 
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function insertarBis(refId, posicion = "DESPUES") {
    try {
      await api(`/piquetes/${refId}/insertar`, { method: "POST", body: { posicion } });
      await cargar();
    } catch (e) { 
      setErr(e.message); 
    }
  }

  async function borrarPiquete(pid) {
    if (!window.confirm("¿Borrar piquete?")) return;
    try {
      await api(`/piquetes/${pid}`, { method: "DELETE" });
      await cargar();
    } catch (e) { 
      setErr(e.message); 
    }
  }

  function irAlPartner() {
    if (partnerId) {
      localStorage.setItem(`partner_for_${partnerId}`, id);
      nav(`/recorridos/${partnerId}/piquetes?order=${order}`);
    }
  }

  async function finalizar() {
    const piquetesRevisados = piquetes.filter(p => 
      p.sin_novedad || p.anomalias_count > 0 || (p.Observaciones && p.Observaciones.length > 0)
    );

    const revisadosIncompletos = piquetesRevisados.filter(p => 
      !p.tc_ss && !p.tc_sd && !p.tc_sv && !p.tc_scm && !p.tc_rs && !p.tc_rd
    );

    if (revisadosIncompletos.length > 0) {
      const etiquetas = revisadosIncompletos.map(p => p.etiqueta).join(", ");
      alert(`⛔ DATOS INCOMPLETOS EN PIQUETES REVISADOS\n\nUsted marcó actividad en los siguientes piquetes pero olvidó seleccionar el "Tipo de Cadena":\n${etiquetas}\n\nPor favor, complete ese dato antes de finalizar.`);
      return;
    }

    const total = piquetes.length;
    const cantidadFaltantes = total - piquetesRevisados.length;
    
    let esEmergencia = false;
    let motivoCierre = "Finalizado Correctamente";

    if (cantidadFaltantes > 0) {
      const confirmacion = window.confirm(
        `⚠️ RECORRIDO INCOMPLETO\n\n` +
        `Se han revisado ${piquetesRevisados.length} de ${total} piquetes.\n` +
        `Quedan ${cantidadFaltantes} sin visitar.\n\n` +
        `¿Es esto una EMERGENCIA o CAUSA MAYOR que impide continuar?`
      );

      if (!confirmacion) return;
      
      esEmergencia = true;
      motivoCierre = prompt("Ingrese el motivo de la emergencia (ej: Lluvia intensa, Vehículo roto, Accidente):") || "Emergencia no especificada";
    } else {
      if (!window.confirm("¿Está seguro de finalizar el recorrido? Se enviará el reporte a supervisión.")) return;
    }

    const operariosIngresados = prompt("Ingrese los nombres de los operarios de la cuadrilla:", rec.usuario || "Operario Campo");
    const operariosFinal = operariosIngresados && operariosIngresados.trim() ? operariosIngresados.trim() : "Operario Campo";

    try {
      let listaAnomalias = [];
      
      const listaOrdenadaTotal = [...piquetes].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));
      const primerId = listaOrdenadaTotal[0]?.id;
      const ultimoId = listaOrdenadaTotal[listaOrdenadaTotal.length - 1]?.id;

      piquetesRevisados.forEach(p => {
        let etiquetaReporte = p.etiqueta;
        if (p.id === primerId && rec.entre_desde) etiquetaReporte = `${p.etiqueta} (${rec.entre_desde})`;
        else if (p.id === ultimoId && rec.entre_hasta) etiquetaReporte = `${p.etiqueta} (${rec.entre_hasta})`;

        const cadenaPiquete = obtenerTextoCadena(p);

        if (p.Anomalias && p.Anomalias.length > 0) {
          p.Anomalias.forEach(a => {
            listaAnomalias.push({
              piquete: etiquetaReporte,
              codigo: a.ItemCatalogo?.codigo,
              descripcion: a.ItemCatalogo?.descripcion,
              detalle: a.valor_texto || a.valor_numero || "Ver detalle",
              prioridad: determinarPrioridad(a), 
              tipo: "ANOMALIA",
              tipo_cadena: cadenaPiquete,
              PodaDetalle: a.PodaDetalle,
              AisladorDetalle: a.AisladorDetalle
            });
          });
        }

        if (p.Observaciones && p.Observaciones.length > 0) {
          p.Observaciones.forEach(o => {
            listaAnomalias.push({
              piquete: etiquetaReporte,
              codigo: "OBS",
              descripcion: "Observación General",
              detalle: o.texto,
              prioridad: "BAJA",
              tipo: "OBSERVACION",
              tipo_cadena: cadenaPiquete
            });
          });
        }
      });

      const prioridades = { "ALTA": 1, "MEDIA": 2, "BAJA": 3 };
      listaAnomalias.sort((a, b) => (prioridades[a.prioridad] || 99) - (prioridades[b.prioridad] || 99));

      const reporteFinal = {
        meta: {
          fecha: new Date(),
          linea: rec.linea,
          ot: rec.ot_numero,
          tramo: `${rec.entre_desde} - ${rec.entre_hasta}`,
          operarios: operariosFinal,
          usuario: operariosFinal,
          estadoCierre: esEmergencia ? "INCOMPLETO/EMERGENCIA" : "COMPLETO",
          motivo: motivoCierre
        },
        estadisticas: {
          total: total,
          revisados: piquetesRevisados.length,
          faltantes: cantidadFaltantes,
          conNovedad: listaAnomalias.length > 0
        },
        planillaGeneral: listaAnomalias, 
      };

      const respuesta = await api(`/recorridos/${id}/finalizar`, { 
        method: "POST",
        body: reporteFinal 
      });

      alert("Recorrido finalizado exitosamente.");

      if (respuesta && respuesta.archivo) {
        const backendBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const linkDescarga = `${backendBase}/recorridos/descargar/${respuesta.archivo}`;

        const enlace = document.createElement('a');
        enlace.href = linkDescarga;
        enlace.target = "_blank";
        enlace.download = respuesta.archivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
      }

      nav('/');
    } catch (e) { 
      setErr(e.message); 
    }
  }

  function determinarPrioridad(anomalia) {
    const codigo = anomalia.ItemCatalogo?.codigo || "";
    
    if (codigo === "PODA" && anomalia.PodaDetalle) {
      const u = anomalia.PodaDetalle.urgencia;
      if (u === "I" || u === "U" || u === "ALTA") return "ALTA";
      if (u === "c/p" || u === "MEDIA") return "MEDIA";
      return "BAJA";
    }

    if (codigo === "AISL_ROTO") return "ALTA";
    if (codigo === "AISL_CACHADO") return "MEDIA";
    if (codigo.includes("COND_") || codigo.includes("COL_INCLINADA")) return "ALTA";

    return "MEDIA";
  }

  const ordenados = useMemo(() => {
    return [...piquetes].sort((a, b) => {
      const ordA = Number(a.orden ?? 0);
      const ordB = Number(b.orden ?? 0);
      return order === "asc" ? ordA - ordB : ordB - ordA;
    });
  }, [piquetes, order]);

  const filtrados = useMemo(() => {
    if (filter === "SN") return ordenados.filter(p => p.sin_novedad);
    if (filter === "NOV") return ordenados.filter(p => p.anomalias_count > 0 || (p.Observaciones && p.Observaciones.length > 0));
    return ordenados;
  }, [ordenados, filter]);

  function toggleOrder() {
    const next = order === "desc" ? "asc" : "desc";
    sp.set("order", next);
    setSp(sp, { replace: true });
  }

  async function agregarPiqueteAlFinal() {
    if (!window.confirm("¿Deseas agregar un nuevo piquete numerado al final del recorrido?")) return;
    try {
      setErr("");
      await api(`/recorridos/${id}/piquetes/final`, { method: "POST" });
      await cargar();
    } catch (e) { 
      setErr(e.message); 
    }
  }

  function onPartnerChange(e) {
    const v = e.target.value;
    setPartnerId(v);
    if (v) localStorage.setItem(`partner_for_${id}`, v);
    else localStorage.removeItem(`partner_for_${id}`);
  }

  if (!rec) return <div className="max-w-md mx-auto p-6 text-center font-black text-slate-800 dark:text-slate-100">Cargando datos del recorrido...</div>;

  return (
    <div className="layout-container">
      
      {/* HEADER */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
        <button onClick={() => nav('/')} className="btn-secondary !min-h-[38px] !text-xs">
          ← Volver
        </button>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest">Línea</div>
          <h1 className="text-lg md:text-xl font-black text-blue-700 dark:text-blue-400 truncate max-w-[200px]">{rec.linea}</h1>
        </div>
      </div>
      
      {err && <div className="bg-red-500 text-white p-3 rounded-xl text-center text-sm font-black shadow-md border-2 border-red-700">{err}</div>}

      {/* TARJETA: LÍNEA ASOCIADA */}
      <div className="card-base bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 space-y-3">
        <div className="font-black text-blue-900 dark:text-blue-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span>🔗</span> Línea Asociada (2da Terna)
        </div>
        <select className="input-field" value={partnerId} onChange={onPartnerChange}>
          <option value="" className="text-slate-400">— Ninguna —</option>
          {todosRecorridos
            .filter(r => String(r.id) !== String(id))
            .map(r => (
              <option key={r.id} value={r.id}>
                Línea {r.linea} (OT {r.ot_numero})
              </option>
            ))}
        </select>
        
        {partnerId && (
          <button 
            onClick={irAlPartner}
            className="btn-primary w-full !min-h-[44px] !text-xs"
          >
            ⇄ Ir a la línea asociada
          </button>
        )}
      </div>

      {/* BARRA DE FILTROS Y ORDEN */}
      <div className="flex flex-col gap-2.5">
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-inner items-center justify-between gap-2">
          <div className="flex gap-1.5 flex-1">
            <button 
              onClick={() => setFilter("ALL")} 
              className={`flex-1 min-h-[40px] rounded-xl text-xs font-black uppercase transition-all ${filter === "ALL" ? "bg-slate-900 text-white dark:bg-blue-600 shadow-md" : "text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilter("NOV")} 
              className={`flex-1 min-h-[40px] rounded-xl text-xs font-black uppercase transition-all ${filter === "NOV" ? "bg-red-600 text-white shadow-md" : "text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"}`}
            >
              Novedades
            </button>
          </div>
          
          <div className="w-px h-7 bg-slate-300 dark:bg-slate-600"></div>

          <button 
            onClick={toggleOrder} 
            className="btn-secondary !min-h-[40px] !text-xs"
          >
            {order === "asc" ? "⬇ Desde" : "⬆ Hasta"}
          </button>
        </div>

        <button 
          onClick={agregarPiqueteAlFinal}
          className="btn-secondary w-full !border-2 !border-blue-400 dark:!border-blue-600 !text-blue-700 dark:!text-blue-300 !bg-blue-50 dark:!bg-blue-950/40"
        >
          <span className="text-base leading-none">+</span> Agregar Piquete al Final
        </button>
      </div>

      {/* LISTA DE PIQUETES */}
      <ul className="space-y-3">
        {filtrados.map(p => (
          <li key={p.id} className="card-base !p-0 flex overflow-hidden hover:border-blue-400 dark:hover:border-blue-500 transition-all">
            <Link 
              to={`/piquetes/${p.id}?order=${order}${partnerId ? `&partner=${partnerId}` : ""}`} 
              className="flex-1 p-3.5 flex flex-col justify-center active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3 mb-1">
                <div className="font-black text-2xl md:text-3xl text-slate-900 dark:text-white leading-none">
                  P.{p.etiqueta}
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {p.sin_novedad && <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-md font-black tracking-wide uppercase">S/N</span>}
                  {p.anomalias_count > 0 && <span className="text-[10px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700 px-2 py-0.5 rounded-md font-black tracking-wide uppercase flex items-center gap-1">🚨 {p.anomalias_count} Nov</span>}
                </div>
              </div>
              
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-extrabold uppercase mt-1">
                {p.tc_set ? `✅ Cadena: ${obtenerTextoCadena(p)}` : "⚠️ Faltan datos de cadena"}
              </div>
            </Link>

            <div className="flex flex-col w-16 md:w-20 border-l-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
              <button 
                onClick={() => insertarBis(p.id, "ANTES")}
                className="flex-1 text-[10px] font-black text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 uppercase transition-colors"
              >
                + Ant
              </button>
              <button 
                onClick={() => insertarBis(p.id, "DESPUES")}
                className="flex-1 text-[10px] font-black text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 uppercase transition-colors"
              >
                + Des
              </button>
              <button 
                onClick={() => borrarPiquete(p.id)}
                className="flex-1 text-[10px] font-black text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 uppercase transition-colors"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
      
      {filtrados.length === 0 && <div className="text-center text-slate-400 font-bold mt-10 p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">No hay piquetes para mostrar.</div>}

      {/* BOTÓN FINALIZAR */}
      <div className="sticky bottom-4 mt-8 z-30">
        <button 
          onClick={finalizar} 
          className="btn-success w-full !min-h-[54px] !text-base shadow-2xl"
        >
          <span className="text-xl">🏁</span> 
          Finalizar Recorrido
        </button>
      </div>

    </div>
  );
}