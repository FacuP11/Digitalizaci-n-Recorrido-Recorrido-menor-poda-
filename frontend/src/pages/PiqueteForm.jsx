import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

export default function PiqueteForm() {
  const { piqueteId } = useParams();
  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  const [showNextBtn, setShowNextBtn] = useState(false);
  const [obsTexto, setObsTexto] = useState("");

  // Query params para flujo alternado y orden
  const [sp] = useSearchParams();
  const order = sp.get("order") === "desc" ? "desc" : "asc";
  const partner = sp.get("partner") || null; // ID del recorrido “pareja” (B)
  const partnerBack = sp.get("partner_back") || null; // ID del recorrido al que volver (A)
  const nextLabel = sp.get("next_label") || null; // etiqueta específica a la que volver

  /**************** ESTADOS ***************/
  // Tipo de cadena (inicial por defecto, luego se sincroniza con el server en cargar())
  const [tc, setTc] = useState({
    ss: false, sd: false, sv: false, scm: false, rs: false, rd: false,
    lado: "INICIO", cadenas: "V",
  });

  // PODA
  const [poda, setPoda] = useState({ urgencia: "s/p", medio: "c/e", cantidad_arboles: 0 });
  const [podaDetalle, setPodaDetalle] = useState(""); // detalle libre de poda

  // BALIZOR
  const [balizor, setBalizor] = useState("N");

  /*************** HELPERS ***************/
  // Normaliza etiqueta → { kind: 'NUM'|'POR'|'ANT'|'OTRO', num: number|null, suf: string }
  function parseEtiqueta(etq) {
    if (etq === 'POR') return { kind: 'POR', num: null, suf: '' };
    if (etq === 'ANT') return { kind: 'ANT', num: null, suf: '' };
    const m = String(etq).match(/^(\d+)([A-Za-z]*)$/);
    if (m) return { kind: 'NUM', num: Number(m[1]), suf: m[2] || '' };
    return { kind: 'OTRO', num: null, suf: String(etq) };
  }

  // Lista ascendente “cruda” (como la entrega el backend)
  async function listaRecorr(recId) {
    return api(`/recorridos/${recId}/piquetes`);
  }

  // Busca el ID del piquete dado un recorrido y una ETIQUETA EXACTA.
  async function idPorEtiqueta(recId, etiqueta) {
    const lista = await listaRecorr(recId);
    const found = lista.find(x => x.etiqueta === etiqueta);
    return found?.id ?? null;
  }

  // Busca en un recorrido un piquete que tenga el MISMO número (ignora POR/ANT/sufijos)
  async function idPorNumero(recId, numero) {
    const lst = await listaRecorr(recId);
    const cand = lst.find(x => parseEtiqueta(x.etiqueta).kind === 'NUM' && parseEtiqueta(x.etiqueta).num === numero);
    return cand?.id ?? null;
  }

  // Devuelve la etiqueta del siguiente piquete NUMÉRICO (salta POR/ANT), respetando orden asc/desc
  async function siguienteEtiquetaNumerica(recId, etiquetaActual, ord = 'asc') {
    const lst = await listaRecorr(recId); // ascendente por 'orden'
    const idx = lst.findIndex(x => x.etiqueta === etiquetaActual);
    if (idx < 0) return null;

    // Avanzamos hacia adelante o atrás buscando el PRÓXIMO NUM
    const step = (ord === 'desc') ? -1 : 1;
    for (let i = idx + step; i >= 0 && i < lst.length; i += step) {
      const p = lst[i];
      const info = parseEtiqueta(p.etiqueta);
      if (info.kind === 'NUM') return p.etiqueta;
    }
    return null;
  }


  /*************** CARGA ***************/
  async function cargar() {
    try {
      setErr("");
      const data = await api(`/piquetes/${piqueteId}`); // GET detalle
      setP(data);

      // Sincronizar TC mostrado con lo guardado
      setTc({
        ss: !!data.tc_ss, sd: !!data.tc_sd, sv: !!data.tc_sv,
        scm: !!data.tc_scm, rs: !!data.tc_rs, rd: !!data.tc_rd,
        lado: data.tc_lado || "INICIO",
        cadenas: data.tc_cadenas || "V",
      });
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    setShowNextBtn(false); 
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piqueteId]);

  /*************** NAVEGACIÓN ***************/
  // Flujo alternado (A:N → B:N → A:N+1 → B:N+1 …)
  async function irAlSiguienteFlujo() {
    if (!p) return;
    const etq = p.etiqueta;
    const info = parseEtiqueta(etq);

    // Si estoy en POR/ANT/OTRO → ir al primer NUM de esta misma línea y listo.
    if (info.kind !== 'NUM') {
      const nextNumLabel = await siguienteEtiquetaNumerica(p.recorrido_id, etq, order);
      if (nextNumLabel) {
        const nextId = await idPorEtiqueta(p.recorrido_id, nextNumLabel);
        if (nextId) {
          // Mantenemos los parámetros de navegación para el siguiente piquete
          const url = `/piquetes/${nextId}?order=${order}${partner ? `&partner=${partner}` : ''}`;
          nav(url);
          return;
        }
      }
      // si no hay más números, volvemos a la lista
      nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`);
      return;
    }

    // En este punto estoy en un NUM → alterno si corresponde
    const numeroActual = info.num;

    // Caso 1: PRINCIPAL (tengo partner pero NO partner_back) → saltar al mismo número del partner
    if (partner && !partnerBack) {
      const partnerId = await idPorNumero(partner, numeroActual);
      const nextLabPrincipal = await siguienteEtiquetaNumerica(p.recorrido_id, etq, order); // etiqueta numérica a la que volver
      if (partnerId) {
        // vamos al partner con indicación de volver al principal luego a nextLab
        const url = `/piquetes/${partnerId}?order=${order}&partner_back=${p.recorrido_id}${
          nextLabPrincipal ? `&next_label=${encodeURIComponent(nextLabPrincipal)}` : ''
        }`;
        nav(url);
        return;
      }
      // si el partner no tiene ese número, seguimos en principal al siguiente NUM (ver Caso 3)
    }

    // Caso 2: PARTNER (tengo partner_back) → volver al PRINCIPAL al siguiente NUM (o next_label si vino)
    if (partnerBack) {
      let targetLabel = nextLabel;
      if (!targetLabel) {
        targetLabel = await siguienteEtiquetaNumerica(partnerBack, etq, order);
      }
      
      if (targetLabel) {
        const targetId = await idPorEtiqueta(partnerBack, targetLabel);
        if (targetId) {
          // volvemos al principal (partnerBack) y dejamos partner apuntando a la línea actual (p.recorrido_id)
          // ESTA ES LA CORRECCIÓN CLAVE PARA MANTENER LA ALTERNANCIA
          nav(`/piquetes/${targetId}?order=${order}&partner=${p.recorrido_id}`); 
          return;
        }
      }
      // fin de recorrido del principal (o error al encontrar el target)
      nav(`/recorridos/${partnerBack}/piquetes?order=${order}`);
      return;
    }

    // Caso 3: sin partner o partner falló en Caso 1 → siguiente NUM en esta línea
    const nextLab = await siguienteEtiquetaNumerica(p.recorrido_id, etq, order);
    if (nextLab) {
      const nextId = await idPorEtiqueta(p.recorrido_id, nextLab);
      if (nextId) {
        // Aseguramos que si existía un partner, se pase para la siguiente alternancia.
        nav(`/piquetes/${nextId}?order=${order}${partner ? `&partner=${partner}` : ''}`);
        return;
      }
    }
    // fin
    nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`);
  }


  /*************** ACCIONES ***************/
  // CORRECCIÓN 1: No navegamos al siguiente piquete después de guardar Tipo de Cadena.
  async function guardarTipoCadena() {
    try {
      await api(`/piquetes/${piqueteId}/tipo-cadena`, {
        method: "POST",
        body: {
          tc_ss: tc.ss, tc_sd: tc.sd, tc_sv: tc.sv, tc_scm: tc.scm, tc_rs: tc.rs, tc_rd: tc.rd,
          tc_lado: tc.lado, tc_cadenas: tc.cadenas,
        },
      });
      // Sólo recargamos el estado local para que el usuario vea que se guardó.
      await cargar(); 
      // Mostramos un mensaje de éxito rápido (opcional, pero mejor para el usuario)
      // En un entorno de producción, aquí podrías usar un toast/snackbar.
      setErr("Tipo de cadena guardado.");
      setTimeout(() => setErr(""), 2000);
      
    } catch (e) {
      setErr(e.message);
    }
  }

  // ACCIÓN SIN NOVEDAD: usa el flujo de navegación complejo
  async function marcarSinNovedad() {
    try {
      await api(`/piquetes/${piqueteId}/sin-novedad`, { method: "POST" });
      await irAlSiguienteFlujo(); 
    } catch (e) {
      setErr(e.message);
    }
  }

  // ACCIÓN AGREGAR PODA: usa el flujo de navegación complejo después de mostrar el botón
  async function agregarPoda() {
    try {
      await api(`/piquetes/${piqueteId}/anomalias`, {
        method: "POST",
        body: {
          item_codigo: "PODA",
          poda,                        
          valor_texto: podaDetalle 
        },
      });
      setShowNextBtn(true);
      await cargar();
    } catch (e) {
      setErr(e.message);
    }
  }

  // ACCIÓN AGREGAR BALIZOR: usa el flujo de navegación complejo después de mostrar el botón
  async function agregarBalizor() {
    try {
      await api(`/piquetes/${piqueteId}/anomalias`, {
        method: "POST",
        body: { item_codigo: "BALIZOR", valor_texto: balizor }, 
      });
      setShowNextBtn(true);
      await cargar();
    } catch (e) {
      setErr(e.message);
    }
  }

  /*************** RENDER ***************/
  if (!p) return <div className="max-w-md mx-auto p-4">Cargando…</div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <button
        className="text-blue-700 underline"
        onClick={() => nav(`/recorridos/${p.recorrido_id}/piquetes?order=${order}`)}
      >
        ← Volver
      </button>

      <h1 className="text-xl font-semibold">Piquete {p.etiqueta}</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Tipo de cadena */}
      <div className="border rounded p-3 space-y-2">
        <div className="font-medium">Tipo de cadena</div>
        {/* ... (Resto del JSX para Tipo de cadena) ... */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          {["ss", "sd", "sv", "scm", "rs", "rd"].map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={tc[k]}
                onChange={(e) => setTc((t) => ({ ...t, [k]: e.target.checked }))}
              />
              {k.toUpperCase()}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="border p-2 rounded"
            value={tc.lado}
            onChange={(e) => setTc((t) => ({ ...t, lado: e.target.value }))}
          >
            <option>INICIO</option>
            <option>FIN</option>
          </select>
          <select
            className="border p-2 rounded"
            value={tc.cadenas}
            onChange={(e) => setTc((t) => ({ ...t, cadenas: e.target.value }))}
          >
            <option>V</option>
            <option>P</option>
            <option>C</option>
            <option>LP</option>
            <option>M</option>
          </select>
          <button onClick={guardarTipoCadena} className="px-3 py-2 rounded bg-blue-600 text-white">
            Guardar
          </button>
        </div>

        <button onClick={marcarSinNovedad} className="text-emerald-700 underline text-sm">
          SIN NOVEDAD
        </button>
      </div>

      {/* Poda */}
      <div className="border rounded p-3 space-y-2">
        <div className="font-medium">Poda</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            className="border p-2 rounded"
            value={poda.urgencia}
            onChange={(e) => setPoda((s) => ({ ...s, urgencia: e.target.value }))}
          >
            <option value="s/p">s/p</option>
            <option value="c/p">c/p</option>
            <option value="U">U</option>
            <option value="I">I</option>
          </select>

          <select
            className="border p-2 rounded"
            value={poda.medio}
            onChange={(e) => setPoda((s) => ({ ...s, medio: e.target.value }))}
          >
            <option value="c/e">c/e</option>
            <option value="c/h">c/h</option>
            <option value="f/s">f/s</option>
          </select>

          <input
            className="border p-2 rounded w-24"
            type="number"
            min="0"
            value={poda.cantidad_arboles}
            onChange={(e) => setPoda((s) => ({ ...s, cantidad_arboles: Number(e.target.value) }))}
          />
        </div>

        {/* Detalle libre de poda */}
        <textarea
          className="border p-2 rounded w-full text-sm"
          rows={2}
          placeholder="Detalle de poda (opcional, ej: 'entre 45 y 46 con hidroelevador')"
          value={podaDetalle}
          onChange={(e) => setPodaDetalle(e.target.value)}
        />

        <div className="flex">
          <button onClick={agregarPoda} className="px-3 py-2 rounded bg-blue-600 text-white">
            Agregar
          </button>
        </div>
      </div>

      {/* Balizor */}
      <div className="border rounded p-3 space-y-2">
        <div className="font-medium">Balizor roto</div>
        <div className="flex items-center gap-2">
          <select
            className="border p-2 rounded"
            value={balizor}
            onChange={(e) => setBalizor(e.target.value)}
          >
            <option value="N">Nocturno (N)</option>
            <option value="D">Diurno (D)</option>
          </select>
          <button onClick={agregarBalizor} className="px-3 py-2 rounded bg-blue-600 text-white">
            Agregar
          </button>
        </div>
      </div>

      {/* Observaciones */}
      <section className="border rounded p-3 space-y-2">
        <div className="font-medium">Observaciones</div>

        <textarea
          className="border p-2 rounded w-full"
          rows={3}
          placeholder="Detalle (ej: entre 45 y 46, poda con hidroelevador por cercanía a edificio)"
          value={obsTexto}
          onChange={(e) => setObsTexto(e.target.value)}
        />

        <div className="flex justify-end">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white"
            onClick={async () => {
              try {
                if (!obsTexto.trim()) return;
                await api(`/piquetes/${piqueteId}/observaciones`, {
                  method: "POST",
                  body: { texto: obsTexto },
                });
                setObsTexto("");
                await cargar(); // refresca Observaciones
              } catch (e) {
                setErr(e.message);
              }
            }}
          >
            Agregar observación
          </button>
        </div>

        <ul className="divide-y">
          {(p?.Observaciones ?? [])
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((obs) => (
              <li key={obs.id} className="py-2 flex items-start justify-between gap-3">
                <div className="text-sm whitespace-pre-wrap">{obs.texto}</div>
                <button
                  className="text-red-700 underline text-xs"
                  onClick={async () => {
                    try {
                      await api(`/piquetes/${piqueteId}/observaciones/${obs.id}`, {
                        method: "DELETE",
                      });
                      await cargar();
                    } catch (e) {
                      setErr(e.message);
                    }
                  }}
                >
                  borrar
                </button>
              </li>
            ))}
        </ul>
      </section>

      {/* Novedades cargadas (Anomalías) */}
      <section className="border rounded p-3 space-y-2">
        <div className="font-medium">Novedades cargadas</div>
        <ul className="text-sm list-disc pl-5 space-y-1">
          {(p?.Anomalias ?? []).map((a) => (
            <li key={a.id}>
              <span className="font-medium">
                {a.ItemCatalogo?.descripcion || a.ItemCatalogo?.codigo}
              </span>
              {/* Poda */}
              {a.ItemCatalogo?.codigo === "PODA" && a.PodaDetalle && (
                <> — {a.PodaDetalle.urgencia}/{a.PodaDetalle.medio} ({a.PodaDetalle.cantidad_arboles})</>
              )}
              {/* Balizor u otros con valor_texto */}
              {a.valor_texto ? <> — {a.valor_texto}</> : null}
              {/* Campos numéricos (señalización, etc.) */}
              {typeof a.valor_numero === "number" ? <> — {a.valor_numero}</> : null}
            </li>
          ))}
          {(!p?.Anomalias || p.Anomalias.length === 0) && (
            <li className="text-gray-500">Sin novedades registradas.</li>
          )}
        </ul>
      </section>

      {/* Botón para avanzar cuando hay anomalia creada */}
      {showNextBtn && (
        <div className="flex justify-end">
          <button onClick={irAlSiguienteFlujo} className="px-3 py-2 rounded bg-gray-900 text-white">
            Siguiente piquete →
          </button>
        </div>
      )}

      {/* Debug */}
      <div className="border rounded p-3">
        <div className="font-medium mb-2">Debug</div>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-56">
          {JSON.stringify(p?.Anomalias || [], null, 2)}
        </pre>
      </div>
    </div>
  );
}