import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { piqueteSchema } from '../schemas/piqueteSchema'; // o definir las reglas locales

// LISTA DE OPCIONES PARA CONDUCTORES
const OPCIONES_CONDUCTORES = [
  { code: 'COND_DIST_EDIF',    label: 'Cable a menor dist. linea edif.' },
  { code: 'COND_ALTURA',       label: 'Cable a menor altura del terreno' },
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
  
  // ==========================================
  // ESTADOS DE OPTIMIZACIÓN (MEMORIA LOCAL)
  // ==========================================
  const [anomaliasLocales, setAnomaliasLocales] = useState([]);
  const [pendientesA, setPendientesA] = useState([]); 
  const [pendientesD, setPendientesD] = useState([]); 
  const [guardando, setGuardando] = useState(false);

  // --- ESTADOS DEL FORMULARIO ---
  const [tc, setTc] = useState({
    ss: false, sd: false, sv: false, scm: false, rs: false, rd: false,
    lado: "INICIO", cadenas: "V",
  });
  const [poda, setPoda] = useState({ urgencia: "s/p", medio: "c/e", cantidad_arboles: 0 });
  const [podaDetalle, setPodaDetalle] = useState(""); 
  const [balizor, setBalizor] = useState("N");
  const [balizorDetalle, setBalizorDetalle] = useState("");
  const [aislLado, setAislLado] = useState(""); 
  const [aislInputs, setAislInputs] = useState({ R: { int: "", ext: "" }, S: { int: "", ext: "" }, T: { int: "", ext: "" } });
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

  // --- HELPERS NAVEGACIÓN ---
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

  // --- CARGA DE DATOS ---
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

  // =========================================================
  // LOGICA LOCAL
  // =========================================================

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
    if(!window.confirm("¿Borrar?")) return;
    
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

  function agregarAislador(tipo, fase) { 
    if (!aislLado) { setErr("Selecciona el Lado primero."); return; }
    const vals = aislInputs[fase];
    if (!vals.int && !vals.ext) return; 

    agregarAnomaliaLocal(
        { item_codigo: `AISL_${tipo}`, aislador: { fase, cantidad_interior: vals.int, cantidad_exterior: vals.ext, lado_referencia: aislLado } },
        { AisladorDetalle: [{ fase, cantidad_interior: vals.int, cantidad_exterior: vals.ext, lado_referencia: aislLado }] }
    );
    setAislInputs(prev => ({ ...prev, [fase]: { int: "", ext: "" } }));
  }

  function handleAislInputChange(fase, campo, val) {
      setAislInputs(prev => ({ ...prev, [fase]: { ...prev[fase], [campo]: val } }));
  }

  function agregarGenerico(codigo, detalle, setCodigo, setDetalle) {
    if (!codigo) { setErr("Selecciona una opción."); return; }
    agregarAnomaliaLocal({ item_codigo: codigo, valor_texto: detalle });
    setCodigo(""); setDetalle("");
  }

  function handleSubmit(e) {
  e.preventDefault();

  // Validar el estado del formulario antes de guardar u offline
  const resultado = piqueteSchema.safeParse(formData);

  if (!resultado.success) {
    // Extraemos el primer error para mostrarlo en pantalla
    const primerError = resultado.error.issues[0].message;
    setMensajeError(primerError);
    return;
  }

  // Si pasa la validación, procedemos a guardar (online u offline)
  guardarPiquete(resultado.data);
}

  const agregarConductor = () => agregarGenerico(condTipo, condDetalle, setCondTipo, setCondDetalle);
  const agregarColumna = () => agregarGenerico(colTipo, colDetalle, setColTipo, setColDetalle);
  const agregarTorre = () => agregarGenerico(torreTipo, torreDetalle, setTorreTipo, setTorreDetalle);
  const agregarGeneral = () => agregarGenerico(genTipo, genDetalle, setGenTipo, setGenDetalle);

  // =========================================================
  // GUARDADO EN LOTE
  // =========================================================
  async function guardarTodoYContinuar() {
      setGuardando(true);
      try {
          await api(`/piquetes/${piqueteId}/tipo-cadena`, {
              method: "POST",
              body: { tc_ss: tc.ss, tc_sd: tc.sd, tc_sv: tc.sv, tc_scm: tc.scm, tc_rs: tc.rs, tc_rd: tc.rd, tc_lado: tc.lado, tc_cadenas: tc.cadenas }
          });
          for(const id of pendientesD) await api(`/piquetes/${piqueteId}/anomalias/${id}`, { method: "DELETE" });
          for(const item of pendientesA) await api(`/piquetes/${piqueteId}/anomalias`, { method: "POST", body: item.body });

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

  if (!p) return <div className="max-w-md mx-auto p-4">Cargando...</div>;

  // -------------------------------------------------------------
  // 🔥 VARIABLE MÁGICA DE PROTECCIÓN (SOLO LECTURA)
  // -------------------------------------------------------------
  const estaFinalizado = p?.Recorrido?.estado?.toUpperCase() === "FINALIZADO";

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-24">
      
      {/* HEADER DE NAVEGACIÓN */}
      <div className="flex justify-between items-start">
          <button className="text-blue-700 underline" onClick={() => nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`)}>← Volver</button>
          {p.Recorrido && (
             <div className="text-right">
                <div className="text-xs text-gray-500 uppercase font-bold">Línea</div>
                <div className="text-lg font-bold text-blue-900">{p.Recorrido.linea}</div>
             </div>
          )}
      </div>

      <h1 className="text-2xl font-bold text-center">Piquete {p.etiqueta}</h1>
      {err && <div className="bg-red-100 text-red-800 p-2 rounded text-center text-sm font-bold">{err}</div>}

      {/* 🚀 CARTEL AVISO: MODO SOLO LECTURA */}
      {estaFinalizado && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-3 rounded shadow-sm">
              <p className="font-extrabold text-sm flex items-center gap-2">
                  <span>🔒</span> RECORRIDO FINALIZADO
              </p>
              <p className="text-xs font-bold mt-1 text-orange-700">Modo de solo lectura. No se pueden modificar los datos.</p>
          </div>
      )}

      {/* 1. TIPO DE CADENA */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3">
        <div className="flex justify-between items-center border-b-2 border-gray-200 pb-1">
            <span className="font-extrabold text-gray-900 text-sm uppercase tracking-wide">Tipo de cadena</span>
            {!estaFinalizado && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">Se guarda al avanzar</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
            {['ss','sd','sv','scm','rs','rd'].map(tipo => {
                const activo = tc[tipo];
                return (
                    <label 
                        key={tipo} 
                        className={`flex items-center justify-center py-3 border-2 rounded-lg font-extrabold text-sm uppercase transition-all ${
                            activo ? 'bg-blue-700 border-blue-900 text-white shadow-inner scale-95' : 'bg-gray-50 border-gray-400 text-gray-700 shadow-sm'
                        } ${estaFinalizado ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <input type="checkbox" className="hidden" disabled={estaFinalizado} checked={activo} onChange={(e) => setTc({...tc, [tipo]: e.target.checked})} />
                        {tipo}
                    </label>
                );
            })}
        </div>
        <div className="flex gap-2 mt-2">
          <select disabled={estaFinalizado} className="border p-2 rounded bg-white w-1/2 text-sm font-bold text-gray-700 disabled:bg-gray-100 disabled:text-gray-400" value={tc.lado} onChange={(e) => setTc((t) => ({ ...t, lado: e.target.value }))}>
            <option>INICIO</option><option>FIN</option>
          </select>
          <select disabled={estaFinalizado} className="border p-2 rounded bg-white w-1/2 text-sm font-bold text-gray-700 disabled:bg-gray-100 disabled:text-gray-400" value={tc.cadenas} onChange={(e) => setTc((t) => ({ ...t, cadenas: e.target.value }))}>
            <option>V</option><option>P</option><option>C</option><option>LP</option><option>M</option>
          </select>
        </div>
        <div className="pt-2">
             <button onClick={marcarSinNovedad} disabled={guardando || estaFinalizado} className="w-full py-3 rounded border-2 border-emerald-500 text-emerald-700 font-bold hover:bg-emerald-50 text-sm uppercase tracking-wide disabled:opacity-40 disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400">
                {guardando ? "⏳ PROCESANDO..." : "SIN NOVEDAD"}
             </button>
        </div>
      </div>

     {/* 2. AISLADORES  */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
            <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide">
                <span className="text-xl">💿</span> Aisladores 
            </div>
        </div>
        
        {p.Recorrido && (
            <div className="mb-4 mt-2">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 block ml-1">Seleccione el Lado a registrar:</label>
                <div className="flex bg-gray-200 p-1.5 rounded-xl border-2 border-gray-300 shadow-inner">
                    {[p.Recorrido.entre_desde, p.Recorrido.entre_hasta].map(lado => {
                        const isSelected = aislLado === lado;
                        return (
                            <button 
                                key={lado}
                                disabled={estaFinalizado}
                                onClick={(e) => { e.preventDefault(); setAislLado(lado); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-extrabold uppercase transition-all duration-200 ${isSelected ? 'bg-blue-700 text-white shadow-md border-2 border-blue-900' : 'text-gray-600 hover:bg-gray-300 border-2 border-transparent'} disabled:opacity-50`}
                            >
                                {isSelected ? <span className="bg-white text-blue-800 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✓</span> : <span className="w-4 h-4"></span>}
                                Lado {lado}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        <div className="space-y-3">
            {['R', 'S', 'T'].map(fase => {
                const esDoble = tc.sd || tc.rd || tc.sv;
                return (
                <div key={fase} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border-2 border-gray-300">
                    <div className="font-black text-2xl w-8 text-center text-gray-800">{fase}</div>
                    {esDoble && (
                        <>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-extrabold text-gray-500 text-center uppercase mb-1">Int</span>
                                <input type="number" disabled={estaFinalizado} placeholder="-" className="w-full border-2 border-gray-400 rounded-lg p-2 text-center font-bold bg-white focus:border-blue-600 outline-none disabled:bg-gray-200" value={aislInputs[fase].int} onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)} />
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-extrabold text-gray-500 text-center uppercase mb-1">Ext</span>
                                <input type="number" disabled={estaFinalizado} placeholder="-" className="w-full border-2 border-gray-400 rounded-lg p-2 text-center font-bold bg-white focus:border-blue-600 outline-none disabled:bg-gray-200" value={aislInputs[fase].ext} onChange={(e) => handleAislInputChange(fase, 'ext', e.target.value)} />
                            </div>
                        </>
                    )}
                    {!esDoble && (
                        <div className="flex flex-col flex-1">
                            <span className="text-[10px] font-extrabold text-gray-500 text-center uppercase mb-1">Cantidad</span>
                            <input type="number" disabled={estaFinalizado} placeholder="-" className="w-full border-2 border-gray-400 rounded-lg p-2 text-center font-bold bg-white focus:border-blue-600 outline-none disabled:bg-gray-200" value={aislInputs[fase].int} onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)} />
                        </div>
                    )}
                    <div className="flex flex-col gap-1 w-16">
                         <button disabled={(!aislInputs[fase].int && !aislInputs[fase].ext) || estaFinalizado} onClick={(e) => { e.preventDefault(); agregarAislador('ROTO', fase); }} className="bg-red-600 text-white border-2 border-red-800 py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase disabled:opacity-40 active:scale-95">+ Roto</button>
                         <button disabled={(!aislInputs[fase].int && !aislInputs[fase].ext) || estaFinalizado} onClick={(e) => { e.preventDefault(); agregarAislador('CACHADO', fase); }} className="bg-orange-500 text-white border-2 border-orange-700 py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase disabled:opacity-40 active:scale-95">+ Cach</button>
                    </div>
                </div>
                );
            })}
        </div>
      </div>

     {/* 3. CONDUCTORES */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">⚡</span> Conductores
        </div>
        <div className="space-y-3">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Tipo de Anomalía</label>
                <select disabled={estaFinalizado} className="w-full border-2 border-gray-400 p-3 rounded-lg bg-gray-50 font-bold outline-none disabled:bg-gray-200" value={condTipo} onChange={(e) => setCondTipo(e.target.value)}>
                    <option value="" className="text-gray-500 font-normal">-- SELECCIONAR ANOMALÍA --</option>
                    {OPCIONES_CONDUCTORES.map(op => <option key={op.code} value={op.code}>{op.label}</option> )}
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase ml-1">Detalle (Opcional)</label>
                <div className="flex gap-2">
                    <input disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 font-bold outline-none disabled:bg-gray-200" placeholder="Ej: Cable deshilachado..." value={condDetalle} onChange={(e) => setCondDetalle(e.target.value)} />
                    <button onClick={(e) => { e.preventDefault(); agregarConductor(); }} className="bg-blue-700 text-white px-5 rounded-lg font-extrabold text-sm uppercase active:scale-95 disabled:opacity-40" disabled={!condTipo || estaFinalizado}>Agregar</button>
                </div>
            </div>
        </div>
      </div>

      {/* 4. PODA */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">🌳</span> Poda / Árboles
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Urgencia</label>
                <select disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg font-bold outline-none disabled:bg-gray-200" value={poda.urgencia} onChange={(e) => setPoda((s) => ({ ...s, urgencia: e.target.value }))}>
                    <option value="s/p">S/P</option><option value="c/p">C/P</option><option value="U">Urgente</option><option value="I">Inmediata</option>
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Medio</label>
                <select disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg font-bold outline-none disabled:bg-gray-200" value={poda.medio} onChange={(e) => setPoda((s) => ({ ...s, medio: e.target.value }))}>
                    <option value="c/e">C/E</option><option value="c/h">C/H</option><option value="f/s">F/S</option>
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Cantidad</label>
                <input disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg text-center font-bold outline-none disabled:bg-gray-200" type="number" placeholder="Ej: 3" value={poda.cantidad_arboles} onChange={(e) => setPoda((s) => ({ ...s, cantidad_arboles: Number(e.target.value) }))} />
            </div>
        </div>
        <div className="flex flex-col gap-1 mt-2">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase ml-1">Detalle / Especie</label>
            <div className="flex gap-2">
                <input disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg flex-1 font-bold outline-none disabled:bg-gray-200" placeholder="Ej: Eucaliptos..." value={podaDetalle} onChange={(e) => setPodaDetalle(e.target.value)} />
                <button disabled={estaFinalizado} onClick={(e) => { e.preventDefault(); agregarPoda(); }} className="bg-blue-700 text-white px-5 rounded-lg font-extrabold text-sm uppercase active:scale-95 disabled:opacity-40">Agregar</button>
            </div>
        </div>
      </div>

      {/* 5. BALIZOR */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">🏮</span> Balizor
        </div>
        <div className="space-y-3">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Tipo de Balizor</label>
                <select disabled={estaFinalizado} className="w-full border-2 border-gray-400 p-3 rounded-lg font-bold outline-none disabled:bg-gray-200" value={balizor} onChange={(e) => setBalizor(e.target.value)}>
                    <option value="N">Nocturno</option><option value="D">Diurno</option>
                </select>
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase ml-1">Detalle</label>
                <div className="flex gap-2">
                    <input disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg flex-1 font-bold outline-none disabled:bg-gray-200" placeholder="Ej: Roto o Desprendido..." value={balizorDetalle} onChange={(e) => setBalizorDetalle(e.target.value)} />
                    <button disabled={estaFinalizado} onClick={(e) => { e.preventDefault(); agregarBalizor(); }} className="bg-blue-700 text-white px-5 rounded-lg font-extrabold text-sm uppercase active:scale-95 disabled:opacity-40">Agregar</button>
                </div>
            </div>
        </div>
      </div>

      {/* 6. COLUMNA, 7. TORRE, 8. GENERAL */}
      {/* (Para no hacer el bloque enorme, los unimos lógicamente de la misma forma) */}
      {[
        { titulo: '🗼 Columna', tipo: colTipo, setTipo: setColTipo, detalle: colDetalle, setDetalle: setColDetalle, func: agregarColumna, opciones: OPCIONES_COLUMNA },
        { titulo: '🏗️ Torre', tipo: torreTipo, setTipo: setTorreTipo, detalle: torreDetalle, setDetalle: setTorreDetalle, func: agregarTorre, opciones: OPCIONES_TORRE },
        { titulo: '📋 General / Otros', tipo: genTipo, setTipo: setGenTipo, detalle: genDetalle, setDetalle: setGenDetalle, func: agregarGeneral, opciones: OPCIONES_GENERAL }
      ].map((seccion, index) => (
        <div key={index} className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
            <div className="font-extrabold text-gray-900 text-sm uppercase border-b-2 border-gray-200 pb-2">{seccion.titulo}</div>
            <div className="space-y-3">
                <select disabled={estaFinalizado} className="w-full border-2 border-gray-400 p-3 rounded-lg font-bold disabled:bg-gray-200" value={seccion.tipo} onChange={(e) => seccion.setTipo(e.target.value)}>
                    <option value="">-- SELECCIONAR --</option>
                    {seccion.opciones.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
                </select>
                <div className="flex gap-2">
                    <input disabled={estaFinalizado} className="border-2 border-gray-400 p-3 rounded-lg flex-1 font-bold disabled:bg-gray-200" placeholder="Detalles (Opcional)..." value={seccion.detalle} onChange={(e) => seccion.setDetalle(e.target.value)} />
                    <button onClick={(e) => { e.preventDefault(); seccion.func(); }} className="bg-blue-700 text-white px-4 rounded-lg font-extrabold text-sm uppercase disabled:opacity-40 active:scale-95" disabled={!seccion.tipo || estaFinalizado}>Agregar</button>
                </div>
            </div>
        </div>
      ))}

      {/* =========================== */}
      {/* LISTA DE ANOMALÍAS CARGADAS */}
      {/* =========================== */}
      {(anomaliasLocales.length > 0) && (
        <div className="border-2 border-red-500 rounded-xl p-4 bg-red-50 shadow-md mt-6">
           <h3 className="text-sm font-extrabold text-red-700 uppercase mb-3 flex items-center gap-2">
              <span className="text-xl">🚨</span> Anomalías Cargadas
           </h3>
           <ul className="divide-y-2 divide-red-200">
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
                   det = `Int: ${d.cantidad_interior} / Ext: ${d.cantidad_exterior} (Lado ${d.lado_referencia})`;
               }

               return (
               <li key={a.id} className="py-3 flex justify-between items-center gap-4 animate-fade-in">
                  <div className="text-sm flex-1">
                    <span className="font-extrabold text-gray-900 block leading-tight">{desc}</span>
                    <span className="text-red-800 font-bold text-xs mt-1 block bg-white border border-red-200 p-1.5 rounded inline-block">{det}</span>
                  </div>
                  {/* SOLO MOSTRAMOS EL BOTÓN BORRAR SI NO ESTÁ FINALIZADO */}
                  {!estaFinalizado && (
                      <button onClick={(e) => { e.preventDefault(); borrarAnomalia(a.id); }} className="bg-red-600 text-white font-extrabold px-3 py-2 rounded-lg shadow-sm border-2 border-red-800 active:scale-95 text-xs uppercase tracking-wider">
                        Borrar
                      </button>
                  )}
               </li>
               );
             })}
           </ul>
        </div>
      )}

      {/* BOTÓN MAGISTRAL DE AVANCE (Navega o Guarda dependiendo el modo) */}
      {(anomaliasLocales.length > 0 || estaFinalizado) && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-10 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button 
               onClick={(e) => { 
                   e.preventDefault(); 
                   // Si está finalizado, solo navega, NO guarda
                   if (estaFinalizado) irAlSiguienteFlujo();
                   else guardarTodoYContinuar(); 
               }} 
               disabled={guardando}
               className={`w-full py-4 rounded-xl font-extrabold text-lg uppercase tracking-widest shadow-[0_8px_30px_rgb(0,0,0,0.5)] border-2 transition-all flex justify-center items-center gap-2 disabled:opacity-75 ${estaFinalizado ? 'bg-gray-800 border-gray-900 text-white hover:bg-gray-900' : 'bg-blue-800 border-blue-900 text-white hover:bg-blue-900 active:scale-95'}`}
            >
               {guardando ? "⏳ PROCESANDO..." : (estaFinalizado ? "Siguiente Piquete →" : "Siguiente Piquete →")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}