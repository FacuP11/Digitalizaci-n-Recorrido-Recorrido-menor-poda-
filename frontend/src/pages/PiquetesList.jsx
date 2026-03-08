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
                        tipo: "ANOMALIA"
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

        // Vemos en consola qué nos devolvió exactamente el backend
        console.log("Respuesta del servidor:", respuesta);

        alert("Recorrido enviado exitosamente.");

        // --- 5. MAGIA DE DESCARGA (ANTI-BLOQUEOS) ---
        // Chequeamos si la respuesta tiene el nombre del archivo
        if (respuesta && respuesta.archivo) {
            
            const URL_BACKEND = "https://recorridos-api-backend.onrender.com"; 
            
            // Armamos la URL exacta. Si tu API no usa "/api", quítalo. 
            const linkDescarga = `${URL_BACKEND}/recorridos/descargar/${respuesta.archivo}`;
            console.log("Intentando descargar de:", linkDescarga);

            // Truco: Creamos un botón invisible, lo agregamos a la página, lo "clickeamos" y lo borramos
            const enlaceInvisible = document.createElement('a');
            enlaceInvisible.href = linkDescarga;
            enlaceInvisible.target = "_blank"; // Para que no te saque de la app
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

  function onPartnerChange(e) {
    const v = e.target.value;
    setPartnerId(v);
    if(v) localStorage.setItem(`partner_for_${id}`, v);
    else localStorage.removeItem(`partner_for_${id}`);
  }

  if (!rec) return <div className="p-4">Cargando...</div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => nav('/')} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">← Volver</button>
        <div className="text-right">
            <div className="text-xs text-gray-500 font-bold">LÍNEA</div>
            <h1 className="text-xl font-bold text-blue-900">{rec.linea}</h1>
        </div>
      </div>
      
      {err && <p className="text-red-600 text-center text-sm font-bold">{err}</p>}

      {/* Selector Partner + BOTÓN CAMBIO RÁPIDO */}
      <div className="border rounded p-3 space-y-3 bg-blue-50 border-blue-100">
        <div className="font-bold text-sm text-blue-800">Línea Asociada</div>
        <select className="border p-2 rounded w-full text-sm bg-white" value={partnerId} onChange={onPartnerChange}>
          <option value="">— Ninguna —</option>
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
                className="w-full py-3 rounded bg-white border-2 border-blue-600 text-blue-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 shadow-sm"
            >
                ⇄ IR A LA LÍNEA ASOCIADA
            </button>
        )}
      </div>

      {/* Filtros y Orden */}
      <div className="flex justify-between items-center bg-gray-100 p-2 rounded">
         <div className="flex gap-1">
            <button onClick={() => setFilter("ALL")} className={`text-xs px-3 py-1 rounded ${filter === "ALL" ? "bg-gray-800 text-white" : "bg-white"}`}>Todos</button>
            <button onClick={() => setFilter("NOV")} className={`text-xs px-3 py-1 rounded ${filter === "NOV" ? "bg-red-600 text-white" : "bg-white"}`}>Novedad</button>
         </div>
         <button onClick={toggleOrder} className="text-xs px-2 py-1 bg-white border rounded">
            Orden: {order.toUpperCase()}
         </button>
      </div>

      {/* Lista Piquetes */}
      <ul className="divide-y">
        {filtrados.map(p => (
          <li key={p.id} className="py-3">
             <div className="flex justify-between items-center gap-2">
                
                {/* ZONA IZQUIERDA: Clic para abrir el formulario */}
                <Link 
                  to={`/piquetes/${p.id}?order=${order}${partnerId ? `&partner=${partnerId}` : ""}`} 
                  className="flex-1 block"
                >
                    <div className="flex items-center gap-2">
                        <div className="font-bold text-lg text-gray-900">Piq {p.etiqueta}</div>
                        {/* Badges de estado */}
                        {p.sin_novedad && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">S/N</span>}
                        {p.anomalias_count > 0 && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">{p.anomalias_count} NOV</span>}
                    </div>
                    {/* Detalles extra simples */}
                    {(p.tc_set) && <div className="text-xs text-gray-500">Cadena ok</div>}
                </Link>

                {/* ZONA DERECHA: Botones BIS y Borrar */}
                <div className="flex flex-col items-end gap-1">
                   {/* Botones BIS pequeños */}
                   <div className="flex gap-1">
                      <button 
                        onClick={() => insertarBis(p.id, "ANTES")}
                        className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
                      >
                        +Bis Ant
                      </button>
                      <button 
                        onClick={() => insertarBis(p.id, "DESPUES")}
                        className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
                      >
                        +Bis Des
                      </button>
                   </div>
                   {/* Botón Borrar (opcional, pequeño y rojo) */}
                   <button 
                     onClick={() => borrarPiquete(p.id)}
                     className="text-[10px] text-red-500 hover:text-red-700 underline"
                   >
                     Borrar
                   </button>
                </div>
             </div>
          </li>
        ))}
      </ul>
      {/* Botón Finalizar */}
        <button onClick={finalizar} className="px-3 py-2 rounded bg-red-600 text-emerald-900 font-bold text-xs hover:bg-red-700 shadow-sm">
            FINALIZAR RECORRIDO
        </button>
      
      {filtrados.length === 0 && <div className="text-center text-gray-500 mt-10">No hay piquetes.</div>}

      
    </div>
  );
}