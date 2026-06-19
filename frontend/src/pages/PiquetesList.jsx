import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

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

  // --- FUNCIÓN DE CARGA (Restaurada para poder refrescar tras insertar BIS) ---
  async function cargar() {
    try {
      setErr("");
      // Cargamos todo en paralelo para asegurar consistencia
      const [r, list, recs] = await Promise.all([
        api(`/recorridos/${id}`),
        api(`/recorridos/${id}/piquetes/detalle`), 
        api(`/recorridos`),
      ]);
      setRec(r);
      setPiquetes(list);
      setTodosRecorridos(recs);

      // Lógica de persistencia del partner
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

  // Cargar al montar el componente
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  // --- ACCIONES ---

  // Restaurada: Insertar piquete BIS
  async function insertarBis(refId, posicion = "DESPUES") {
    try {
      await api(`/piquetes/${refId}/insertar`, { method: "POST", body: { posicion } });
      await cargar(); // Recargar la lista para ver el nuevo piquete
    } catch (e) { setErr(e.message); }
  }

  // Restaurada: Borrar piquete (útil para eliminar un BIS creado por error)
  async function borrarPiquete(pid) {
    if(!window.confirm("¿Borrar piquete?")) return;
    try {
      await api(`/piquetes/${pid}`, { method: "DELETE" });
      await cargar();
    } catch (e) { setErr(e.message); }
  }

  function irAlPartner() {
    if (partnerId) {
        localStorage.setItem(`partner_for_${partnerId}`, id);
        nav(`/recorridos/${partnerId}/piquetes?order=${order}`);
    }
  }

// --- FUNCIÓN FINALIZAR ---
async function finalizar() {
    // --- PASO 1: IDENTIFICAR QUÉ PIQUETES SE REVISARON REALMENTE ---
    // Un piquete se considera "Revisado" si el operario interactuó con él 
    // (Puso Sin Novedad, cargó una Anomalía o escribió una Observación)
    const piquetesRevisados = piquetes.filter(p => 
        p.sin_novedad || p.anomalias_count > 0 || (p.Observaciones && p.Observaciones.length > 0)
    );

    // --- PASO 2: VALIDACIÓN DE DATOS (Solo sobre lo revisado) ---
    // Solo exigimos "Tipo de Cadena" en los piquetes que el operario dijo haber revisado.
    // Los que no llegó a ver (por emergencia), no se validan.
    const revisadosIncompletos = piquetesRevisados.filter(p => 
        !p.tc_ss && !p.tc_sd && !p.tc_sv && !p.tc_scm && !p.tc_rs && !p.tc_rd
    );

    if (revisadosIncompletos.length > 0) {
        const etiquetas = revisadosIncompletos.map(p => p.etiqueta).join(", ");
        alert(`⛔ DATOS INCOMPLETOS EN PIQUETES REVISADOS\n\nUsted marcó actividad en los siguientes piquetes pero olvidó seleccionar el "Tipo de Cadena":\n${etiquetas}\n\nPor favor, complete ese dato antes de finalizar.`);
        return; // Bloqueamos. No es emergencia olvidar un dato en algo que sí viste.
    }

    // --- PASO 3: DETECCIÓN DE EMERGENCIA (Faltantes) ---
    const total = piquetes.length;
    const cantidadFaltantes = total - piquetesRevisados.length;
    
    let esEmergencia = false;
    let motivoCierre = "Finalizado Correctamente";

    if (cantidadFaltantes > 0) {
        // Faltan piquetes por revisar
        const confirmacion = window.confirm(
            `⚠️ RECORRIDO INCOMPLETO\n\n` +
            `Se han revisado ${piquetesRevisados.length} de ${total} piquetes.\n` +
            `Quedan ${cantidadFaltantes} sin visitar.\n\n` +
            `¿Es esto una EMERGENCIA o CAUSA MAYOR que impide continuar?`
        );

        if (!confirmacion) {
            return; // El usuario dijo "No", entonces vuelve a la lista para seguir trabajando.
        }
        
        // Si dijo "Sí", procedemos al cierre forzoso
        esEmergencia = true;
        motivoCierre = prompt("Ingrese el motivo de la emergencia (ej: Lluvia intensa, Vehículo roto, Accidente):") || "Emergencia no especificada";
    } else {
        // Están todos revisados
        if (!window.confirm("¿Está seguro de finalizar el recorrido? Se enviará el reporte a supervisión.")) return;
    }

    try {
        // --- PASO 4: GENERAR REPORTE (Solo con lo revisado) ---
        let listaAnomalias = [];
        
        // Ordenamos para detectar POR/ANT correctamente
        const listaOrdenadaTotal = [...piquetes].sort((a, b) => a.orden - b.orden);
        const primerId = listaOrdenadaTotal[0]?.id;
        const ultimoId = listaOrdenadaTotal[listaOrdenadaTotal.length - 1]?.id;

        // IMPORTANTE: Solo iteramos sobre 'piquetesRevisados'. 
        // Los no completados se ignoran en el reporte detallado (quedan como pendientes en la realidad).
        piquetesRevisados.forEach(p => {
            
            // Lógica de Etiqueta (Lado A / Lado B)
            let etiquetaReporte = p.etiqueta;
            if (p.id === primerId && rec.entre_desde) etiquetaReporte = `${p.etiqueta} (${rec.entre_desde})`;
            else if (p.id === ultimoId && rec.entre_hasta) etiquetaReporte = `${p.etiqueta} (${rec.entre_hasta})`;

            // A. Anomalías
            if (p.Anomalias && p.Anomalias.length > 0) {
                p.Anomalias.forEach(a => {
                    listaAnomalias.push({
                        piquete: etiquetaReporte,
                        codigo: a.ItemCatalogo?.codigo,
                        descripcion: a.ItemCatalogo?.descripcion,
                        detalle: a.valor_texto || a.valor_numero || "Ver detalle",
                        prioridad: determinarPrioridad(a), 
                        tipo: "ANOMALIA",
                        // 👇 ¡AQUÍ ESTÁ LA MAGIA! Pasamos los datos crudos al backend 👇
                        PodaDetalle: a.PodaDetalle,
                        AisladorDetalle: a.AisladorDetalle
                    });
                });
            }

            // B. Observaciones
            if (p.Observaciones && p.Observaciones.length > 0) {
                p.Observaciones.forEach(o => {
                    listaAnomalias.push({
                        piquete: etiquetaReporte,
                        codigo: "OBS",
                        descripcion: "Observación General",
                        detalle: o.texto,
                        prioridad: "BAJA",
                        tipo: "OBSERVACION"
                    });
                });
            }
        });

        // Ordenar reporte por prioridad
        const prioridades = { "ALTA": 1, "MEDIA": 2, "BAJA": 3 };
        listaAnomalias.sort((a, b) => (prioridades[a.prioridad] || 99) - (prioridades[b.prioridad] || 99));

        // Payload final
        const reporteFinal = {
            meta: {
                fecha: new Date(),
                linea: rec.linea,
                ot: rec.ot_numero,
                tramo: `${rec.entre_desde} - ${rec.entre_hasta}`,
                usuario: "Operario Campo",
                estadoCierre: esEmergencia ? "INCOMPLETO/EMERGENCIA" : "COMPLETO",
                motivo: motivoCierre
            },
            estadisticas: {
                total: total,
                revisados: piquetesRevisados.length,
                faltantes: cantidadFaltantes, // Dato útil para el supervisor
                conNovedad: listaAnomalias.length > 0
            },
            planillaGeneral: listaAnomalias, 
        };

        // --- 5. ENVIAR ---
        const respuesta = await api(`/recorridos/${id}/finalizar`, { 
            method: "POST",
            body: reporteFinal 
        });

        console.log("Respuesta del servidor:", respuesta);
        alert("Recorrido enviado exitosamente.");

        // --- 5. MAGIA DE DESCARGA (ANTI-BLOQUEOS) ---
        if (respuesta && respuesta.archivo) {
            const URL_BACKEND = "https://recorridos-api-backend.onrender.com"; 
            const linkDescarga = `${URL_BACKEND}/recorridos/descargar/${respuesta.archivo}`;
            console.log("Intentando descargar de:", linkDescarga);

            const enlaceInvisible = document.createElement('a');
            enlaceInvisible.href = linkDescarga;
            enlaceInvisible.target = "_blank"; 
            enlaceInvisible.download = respuesta.archivo;
            
            document.body.appendChild(enlaceInvisible);
            enlaceInvisible.click();
            document.body.removeChild(enlaceInvisible);
        } else {
            console.log("El servidor no devolvió un nombre de archivo. No hay descarga.");
        }

        nav('/');

    } catch (e) { 
        setErr(e.message); 
    }
}
// --- HELPER PARA PRIORIDAD (Pégalo fuera de la función finalizar o al final del archivo) ---
function determinarPrioridad(anomalia) {
    const codigo = anomalia.ItemCatalogo?.codigo || "";
    
    // 1. Prioridad por PODA
    if (codigo === "PODA" && anomalia.PodaDetalle) {
        const u = anomalia.PodaDetalle.urgencia;
        if (u === "I" || u === "U") return "ALTA"; // Inmediata o Urgente
        if (u === "c/p") return "MEDIA"; // Corto Plazo
        return "BAJA"; // Sin plazo
    }

    // 2. Prioridad por AISLADOR
    if (codigo === "AISL_ROTO") return "ALTA"; // Roto siempre es grave
    if (codigo === "AISL_CACHADO") return "MEDIA"; 

    // 3. Prioridad por CONDUCTOR (Cables cortados o bajos son graves)
    if (codigo.includes("COND_")) return "ALTA";
    if (codigo.includes("COL_INCLINADA")) return "ALTA";

    return "MEDIA"; // Default
}

  // --- FILTROS Y ORDEN ---

  const ordenados = useMemo(() => {
    const base = [...piquetes].sort((a, b) => a.orden - b.orden);
    return order === "asc" ? base : base.reverse();
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
    if(!window.confirm("¿Deseas agregar un nuevo piquete numerado al final del recorrido?")) return;
    try {
      setErr("");
      await api(`/recorridos/${id}/piquetes/final`, { method: "POST" });
      await cargar(); // Recargamos la lista para que aparezca
    } catch (e) { 
      setErr(e.message); 
    }
  }

  function onPartnerChange(e) {
    const v = e.target.value;
    setPartnerId(v);
    if(v) localStorage.setItem(`partner_for_${id}`, v);
    else localStorage.removeItem(`partner_for_${id}`);
  }

  if (!rec) return <div className="p-4">Cargando...</div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 pb-24 bg-gray-50 min-h-screen">
      
      {/* ========================================================= */}
      {/* HEADER */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between border-b-2 border-gray-300 pb-3">
        <button onClick={() => nav('/')} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-extrabold text-sm transition-colors shadow-sm">
           ← Volver
        </button>
        <div className="text-right">
            <div className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">Línea</div>
            <h1 className="text-xl font-black text-blue-900 truncate max-w-[200px]">{rec.linea}</h1>
        </div>
      </div>
      
      {err && <div className="bg-red-100 border-2 border-red-500 text-red-800 p-3 rounded-xl text-center text-sm font-extrabold shadow-sm">{err}</div>}

      {/* ========================================================= */}
      {/* TARJETA: LÍNEA ASOCIADA */}
      {/* ========================================================= */}
      <div className="border-2 border-blue-300 rounded-xl p-4 bg-blue-50 shadow-sm space-y-3">
        <div className="font-extrabold text-blue-900 text-sm uppercase tracking-wide flex items-center gap-2">
            <span className="text-lg">🔗</span> Línea Asociada
        </div>
        <select className="border-2 border-blue-400 p-3 rounded-lg w-full bg-white text-blue-900 font-bold focus:border-blue-700 outline-none transition-colors" value={partnerId} onChange={onPartnerChange}>
          <option value="" className="text-gray-500 font-normal">— Ninguna —</option>
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
                className="w-full py-3 rounded-lg bg-blue-700 text-white border-2 border-blue-900 font-extrabold text-sm flex items-center justify-center gap-2 active:scale-95 shadow-sm transition-all uppercase tracking-wide"
            >
                ⇄ Ir a la línea asociada
            </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* BARRA DE FILTROS Y ORDEN (ESTILO INTERRUPTOR) */}
      {/* ========================================================= */}
      <div className="flex flex-col gap-2">
          <div className="flex bg-gray-200 p-1.5 rounded-xl border-2 border-gray-300 shadow-inner items-center justify-between">
             
             {/* Filtros */}
             <div className="flex gap-1 flex-1">
                <button 
                    onClick={() => setFilter("ALL")} 
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold uppercase transition-all duration-200 ${filter === "ALL" ? "bg-gray-800 text-white shadow-md scale-[1.02]" : "text-gray-600 hover:bg-gray-300"}`}
                >
                    Todos
                </button>
                <button 
                    onClick={() => setFilter("NOV")} 
                    className={`flex-1 py-2 rounded-lg text-xs font-extrabold uppercase transition-all duration-200 ${filter === "NOV" ? "bg-red-600 text-white shadow-md scale-[1.02]" : "text-gray-600 hover:bg-gray-300"}`}
                >
                    Novedades
                </button>
             </div>
             
             <div className="w-px h-8 bg-gray-300 mx-2"></div>

             {/* Orden */}
             <button 
                onClick={toggleOrder} 
                className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-xs font-extrabold text-gray-700 shadow-sm flex items-center gap-1 hover:bg-gray-50 active:scale-95 transition-all"
             >
                {order === "asc" ? "⬇ ASC" : "⬆ DESC"}
             </button>
          </div>

          {/* BOTÓN AGREGAR PIQUETE */}
          <button 
              onClick={agregarPiqueteAlFinal}
              className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 border-2 border-blue-400 font-extrabold py-3 rounded-xl shadow-sm text-sm uppercase tracking-wide transition-all active:scale-95 flex justify-center items-center gap-2"
          >
              <span className="text-lg leading-none">+</span> Agregar Piquete al Final
          </button>
      </div>

      {/* ========================================================= */}
      {/* LISTA DE PIQUETES  */}
      {/* ========================================================= */}
      <ul className="space-y-3">
        {filtrados.map(p => (
          <li key={p.id} className="bg-white border-2 border-gray-300 rounded-xl shadow-sm flex overflow-hidden">
             
             {/* ZONA IZQUIERDA: Clickeable para abrir el piquete */}
             <Link 
                to={`/piquetes/${p.id}?order=${order}${partnerId ? `&partner=${partnerId}` : ""}`} 
                className="flex-1 p-3 flex flex-col justify-center active:bg-blue-50 transition-colors"
             >
                <div className="flex items-center gap-3 mb-1">
                    <div className="font-black text-2xl text-gray-900 leading-none">
                        P.{p.etiqueta}
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                        {p.sin_novedad && <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-extrabold tracking-wide uppercase">S/N</span>}
                        {p.anomalias_count > 0 && <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-md font-extrabold tracking-wide uppercase flex items-center gap-1">🚨 {p.anomalias_count} Nov</span>}
                    </div>
                </div>
                
                {/* Detalles extra simples */}
                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                    {(p.tc_set) ? "✅ Cadena Registrada" : "⚠️ Faltan datos"}
                </div>
             </Link>

             {/* ZONA DERECHA: Botones de Acción (BIS / Borrar) */}
             <div className="flex flex-col w-16 border-l-2 border-gray-200 bg-gray-50">
                <button 
                  onClick={() => insertarBis(p.id, "ANTES")}
                  className="flex-1 text-[9px] font-extrabold text-gray-700 bg-gray-100 hover:bg-gray-200 border-b-2 border-gray-200 uppercase transition-colors"
                >
                  + Ant
                </button>
                <button 
                  onClick={() => insertarBis(p.id, "DESPUES")}
                  className="flex-1 text-[9px] font-extrabold text-gray-700 bg-gray-100 hover:bg-gray-200 border-b-2 border-gray-200 uppercase transition-colors"
                >
                  + Des
                </button>
                <button 
                  onClick={() => borrarPiquete(p.id)}
                  className="flex-1 text-[9px] font-extrabold text-red-600 bg-red-50 hover:bg-red-100 uppercase transition-colors"
                >
                  Borrar
                </button>
             </div>
          </li>
        ))}
      </ul>
      
      {filtrados.length === 0 && <div className="text-center text-gray-500 font-bold mt-10 p-6 border-2 border-dashed border-gray-300 rounded-xl">No hay piquetes para mostrar.</div>}

      {/* ========================================================= */}
      {/* BOTÓN FINALIZAR RECORRIDO */}
      {/* ========================================================= */}
      <div className="sticky bottom-4 mt-8 z-50">
          <div className="absolute inset-0 bg-emerald-600 blur-lg opacity-40 rounded-xl"></div>
          <button 
            onClick={finalizar} 
            className="relative w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-lg uppercase tracking-widest shadow-xl border-2 border-emerald-400 hover:from-emerald-700 hover:to-emerald-600 active:scale-95 transition-all flex justify-center items-center gap-3"
          >
              <span className="text-2xl">🏁</span> 
              Finalizar Recorrido
          </button>
      </div>

    </div>
  );
}