import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

// LISTA DE OPCIONES PARA CONDUCTORES (Códigos internos y Etiquetas legibles)
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

// Unimos todas para buscar etiquetas fácil al renderizar la lista
const TODAS_OPCIONES = [
    ...OPCIONES_CONDUCTORES, 
    ...OPCIONES_COLUMNA, 
    ...OPCIONES_TORRE, 
    ...OPCIONES_GENERAL
];


export default function PiqueteForm() {
  const { piqueteId } = useParams();
  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  const [showNextBtn, setShowNextBtn] = useState(false);
  
  // Params de navegación
  const [sp] = useSearchParams();
  const order = sp.get("order") === "desc" ? "desc" : "asc";
  const partner = sp.get("partner") || null; 
  const partnerBack = sp.get("partner_back") || null; 
  const nextLabel = sp.get("next_label") || null; 

  // --- ESTADOS DEL FORMULARIO ---

  // 1. Tipo de cadena
  const [tc, setTc] = useState({
    ss: false, sd: false, sv: false, scm: false, rs: false, rd: false,
    lado: "INICIO", cadenas: "V",
  });
  
  // 2. Poda
  const [poda, setPoda] = useState({ urgencia: "s/p", medio: "c/e", cantidad_arboles: 0 });
  const [podaDetalle, setPodaDetalle] = useState(""); 
  
  // 3. Balizor
  const [balizor, setBalizor] = useState("N");
  const [balizorDetalle, setBalizorDetalle] = useState("");

  // 4. AISLADORES (La Matriz)
  const [aislLado, setAislLado] = useState(""); 
  // Guardamos los inputs por fase:
  const [aislInputs, setAislInputs] = useState({
    R: { int: "", ext: "" },
    S: { int: "", ext: "" },
    T: { int: "", ext: "" }
  });

  // 5. CONDUCTORES
  const [condTipo, setCondTipo] = useState(""); // Código seleccionado
  const [condDetalle, setCondDetalle] = useState(""); // Texto detalle

  // 6. Columna (NUEVO)
  const [colTipo, setColTipo] = useState(""); 
  const [colDetalle, setColDetalle] = useState("");

  // 7. Torre (NUEVO)
  const [torreTipo, setTorreTipo] = useState(""); 
  const [torreDetalle, setTorreDetalle] = useState("");

  // 8. General (NUEVO)
  const [genTipo, setGenTipo] = useState(""); 
  const [genDetalle, setGenDetalle] = useState("");

  // --- HELPERS Y NAVEGACIÓN ---
  async function listaRecorr(recId) { return api(`/recorridos/${recId}/piquetes`); }
  
  async function idPorEtiqueta(targetRecId, etiquetaBuscada, piqueteOrigen) {
    const listaDestino = await listaRecorr(targetRecId);
    listaDestino.sort((a, b) => Number(a.orden) - Number(b.orden)); // Ordenar numéricamente

    // 1. Buscamos TODOS los que coinciden con la etiqueta (ej: todos los "POR")
    const candidatosDestino = listaDestino.filter(x => x.etiqueta === etiquetaBuscada);
    
    // Si no hay ninguno, adiós.
    if (candidatosDestino.length === 0) return null;

    // Si solo hay uno, es ese.
    if (candidatosDestino.length === 1) return candidatosDestino[0].id;

    // --- DESEMPATE POR CONTEXTO ---
    // Si hay varios (ej: POR inicio y POR fin), necesitamos saber cuál somos nosotros.
    
    // Traemos la lista de DONDE VENIMOS para saber "quién soy yo"
    const listaOrigen = await listaRecorr(piqueteOrigen.recorrido_id);
    listaOrigen.sort((a, b) => Number(a.orden) - Number(b.orden));
    
    // Buscamos todos los "POR" en mi línea original
    const candidatosOrigen = listaOrigen.filter(x => x.etiqueta === etiquetaBuscada);
    
    // ¿Qué índice ocupo yo entre mis gemelos? (¿Soy el 1er POR o el 2do POR?)
    const miIndiceRelativo = candidatosOrigen.findIndex(x => x.id === piqueteOrigen.id);

    // Intentamos buscar el mismo índice en la línea destino
    // Si yo soy el 2do POR, busco el 2do POR allá.
    if (candidatosDestino[miIndiceRelativo]) {
        return candidatosDestino[miIndiceRelativo].id;
    }

    //Si no coincide exacto, devolvemos el último (asumiendo que estamos al final)
    return candidatosDestino[candidatosDestino.length - 1].id;
  }
  //Devuelve el ID directo del siguiente, basándose en el ORDEN
  async function siguienteIdPorOrden(recId, idActual) {

    const lst = await listaRecorr(recId);
    // Aseguramos que el orden sea numérico para ordenar bien
    lst.sort((a, b) => {
    const ordenA = Number(a.orden);
    const ordenB = Number(b.orden);
    
    if (ordenA !== ordenB) {
        return ordenA - ordenB;
    }
    // Si el orden es igual, desempatamos por ID
    return Number(a.id) - Number(b.id);
});

    // Debug: Ver cómo queda ordenada
    console.log("--- DEBUG NAVEGACIÓN ---");
    console.log("Lista Ordenada:", lst.map(x => `${x.id}: ${x.etiqueta} (Orden: ${x.orden})`));
    console.log("Buscando ID Actual:", idActual);

    if (order === 'desc') lst.reverse();
    // Buscamos por ID, que es único (no por etiqueta)
    const idx = lst.findIndex(x => Number(x.id) === Number(idActual));

    console.log("Índice encontrado:", idx, "de", lst.length);

    // Si encontramos el actual y no es el último, devolvemos el ID del siguiente
    if (idx >= 0 && idx < lst.length - 1) {

      console.log("Siguiente encontrado -> ID:", lst[idx + 1].id, "Etiqueta:", lst[idx + 1].etiqueta);

        return lst[idx + 1].id;
    }
    console.log("No hay siguiente. Fin del recorrido.");
    return null; // No hay siguiente (es el final)
  }

  //Para saber la etiqueta del siguiente (solo para partners/lógica de texto)
  async function siguienteEtiquetaPorOrden(recId, idActual) { // Nota: ahora recibe ID, no etiqueta
    const lst = await listaRecorr(recId);
    lst.sort((a, b) => {
    const ordenA = Number(a.orden);
    const ordenB = Number(b.orden);
    
    if (ordenA !== ordenB) {
        return ordenA - ordenB;
    }
    // Si el orden es igual, desempatamos por ID
    return Number(a.id) - Number(b.id);
});
    if (order === 'desc') lst.reverse();
    const idx = lst.findIndex(x => Number(x.id) === Number(idActual));
    if (idx >= 0 && idx < lst.length - 1) {
        return lst[idx + 1].etiqueta;
    }
    return null;
  }


  // --- CARGA DE DATOS ---
  async function cargar() {
    try {
      setErr("");
      const data = await api(`/piquetes/${piqueteId}`);
      setP(data);
      
      const tieneDatos = (data.Anomalias && data.Anomalias.length > 0) || (data.Observaciones && data.Observaciones.length > 0);
      setShowNextBtn(tieneDatos);

      // Cargar estado de TC
      setTc({
        ss: !!data.tc_ss, sd: !!data.tc_sd, sv: !!data.tc_sv,
        scm: !!data.tc_scm, rs: !!data.tc_rs, rd: !!data.tc_rd,
        lado: data.tc_lado || "INICIO", cadenas: data.tc_cadenas || "V",
      });

      // Pre-seleccionar lado por defecto (si no hay uno elegido ya)
      if (data.Recorrido && !aislLado) {
          setAislLado(data.Recorrido.entre_desde);
      }
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => { cargar(); }, [piqueteId]);

  // --- LÓGICA DE NAVEGACIÓN (FLUJO) ---
  async function irAlSiguienteFlujo() {
    if (!p) return;
    
    // 1. Calculamos el ID del siguiente piquete en ESTA misma línea
    const nextIdThisLine = await siguienteIdPorOrden(p.recorrido_id, p.id);

    // --- CASO A: TIENE PARTNER (IDA) ---
    // Si estamos navegando en modo "Zig-Zag" entre dos líneas
    if (partner && !partnerBack) {
      
      // CORRECCIÓN AQUÍ: Agregamos ', p' al final
      const partnerIdDestino = await idPorEtiqueta(partner, p.etiqueta, p); 
      
      if (partnerIdDestino) {
        const nextLabel = await siguienteEtiquetaPorOrden(p.recorrido_id, p.id);
        nav(`/piquetes/${partnerIdDestino}?order=${order}&partner_back=${p.recorrido_id}${nextLabel ? `&next_label=${encodeURIComponent(nextLabel)}` : ''}`);
        return;
      }
    }

    // --- CASO B: VOLVIENDO DEL PARTNER (VUELTA) ---
    if (partnerBack) {
      let targetLabel = nextLabel;
      
      // Si no hay label en URL, calculamos el siguiente lógico
      if (!targetLabel) {
          targetLabel = await siguienteEtiquetaPorOrden(partnerBack, p.id); 
      }

      if (targetLabel) {
        // CORRECCIÓN AQUÍ TAMBIÉN: Agregamos ', p' al final
        // (Aunque al volver es menos crítico, es mejor que no falle)
        const targetId = await idPorEtiqueta(partnerBack, targetLabel, p);
        
        if (targetId) {
          nav(`/piquetes/${targetId}?order=${order}&partner=${p.recorrido_id}`);
          return;
        }
      }
      // Si no encuentra a donde volver, va a la lista
      nav(`/recorridos/${partnerBack}/piquetes?order=${order}`);
      return;
    }

    // --- CASO C: NAVEGACIÓN NORMAL (Siguiente Piquete) ---
    if (nextIdThisLine) {
        nav(`/piquetes/${nextIdThisLine}?order=${order}${partner ? `&partner=${partner}` : ''}`);
        return;
    }

    // Si no hay más piquetes, volvemos a la lista
    nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`);
  }

  // --- ACCIONES (GUARDAR) ---

  async function guardarTipoCadena() {
    try {
      await api(`/piquetes/${piqueteId}/tipo-cadena`, {
        method: "POST",
        body: { tc_ss: tc.ss, tc_sd: tc.sd, tc_sv: tc.sv, tc_scm: tc.scm, tc_rs: tc.rs, tc_rd: tc.rd, tc_lado: tc.lado, tc_cadenas: tc.cadenas },
      });
      await cargar();
      setErr("Guardado OK"); setTimeout(() => setErr(""), 1500);
    } catch (e) { setErr(e.message); }
  }

  async function marcarSinNovedad() {
    try {
      await api(`/piquetes/${piqueteId}/sin-novedad`, { method: "POST" });
      await irAlSiguienteFlujo();
    } catch (e) { setErr(e.message); }
  }

  async function agregarPoda() {
    try {
      await api(`/piquetes/${piqueteId}/anomalias`, {
        method: "POST",
        body: { item_codigo: "PODA", poda, valor_texto: podaDetalle },
      });
      setPodaDetalle("");
      await cargar();
    } catch (e) { setErr(e.message); }
  }

  async function agregarBalizor() {
    try {
      await api(`/piquetes/${piqueteId}/anomalias`, {
        method: "POST",
        body: { item_codigo: "BALIZOR", valor_texto: `Tipo: ${balizor}. ${balizorDetalle}` },
      });
      setBalizorDetalle("");
      await cargar();
    } catch (e) { setErr(e.message); }
  }

  // --- AGREGAR AISLADOR (MATRIZ) ---
  async function agregarAislador(tipo, fase) { 
    // tipo: 'ROTO' o 'CACHADO'
    // fase: 'R', 'S', 'T'
    if (!aislLado) { setErr("Selecciona el Lado primero."); return; }
    
    const vals = aislInputs[fase];
    const nInt = vals.int;
    const nExt = vals.ext;

    // Validación básica: debe haber al menos un número ingresado
    if (!nInt && !nExt) return; 

    try {
        await api(`/piquetes/${piqueteId}/anomalias`, {
            method: "POST",
            body: { 
                item_codigo: `AISL_${tipo}`, 
                aislador: { 
                    fase: fase,
                    cantidad_interior: nInt,
                    cantidad_exterior: nExt,
                    lado_referencia: aislLado
                }
            }
        });
        
        // Limpiar inputs de esa fase específica tras guardar
        setAislInputs(prev => ({
            ...prev,
            [fase]: { int: "", ext: "" }
        }));
        await cargar();
    } catch (e) { setErr(e.message); }
  }

  // Manejador de cambios en los inputs de la matriz
  function handleAislInputChange(fase, campo, val) {
      setAislInputs(prev => ({
          ...prev,
          [fase]: { ...prev[fase], [campo]: val }
      }));
  }

  // Helper Genérico para las secciones nuevas. CONDUCTORES, COLUMNAS, TORRES, GENERAL
  async function agregarGenerico(codigo, detalle, setCodigo, setDetalle) {
    if (!codigo) { setErr("Selecciona una opción."); return; }
    try {
        await api(`/piquetes/${piqueteId}/anomalias`, {
            method: "POST",
            body: { item_codigo: codigo, valor_texto: detalle }
        });
        setCodigo("");
        setDetalle("");
        await cargar();
    } catch (e) { setErr(e.message); }
  }

  // Wrappers específicos para usar en el onClick
  const agregarConductor = () => agregarGenerico(condTipo, condDetalle, setCondTipo, setCondDetalle);
  const agregarColumna = () => agregarGenerico(colTipo, colDetalle, setColTipo, setColDetalle);
  const agregarTorre = () => agregarGenerico(torreTipo, torreDetalle, setTorreTipo, setTorreDetalle);
  const agregarGeneral = () => agregarGenerico(genTipo, genDetalle, setGenTipo, setGenDetalle);

  // Borrar cualquier anomalía
  async function borrarAnomalia(anomaliaId) {
    if(!window.confirm("¿Borrar?")) return;
    try {
        await api(`/piquetes/${piqueteId}/anomalias/${anomaliaId}`, { method: "DELETE" });
        await cargar();
    } catch(e) { setErr(e.message); }
  }

  if (!p) return <div className="max-w-md mx-auto p-4">Cargando...</div>;

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
      {err && <div className="bg-blue-100 text-blue-800 p-2 rounded text-center text-sm font-bold">{err}</div>}

      {/* 1. TIPO DE CADENA */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3">
        <div className="font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-1">Tipo de cadena</div>
        <div className="grid grid-cols-3 gap-2">
            {['ss','sd','sv','scm','rs','rd'].map(tipo => {
                const activo = tc[tipo];
                return (
                    <label 
                        key={tipo} 
                        className={`flex items-center justify-center py-3 border-2 rounded-lg font-extrabold text-sm uppercase cursor-pointer transition-all ${
                            activo 
                            ? 'bg-blue-700 border-blue-900 text-white shadow-inner scale-95' 
                            : 'bg-gray-50 border-gray-400 text-gray-700 shadow-sm'
                        }`}
                    >
                        {/* El checkbox real está oculto, usamos el label como botón grande */}
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={activo} 
                            onChange={(e) => setTc({...tc, [tipo]: e.target.checked})} 
                        />
                        {tipo}
                    </label>
                );
            })}
        </div>
        <div className="flex gap-2 mt-2">
          <select className="border p-2 rounded bg-white w-1/3 text-sm" value={tc.lado} onChange={(e) => setTc((t) => ({ ...t, lado: e.target.value }))}>
            <option>INICIO</option><option>FIN</option>
          </select>
          <select className="border p-2 rounded bg-white w-1/3 text-sm" value={tc.cadenas} onChange={(e) => setTc((t) => ({ ...t, cadenas: e.target.value }))}>
            <option>V</option><option>P</option><option>C</option><option>LP</option><option>M</option>
          </select>
          <button onClick={guardarTipoCadena} className="flex-1 bg-blue-600 text-emerald-700 rounded font-bold text-sm">Guardar</button>
        </div>
        <div className="pt-2">
             <button onClick={marcarSinNovedad} className="w-full py-3 rounded border-2 border-emerald-500 text-emerald-700 font-bold hover:bg-emerald-50 text-sm uppercase tracking-wide">
                SIN NOVEDAD
             </button>
        </div>
      </div>

     {/* 2. AISLADORES  */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center justify-between border-b-2 border-gray-200 pb-2">
            <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide">
                <span className="text-xl">💿</span> Aisladores 
            </div>
            {(tc.sd || tc.rd || tc.sv) 
                ? <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-300">CADENA DOBLE</span> 
                : <span className="text-[10px] font-extrabold bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-300">CADENA SIMPLE</span>
            }
        </div>
        
        {/* Selector LADO */}
        {p.Recorrido && (
            <div className="mb-4 mt-2">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 block ml-1">
                    Seleccione el Lado a registrar:
                </label>
                <div className="flex bg-gray-200 p-1.5 rounded-xl border-2 border-gray-300 shadow-inner">
                    {[p.Recorrido.entre_desde, p.Recorrido.entre_hasta].map(lado => {
                        const isSelected = aislLado === lado;
                        return (
                            <button 
                                key={lado}
                                onClick={(e) => { e.preventDefault(); setAislLado(lado); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-extrabold uppercase transition-all duration-200 ${
                                    isSelected 
                                    ? 'bg-blue-700 text-white shadow-md border-2 border-blue-900 scale-[1.02]' 
                                    : 'text-gray-600 hover:bg-gray-300 border-2 border-transparent'
                                }`}
                            >
                                {/* Muestra un tilde solo si está seleccionado */}
                                {isSelected ? (
                                    <span className="bg-white text-blue-800 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                        ✓
                                    </span>
                                ) : (
                                    <span className="w-4 h-4"></span> 
                                )}
                                Lado {lado}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Matriz de Entrada */}
        <div className="space-y-3">
            {['R', 'S', 'T'].map(fase => {
                const esDoble = tc.sd || tc.rd || tc.sv;

                return (
                <div key={fase} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border-2 border-gray-300">
                    {/* Letra Fase */}
                    <div className="font-black text-2xl w-8 text-center text-gray-800">{fase}</div>
                    
                    {/* CASO 1: CADENA DOBLE (Int / Ext) */}
                    {esDoble && (
                        <>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-extrabold text-gray-500 text-center uppercase mb-1">Int</span>
                                <input 
                                    type="number" placeholder="-" className="w-full border-2 border-gray-400 rounded-lg p-2 text-center font-bold bg-white text-gray-900 focus:border-blue-600 outline-none"
                                    value={aislInputs[fase].int}
                                    onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-extrabold text-gray-500 text-center uppercase mb-1">Ext</span>
                                <input 
                                    type="number" placeholder="-" className="w-full border-2 border-gray-400 rounded-lg p-2 text-center font-bold bg-white text-gray-900 focus:border-blue-600 outline-none"
                                    value={aislInputs[fase].ext}
                                    onChange={(e) => handleAislInputChange(fase, 'ext', e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {/* CASO 2: CADENA SIMPLE (Solo Cantidad) */}
                    {!esDoble && (
                        <div className="flex flex-col flex-1">
                            <span className="text-[10px] font-extrabold text-gray-500 text-center uppercase mb-1">Cantidad</span>
                            <input 
                                type="number" placeholder="-" className="w-full border-2 border-gray-400 rounded-lg p-2 text-center font-bold bg-white text-gray-900 focus:border-blue-600 outline-none"
                                value={aislInputs[fase].int} 
                                onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)}
                            />
                        </div>
                    )}

                    {/* Botones Agregar (Roto / Cachado) */}
                    <div className="flex flex-col gap-1 w-16">
                         <button 
                            disabled={!aislInputs[fase].int && !aislInputs[fase].ext}
                            onClick={(e) => { e.preventDefault(); agregarAislador('ROTO', fase); }}
                            className="bg-red-600 text-white border-2 border-red-800 py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase disabled:bg-gray-300 disabled:border-gray-400 disabled:text-gray-500 transition-colors active:scale-95"
                         >
                            + Roto
                         </button>
                         <button 
                            disabled={!aislInputs[fase].int && !aislInputs[fase].ext}
                            onClick={(e) => { e.preventDefault(); agregarAislador('CACHADO', fase); }}
                            className="bg-orange-500 text-white border-2 border-orange-700 py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase disabled:bg-gray-300 disabled:border-gray-400 disabled:text-gray-500 transition-colors active:scale-95"
                         >
                            + Cach
                         </button>
                    </div>
                </div>
                );
            })}
        </div>
        
        <div className="text-[10px] font-bold text-gray-400 text-center mt-2">
           {(tc.sd || tc.rd || tc.sv) 
             ? "Registre platos Interiores y Exteriores por separado." 
             : "Registre la cantidad total de platos en la cadena."}
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
                <select 
                    className="w-full border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-colors"
                    value={condTipo}
                    onChange={(e) => setCondTipo(e.target.value)}
                >
                    <option value="" className="text-gray-500 font-normal">-- SELECCIONAR ANOMALÍA --</option>
                    {OPCIONES_CONDUCTORES.map(op => (
                        <option key={op.code} value={op.code}>{op.label}</option>
                    ))}
                </select>
            </div>

            {/* Input Detalle + Botón Agregar */}
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase ml-1">Detalle (Opcional)</label>
                <div className="flex gap-2">
                    <input 
                        className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 font-bold focus:border-blue-600 focus:bg-white outline-none transition-colors" 
                        placeholder="Ej: Cable deshilachado..." 
                        value={condDetalle} 
                        onChange={(e) => setCondDetalle(e.target.value)} 
                    />
                    <button 
                        onClick={(e) => { e.preventDefault(); agregarConductor(); }}
                        className="bg-blue-700 text-white px-5 rounded-lg font-extrabold text-sm uppercase border-2 border-blue-900 shadow-sm active:scale-95 transition-all disabled:bg-gray-300 disabled:border-gray-400 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center"
                        disabled={!condTipo}
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
      </div>


      {/* 4. PODA (ALTO CONTRASTE Y BOTÓN ARREGLADO) */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">🌳</span> Poda / Árboles
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Urgencia</label>
                <select className="border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white transition-colors outline-none" value={poda.urgencia} onChange={(e) => setPoda((s) => ({ ...s, urgencia: e.target.value }))}>
                    <option value="s/p">S/P</option>
                    <option value="c/p">C/P</option>
                    <option value="U">Urgente</option>
                    <option value="I">Inmediata</option>
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Medio</label>
                <select className="border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white transition-colors outline-none" value={poda.medio} onChange={(e) => setPoda((s) => ({ ...s, medio: e.target.value }))}>
                    <option value="c/e">C/E (Escalera)</option>
                    <option value="c/h">C/H (Hidro)</option>
                    <option value="f/s">F/S (Fuera Serv)</option>
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Cantidad</label>
                <input className="border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white text-center transition-colors outline-none" type="number" placeholder="Ej: 3" value={poda.cantidad_arboles} onChange={(e) => setPoda((s) => ({ ...s, cantidad_arboles: Number(e.target.value) }))} />
            </div>
        </div>
        
        <div className="flex flex-col gap-1 mt-2">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase ml-1">Detalle / Especie (Opcional)</label>
            <div className="flex gap-2">
                <input className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 font-bold focus:border-blue-600 focus:bg-white outline-none transition-colors" placeholder="Ej: Eucaliptos..." value={podaDetalle} onChange={(e) => setPodaDetalle(e.target.value)} />
                <button 
                    onClick={(e) => { e.preventDefault(); agregarPoda(); }} 
                    className="bg-blue-700 text-white px-5 rounded-lg font-extrabold text-sm uppercase border-2 border-blue-900 shadow-sm active:scale-95 transition-all flex items-center justify-center"
                >
                    Agregar
                </button>
            </div>
        </div>
      </div>

      {/* 5. BALIZOR (ARREGLO DE MARGEN Y CONTRASTE) */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">🏮</span> Balizor
        </div>
        
        <div className="space-y-3">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Tipo de Balizor</label>
                <select className="w-full border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white transition-colors outline-none" value={balizor} onChange={(e) => setBalizor(e.target.value)}>
                    <option value="N">Nocturno</option>
                    <option value="D">Diurno</option>
                </select>
            </div>
            
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase ml-1">Detalle (Opcional)</label>
                <div className="flex gap-2">
                    <input 
                        className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 font-bold focus:border-blue-600 focus:bg-white transition-colors outline-none" 
                        placeholder="Ej: Roto o Desprendido..." 
                        value={balizorDetalle} 
                        onChange={(e) => setBalizorDetalle(e.target.value)} 
                    />
                    <button 
                        onClick={(e) => { e.preventDefault(); agregarBalizor(); }} 
                        className="bg-blue-700 text-white px-5 rounded-lg font-extrabold text-sm uppercase border-2 border-blue-900 shadow-sm active:scale-95 transition-all flex items-center justify-center"
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* 6. COLUMNA */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">🗼</span> Columna
        </div>
        <div className="space-y-3">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Anomalía en Columna</label>
                <select className="w-full border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white transition-colors" value={colTipo} onChange={(e) => setColTipo(e.target.value)}>
                    <option value="" className="text-gray-500 font-normal">-- SELECCIONAR --</option>
                    {OPCIONES_COLUMNA.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
                </select>
            </div>
            <div className="flex gap-2">
                <input className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 font-bold focus:border-blue-600 focus:bg-white transition-colors" placeholder="Detalles (Opcional)..." value={colDetalle} onChange={(e) => setColDetalle(e.target.value)} />
                <button onClick={(e) => { e.preventDefault(); agregarColumna(); }} className="bg-blue-700 text-white px-4 rounded-lg font-extrabold text-sm uppercase border-2 border-blue-900 shadow-sm active:scale-95 transition-all disabled:bg-gray-300 disabled:border-gray-400 disabled:text-gray-500" disabled={!colTipo}>
                    Agregar
                </button>
            </div>
        </div>
      </div>

      {/* 7. TORRE */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">🏗️</span> Torre
        </div>
        <div className="space-y-3">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Anomalía en Torre</label>
                <select className="w-full border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white transition-colors" value={torreTipo} onChange={(e) => setTorreTipo(e.target.value)}>
                    <option value="" className="text-gray-500 font-normal">-- SELECCIONAR --</option>
                    {OPCIONES_TORRE.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
                </select>
            </div>
            <div className="flex gap-2">
                <input className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 font-bold focus:border-blue-600 focus:bg-white transition-colors" placeholder="Detalles (Opcional)..." value={torreDetalle} onChange={(e) => setTorreDetalle(e.target.value)} />
                <button onClick={(e) => { e.preventDefault(); agregarTorre(); }} className="bg-blue-700 text-white px-4 rounded-lg font-extrabold text-sm uppercase border-2 border-blue-900 shadow-sm active:scale-95 transition-all disabled:bg-gray-300 disabled:border-gray-400 disabled:text-gray-500" disabled={!torreTipo}>
                    Agregar
                </button>
            </div>
        </div>
      </div>

      {/* 8. GENERAL */}
      <div className="border-2 border-gray-300 rounded-xl p-3 bg-white shadow-sm space-y-3 mt-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">📋</span> General / Otros
        </div>
        <div className="space-y-3">
            <div className="flex flex-col">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Otras Anomalías</label>
                <select className="w-full border-2 border-gray-400 p-3 rounded-lg bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white transition-colors" value={genTipo} onChange={(e) => setGenTipo(e.target.value)}>
                    <option value="" className="text-gray-500 font-normal">-- SELECCIONAR --</option>
                    {OPCIONES_GENERAL.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
                </select>
            </div>
            <div className="flex gap-2">
                <input className="border-2 border-gray-400 p-3 rounded-lg flex-1 bg-gray-50 text-gray-900 placeholder-gray-400 font-bold focus:border-blue-600 focus:bg-white transition-colors" placeholder="Detalles (Opcional)..." value={genDetalle} onChange={(e) => setGenDetalle(e.target.value)} />
                <button onClick={(e) => { e.preventDefault(); agregarGeneral(); }} className="bg-blue-700 text-white px-4 rounded-lg font-extrabold text-sm uppercase border-2 border-blue-900 shadow-sm active:scale-95 transition-all disabled:bg-gray-300 disabled:border-gray-400 disabled:text-gray-500" disabled={!genTipo}>
                    Agregar
                </button>
            </div>
        </div>
      </div>

      {/* =========================== */}
      {/* LISTA DE ANOMALÍAS CARGADAS  */}
      {/* =========================== */}
      {(p.Anomalias && p.Anomalias.length > 0) && (
        <div className="border-2 border-red-500 rounded-xl p-4 bg-red-50 shadow-md mt-6">
           <h3 className="text-sm font-extrabold text-red-700 uppercase mb-3 flex items-center gap-2">
              <span className="text-xl">🚨</span> Anomalías Cargadas
           </h3>
           <ul className="divide-y-2 divide-red-200">
             {p.Anomalias.map(a => {
               // Descripciones
               let desc = a.ItemCatalogo?.descripcion || a.ItemCatalogo?.codigo;
               let det = a.valor_texto || a.valor_numero || '';
               
               // Formato PODA
               if (a.ItemCatalogo?.codigo === 'PODA' && a.PodaDetalle) {
                   det = `${a.PodaDetalle.urgencia}/${a.PodaDetalle.medio} (${a.PodaDetalle.cantidad_arboles}) ${det}`;
               }
               // Formato AISLADOR
               if (a.AisladorDetalle && a.AisladorDetalle.length > 0) {
                   const d = a.AisladorDetalle[0];
                   const tipoTxt = (a.ItemCatalogo?.codigo === 'AISL_ROTO') ? 'ROTO' : 'CACHADO';
                   desc = `AISL. ${tipoTxt} - FASE ${d.fase}`;
                   det = `Int: ${d.cantidad_interior} / Ext: ${d.cantidad_exterior} (Lado ${d.lado_referencia})`;
               }

               return (
               <li key={a.id} className="py-3 flex justify-between items-center gap-4">
                  <div className="text-sm flex-1">
                    <span className="font-extrabold text-gray-900 block leading-tight">{desc}</span>
                    <span className="text-red-800 font-bold text-xs mt-1 block bg-white border border-red-200 p-1.5 rounded inline-block">{det}</span>
                  </div>
                  <button 
                     onClick={(e) => { e.preventDefault(); borrarAnomalia(a.id); }} 
                     className="bg-red-600 text-white font-extrabold px-3 py-2 rounded-lg shadow-sm border-2 border-red-800 active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    Borrar
                  </button>
               </li>
               );
             })}
           </ul>
        </div>
      )}

      {showNextBtn && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-10 pointer-events-none">
          {/* pointer-events-none en el wrapper para poder hacer clic "a través" de los costados, 
              y pointer-events-auto en el botón para que sí funcione */}
          <div className="max-w-md mx-auto pointer-events-auto">
            <button 
               onClick={(e) => { e.preventDefault(); irAlSiguienteFlujo(); }} 
               className="w-full py-4 rounded-xl bg-blue-800 text-white font-extrabold text-lg uppercase tracking-widest shadow-[0_8px_30px_rgb(0,0,0,0.5)] border-2 border-blue-900 hover:bg-blue-900 active:scale-95 transition-all flex justify-center items-center gap-2"
            >
               Siguiente Piquete <span className="text-2xl">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}