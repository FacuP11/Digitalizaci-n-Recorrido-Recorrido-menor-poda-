// src/components/UIExamples.jsx
export default function UIExamples() {
  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Catálogo de UI</h1>

      {/* Tipografía */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Tipografía</h2>
        <p className="text-xl font-semibold">Título (text-xl font-semibold)</p>
        <p className="text-sm text-gray-600">Texto secundario (text-sm text-gray-600)</p>
        <p className="text-red-600">Error (text-red-600)</p>
        <p className="text-blue-700 underline">Link (text-blue-700 underline)</p>
      </section>

      {/* Layout básicos */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Layout</h2>
        <div className="border rounded p-3">Caja (border rounded p-3)</div>
        <div className="flex gap-2">
          <div className="border rounded p-2">flex item</div>
          <div className="border rounded p-2">flex item</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded p-2">grid col</div>
          <div className="border rounded p-2">grid col</div>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Inputs</h2>
        <input className="border p-2 rounded w-full" placeholder="Input básico" />
        <select className="border p-2 rounded w-full">
          <option>Opción A</option><option>Opción B</option>
        </select>
        <div className="flex items-center gap-2">
          <input id="chk" type="checkbox" className="h-4 w-4" />
          <label htmlFor="chk" className="text-sm">Checkbox</label>
        </div>
        <input className="border p-2 rounded w-24" type="number" min="0" placeholder="0" />
        <textarea className="border p-2 rounded w-full" rows={3} placeholder="Textarea"></textarea>
      </section>

      {/* Botones */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Botones</h2>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Primario</button>
          <button className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">Éxito</button>
          <button className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Secundario</button>
          <button className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">Peligro</button>
          <button className="px-3 py-2 rounded bg-blue-600/50 text-white cursor-not-allowed" disabled>Disabled</button>
          <button className="text-blue-700 underline">Texto/link</button>
        </div>
      </section>

      {/* Badges/Etiquetas */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Badges</h2>
        <div className="flex gap-2 flex-wrap">
          <span className="px-2 py-1 rounded text-xs bg-gray-200">POR</span>
          <span className="px-2 py-1 rounded text-xs bg-gray-200">ANT</span>
          <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">SIN NOVEDAD</span>
          <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">PODA</span>
          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">BALIZOR N</span>
          <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">BALIZOR D</span>
        </div>
      </section>

      {/* Listas */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Listas</h2>
        <ul className="divide-y">
          <li className="py-2 flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">Piq 12</div>
              <div className="text-xs text-gray-500">Detalle breve</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-gray-200">POR</span>
              <button className="text-blue-700 underline">Abrir</button>
            </div>
          </li>
          <li className="py-2 flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">Piq 13</div>
              <div className="text-xs text-emerald-700">Sin novedad</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-gray-200">ANT</span>
              <button className="text-blue-700 underline">Abrir</button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
