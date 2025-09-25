import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

export default function PiquetesList() {
  const { id } = useParams(); // id de recorrido
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [rec, setRec] = useState(null);
  const [piquetes, setPiquetes] = useState([]);
  const [cant, setCant] = useState(0);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("ALL"); // ALL | NOV | SN
  const order = sp.get("order") === "desc" ? "desc" : "asc"; // ascendente por defecto


   useEffect(() => {
    (async () => {
      try {
        setErr("");
        const r = await api(`/recorridos/${id}`);
        setRec(r);
        const list = await api(`/recorridos/${id}/piquetes/detalle`);
        setPiquetes(list);
      } catch (e) { setErr(e.message); }
    })();
  }, [id]);
  
  async function cargar() {
    try {
      setErr("");
      // Usamos el endpoint "detalle" para traer tc_set y anomalías
      const list = await api(`/recorridos/${id}/piquetes/detalle`);
      setPiquetes(list);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { cargar(); }, [id]);

  async function generar() {
    try {
      await api(`/recorridos/${id}/piquetes/generar`, {
        method: "POST",
        body: { cantidad: Number(cant || 0), por: { inicio: true, final: false }, ant: { inicio: 0, final: 0 } }
      });
      setCant(0);
      cargar();
    } catch (e) { setErr(e.message); }
  }

  async function insertarBis(refId, posicion="DESPUES") {
    try {
      await api(`/piquetes/${refId}/insertar`, { method: "POST", body: { posicion } });
      cargar();
    } catch (e) { setErr(e.message); }
  }

  async function finalizar() {
    try {
      await api(`/recorridos/${id}/finalizar`, { method: "POST" });
      alert("Recorrido finalizado");
    } catch (e) { setErr(e.message); }
  }

  // Orden POR -> ANT -> número (incluye '155B' detrás de 155)
  function etiquetaRank(etq) {
    if (etq === "POR") return { grp: 0, n: 0, suf: "" };
    if (etq === "ANT") return { grp: 1, n: 0, suf: "" };
    // num o num+letra
    const m = String(etq).match(/^(\d+)([A-Za-z]*)$/);
    if (m) return { grp: 2, n: Number(m[1]), suf: m[2] || "" };
    return { grp: 3, n: Number.MAX_SAFE_INTEGER, suf: String(etq) };
  }

   const ordenados = useMemo(() => {
    const base = [...piquetes].sort((a,b) => {
      const A = etiquetaRank(a.etiqueta), B = etiquetaRank(b.etiqueta);
      if (A.grp !== B.grp) return A.grp - B.grp;
      if (A.n !== B.n) return A.n - B.n;
      return A.suf.localeCompare(B.suf);
    });
    return order === "asc" ? base : base.reverse();
  }, [piquetes, order]);

  const filtrados = useMemo(() => {
    const base = ordenados;
    if (filter === "SN") return base.filter(p => p.sin_novedad);
    if (filter === "NOV") return base.filter(p => !p.sin_novedad);
    return base;
  }, [ordenados, filter]);

  function BadgePORANT(etiqueta) {
    if (etiqueta === "POR" || etiqueta === "ANT") {
      return <span className="px-2 py-1 rounded text-xs bg-gray-200">{etiqueta}</span>;
    }
    return null;
  }

  function resumenTipoCadena(p) {
    const tipos = [];
    if (p.tc_ss) tipos.push("SS");
    if (p.tc_sd) tipos.push("SD");
    if (p.tc_sv) tipos.push("SV");
    if (p.tc_scm) tipos.push("SCM");
    if (p.tc_rs) tipos.push("RS");
    if (p.tc_rd) tipos.push("RD");
    if (!tipos.length) return "—";
    const lado = p.tc_lado ? ` • ${p.tc_lado}` : "";
    const cad = p.tc_cadenas ? ` • ${p.tc_cadenas}` : "";
    return `${tipos.join("/")}${lado}${cad}`;
  }

  function resumenAnomalias(p) {
    if (p.sin_novedad) return <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">SIN NOVEDAD</span>;
    if (!p.Anomalia || p.Anomalia.length === 0) return <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">FALTA completar</span>;
    // Compactar: mostrar hasta 2, luego "+n"
    const max = 2;
    const parts = p.Anomalia.slice(0, max).map(a => {
      const desc = a.ItemCatalogo?.descripcion || a.item_id;
      if (a.ItemCatalogo?.codigo === "PODA" && a.PodaDetalle) {
        return `PODA ${a.PodaDetalle.urgencia}/${a.PodaDetalle.medio} (${a.PodaDetalle.cantidad_arboles})`;
        }
      if (a.ItemCatalogo?.codigo === "BALIZOR" && a.valor_texto) {
        return `BALIZOR ${a.valor_texto}`;
      }
      if (a.valor_numero != null) return `${desc}: ${a.valor_numero}`;
      if (a.marcado) return `${desc}: X`;
      if (a.valor_texto) return `${desc}: ${a.valor_texto}`;
      return desc;
    });
    const resto = p.Anomalia.length - max;
    const txt = resto > 0 ? `${parts.join(" • ")} • +${resto}` : parts.join(" • ");
    return <span className="text-xs text-gray-700">{txt}</span>;
  }

  //Borrar Piquete
  async function borrarPiquete(pid) {
    const ok = window.confirm("¿Eliminar este piquete y sus marcas? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await api(`/piquetes/${pid}`, { method: "DELETE" });
      setPiquetes(list => list.filter(p => p.id !== pid));
    } catch (e) { setErr(e.message); }
  }


  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Volver + Finalizar */}
      <div className="flex items-center justify-between">
        <button onClick={()=>nav('/')} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">← Volver</button>
        <h1 className="text-xl font-semibold">Linea {/*ACA TIENE QUE IR EL NRO DE LINEA */}</h1>
        <button onClick={finalizar} className="px-3 py-2 rounded bg-emerald-600 text-black">Finalizar</button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Generar piquetes rápidos */}
    {/*   <div className="flex gap-2 items-center">
        <input className="border p-2 rounded w-24" type="number" min="0" placeholder="Cant."
               value={cant} onChange={e=>setCant(e.target.value)} />
        <button onClick={generar} className="px-3 py-2 rounded bg-blue-600 text-white">Generar</button>
      </div> */}

      {/* Filtros */}
      <div className="flex gap-2">
        <button onClick={()=>setFilter("ALL")}
                className={`px-3 py-1 rounded ${filter==="ALL" ? "bg-gray-900 text-black" : "bg-gray-200"}`}>
          Todos
        </button>
        <button onClick={()=>setFilter("NOV")}
                className={`px-3 py-1 rounded ${filter==="NOV" ? "bg-gray-900 text-white" : "bg-gray-200"}`}>
          Con novedad
        </button>
        <button onClick={()=>setFilter("SN")}
                className={`px-3 py-1 rounded ${filter==="SN" ? "bg-gray-900 text-white" : "bg-gray-200"}`}>
          Sin novedad
        </button>
      </div>

      {/* Lista */}
      <ul className="divide-y">
        {filtrados.map(p => (
          <li key={p.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <div className="font-medium">Piq {p.etiqueta}</div>
                  {BadgePORANT(p.etiqueta)}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Tipo cadena: {resumenTipoCadena(p)}
                </div>
                <div className="mt-1">
                  {resumenAnomalias(p)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* BIS */}
                <div className="flex flex-col items-end gap-1">
                  <button className="text-blue-700 underline text-xs" onClick={()=>insertarBis(p.id, "ANTES")}>+BIS antes</button>
                  <button className="text-blue-700 underline text-xs" onClick={()=>insertarBis(p.id, "DESPUES")}>+BIS desp.</button>
                </div>
                {/* Abrir */}
                <Link className="px-2 py-1 rounded bg-blue-600 text-white" to={`/piquetes/${p.id}`}>Abrir</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Info cuando no hay piquetes */}
      {(!err && filtrados.length === 0) && (
        <p className="text-sm text-gray-600">No hay piquetes aún. Generá POR/ANT y numerados con el panel de arriba.</p>
      )}
    </div>
  );
}
