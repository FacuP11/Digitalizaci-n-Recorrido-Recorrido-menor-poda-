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
    
    crear_paralela: false,
    linea_paralela: "",
    ot_numero_paralela: ""
  });

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'number') {
      if (value === '') {
        setForm(f => ({ ...f, [name]: '' }));
      } else {
        const valNum = Math.max(0, parseInt(value, 10) || 0);
        setForm(f => ({ ...f, [name]: valNum }));
      }
      return;
    }

    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const bloquearTeclasInvalidas = (e) => {
    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  async function crear() {
    try {
      setErr("");

      const desde = parseInt(form.piq_desde, 10);
      const hasta = parseInt(form.piq_hasta, 10);

      if (isNaN(desde) || desde <= 0 || isNaN(hasta) || hasta <= 0) {
        setErr("Los piquetes 'Desde' y 'Hasta' deben ser números enteros positivos mayores a 0.");
        return;
      }

      if (!form.linea.trim() || !form.ot_numero.trim() || !form.entre_desde.trim() || !form.entre_hasta.trim()) {
        setErr("Por favor complete los campos obligatorios: Línea, Tensión, OT y Tramo.");
        return;
      }

      if (form.crear_paralela) {
        if (!form.linea_paralela.trim()) {
          setErr("Debe ingresar el nombre para la 2da Línea paralela.");
          return;
        }
        if (!form.ot_numero_paralela.trim()) {
          setErr("Debe ingresar el N° de OT específico para la 2da Línea.");
          return;
        }
      }

      setSaving(true);

      const antIni = Math.max(0, parseInt(form.ant_inicio, 10) || 0);
      const antFin = Math.max(0, parseInt(form.ant_final, 10) || 0);

      // 1) LÍNEA PRINCIPAL
      const rec1 = await api("/recorridos", {
        method: "POST", 
        body: { 
          linea: form.linea.trim(),
          kv: form.kv,
          entre_desde: form.entre_desde.trim(),
          entre_hasta: form.entre_hasta.trim(),
          ot_numero: form.ot_numero.trim(),
          carga_amp: Number(form.carga_amp) || 0,
          fecha: form.fecha
        } 
      });
      
      await api(`/recorridos/${rec1.id}/piquetes/generar`, {
        method: "POST",
        body: {
          piq_desde: desde,                
          piq_hasta: hasta,                
          por_inicio: !!form.por_inicio,            
          por_final: !!form.por_final,              
          ant_inicio: antIni, 
          ant_final: antFin    
        }
      });

      // 2) LÍNEA PARALELA
      if (form.crear_paralela) {
        const rec2 = await api("/recorridos", {
          method: "POST", 
          body: { 
            linea: form.linea_paralela.trim(),
            kv: form.kv,
            entre_desde: form.entre_desde.trim(),
            entre_hasta: form.entre_hasta.trim(),
            ot_numero: form.ot_numero_paralela.trim(),
            carga_amp: Number(form.carga_amp) || 0,
            fecha: form.fecha
          } 
        });
        
        await api(`/recorridos/${rec2.id}/piquetes/generar`, {
          method: "POST",
          body: {
            piq_desde: desde,                
            piq_hasta: hasta,                
            por_inicio: !!form.por_inicio,            
            por_final: !!form.por_final,              
            ant_inicio: antIni, 
            ant_final: antFin    
          }
        });

        localStorage.setItem(`partner_for_${rec1.id}`, String(rec2.id));
        localStorage.setItem(`partner_for_${rec2.id}`, String(rec1.id));
      }

      if (form.crear_paralela) {
        nav(`/`);
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
    <div className="layout-container">
      
      {/* HEADER */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wide">
          Nuevo Recorrido
        </h1>
        <button onClick={() => nav('/')} className="btn-secondary !min-h-[38px] !text-xs">
          Cancelar
        </button>
      </div>

      {err && <div className="bg-red-500 text-white p-3 rounded-xl text-center text-sm font-black shadow-md border-2 border-red-700">{err}</div>}

      {/* TARJETA 1: DATOS GENERALES */}
      <div className="card-base space-y-4">
        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xs md:text-sm uppercase tracking-wider border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <span>📋</span> Datos de la Línea
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 flex flex-col">
            <label className="label-title">Nombre de la Línea</label>
            <input className="input-field" name="linea" placeholder="Ej: Terna 1" value={form.linea} onChange={onChange} />
          </div>
          <div className="col-span-1 flex flex-col">
            <label className="label-title">Tensión</label>
            <select className="input-field" name="kv" value={form.kv} onChange={onChange}>
              <option>132</option>
              <option>220</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="label-title">Entre (Desde)</label>
            <input className="input-field" name="entre_desde" placeholder="Estación A" value={form.entre_desde} onChange={onChange} />
          </div>
          <div className="flex flex-col">
            <label className="label-title">Entre (Hasta)</label>
            <input className="input-field" name="entre_hasta" placeholder="Estación B" value={form.entre_hasta} onChange={onChange} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="label-title">OT Número (Principal)</label>
            <input className="input-field" name="ot_numero" placeholder="Ej: 12345" value={form.ot_numero} onChange={onChange} />
          </div>
          <div className="flex flex-col">
            <label className="label-title">Carga (Amp)</label>
            <input className="input-field !text-center" type="number" min="0" onKeyDown={bloquearTeclasInvalidas} name="carga_amp" placeholder="Ej: 400" value={form.carga_amp} onChange={onChange} />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="label-title">Fecha</label>
          <input className="input-field" type="date" name="fecha" value={form.fecha} onChange={onChange} /> 
        </div>

        {/* LÍNEA PARALELA */}
        <div className="mt-4 p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl transition-all">
          <label className="flex items-center gap-3 cursor-pointer font-black text-indigo-900 dark:text-indigo-300 text-xs md:text-sm uppercase tracking-wide">
            <input type="checkbox" name="crear_paralela" checked={form.crear_paralela} onChange={onChange} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
            ¿Crear línea paralela vinculada (2da Terna)?
          </label>
          
          {form.crear_paralela && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
              <div className="flex flex-col">
                <label className="label-title text-indigo-700 dark:text-indigo-300">Nombre 2da Línea</label>
                <input className="input-field" name="linea_paralela" placeholder="Ej: Terna 2" value={form.linea_paralela} onChange={onChange} />
              </div>
              <div className="flex flex-col">
                <label className="label-title text-indigo-700 dark:text-indigo-300">OT N° (2da Línea)</label>
                <input className="input-field" name="ot_numero_paralela" placeholder="Ej: 12346" value={form.ot_numero_paralela} onChange={onChange} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TARJETA 2: CONFIGURACIÓN DE PIQUETES */}
      <div className="card-base space-y-5">
        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xs md:text-sm uppercase tracking-wider border-b-2 border-slate-100 dark:border-slate-800 pb-2">
          <span>⚙️</span> Piquetes del Tramo
        </div>

        {/* Numeración Positiva */}
        <div className="flex flex-col bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700">
          <label className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase mb-2">Numeración a Recorrer</label>
          <div className="flex gap-3 items-center justify-between">
            <div className="w-2/5 flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Desde Nº:</span>
              <input 
                className="input-field !text-center !text-lg !font-black" 
                type="number" 
                min="1" 
                step="1"
                onKeyDown={bloquearTeclasInvalidas}
                name="piq_desde" 
                placeholder="75" 
                value={form.piq_desde || ""} 
                onChange={onChange} 
              />
            </div>
            
            <div className="font-black text-slate-400 dark:text-slate-500 text-2xl flex-shrink-0">→</div>
            
            <div className="w-2/5 flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Hasta Nº:</span>
              <input 
                className="input-field !text-center !text-lg !font-black" 
                type="number" 
                min="1" 
                step="1"
                onKeyDown={bloquearTeclasInvalidas}
                name="piq_hasta" 
                placeholder="54" 
                value={form.piq_hasta || ""} 
                onChange={onChange} 
              />
            </div>
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold text-center mt-2">
            El sistema detecta automáticamente si el tramo sube o baja.
          </div>
        </div>

        {/* POR (Pórticos) */}
        <div className="flex flex-col">
          <div className="label-title">Agregar Pórticos (POR)</div>
          <div className="flex gap-3">
            <label className={`flex-1 min-h-[46px] flex items-center justify-center p-3 border-2 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${form.por_inicio ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <input type="checkbox" name="por_inicio" className="hidden" checked={form.por_inicio} onChange={onChange} />
              {form.por_inicio ? '✓ POR (Inicio)' : 'POR (Inicio)'}
            </label>
            <label className={`flex-1 min-h-[46px] flex items-center justify-center p-3 border-2 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${form.por_final ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <input type="checkbox" name="por_final" className="hidden" checked={form.por_final} onChange={onChange} />
              {form.por_final ? '✓ POR (Final)' : 'POR (Final)'}
            </label>
          </div>
        </div>

        {/* ANT (Anteado) */}
        <div className="flex flex-col border-t-2 border-slate-100 dark:border-slate-800 pt-4">
          <div className="label-title">Antenado (ANT)</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Cant. al Inicio</label>
              <input 
                type="number" 
                min="0" 
                max="20" 
                step="1"
                onKeyDown={bloquearTeclasInvalidas}
                name="ant_inicio" 
                className="input-field !text-center !font-black" 
                value={form.ant_inicio} 
                onChange={onChange} 
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1">Cant. al Final</label>
              <input 
                type="number" 
                min="0" 
                max="20" 
                step="1"
                onKeyDown={bloquearTeclasInvalidas}
                name="ant_final" 
                className="input-field !text-center !font-black" 
                value={form.ant_final} 
                onChange={onChange} 
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* BOTONERA INFERIOR */}
      <div className="pt-2 space-y-3">
        <button 
          onClick={crear} 
          disabled={saving} 
          className="btn-success w-full !text-base"
        >
          {saving ? "⏳ Generando..." : (form.crear_paralela ? "🚀 Crear 2 Recorridos Vinculados" : "🚀 Crear Recorrido")}
        </button>
        <button 
          onClick={() => nav('/')} 
          className="btn-secondary w-full"
        >
          Cancelar
        </button>
      </div>

    </div>
  );
}