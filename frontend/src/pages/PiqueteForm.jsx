import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

const OPCIONES_CONDUCTORES = [
  { code: 'COND_DIST_EDIF',   label: 'Cable a menor dist. linea edif.' },
  { code: 'COND_ALTURA',      label: 'Cable a menor altura del terreno' },
  { code: 'COND_DIST_CARTEL',  label: 'A menor distancia de carteles' },
  { code: 'COND_PROX_INST',    label: 'Cable proximo a otras instalaciones' },
  { code: 'COND_DETERIORADO',  label: 'Cable deteriorado' },
  { code: 'COND_MORSETERIA',   label: 'Morseteria deteriorada' },
  { code: 'COND_HG_BAJO',      label: 'H°G° bajo, desprendido' },
  { code: 'COND_ELEM_EXTR',    label: 'Cable con elementos extraños' },
  { code: 'COND_HG_DET',       label: 'H°G° deteriorado' },
];

const OPCIONES_COLUMNA = [
  { code: 'COL_INCLINADA',     label: 'Columna inclinada (met. o H° A°)' },
  { code: 'COL_MENSULA_DET',   label: 'Ménsula H° A° deteriorada' },
  { code: 'COL_SEN_ILEGIBLE',  label: 'Señalización Ilegible' },
  { code: 'COL_ID_ILEGIBLE',   label: 'Identificación Ilegible' },
];

const OPCIONES_TORRE = [
  { code: 'TORRE_ANTITREP',    label: 'N° antitrepadores colocados' },
  { code: 'TORRE_PERFILES',    label: 'N° perfiles faltantes' },
  { code: 'TORRE_FALTA_SEN',   label: 'Falta o daño señalización' },
  { code: 'TORRE_FALTA_ID',    label: 'Falta o daño identificación' },
];

const OPCIONES_GENERAL = [
  { code: 'GEN_ELEM_EXTR',     label: 'Estructura o columna con elementos extraños' },
  { code: 'GEN_DETERIORADA',   label: 'Estructura o columna deteriorada' },
  { code: 'GEN_PUESTA_TIERRA', label: 'Puesta a tierra deteriorada' },
  { code: 'GEN_CHOQUE',        label: 'Choque vehicular' },
];

const TODAS_OPCIONES = [
  ...OPCIONES_CONDUCTORES, 
  ...OPCIONES_COLUMNA, 
  ...OPCIONES_TORRE, 
  ...OPCIONES_GENERAL
];

