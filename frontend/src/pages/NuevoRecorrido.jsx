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

    cantidad: 0,
    // CAMBIO 1: Convertimos la posición de POR a dos booleanos independientes
    por_inicio: false,
    por_final: false,
    ant_inicio: 0,
    ant_final: 0
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

      // 1) crear encabezado
      const rec = await api("/recorridos", {
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
      
      // 2) generar piquetes (si corresponde)
      if (Number(form.cantidad) > 0 || form.por_inicio || form.por_final || Number(form.ant_inicio) > 0 || Number(form.ant_final) > 0) {
        await api(`/recorridos/${rec.id}/piquetes/generar`, {
          method: "POST",
          body: {
            cantidad: Number(form.cantidad || 0),
            // CAMBIO 2: Usamos los booleanos directos en el cuerpo de la solicitud
            por: { inicio: !!form.por_inicio, final: !!form.por_final },
            ant: { inicio: Number(form.ant_inicio || 0), final: Number(form.ant_final || 0) }
          }
        });
      }

      // 3) navegar a la lista de piquetes
      nav(`/recorridos/${rec.id}/piquetes`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Nuevo recorrido</h1>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-2 gap-3">
        <input className="border p-2 rounded" name="linea" placeholder="Línea" onChange={onChange} />
        <select className="border p-2 rounded" name="kv" value={form.kv} onChange={onChange}>
          <option>132</option><option>220</option>
        </select>

        <input className="border p-2 rounded col-span-2" name="entre_desde" placeholder="Entre (desde)" onChange={onChange} />
        <input className="border p-2 rounded col-span-2" name="entre_hasta" placeholder="Entre (hasta)" onChange={onChange} />

        <input className="border p-2 rounded" name="ot_numero" placeholder="OT" onChange={onChange} />
        <input className="border p-2 rounded" type="number" name="carga_amp" placeholder="Carga (A)" onChange={onChange} />

        <input className="border p-2 rounded col-span-2" type="date" name="fecha" value={form.fecha} onChange={onChange} /> 
      </div>

      {/* Configuración de piquetes */}
      <div className="border rounded p-3 space-y-3">
        <div className="font-medium">Configuración de Piquetes</div>

        {/* Cantidad numerados */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Cantidad de piquetes numerados (1..N)</label>
          <input className="border p-2 rounded w-32" type="number" min="0" name="cantidad"
            value={form.cantidad} onChange={onChange} />
        </div>

        {/* CORRECCIÓN JSX: Reemplazamos radio por checkboxes para POR */}
        <div className="col-span-2">
          <div className="text-sm font-medium mb-1">Piquetes POR (Tracción)</div>
          <div className="flex items-center gap-4 text-sm">
            <label>
              <input 
                type="checkbox" 
                name="por_inicio"
                checked={form.por_inicio}
                onChange={onChange} 
              /> Al inicio (Etiqueta: POR)
            </label>
            <label>
              <input 
                type="checkbox" 
                name="por_final"
                checked={form.por_final}
                onChange={onChange} 
              /> Al final (Etiqueta: POR)
            </label>
          </div>
        </div>

        {/* ANT (select 0..10) - Se mantiene el diseño, pero la lógica de estado es ahora independiente */}
        <div className="col-span-2">
          <div className="text-sm font-medium mb-1">Piquetes ANT (Anterior)</div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-gray-600">Cantidad al Inicio (Etiqueta: ANT)</label>
              <input type="number" min="0" max="10" name="ant_inicio" className="border p-2 rounded w-20"
                value={form.ant_inicio} onChange={onChange} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Cantidad al Final (Etiqueta: ANT)</label>
              <input type="number" min="0" max="10" name="ant_final" className="border p-2 rounded w-20"
                value={form.ant_final} onChange={onChange} />
            </div>
          </div>
        </div>
      </div>
      
      <button onClick={crear} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white">
        {saving ? "Guardando…" : "Crear"}
      </button>
      <button onClick={() => nav('/')} 
        className="ml-2 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"> Cancelar </button>
    </div>
  );
}