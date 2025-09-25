/*****------                  --------- PANTALLA 2 --------                  --------*****/


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

    cantidad: 0,          // piquetes numerados
    por_pos: "INICIO",   // INICIO | FINAL | NINGUNO
    ant_inicio: 0,       // 0..10
    ant_final: 0         // 0..10
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
      /*  const rec = await api("/recorridos", {
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
       }); */
      const rec = await api("/recorridos", { method: "POST", body: { 
        linea: form.linea,
        kv: form.kv,
        entre_desde: form.entre_desde,
        entre_hasta: form.entre_hasta,
        ot_numero: form.ot_numero,
        carga_amp: Number(form.carga_amp),
        fecha: form.fecha
       } });
      

      // 2) generar piquetes (si corresponde)
      if (Number(form.cantidad) > 0 || form.por_inicio || form.por_final || Number(form.ant_inicio) > 0 || Number(form.ant_final) > 0) {
        await api(`/recorridos/${rec.id}/piquetes/generar`, {
          method: "POST",
          body: {
            cantidad: Number(form.cantidad || 0),
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

        <input className="border p-2 rounded col-span-2" type="date" name="fecha" value={form.fecha} />
      </div>

      {/* Configuración de piquetes (sustituye tu bloque actual) */}
      <div className="border rounded p-3 space-y-3">
        <div className="font-medium">Piquetes iniciales</div>

        <div className="grid grid-cols-2 gap-3">
          {/* Cantidad numerados */}
          <div className="col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Cantidad de piquetes numerados (1..N)</label>
            <input className="border p-2 rounded w-32" type="number" min="0" name="cantidad"
              value={form.cantidad} onChange={onChange} />
          </div>

          {/* POR (radio: uno solo) */}
          <div className="col-span-2">
            <div className="text-sm font-medium mb-1">POR</div>
            <div className="flex items-center gap-4 text-sm">
              <label>
                <input type="radio" name="por_pos" value="INICIO"
                  checked={form.por_pos === "INICIO"} onChange={onChange} /> Inicio
              </label>
              <label>
                <input type="radio" name="por_pos" value="FINAL"
                  checked={form.por_pos === "FINAL"} onChange={onChange} /> Final
              </label>
              <label>
                <input type="radio" name="por_pos" value="NINGUNO"
                  checked={form.por_pos === "NINGUNO"} onChange={onChange} /> Ninguno
              </label>
            </div>
          </div>

          {/* ANT (select 0..10) */}
          <div className="col-span-2">
            <div className="text-sm font-medium mb-1">ANT</div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-600">Inicio</label>
                <select name="ant_inicio" className="border p-2 rounded w-20"
                  value={form.ant_inicio} onChange={onChange}>
                  {Array.from({ length: 11 }, (_, i) => i).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600">Final</label>
                <select name="ant_final" className="border p-2 rounded w-20"
                  value={form.ant_final} onChange={onChange}>
                  {Array.from({ length: 11 }, (_, i) => i).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button onClick={crear} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white">
        {saving ? "Guardando…" : "Crear"}
      </button>
      <button onClick={() => nav('/')} // o nav('/') si querés volver a la lista siempre
        className="ml-2 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"> Cancelar </button>
    </div>
  );
}