export default function PiqueteForm() {
  const { piqueteId } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const order = sp.get("order") === "desc" ? "desc" : "asc";
  const partner = sp.get("partner") || null; 
  const partnerBack = sp.get("partner_back") || null; 
  const nextLabel = sp.get("next_label") || null; 

  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  
  const [anomaliasLocales, setAnomaliasLocales] = useState([]);
  const [pendientesA, setPendientesA] = useState([]); 
  const [pendientesD, setPendientesD] = useState([]); 
  const [guardando, setGuardando] = useState(false);

  const [tc, setTc] = useState({
    ss: false, sd: false, sv: false, scm: false, rs: false, rd: false,
    lado: "INICIO", cadenas: "V",
  });
  const [poda, setPoda] = useState({ urgencia: "s/p", medio: "c/e", cantidad_arboles: 0 });
  const [podaDetalle, setPodaDetalle] = useState(""); 
  const [balizor, setBalizor] = useState("N");
  const [balizorDetalle, setBalizorDetalle] = useState("");
  const [aislLado, setAislLado] = useState(""); 
  
  const [aislInputs, setAislInputs] = useState({ 
    R: { int: "", ext: "", scm: "", cant: "" }, 
    S: { int: "", ext: "", scm: "", cant: "" }, 
    T: { int: "", ext: "", scm: "", cant: "" } 
  });

  const [condTipo, setCondTipo] = useState(""); 
  const [condDetalle, setCondDetalle] = useState(""); 
  const [colTipo, setColTipo] = useState(""); 
  const [colDetalle, setColDetalle] = useState("");
  const [torreTipo, setTorreTipo] = useState(""); 
  const [torreDetalle, setTorreDetalle] = useState("");
  const [genTipo, setGenTipo] = useState(""); 
  const [genDetalle, setGenDetalle] = useState("");

  useEffect(() => {
    if (p && p.id) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [piqueteId, p]);

  async function listaRecorr(recId) { return api(`/recorridos/${recId}/piquetes`); }
  async function idPorEtiqueta(targetRecId, etiquetaBuscada, piqueteOrigen) {
    const listaDestino = await listaRecorr(targetRecId);
    listaDestino.sort((a, b) => Number(a.orden) - Number(b.orden));
    const candidatosDestino = listaDestino.filter(x => x.etiqueta === etiquetaBuscada);
    if (candidatosDestino.length === 0) return null;
    if (candidatosDestino.length === 1) return candidatosDestino[0].id;
    const listaOrigen = await listaRecorr(piqueteOrigen.recorrido_id);
    listaOrigen.sort((a, b) => Number(a.orden) - Number(b.orden));
    const candidatosOrigen = listaOrigen.filter(x => x.etiqueta === etiquetaBuscada);
    const miIndiceRelativo = candidatosOrigen.findIndex(x => x.id === piqueteOrigen.id);
    if (candidatosDestino[miIndiceRelativo]) return candidatosDestino[miIndiceRelativo].id;
    return candidatosDestino[candidatosDestino.length - 1].id;
  }
  async function siguienteIdPorOrden(recId, idActual) {
    const lst = await listaRecorr(recId);
    lst.sort((a, b) => Number(a.orden) !== Number(b.orden) ? Number(a.orden) - Number(b.orden) : Number(a.id) - Number(b.id));
    if (order === 'desc') lst.reverse();
    const idx = lst.findIndex(x => Number(x.id) === Number(idActual));
    if (idx >= 0 && idx < lst.length - 1) return lst[idx + 1].id;
    return null;
  }
  async function siguienteEtiquetaPorOrden(recId, idActual) {
    const lst = await listaRecorr(recId);
    lst.sort((a, b) => Number(a.orden) !== Number(b.orden) ? Number(a.orden) - Number(b.orden) : Number(a.id) - Number(b.id));
    if (order === 'desc') lst.reverse();
    const idx = lst.findIndex(x => Number(x.id) === Number(idActual));
    if (idx >= 0 && idx < lst.length - 1) return lst[idx + 1].etiqueta;
    return null;
  }

  async function cargar() {
    try {
      setP(null); setErr(""); setGuardando(false);
      setTc({ ss: false, sd: false, sv: false, scm: false, rs: false, rd: false, lado: "INICIO", cadenas: "V" });

      const data = await api(`/piquetes/${piqueteId}`);
      setP(data);
      
      setAnomaliasLocales(data.Anomalias || []);
      setPendientesA([]);
      setPendientesD([]);

      setTc({
        ss: !!data.tc_ss, sd: !!data.tc_sd, sv: !!data.tc_sv,
        scm: !!data.tc_scm, rs: !!data.tc_rs, rd: !!data.tc_rd,
        lado: data.tc_lado || "INICIO", cadenas: data.tc_cadenas || "V",
      });
      if (data.Recorrido && !aislLado) setAislLado(data.Recorrido.entre_desde);
      
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => { cargar(); }, [piqueteId]);

  async function irAlSiguienteFlujo() {
    if (!p) return;
    const nextIdThisLine = await siguienteIdPorOrden(p.recorrido_id, p.id);
    if (partner && !partnerBack) {
      const partnerIdDestino = await idPorEtiqueta(partner, p.etiqueta, p); 
      if (partnerIdDestino) {
        const nextLabel = await siguienteEtiquetaPorOrden(p.recorrido_id, p.id);
        nav(`/piquetes/${partnerIdDestino}?order=${order}&partner_back=${p.recorrido_id}${nextLabel ? `&next_label=${encodeURIComponent(nextLabel)}` : ''}`);
        return;
      }
    }
    if (partnerBack) {
      let targetLabel = nextLabel;
      if (!targetLabel) targetLabel = await siguienteEtiquetaPorOrden(partnerBack, p.id); 
      if (targetLabel) {
        const targetId = await idPorEtiqueta(partnerBack, targetLabel, p);
        if (targetId) {
          nav(`/piquetes/${targetId}?order=${order}&partner=${p.recorrido_id}`);
          return;
        }
      }
      nav(`/recorridos/${partnerBack}/piquetes?order=${order}`);
      return;
    }
    if (nextIdThisLine) {
      nav(`/piquetes/${nextIdThisLine}?order=${order}${partner ? `&partner=${partner}` : ''}`);
      return;
    }
    nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`);
  }

  function agregarAnomaliaLocal(body, extraUI = {}) {
    const tempId = 'temp-' + Date.now() + Math.random();
    const label = TODAS_OPCIONES.find(op => op.code === body.item_codigo)?.label || body.item_codigo;

    setAnomaliasLocales(prev => [...prev, {
      id: tempId,
      ItemCatalogo: { codigo: body.item_codigo, descripcion: label },
      valor_texto: body.valor_texto,
      ...extraUI
    }]);
    setPendientesA(prev => [...prev, { tempId, body }]);
  }

  function borrarAnomalia(anomaliaId) {
    if (!window.confirm("¿Borrar esta anomalía?")) return;
    
    setAnomaliasLocales(prev => prev.filter(a => a.id !== anomaliaId));
    if (String(anomaliaId).startsWith('temp-')) {
      setPendientesA(prev => prev.filter(p => p.tempId !== anomaliaId));
    } else {
      setPendientesD(prev => [...prev, anomaliaId]);
    }
  }

  function agregarPoda() {
    agregarAnomaliaLocal({ item_codigo: "PODA", poda, valor_texto: podaDetalle }, { PodaDetalle: poda });
    setPodaDetalle("");
  }

  function agregarBalizor() {
    agregarAnomaliaLocal({ item_codigo: "BALIZOR", valor_texto: `Tipo: ${balizor}. ${balizorDetalle}` });
    setBalizorDetalle("");
  }

  // Lógica técnica de Aisladores
  function agregarAislador(tipo, fase) { 
    const esRetencion = tc.rs || tc.rd;
    
    // Solo exigimos lado si es una retención (RS o RD)
    if (esRetencion && !aislLado) { 
      setErr("Selecciona el Lado de la retención primero (Subestación A o B)."); 
      return; 
    }
    setErr("");

    const vals = aislInputs[fase];
    const cantInt = Number(vals.int || vals.cant) || 0;
    const cantExt = Number(vals.ext) || 0;
    const cantScm = Number(vals.scm) || 0;

    if (cantInt === 0 && cantExt === 0 && cantScm === 0) return;

    const partesRoturas = [];
    if (cantInt > 0) partesRoturas.push(`Int: ${cantInt}`);
    if (cantExt > 0) partesRoturas.push(`Ext: ${cantExt}`);
    if (cantScm > 0) partesRoturas.push(`SCM: ${cantScm}`);

    const ladoTexto = esRetencion ? ` (Lado ${aislLado})` : '';
    const detalleTexto = `Fase ${fase} | ${partesRoturas.join(' / ')}${ladoTexto}`;

    agregarAnomaliaLocal(
      { 
        item_codigo: `AISL_${tipo}`, 
        valor_texto: detalleTexto,
        aislador: { 
          fase, 
          cantidad_interior: cantInt, 
          cantidad_exterior: cantExt, 
          cantidad_scm: cantScm,
          lado_referencia: esRetencion ? aislLado : (aislLado || "N/A") 
        } 
      },
      { 
        AisladorDetalle: [{ 
          fase, 
          cantidad_interior: cantInt, 
          cantidad_exterior: cantExt, 
          cantidad_scm: cantScm,
          lado_referencia: esRetencion ? aislLado : (aislLado || "N/A") 
        }] 
      }
    );

    setAislInputs(prev => ({ 
      ...prev, 
      [fase]: { int: "", ext: "", scm: "", cant: "" } 
    }));
  }

  function handleAislInputChange(fase, campo, val) {
    const valLimpio = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setAislInputs(prev => ({ ...prev, [fase]: { ...prev[fase], [campo]: valLimpio } }));
  }

  function agregarGenerico(codigo, detalle, setCodigo, setDetalle) {
    if (!codigo) { setErr("Selecciona una opción."); return; }
    agregarAnomaliaLocal({ item_codigo: codigo, valor_texto: detalle });
    setCodigo(""); setDetalle("");
  }

  const agregarConductor = () => agregarGenerico(condTipo, condDetalle, setCondTipo, setCondDetalle);
  const agregarColumna = () => agregarGenerico(colTipo, colDetalle, setColTipo, setColDetalle);
  const agregarTorre = () => agregarGenerico(torreTipo, torreDetalle, setTorreTipo, setTorreDetalle);
  const agregarGeneral = () => agregarGenerico(genTipo, genDetalle, setGenTipo, setGenDetalle);

  async function guardarTodoYContinuar() {
    setGuardando(true);
    try {
      await api(`/piquetes/${piqueteId}/tipo-cadena`, {
        method: "POST",
        body: { tc_ss: tc.ss, tc_sd: tc.sd, tc_sv: tc.sv, tc_scm: tc.scm, tc_rs: tc.rs, tc_rd: tc.rd, tc_lado: tc.lado, tc_cadenas: tc.cadenas }
      });
      for (const id of pendientesD) await api(`/piquetes/${piqueteId}/anomalias/${id}`, { method: "DELETE" });
      for (const item of pendientesA) await api(`/piquetes/${piqueteId}/anomalias`, { method: "POST", body: item.body });

      await irAlSiguienteFlujo();
    } catch (e) {
      setErr("Error al guardar: " + e.message);
      setGuardando(false);
    }
  }

  async function marcarSinNovedad() {
    setGuardando(true);
    try {
      await api(`/piquetes/${piqueteId}/tipo-cadena`, {
        method: "POST",
        body: { tc_ss: tc.ss, tc_sd: tc.sd, tc_sv: tc.sv, tc_scm: tc.scm, tc_rs: tc.rs, tc_rd: tc.rd, tc_lado: tc.lado, tc_cadenas: tc.cadenas }
      });
      await api(`/piquetes/${piqueteId}/sin-novedad`, { method: "POST" });
      await irAlSiguienteFlujo();
    } catch (e) { 
      setErr(e.message); 
      setGuardando(false);
    }
  }

  if (!p) return <div className="max-w-md mx-auto p-6 text-center font-black text-slate-800 dark:text-slate-100">Cargando datos del piquete...</div>;

  const estaFinalizado = p?.Recorrido?.estado?.toUpperCase() === "FINALIZADO" || p?.Recorrido?.estado?.toUpperCase() === "COMPLETO";
  
  // Determinaciones técnicas
  const esCadenaDoble = tc.sd || tc.rd || tc.sv;
  const esRetencion = tc.rs || tc.rd; // <-- Solo RD y RS son Retención

  return (
    <div className="max-w-md md:max-w-2xl mx-auto p-4 md:p-6 space-y-5 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* HEADER DE NAVEGACIÓN */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
        <button 
          onClick={() => nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`)}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-extrabold text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95"
        >
          ← Volver
        </button>
        {p.Recorrido && (
          <div className="text-right">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest">Línea</div>
            <div className="text-base font-black text-blue-700 dark:text-blue-400 truncate max-w-[180px]">{p.Recorrido.linea}</div>
          </div>
        )}
      </div>

      <div className="text-center py-1">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full">
          Inspección Técnica
        </span>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">Piquete {p.etiqueta}</h1>
      </div>

      {err && <div className="bg-red-500 text-white p-3 rounded-xl text-center text-sm font-extrabold shadow-md border-2 border-red-700">{err}</div>}

      {/* AVISO: MODO SOLO LECTURA */}
      {estaFinalizado && (
        <div className="bg-amber-500 text-slate-950 p-3.5 rounded-2xl shadow-md border-2 border-amber-600 font-black text-xs flex items-center gap-2">
          <span className="text-lg">🔒</span>
          <span>RECORRIDO FINALIZADO — Modo solo lectura activado.</span>
        </div>
      )}

      {/* 1. TIPO DE CADENA */}
      <div className="card-base space-y-4">
        <div className="flex justify-between items-center border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <span className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <span>⛓️</span> Tipo de cadena
          </span>
          {!estaFinalizado && <span className="text-[10px] bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-md font-extrabold border border-blue-200 dark:border-blue-800">Auto-guarda</span>}
        </div>
        
        <div className="grid grid-cols-3 gap-2.5">
          {['ss','sd','sv','scm','rs','rd'].map(tipo => {
            const activo = tc[tipo];
            return (
              <label 
                key={tipo} 
                className={`flex items-center justify-center min-h-[46px] rounded-xl font-black text-sm uppercase transition-all duration-150 border-2 select-none ${
                  activo 
                    ? 'bg-blue-600 border-blue-700 text-white shadow-md scale-[0.98]' 
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                } ${estaFinalizado ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
              >
                <input type="checkbox" className="hidden" disabled={estaFinalizado} checked={activo} onChange={(e) => setTc({...tc, [tipo]: e.target.checked})} />
                {tipo}
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Lado en tipo de cadena: solo si es retención */}
          <div className="flex flex-col">
            <span className="label-title">Lado Piquete</span>
            <select disabled={estaFinalizado || !esRetencion} className="input-field disabled:opacity-50" value={tc.lado} onChange={(e) => setTc((t) => ({ ...t, lado: e.target.value }))}>
              <option>INICIO</option><option>FIN</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="label-title">Configuración</span>
            <select disabled={estaFinalizado} className="input-field disabled:opacity-50" value={tc.cadenas} onChange={(e) => setTc((t) => ({ ...t, cadenas: e.target.value }))}>
              <option>V</option><option>P</option><option>C</option><option>LP</option><option>M</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button 
            onClick={marcarSinNovedad} 
            disabled={guardando || estaFinalizado} 
            className="btn-success w-full"
          >
            {guardando ? "⏳ PROCESANDO..." : "✔ MARCAR SIN NOVEDAD"}
          </button>
        </div>
      </div>

      {/* 2. AISLADORES */}
      <div className="card-base space-y-4">
        <div className="flex items-center justify-between border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
            <span className="text-base">💿</span> Aisladores
            {tc.scm && <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-md font-black shadow-sm">+ SCM Activo</span>}
            {esRetencion && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-black shadow-sm">Retención (RS/RD)</span>}
          </div>
        </div>
        
        {/* SELECTOR DE LADO: Solo aparece si está marcado RD o RS */}
        {esRetencion && p.Recorrido && (
          <div className="space-y-1 animate-fade-in">
            <label className="label-title text-blue-700 dark:text-blue-400">
              Lado de la Retención (Subestación A o B):
            </label>
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
              {[p.Recorrido.entre_desde, p.Recorrido.entre_hasta].map(lado => {
                const isSelected = aislLado === lado;
                return (
                  <button 
                    key={lado}
                    disabled={estaFinalizado}
                    onClick={(e) => { e.preventDefault(); setAislLado(lado); }}
                    className={`flex-1 min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                    } disabled:opacity-50 active:scale-95`}
                  >
                    {isSelected && <span className="text-xs">✓</span>}
                    Lado {lado}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 pt-1">
          {['R', 'S', 'T'].map(fase => {
            const tieneDatos = !!aislInputs[fase].int || !!aislInputs[fase].ext || !!aislInputs[fase].scm || !!aislInputs[fase].cant;

            return (
              <div key={fase} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700">
                <div className="font-black text-2xl w-8 text-center text-slate-800 dark:text-slate-100">{fase}</div>
                
                {/* CADENAS PRINCIPALES DOBLES (SD, SV, RD) */}
                {esCadenaDoble && (
                  <>
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 text-center uppercase mb-0.5">Int</span>
                      <input 
                        type="number" 
                        min="0"
                        disabled={estaFinalizado} 
                        placeholder="-" 
                        className="w-full border-2 border-slate-300 dark:border-slate-600 rounded-lg p-2 text-center font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-200 text-base" 
                        value={aislInputs[fase].int} 
                        onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)} 
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 text-center uppercase mb-0.5">Ext</span>
                      <input 
                        type="number" 
                        min="0"
                        disabled={estaFinalizado} 
                        placeholder="-" 
                        className="w-full border-2 border-slate-300 dark:border-slate-600 rounded-lg p-2 text-center font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-200 text-base" 
                        value={aislInputs[fase].ext} 
                        onChange={(e) => handleAislInputChange(fase, 'ext', e.target.value)} 
                      />
                    </div>
                  </>
                )}

                {/* CADENA SIMPLE (SS, RS o no doble) */}
                {!esCadenaDoble && (
                  <div className="flex flex-col flex-1">
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 text-center uppercase mb-0.5">Ppal</span>
                    <input 
                      type="number" 
                      min="0"
                      disabled={estaFinalizado} 
                      placeholder="-" 
                      className="w-full border-2 border-slate-300 dark:border-slate-600 rounded-lg p-2 text-center font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-200 text-base" 
                      value={aislInputs[fase].cant} 
                      onChange={(e) => handleAislInputChange(fase, 'cant', e.target.value)} 
                    />
                  </div>
                )}

                {/* SCM (CUELLO MUERTO) */}
                {tc.scm && (
                  <div className="flex flex-col flex-1 bg-purple-100 dark:bg-purple-950/60 p-1 rounded-lg border-2 border-purple-400 dark:border-purple-600">
                    <span className="text-[9px] font-black text-purple-900 dark:text-purple-300 text-center uppercase mb-0.5">SCM</span>
                    <input 
                      type="number" 
                      min="0"
                      disabled={estaFinalizado} 
                      placeholder="-" 
                      className="w-full border-2 border-purple-500 rounded-md p-1.5 text-center font-black text-purple-950 dark:text-purple-100 bg-white dark:bg-slate-900 focus:border-purple-700 outline-none disabled:bg-slate-200 text-base" 
                      value={aislInputs[fase].scm} 
                      onChange={(e) => handleAislInputChange(fase, 'scm', e.target.value)} 
                    />
                  </div>
                )}

                {/* BOTONES ROTO / CACH */}
                <div className="flex flex-col gap-1.5 w-20">
                  <button 
                    disabled={!tieneDatos || estaFinalizado} 
                    onClick={(e) => { e.preventDefault(); agregarAislador('ROTO', fase); }} 
                    className="btn-danger !min-h-[32px] !text-xs !py-1 !px-1.5"
                  >
                    + Roto
                  </button>
                  <button 
                    disabled={!tieneDatos || estaFinalizado} 
                    onClick={(e) => { e.preventDefault(); agregarAislador('CACHADO', fase); }} 
                    className="btn-warning !min-h-[32px] !text-xs !py-1 !px-1.5"
                  >
                    + Cach
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. CONDUCTORES */}
      <div className="card-base space-y-3">
        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <span>⚡</span> Conductores
        </div>
        <div className="space-y-3">
          <select disabled={estaFinalizado} className="input-field" value={condTipo} onChange={(e) => setCondTipo(e.target.value)}>
            <option value="" className="text-slate-400">-- SELECCIONAR ANOMALÍA --</option>
            {OPCIONES_CONDUCTORES.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
          </select>
          <div className="flex gap-2">
            <input disabled={estaFinalizado} className="input-field flex-1" placeholder="Detalles..." value={condDetalle} onChange={(e) => setCondDetalle(e.target.value)} />
            <button onClick={(e) => { e.preventDefault(); agregarConductor(); }} className="btn-primary !min-h-[44px] !text-xs" disabled={!condTipo || estaFinalizado}>
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* 4. PODA */}
      <div className="card-base space-y-3">
        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <span>🌳</span> Poda / Árboles
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col">
            <label className="label-title">Urgencia</label>
            <select disabled={estaFinalizado} className="input-field !p-2.5 !text-xs" value={poda.urgencia} onChange={(e) => setPoda((s) => ({ ...s, urgencia: e.target.value }))}>
              <option value="s/p">S/P (Sin plazo)</option>
              <option value="c/p">C/P (Corto plazo)</option>
              <option value="U">Urgente</option>
              <option value="I">Inmediata</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="label-title">Medio</label>
            <select disabled={estaFinalizado} className="input-field !p-2.5 !text-xs" value={poda.medio} onChange={(e) => setPoda((s) => ({ ...s, medio: e.target.value }))}>
              <option value="c/e">C/E (Hidro)</option>
              <option value="c/h">C/H (Trepa)</option>
              <option value="f/s">F/S (L. viva)</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="label-title">Árboles</label>
            <input disabled={estaFinalizado} min="0" className="input-field !p-2.5 !text-center text-sm" type="number" placeholder="0" value={poda.cantidad_arboles} onChange={(e) => setPoda((s) => ({ ...s, cantidad_arboles: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <input disabled={estaFinalizado} className="input-field flex-1" placeholder="Especie / Observación..." value={podaDetalle} onChange={(e) => setPodaDetalle(e.target.value)} />
          <button disabled={estaFinalizado} onClick={(e) => { e.preventDefault(); agregarPoda(); }} className="btn-primary !min-h-[44px] !text-xs">
            Agregar
          </button>
        </div>
      </div>

      {/* 5. BALIZOR */}
      <div className="card-base space-y-3">
        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <span>🏮</span> Balizor
        </div>
        <div className="space-y-3">
          <select disabled={estaFinalizado} className="input-field" value={balizor} onChange={(e) => setBalizor(e.target.value)}>
            <option value="N">Nocturno</option>
            <option value="D">Diurno</option>
          </select>
          <div className="flex gap-2">
            <input disabled={estaFinalizado} className="input-field flex-1" placeholder="Detalles de balizor..." value={balizorDetalle} onChange={(e) => setBalizorDetalle(e.target.value)} />
            <button disabled={estaFinalizado} onClick={(e) => { e.preventDefault(); agregarBalizor(); }} className="btn-primary !min-h-[44px] !text-xs">
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* 6. COLUMNA, TORRE, GENERAL */}
      {[
        { titulo: '🗼 Columna', tipo: colTipo, setTipo: setColTipo, detalle: colDetalle, setDetalle: setColDetalle, func: agregarConductor, opciones: OPCIONES_COLUMNA },
        { titulo: '🏗️ Torre', tipo: torreTipo, setTipo: setTorreTipo, detalle: torreDetalle, setDetalle: setTorreDetalle, func: agregarTorre, opciones: OPCIONES_TORRE },
        { titulo: '📋 General / Otros', tipo: genTipo, setTipo: setGenTipo, detalle: genDetalle, setDetalle: setGenDetalle, func: agregarGeneral, opciones: OPCIONES_GENERAL }
      ].map((seccion, index) => (
        <div key={index} className="card-base space-y-3">
          <div className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider border-b-2 border-slate-100 dark:border-slate-800 pb-2">{seccion.titulo}</div>
          <div className="space-y-3">
            <select disabled={estaFinalizado} className="input-field" value={seccion.tipo} onChange={(e) => seccion.setTipo(e.target.value)}>
              <option value="" className="text-slate-400">-- SELECCIONAR --</option>
              {seccion.opciones.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
            </select>
            <div className="flex gap-2">
              <input disabled={estaFinalizado} className="input-field flex-1" placeholder="Detalles opcionales..." value={seccion.detalle} onChange={(e) => seccion.setDetalle(e.target.value)} />
              <button onClick={(e) => { e.preventDefault(); seccion.func(); }} className="btn-primary !min-h-[44px] !text-xs" disabled={!seccion.tipo || estaFinalizado}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* LISTA DE ANOMALÍAS CARGADAS */}
      {(anomaliasLocales.length > 0) && (
        <div className="border-2 border-red-500 rounded-2xl p-4 bg-red-50 dark:bg-red-950/40 shadow-md space-y-3">
          <h3 className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>🚨</span> Anomalías Cargadas ({anomaliasLocales.length})
          </h3>
          <ul className="divide-y-2 divide-red-200 dark:divide-red-900/60">
            {anomaliasLocales.map(a => {
              let desc = a.ItemCatalogo?.descripcion || a.ItemCatalogo?.codigo;
              let det = a.valor_texto || a.valor_numero || '';
              
              if (a.ItemCatalogo?.codigo === 'PODA' && a.PodaDetalle) {
                det = `${a.PodaDetalle.urgencia}/${a.PodaDetalle.medio} (${a.PodaDetalle.cantidad_arboles}) ${det}`;
              }
              if (a.AisladorDetalle && a.AisladorDetalle.length > 0) {
                const d = a.AisladorDetalle[0];
                const tipoTxt = (a.ItemCatalogo?.codigo === 'AISL_ROTO') ? 'ROTO' : 'CACHADO';
                desc = `AISL. ${tipoTxt} - FASE ${d.fase}`;
                
                const roturas = [];
                if (d.cantidad_interior > 0) roturas.push(`Int: ${d.cantidad_interior}`);
                if (d.cantidad_exterior > 0) roturas.push(`Ext: ${d.cantidad_exterior}`);
                if (d.cantidad_scm > 0) roturas.push(`SCM: ${d.cantidad_scm}`);
                
                const ladoInfo = d.lado_referencia && d.lado_referencia !== 'N/A' ? ` (Lado ${d.lado_referencia})` : '';
                det = `${roturas.join(' / ')}${ladoInfo}`;
              }

              return (
                <li key={a.id} className="py-3 flex justify-between items-center gap-3 animate-fade-in">
                  <div className="text-xs flex-1">
                    <span className="font-black text-slate-900 dark:text-slate-100 block leading-tight">{desc}</span>
                    <span className="text-red-800 dark:text-red-300 font-extrabold text-[11px] mt-1 block bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 p-1.5 rounded-lg inline-block">{det}</span>
                  </div>
                  {!estaFinalizado && (
                    <button onClick={(e) => { e.preventDefault(); borrarAnomalia(a.id); }} className="btn-danger !min-h-[36px] !text-xs !py-1 !px-3">
                      Borrar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* BOTÓN FLOTANTE DE AVANCE */}
      {(anomaliasLocales.length > 0 || estaFinalizado) && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-20 pointer-events-none">
          <div className="max-w-md md:max-w-2xl mx-auto pointer-events-auto">
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                if (estaFinalizado) irAlSiguienteFlujo();
                else guardarTodoYContinuar(); 
              }} 
              disabled={guardando}
              className="btn-primary w-full !min-h-[54px] !text-base shadow-2xl"
            >
              {guardando ? "⏳ PROCESANDO..." : "Siguiente Piquete →"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}