import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function NuevoRecorrido() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    linea: "",
    kv: "132",
    entre_desde: "",
    entre_hasta: "",
    ot_numero: "",
    carga_amp: 0,
    fecha: new Date().toISOString().slice(0, 10),

    piq_desde: "", 
    piq_hasta: "",
    por_inicio: false,
    por_final: false,
    ant_inicio: 0,
    ant_final: 0,
    
    // VARIABLES NUEVAS PARA LA LÍNEA PARALELA
    crear_paralela: false,
    linea_paralela: ""
  });

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  async function crear() {
    try {
      setErr("");
      setSaving(true);

      // --- 1) CREAR LÍNEA PRINCIPAL ---
      const rec1 = await api("/recorridos", {
        method: "POST", 
        body: { 
          linea: form.linea,
          kv: form.kv,
          entre_desde: form.entre_desde,
          entre_hasta: form.entre_hasta,
          ot_numero: form.ot_numero,
          carga_amp: Number(form.carga_amp),
          fecha: form.fecha
        } 
      });
      
      // Generar piquetes de la Línea Principal
      await api(`/recorridos/${rec1.id}/piquetes/generar`, {
        method: "POST",
        body: {
          piq_desde: form.piq_desde,                
          piq_hasta: form.piq_hasta,                
          por_inicio: !!form.por_inicio,            
          por_final: !!form.por_final,              
          ant_inicio: Number(form.ant_inicio || 0), 
          ant_final: Number(form.ant_final || 0)    
        }
      });

      // --- 2) CREAR LÍNEA PARALELA (Si está activado) ---
      if (form.crear_paralela && form.linea_paralela) {
          const rec2 = await api("/recorridos", {
            method: "POST", 
            body: { 
              linea: form.linea_paralela, // ¡Acá mandamos el nombre de la 2da línea!
              kv: form.kv,
              entre_desde: form.entre_desde,
              entre_hasta: form.entre_hasta,
              ot_numero: form.ot_numero,
              carga_amp: Number(form.carga_amp),
              fecha: form.fecha
            } 
          });
          
          // Generar los mismos piquetes exactos para la Línea Paralela
          await api(`/recorridos/${rec2.id}/piquetes/generar`, {
            method: "POST",
            body: {
              piq_desde: form.piq_desde,                
              piq_hasta: form.piq_hasta,                
              por_inicio: !!form.por_inicio,            
              por_final: !!form.por_final,              
              ant_inicio: Number(form.ant_inicio || 0), 
              ant_final: Number(form.ant_final || 0)    
            }
          });


         
      }

      // 3) Navegar al inicio para ver las líneas listas (o directo a los piquetes si es una sola)
      if (form.crear_paralela) {
          nav(`/`); // Volvemos al menú principal para que puedan iniciar el modo vinculado
      } else {
          nav(`/recorridos/${rec1.id}/piquetes`);
      }
      
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 pb-12 bg-gray-50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b-2 border-gray-300 pb-3">
        <h1 className="text-2xl font-black text-blue-900 uppercase tracking-wide">
            Nuevo Recorrido
        </h1>
        <button onClick={() => nav('/')} className="text-sm font-extrabold text-gray-500 hover:text-gray-800 underline">
            Cancelar
        </button>
      </div>

      {err && <div className="bg-red-100 border-2 border-red-500 text-red-800 p-3 rounded-xl text-center text-sm font-extrabold shadow-sm">{err}</div>}

      {/* ========================================================= */}
      {/* TARJETA 1: DATOS GENERALES */}
      {/* ========================================================= */}
      <div className="border-2 border-gray-300 rounded-2xl p-4 bg-white shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">📋</span> Datos de la Línea
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 flex flex-col">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Nombre de la Línea</label>
              <input className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all" name="linea" placeholder="Ej: Terna 1" onChange={onChange} />
          </div>
          <div className="col-span-1 flex flex-col">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Tensión</label>
              <select className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all" name="kv" value={form.kv} onChange={onChange}>
                <option>132</option>
                <option>220</option>
              </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Entre (Desde)</label>
              <input className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all" name="entre_desde" placeholder="Estación A" onChange={onChange} />
          </div>
          <div className="flex flex-col">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Entre (Hasta)</label>
              <input className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all" name="entre_hasta" placeholder="Estación B" onChange={onChange} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">OT Número</label>
              <input className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all" name="ot_numero" placeholder="Ej: 12345" onChange={onChange} />
          </div>
          <div className="flex flex-col">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Carga (Amp)</label>
              <input className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all" type="number" name="carga_amp" placeholder="Ej: 400" onChange={onChange} />
          </div>
        </div>

        <div className="flex flex-col">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase mb-1 ml-1">Fecha</label>
            <input className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all w-full" type="date" name="fecha" value={form.fecha} onChange={onChange} /> 
        </div>

        {/* 🚀 MAGIA AQUÍ: LÍNEA PARALELA */}
        <div className="mt-4 p-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl transition-all">
            <label className="flex items-center gap-3 cursor-pointer font-black text-indigo-900 text-xs uppercase tracking-wide">
                <input type="checkbox" name="crear_paralela" checked={form.crear_paralela} onChange={onChange} className="w-5 h-5 accent-indigo-700 cursor-pointer" />
                ¿Crear línea paralela vinculada?
            </label>
            
            {form.crear_paralela && (
                <div className="mt-3 flex flex-col animate-fade-in">
                    <label className="text-[10px] font-extrabold text-indigo-600 uppercase mb-1 ml-1">Nombre de la Línea Paralela</label>
                    <input className="border-2 border-indigo-300 p-3 rounded-xl bg-white text-indigo-900 font-bold focus:border-indigo-600 outline-none transition-all shadow-inner" name="linea_paralela" placeholder="Ej: Terna 2" value={form.linea_paralela} onChange={onChange} />
                </div>
            )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TARJETA 2: CONFIGURACIÓN DE PIQUETES */}
      {/* ========================================================= */}
      <div className="border-2 border-gray-300 rounded-2xl p-4 bg-white shadow-sm space-y-5">
        <div className="flex items-center gap-2 font-extrabold text-gray-900 text-sm uppercase tracking-wide border-b-2 border-gray-200 pb-2">
           <span className="text-xl">⚙️</span> Piquetes del Tramo
        </div>

        {/* Numeración de Piquetes */}
        <div className="flex flex-col bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
          <label className="text-xs font-extrabold text-blue-900 uppercase mb-2">Numeración a Recorrer</label>
          <div className="flex gap-2 items-center justify-between">
             
             <div className="w-2/5 flex flex-col">
                 <span className="text-[10px] font-bold text-blue-800 mb-1 ml-1">Desde Nº:</span>
                 <input className="border-2 border-blue-400 p-2 rounded-lg bg-white text-blue-900 text-lg font-black focus:border-blue-700 outline-none text-center shadow-inner transition-all w-full" type="number" name="piq_desde" placeholder="Ej: 75" value={form.piq_desde || ""} onChange={onChange} />
             </div>
             
             <div className="font-black text-blue-300 text-xl flex-shrink-0">→</div>
             
             <div className="w-2/5 flex flex-col">
                 <span className="text-[10px] font-bold text-blue-800 mb-1 ml-1">Hasta Nº:</span>
                 <input className="border-2 border-blue-400 p-2 rounded-lg bg-white text-blue-900 text-lg font-black focus:border-blue-700 outline-none text-center shadow-inner transition-all w-full" type="number" name="piq_hasta" placeholder="Ej: 54" value={form.piq_hasta || ""} onChange={onChange} />
             </div>
             
          </div>
          <div className="text-[9px] text-blue-600 font-bold text-center mt-2 leading-tight">
            El sistema detectará si el recorrido sube o baja.
          </div>
        </div>

        {/* POR (Botones de Alternancia Táctiles) */}
        <div className="flex flex-col">
          <div className="text-[10px] font-extrabold text-gray-500 uppercase mb-2 ml-1">Agregar Pórticos (POR)</div>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center justify-center p-3 border-2 rounded-xl font-extrabold text-xs uppercase cursor-pointer transition-all ${form.por_inicio ? 'bg-blue-700 border-blue-900 text-white shadow-inner scale-95' : 'bg-gray-100 border-gray-400 text-gray-600 shadow-sm hover:bg-gray-200'}`}>
              <input type="checkbox" name="por_inicio" className="hidden" checked={form.por_inicio} onChange={onChange} />
              {form.por_inicio ? '✓ POR (Inicio)' : 'POR (Inicio)'}
            </label>
            <label className={`flex-1 flex items-center justify-center p-3 border-2 rounded-xl font-extrabold text-xs uppercase cursor-pointer transition-all ${form.por_final ? 'bg-blue-700 border-blue-900 text-white shadow-inner scale-95' : 'bg-gray-100 border-gray-400 text-gray-600 shadow-sm hover:bg-gray-200'}`}>
              <input type="checkbox" name="por_final" className="hidden" checked={form.por_final} onChange={onChange} />
              {form.por_final ? '✓ POR (Final)' : 'POR (Final)'}
            </label>
          </div>
        </div>

        {/* ANT (Anteriores) */}
        <div className="flex flex-col border-t-2 border-gray-100 pt-4">
          <div className="text-[10px] font-extrabold text-gray-500 uppercase mb-2 ml-1">Antenado (ANT)</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-600 mb-1 ml-1">Cant. al Inicio</label>
              <input type="number" min="0" max="10" name="ant_inicio" className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all text-center" value={form.ant_inicio} onChange={onChange} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-600 mb-1 ml-1">Cant. al Final</label>
              <input type="number" min="0" max="10" name="ant_final" className="border-2 border-gray-400 p-3 rounded-xl bg-gray-50 text-gray-900 font-bold focus:border-blue-600 focus:bg-white outline-none transition-all text-center" value={form.ant_final} onChange={onChange} />
            </div>
          </div>
        </div>
      </div>
      
      {/* ========================================================= */}
      {/* BOTONERA INFERIOR */}
      {/* ========================================================= */}
      <div className="pt-4 space-y-3">
        <button 
            onClick={crear} 
            disabled={saving} 
            className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-lg uppercase tracking-widest shadow-[0_4px_14px_0_rgb(5,150,105,0.39)] border-2 border-emerald-800 hover:bg-emerald-700 active:scale-95 transition-all disabled:bg-gray-400 disabled:border-gray-500 disabled:shadow-none"
        >
            {saving ? "Generando..." : (form.crear_paralela ? "Crear 2 Recorridos" : "Crear Recorrido")}
        </button>
        <button 
            onClick={() => nav('/')} 
            className="w-full py-3 rounded-xl bg-white text-gray-700 font-extrabold text-sm uppercase border-2 border-gray-300 hover:bg-gray-100 transition-all"
        >
            Cancelar
        </button>
      </div>

    </div>
  );
}