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
      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">Tipo de cadena</div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {["ss", "sd", "sv", "scm", "rs", "rd"].map((k) => (
            <label key={k} className="flex items-center gap-2 p-1 border rounded bg-gray-50">
              <input type="checkbox" className="w-4 h-4" checked={tc[k]} onChange={(e) => setTc((t) => ({ ...t, [k]: e.target.checked }))} />
              {k.toUpperCase()}
            </label>
          ))}
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

      {/* 2. AISLADORES (MATRIZ DINÁMICA) */}
      <div className="border rounded p-3 bg-white shadow-sm space-y-3">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">
             Aisladores 
             {/* Pequeña ayuda visual */}
             {(tc.sd || tc.rd || tc.sv) ? <span className="text-xs normal-case text-blue-600 ml-2">(Modo Cadena Doble)</span> : <span className="text-xs normal-case text-gray-500 ml-2">(Modo Cadena Simple)</span>}
        </div>
        
        {/* Selector LADO */}
        {p.Recorrido && (
            <div className="flex gap-2 mb-2">
                {[p.Recorrido.entre_desde, p.Recorrido.entre_hasta].map(lado => (
                    <button 
                        key={lado}
                        onClick={() => setAislLado(lado)}
                        className={`flex-1 py-2 rounded text-xs font-bold border uppercase ${aislLado === lado ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-300'}`}
                    >
                        Lado {lado}
                    </button>
                ))}
            </div>
        )}

        {/* Matriz de Entrada */}
        <div className="space-y-2">
            {['R', 'S', 'T'].map(fase => {
                // LÓGICA: ¿Es cadena doble? (SD o RD marcados)
                const esDoble = tc.sd || tc.rd || tc.sv;

                return (
                <div key={fase} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                    {/* Letra Fase */}
                    <div className="font-bold text-lg w-6 text-center text-gray-700">{fase}</div>
                    
                    {/* CASO 1: CADENA DOBLE (Muestra Int y Ext) */}
                    {esDoble && (
                        <>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] text-gray-500 text-center uppercase">Int</span>
                                <input 
                                    type="number" placeholder="-" className="w-full border rounded p-1 text-center font-bold bg-white"
                                    value={aislInputs[fase].int}
                                    onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] text-gray-500 text-center uppercase">Ext</span>
                                <input 
                                    type="number" placeholder="-" className="w-full border rounded p-1 text-center font-bold bg-white"
                                    value={aislInputs[fase].ext}
                                    onChange={(e) => handleAislInputChange(fase, 'ext', e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {/* CASO 2: CADENA SIMPLE (Muestra solo Cantidad) */}
                    {!esDoble && (
                        <div className="flex flex-col flex-1">
                            <span className="text-[10px] text-gray-500 text-center uppercase">Cantidad</span>
                            <input 
                                type="number" placeholder="-" className="w-full border rounded p-1 text-center font-bold bg-white"
                                // Usamos el campo 'int' para guardar el valor único
                                value={aislInputs[fase].int} 
                                onChange={(e) => handleAislInputChange(fase, 'int', e.target.value)}
                            />
                        </div>
                    )}

                    {/* Botones Agregar */}
                    <div className="flex flex-col gap-1 w-20">
                         <button 
                            // Habilitar si hay al menos un dato cargado
                            disabled={!aislInputs[fase].int && !aislInputs[fase].ext}
                            onClick={() => agregarAislador('ROTO', fase)}
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] py-1 px-1 rounded font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                         >
                            + Roto
                         </button>
                         <button 
                            disabled={!aislInputs[fase].int && !aislInputs[fase].ext}
                            onClick={() => agregarAislador('CACHADO', fase)}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] py-1 px-1 rounded font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                         >
                            + Cach
                         </button>
                    </div>
                </div>
                );
            })}
        </div>
        
        {/* Leyenda Dinámica */}
        <div className="text-[10px] text-gray-400 text-center mt-1">
           {(tc.sd || tc.rd) 
             ? "Se registran platos interiores y exteriores por separado." 
             : "Se registra la cantidad total de platos en la cadena."}
        </div>
      </div>

      {/* 3. CONDUCTORES (NUEVA SECCIÓN) */}

      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">Conductores</div>
        <div className="space-y-2">
            {/* Desplegable */}
            <select 
                className="w-full border p-2 rounded bg-white text-sm"
                value={condTipo}
                onChange={(e) => setCondTipo(e.target.value)}
            >
                <option value="">-- Seleccionar Anomalía --</option>
                {OPCIONES_CONDUCTORES.map(op => (
                    <option key={op.code} value={op.code}>{op.label}</option>
                ))}
            </select>
            {/* Input Detalle + Botón Agregar */}
            <div className="flex gap-2">
                <input 
                    className="border p-2 rounded flex-1 text-sm" 
                    placeholder="Detalles (opcional)..." 
                    value={condDetalle} 
                    onChange={(e) => setCondDetalle(e.target.value)} 
                />
                <button 
                    onClick={agregarConductor}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm disabled:bg-gray-400"
                    disabled={!condTipo}
                >
                    +
                </button>
            </div>
        </div>
      </div>



      {/* 4. PODA */}
      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">Poda</div>
        <div className="flex gap-2 text-sm">
          <select className="border p-2 rounded bg-white w-1/3" value={poda.urgencia} onChange={(e) => setPoda((s) => ({ ...s, urgencia: e.target.value }))}>
            <option value="s/p">s/p</option><option value="c/p">c/p</option><option value="U">U</option><option value="I">I</option>
          </select>
          <select className="border p-2 rounded bg-white w-1/3" value={poda.medio} onChange={(e) => setPoda((s) => ({ ...s, medio: e.target.value }))}>
            <option value="c/e">c/e</option><option value="c/h">c/h</option><option value="f/s">f/s</option>
          </select>
          <input className="border p-2 rounded w-1/3 pl-2" type="number" placeholder="Cant." value={poda.cantidad_arboles} onChange={(e) => setPoda((s) => ({ ...s, cantidad_arboles: Number(e.target.value) }))} />
        </div>
        <div className="flex gap-2">
            <input className="border p-2 rounded w-full text-sm" placeholder="Detalle poda..." value={podaDetalle} onChange={(e) => setPodaDetalle(e.target.value)} />
            <button onClick={agregarPoda} className="bg-gray-200 px-4 rounded text-gray-800 font-bold">+</button>
        </div>
      </div>

      {/* 5. BALIZOR */}
      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">Balizor</div>
        <div className="flex gap-2 items-center">
            <select className="border p-2 rounded w-20 bg-white text-sm" value={balizor} onChange={(e) => setBalizor(e.target.value)}>
                <option value="N">Noct</option><option value="D">Diur</option>
            </select>
            <input 
                className="border p-2 rounded flex-1 text-sm" 
                placeholder="Detalle (opcional)" 
                value={balizorDetalle} 
                onChange={(e) => setBalizorDetalle(e.target.value)} 
            />
            <button onClick={agregarBalizor} className="bg-gray-200 px-4 py-2 rounded text-gray-800 font-bold">+</button>
        </div>
      </div>

      {/* 6. COLUMNA (NUEVO) */}
      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">Columna</div>
        <div className="space-y-2">
            <select className="w-full border p-2 rounded bg-white text-sm" value={colTipo} onChange={(e) => setColTipo(e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {OPCIONES_COLUMNA.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
            </select>
            <div className="flex gap-2">
                <input className="border p-2 rounded flex-1 text-sm" placeholder="Detalles..." value={colDetalle} onChange={(e) => setColDetalle(e.target.value)} />
                <button onClick={agregarColumna} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm disabled:bg-gray-400" disabled={!colTipo}>+</button>
            </div>
        </div>
      </div>

      {/* 7. TORRE (NUEVO) */}
      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">Torre</div>
        <div className="space-y-2">
            <select className="w-full border p-2 rounded bg-white text-sm" value={torreTipo} onChange={(e) => setTorreTipo(e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {OPCIONES_TORRE.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
            </select>
            <div className="flex gap-2">
                <input className="border p-2 rounded flex-1 text-sm" placeholder="Detalles..." value={torreDetalle} onChange={(e) => setTorreDetalle(e.target.value)} />
                <button onClick={agregarTorre} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm disabled:bg-gray-400" disabled={!torreTipo}>+</button>
            </div>
        </div>
      </div>

      {/* 8. GENERAL (NUEVO) */}
      <div className="border rounded p-3 space-y-2 bg-white shadow-sm">
        <div className="font-medium text-gray-700 text-sm uppercase tracking-wide">General</div>
        <div className="space-y-2">
            <select className="w-full border p-2 rounded bg-white text-sm" value={genTipo} onChange={(e) => setGenTipo(e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {OPCIONES_GENERAL.map(op => <option key={op.code} value={op.code}>{op.label}</option>)}
            </select>
            <div className="flex gap-2">
                <input className="border p-2 rounded flex-1 text-sm" placeholder="Detalles..." value={genDetalle} onChange={(e) => setGenDetalle(e.target.value)} />
                <button onClick={agregarGeneral} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm disabled:bg-gray-400" disabled={!genTipo}>+</button>
            </div>
        </div>
      </div>

      {/* LISTA DE ANOMALÍAS CARGADAS */}
      {(p.Anomalias && p.Anomalias.length > 0) && (
        <div className="border rounded p-3 bg-red-50 border-red-100 shadow-sm">
           <h3 className="text-xs font-bold text-red-800 uppercase mb-2">Anomalías Cargadas</h3>
           <ul className="divide-y divide-red-200">
             {p.Anomalias.map(a => {
               // Descripciones
               let desc = a.ItemCatalogo?.descripcion || a.ItemCatalogo?.codigo;
               let det = a.valor_texto || a.valor_numero || '';
               
               // Formato PODA
               if (a.ItemCatalogo?.codigo === 'PODA' && a.PodaDetalle) {
                   det = `${a.PodaDetalle.urgencia}/${a.PodaDetalle.medio} (${a.PodaDetalle.cantidad_arboles}) ${det}`;
               }
               // Formato AISLADOR (Nueva estructura)
               if (a.AisladorDetalle && a.AisladorDetalle.length > 0) {
                   const d = a.AisladorDetalle[0];
                   // Icono visual simple según tipo
                   const tipoTxt = (a.ItemCatalogo?.codigo === 'AISL_ROTO') ? 'ROTO' : 'CACHADO';
                   desc = `AISL. ${tipoTxt} - FASE ${d.fase}`;
                   // Detalle: "Int: 2 / Ext: 0 (Lado Rosario)"
                   det = `Int: ${d.cantidad_interior} / Ext: ${d.cantidad_exterior} (Lado ${d.lado_referencia})`;
               }

               return (
               <li key={a.id} className="py-2 flex justify-between items-center">
                  <div className="text-sm">
                    <span className="font-bold text-gray-800 block">{desc}</span>
                    <span className="text-gray-600 text-xs">{det}</span>
                  </div>
                  <button onClick={() => borrarAnomalia(a.id)} className="ml-2 text-red-600 text-xs font-bold border border-red-300 bg-white px-2 py-1 rounded hover:bg-red-100">
                    X
                  </button>
               </li>
               );
             })}
           </ul>
        </div>
      )}

      {/* BOTÓN SIGUIENTE */}
      {showNextBtn && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-10">
          <div className="max-w-md mx-auto">
            <button onClick={irAlSiguienteFlujo} className="w-full py-3 rounded-lg bg-gray-900 text-black font-bold text-lg shadow-xl hover:bg-black transition-colors border-2 border-white/20">
              Siguiente piquete →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}