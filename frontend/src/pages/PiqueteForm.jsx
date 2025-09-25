import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

export default function PiqueteForm() {
  const { piqueteId } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [sp] = useSearchParams();
  const order = sp.get('order') === 'desc' ? 'desc' : 'asc';
  const partner = sp.get('partner');        // recorrido “pareja”
  const partnerBack = sp.get('partner_back'); // si estamos en partner, volver a este recorrido
  const nextLabel = sp.get('next_label');     // etiqueta a la que hay que volver
  const [err, setErr] = useState("");
  const [showNextBtn, setShowNextBtn] = useState(false); // ← mostrar “Siguiente piquete” tras crear anomalia
  const [obsTexto, setObsTexto] = useState(""); // ← observaciones


  // Estado local para tipo de cadena
  const [tc, setTc] = useState({
    ss: false, sd: false, sv: false, scm: false, rs: false, rd: false,
    lado: "INICIO", cadenas: "V"
  });

  // Estado para PODA
  const [poda, setPoda] = useState({ urgencia: "s/p", medio: "c/e", cantidad_arboles: 0 });
  const [podaDetalle, setPodaDetalle] = useState(""); // ← DETALLE DE PODA

  // Estado para Balizor
  const [balizor, setBalizor] = useState("N");

  async function cargar() {
    try {
      setErr("");
      const data = await api(`/piquetes/${piqueteId}`); // GET detalle
      setP(data);

    } catch (e) { setErr(e.message); }
  }

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        setShowNextBtn(false);
        const data = await api(`/piquetes/${piqueteId}`);
        setP(data);
      } catch (e) { setErr(e.message); }
    })();
  }, [piqueteId]);

  // lista de piquetes de un recorrido
  async function listaRecorr(recId) {
    return api(`/recorridos/${recId}/piquetes`);
  }

  // dado un recorrido y una etiqueta, encuentra piquete id
  async function idPorEtiqueta(recId, etiqueta) {
    const lista = await listaRecorr(recId);
    const found = lista.find(x => x.etiqueta === etiqueta);
    return found?.id || null;
  }

  // saltos:
  async function irAlSiguienteFlujo() {
    if (!p) return;
    const etiquetaActual = p.etiqueta;

    // Caso 1: estoy en PRINCIPAL (sin partner_back) y tengo partner → saltar al partner mismo etiqueta
    if (partner && !partnerBack) {
      const partnerId = await idPorEtiqueta(partner, etiquetaActual);
      const nextLab = await siguienteEtiqueta(p.recorrido_id, etiquetaActual);
      if (partnerId) {
        // vamos al partner con indicación de volver al principal luego a nextLab
        const url = `/piquetes/${partnerId}?order=${order}&partner_back=${p.recorrido_id}${nextLab ? `&next_label=${encodeURIComponent(nextLab)}` : ''}`;
        nav(url);
        return;
      }
      // si no existe etiqueta en partner, seguimos al siguiente del principal
    }

    // Caso 2: estoy en PARTNER (tengo partner_back). Volver al principal a next_label
    if (partnerBack) {
      // si me dieron next_label, ir ahí; si no, al siguiente calculado
      let targetLabel = nextLabel;
      if (!targetLabel) {
        targetLabel = await siguienteEtiqueta(partnerBack, etiquetaActual);
      }
      if (targetLabel) {
        const targetId = await idPorEtiqueta(partnerBack, targetLabel);
        if (targetId) {
          nav(`/piquetes/${targetId}?order=${order}&partner=${p.recorrido_id}`); // partner ahora es el actual (para continuar alternando)
          return;
        }
      }
      // si no hay siguiente, volvemos a la lista
      nav(`/recorridos/${partnerBack}/piquetes?order=${order}`);
      return;
    }

    // Caso 3: no hay partner → siguiente normal en este recorrido
    const nextLab = await siguienteEtiqueta(p.recorrido_id, etiquetaActual);
    if (nextLab) {
      const nextId = await idPorEtiqueta(p.recorrido_id, nextLab);
      if (nextId) {
        nav(`/piquetes/${nextId}?order=${order}${partner ? `&partner=${partner}` : ''}`);
        return;
      }
    }
    // fin del recorrido
    nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`);
  }

  async function guardarTipoCadena() {
    try {
      await api(`/piquetes/${piqueteId}/tipo-cadena`, {
        method: "POST",
        body: {
          tc_ss: tc.ss, tc_sd: tc.sd, tc_sv: tc.sv, tc_scm: tc.scm, tc_rs: tc.rs, tc_rd: tc.rd,
          tc_lado: tc.lado, tc_cadenas: tc.cadenas
        }
      });
      cargar();
    } catch (e) { setErr(e.message); }
  }

  //** */ IR AL SIGUIENTE PIQUETE (por orden)
  async function irAlSiguiente() {
    try {
      if (!p) return;

      const lista = await api(`/recorridos/${p.recorrido_id}/piquetes`);// Traemos la lista ordenada y buscamos el siguiente por "orden"
      const actual = lista.find(x => x.id === p.id);
      if (!actual) return;


      const siguiente = lista.find(x => x.orden > actual.orden);// siguiente = primer piquete con orden > actual
      if (siguiente) nav(`/piquetes/${siguiente.id}`);
      else {

        nav(`/recorridos/${p.recorrido_id}/piquetes`);// si no hay siguiente, volvemos a la lista
      }
    } catch (e) {
      setErr(e.message);
    }
  }
// /******************* SIN NOVEDAD *********************
  async function marcarSinNovedad() {
    try {
      await api(`/piquetes/${piqueteId}/sin-novedad`, { method: "POST" });

      await irAlSiguienteFlujo();// Auto-saltar al siguiente piquete
    } catch (e) { setErr(e.message); }
  }
//** ********************AGREGAR PODA**************** */
  async function agregarPoda() {
    try {
      await api(`/piquetes/${piqueteId}/anomalias`, {
        method: "POST",
        body: {
          item_codigo: "PODA",
          poda,                        // urgencia/medio/cantidad_arboles
          valor_texto: podaDetalle     //  detalle libre de la poda
        }
      });
      setShowNextBtn(true); // habilita “Siguiente piquete”
      //await cargar();
    } catch (e) { setErr(e.message); }
  }

  async function agregarBalizor() {
    try {
      await api(`/piquetes/${piqueteId}/anomalias`, {
        method: "POST",
        body: {
          item_codigo: "BALIZOR",
          valor_texto: balizor
        }
      });
      setShowNextBtn(true); // habilita “Siguiente piquete”
      //cargar();
    } catch (e) { setErr(e.message); }
  }

  async function marcarSinNovedad() {
    try {
      await api(`/piquetes/${piqueteId}/sin-novedad`, { method: "POST" });
      await irAlSiguiente(); // <- navega al siguiente
    } catch (e) { setErr(e.message); }
  }

  if (!p) return <div className="max-w-md mx-auto p-4">Cargando…</div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <button className="text-blue-700 underline" onClick={() => nav(`/recorridos/${p.recorrido_id}/piquetes`)}>← Volver</button>
      <h1 className="text-xl font-semibold"> Piquete {p.etiqueta}</h1>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Tipo de cadena */}
      <div className="border rounded p-3 space-y-2">
        <div className="font-medium"> Tipo de cadena </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {["ss", "sd", "sv", "scm", "rs", "rd"].map(k => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={tc[k]} onChange={e => setTc(t => ({ ...t, [k]: e.target.checked }))} />
              {k.toUpperCase()}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <select className="border p-2 rounded" value={tc.lado} onChange={e => setTc(t => ({ ...t, lado: e.target.value }))}>
            <option> INICIO </option> <option> FIN </option>
          </select>
          <select className="border p-2 rounded" value={tc.cadenas} onChange={e => setTc(t => ({ ...t, cadenas: e.target.value }))}>
            <option> V </option><option> P </option><option>C</option><option>LP</option><option>M</option>
          </select>
          <button onClick={guardarTipoCadena} className="px-3 py-2 rounded bg-blue-600 text-white">Guardar</button>
        </div>

        <button onClick={marcarSinNovedad} className="text-emerald-700 underline text-sm"> SIN NOVEDAD </button>
      </div>

      {/* Poda */}
      <div className="border rounded p-3 space-y-2">
        <div className="font-medium">Poda</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select className="border p-2 rounded" value={poda.urgencia} onChange={e => setPoda(s => ({ ...s, urgencia: e.target.value }))}>
            <option value="s/p">s/p</option><option value="c/p">c/p</option><option value="U">U</option><option value="I">I</option>
          </select>
          <select className="border p-2 rounded" value={poda.medio} onChange={e => setPoda(s => ({ ...s, medio: e.target.value }))}>
            <option value="c/e">c/e</option><option value="c/h">c/h</option><option value="f/s">f/s</option>
          </select>
          <input className="border p-2 rounded w-24" type="number" min="0"
            value={poda.cantidad_arboles}
            onChange={e => setPoda(s => ({ ...s, cantidad_arboles: Number(e.target.value) }))} />
          <button onClick={agregarPoda} className="px-3 py-2 rounded bg-blue-600 text-white">Agregar</button>
        </div>
      </div>

      {/* Balizor */}
      <div className="border rounded p-3 space-y-2">
        <div className="font-medium">Balizor roto</div>
        <div className="flex items-center gap-2">
          <select className="border p-2 rounded" value={balizor} onChange={e => setBalizor(e.target.value)}>
            <option value="N">Nocturno (N)</option>
            <option value="D">Diurno (D)</option>
          </select>
          <button onClick={agregarBalizor} className="px-3 py-2 rounded bg-blue-600 text-white">Agregar</button>
        </div>
      </div>

      {/*/ Dentro del JSX, debajo de Poda/Balizor, agrega la sección Observaciones:*/}
      <section className="border rounded p-3 space-y-2">
        <div className="font-medium">Observaciones</div>

        <textarea
          className="border p-2 rounded w-full"
          rows={3}
          placeholder="Detalle (ej: entre 45 y 46, poda con hidroelevador por cercanía a edificio)"
          value={obsTexto}
          onChange={e => setObsTexto(e.target.value)}
        />

        <div className="flex justify-end">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white"
            onClick={async () => {
              try {
                if (!obsTexto.trim()) return;
                await api(`/piquetes/${piqueteId}/observaciones`, {
                  method: "POST",
                  body: { texto: obsTexto }
                });
                setObsTexto("");
                await cargar(); // refresca la lista del piquete (incluye Observaciones)
              } catch (e) { setErr(e.message); }
            }}
          >
            {/* Agregar observación */} Agregar observación
          </button>
        </div>

        <ul className="divide-y">
          {(p.Observaciones || p.Observaciones || []).slice().sort((a, b) => (
            new Date(b.createdAt) - new Date(a.createdAt)
          )).map(obs => (
            <li key={obs.id} className="py-2 flex items-start justify-between gap-3">
              <div className="text-sm whitespace-pre-wrap">{obs.texto}</div>
              <button
                className="text-red-700 underline text-xs"
                onClick={async () => {
                  try {
                    await api(`/piquetes/${piqueteId}/observaciones/${obs.id}`, { method: "DELETE" });
                    await cargar();
                  } catch (e) { setErr(e.message); }
                }}
              >
                borrar
              </button>
            </li>
          ))}
        </ul>
      </section>


      {/* Botón para avanzar cuando hay anomalia creada */}
      {showNextBtn && (
        <div className="flex justify-end">
          <button onClick={irAlSiguiente} className="px-3 py-2 rounded bg-gray-900 text-white">
            Siguiente piquete →
          </button>
        </div>
      )}

      {/* Vista rápida de lo cargado */}
      <div className="border rounded p-3">
        <div className="font-medium mb-2">Cargado</div>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-56">
          {JSON.stringify(p.Anomalia || [], null, 2)}
        </pre>
      </div>
    </div>
  );
}
