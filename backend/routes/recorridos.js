// backend/routes/recorridos.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { generarReporteExcel } from '../generarExcel.js'; 
import { 
  sequelize, 
  Recorrido, 
  Piquete, 
  Anomalia, 
  ItemCatalogo, 
  PodaDetalle, 
  Observaciones, 
  AisladorDetalle 
} from '../models/index.js';

// Definición de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* RUTAS FIJAS / LISTADO                                                     */
/* -------------------------------------------------------------------------- */

// Ping para chequear montaje
router.get('/__ping', (_req, res) => res.json({ ok: true, scope: 'recorridos' }));

// GET: lista de recorridos
router.get('/', async (req, res) => {
  try {
    const lista = await Recorrido.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'linea', 'kv', 'entre_desde', 'entre_hasta', 'ot_numero', 'carga_amp', 'estado', 'createdAt']
    });
    res.json(lista);
  } catch (e) { 
    res.status(400).json({ error: e.message }); 
  }
});

// POST: /recorridos → crea el encabezado de un recorrido
router.post('/', async (req, res) => {
  try {
    const {
      linea,          // string
      kv,             // '132' | '220'
      entre_desde,    // string
      entre_hasta,    // string
      ot_numero,      // string
      carga_amp,      // number
      fecha           // 'YYYY-MM-DD'
    } = req.body;

    if (!linea || !kv || !entre_desde || !entre_hasta || !ot_numero || carga_amp == null || !fecha) {
      return res.status(400).json({
        error: 'Campos requeridos: linea, kv, entre_desde, entre_hasta, ot_numero, carga_amp, fecha'
      });
    }

    const creado = await Recorrido.create({
      linea,
      kv,
      entre_desde,
      entre_hasta,
      ot_numero,
      carga_amp: Number(carga_amp),
      fecha
    });

    return res.status(201).json(creado);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// Traer encabezado individual
router.get('/:id', async (req, res) => {
  try {
    const rec = await Recorrido.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });
    res.json(rec);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* -------------------------------------------------------------------------- */
/* DETALLE DE PIQUETES Y ANOMALÍAS                                            */
/* -------------------------------------------------------------------------- */

// GET /recorridos/:id/piquetes/detalle
router.get('/:id/piquetes/detalle', async (req, res) => {
  try {
    const rid = Number(req.params.id);
    if (!Number.isInteger(rid)) {
      return res.status(400).json({ error: 'recorrido_id inválido' });
    }

    const rec = await Recorrido.findByPk(rid);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const piquetes = await Piquete.findAll({
      where: { recorrido_id: rid },
      order: [['orden', 'ASC']], 
      include: [
        {
          model: Anomalia,
          as: 'Anomalias', 
          include: [
            { model: ItemCatalogo, attributes: ['codigo', 'descripcion', 'tipo_entrada', 'max_value'] },
            { model: PodaDetalle, as: 'PodaDetalle' },
            { model: AisladorDetalle, as: 'AisladorDetalle' }
          ]
        },
        { model: Observaciones, as: 'Observaciones' }
      ]
    });

    const out = piquetes.map(p => {
      const plain = p.toJSON();
      plain.tc_set = !!(plain.tc_ss || plain.tc_sd || plain.tc_sv || plain.tc_scm || plain.tc_rs || plain.tc_rd);
      plain.anomalias_count = Array.isArray(plain.Anomalias) ? plain.Anomalias.length : 0; 
      
      if (Array.isArray(plain.Observaciones)) {
        plain.Observaciones.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return plain;
    });

    return res.json(out);
  } catch (e) {
    console.error('detalle error:', e);
    return res.status(400).json({ error: e.message });
  }
});

// GET: /recorridos/:id/piquetes -> lista de piquetes básicos
router.get('/:id/piquetes', async (req, res) => {
  try {
    const rec = await Recorrido.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const lista = await Piquete.findAll({
      where: { recorrido_id: rec.id },
      order: [['orden', 'ASC']],
      attributes: ['id', 'recorrido_id', 'etiqueta', 'orden', 'sin_novedad']
    });

    return res.json(lista);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// GENERAR PIQUETES (Detecta automáticamente extremos según subida o bajada)
// ===========================================================================
router.post('/:id/piquetes/generar', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      piq_desde, 
      piq_hasta, 
      por_inicio, 
      por_final, 
      ant_inicio, 
      ant_final 
    } = req.body;

    const rec = await Recorrido.findByPk(id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const yaHay = await Piquete.count({ where: { recorrido_id: id } });
    if (yaHay > 0) return res.status(400).json({ error: 'Este recorrido ya tiene piquetes generados' });

    const inicio = parseInt(piq_desde, 10);
    const fin = parseInt(piq_hasta, 10);
    const esBajada = inicio > fin; // Ejemplo: 75 -> 54

    const piquetes = [];
    let ordenBase = 10;

    // Determinar qué pórticos/antenados corresponden a la salida y a la llegada
    // Extremo de Salida: si es bajada, arranca en el extremo final (B); si es subida, arranca en (A).
    const tienePorSalida = esBajada ? (por_final === true || por_final === 'true') : (por_inicio === true || por_inicio === 'true');
    const cantAntSalida = esBajada ? Math.max(0, parseInt(ant_final, 10) || 0) : Math.max(0, parseInt(ant_inicio, 10) || 0);

    // Extremo de Llegada: si es bajada, termina en el extremo inicial (A); si es subida, termina en (B).
    const cantAntLlegada = esBajada ? Math.max(0, parseInt(ant_inicio, 10) || 0) : Math.max(0, parseInt(ant_final, 10) || 0);
    const tienePorLlegada = esBajada ? (por_inicio === true || por_inicio === 'true') : (por_final === true || por_final === 'true');

    // 1. PÓRTICO DE SALIDA
    if (tienePorSalida) {
      piquetes.push({ recorrido_id: id, etiqueta: 'POR', orden: ordenBase });
      ordenBase += 10;
    }

    // 2. ANTENADO DE SALIDA
    for (let i = 0; i < cantAntSalida; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: 'ANT', orden: ordenBase });
      ordenBase += 10;
    }

    // 3. PIQUETES NUMERADOS (75 -> 54 o 54 -> 75)
    if (!isNaN(inicio) && !isNaN(fin)) {
      const paso = (inicio <= fin) ? 1 : -1;
      for (let i = inicio; (paso > 0 ? i <= fin : i >= fin); i += paso) {
        piquetes.push({ recorrido_id: id, etiqueta: i.toString(), orden: ordenBase });
        ordenBase += 10;
      }
    }

    // 4. ANTENADO DE LLEGADA
    for (let i = 0; i < cantAntLlegada; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: 'ANT', orden: ordenBase });
      ordenBase += 10;
    }

    // 5. PÓRTICO DE LLEGADA
    if (tienePorLlegada) {
      piquetes.push({ recorrido_id: id, etiqueta: 'POR', orden: ordenBase });
      ordenBase += 10;
    }

    // Guardar en la base de datos
    await Piquete.bulkCreate(piquetes);

    const lista = await Piquete.findAll({ where: { recorrido_id: id }, order: [['orden', 'ASC']] });
    res.json(lista);

  } catch (e) { 
    console.error("❌ Error generando piquetes:", e);
    res.status(400).json({ error: e.message }); 
  }
});

// Agregar piquete inteligente al final
router.post('/:id/piquetes/final', async (req, res) => {
  try {
    const { id } = req.params;

    const piquetes = await Piquete.findAll({
      where: { recorrido_id: id },
      order: [['orden', 'ASC']]
    });

    const numerados = piquetes.filter(p => !isNaN(parseInt(p.etiqueta)) && !p.etiqueta.includes('BIS'));

    let nuevaEtiqueta = "NUEVO";
    let nuevoOrden = 1000;

    if (numerados.length > 0) {
      const ultimoNumerado = numerados[numerados.length - 1];
      const indiceOriginal = piquetes.findIndex(p => p.id === ultimoNumerado.id);
      
      let paso = 1;
      if (numerados.length >= 2) {
        const penultimo = parseInt(numerados[numerados.length - 2].etiqueta);
        const ultimo = parseInt(ultimoNumerado.etiqueta);
        if (ultimo < penultimo) paso = -1;
      }
      
      nuevaEtiqueta = (parseInt(ultimoNumerado.etiqueta) + paso).toString();

      if (indiceOriginal === piquetes.length - 1) {
        nuevoOrden = ultimoNumerado.orden + 1000;
      } else {
        const siguiente = piquetes[indiceOriginal + 1];
        nuevoOrden = (ultimoNumerado.orden + siguiente.orden) / 2;
      }
    } else if (piquetes.length > 0) {
      nuevoOrden = piquetes[piquetes.length - 1].orden + 1000;
    }

    const nuevo = await Piquete.create({
      recorrido_id: id,
      etiqueta: nuevaEtiqueta,
      orden: nuevoOrden
    });

    res.json(nuevo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/* FINALIZAR Y REPORTES EXCEL                                                 */
/* -------------------------------------------------------------------------- */

router.post('/:id/finalizar', async (req, res) => {
  try {
    const { id } = req.params;
    const datosReporte = req.body;
    const { meta } = datosReporte;

    console.log(`📡 Finalizando Recorrido ID: ${id}`);

    const r = await Recorrido.findByPk(id);
    if (!r) return res.status(404).json({ error: 'Recorrido no encontrado' });

    const nuevoEstado = meta?.estadoCierre?.includes('EMERGENCIA') ? 'EMERGENCIA' : 'COMPLETO';

    await r.update({
      estado: nuevoEstado,
      motivo_cierre: meta?.motivo || null,
      fecha_fin: new Date()
    });
    console.log("✅ Base de datos actualizada.");

    console.log("📊 Iniciando generación de Excel...");
    let nombreArchivoGenerado = null;
    try {
      nombreArchivoGenerado = await generarReporteExcel(datosReporte);
      console.log(`✅ Excel creado: ${nombreArchivoGenerado}`);
    } catch (excelError) {
      console.error("❌ Error generando Excel (pero se guardó en DB):", excelError.message);
    }

    res.json({ 
      ok: true, 
      recorrido: r, 
      archivo: nombreArchivoGenerado 
    });

  } catch (e) {
    console.error("❌ Error general:", e);
    res.status(400).json({ error: e.message });
  }
});

// Descargar archivo Excel por nombre
router.get('/descargar/:nombreArchivo', (req, res) => {
  const { nombreArchivo } = req.params;
  const filePath = path.join(__dirname, '../', nombreArchivo);

  if (fs.existsSync(filePath)) {
    res.download(filePath, nombreArchivo, (err) => {
      if (err) console.error("Error al descargar:", err);
    });
  } else {
    res.status(404).json({ error: "El archivo ya no existe o caducó." });
  }
});

// Descargar Excel por ID de recorrido
router.get('/:id/excel', async (req, res, next) => {
  try {
    const nombreArchivo = await generarReporteExcel(req.params.id);
    res.download(nombreArchivo);
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/* ELIMINAR RECORRIDO                                                         */
/* -------------------------------------------------------------------------- */

router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const rec = await Recorrido.findByPk(id, { transaction: t });
    if (!rec) {
      await t.rollback();
      return res.status(404).json({ error: 'Recorrido no existe' });
    }

    const piquetes = await Piquete.findAll({
      where: { recorrido_id: id },
      attributes: ['id'],
      transaction: t
    });
    const piqIds = piquetes.map(p => p.id);

    if (piqIds.length > 0) {
      const anoms = await Anomalia.findAll({
        where: { piquete_id: piqIds },
        attributes: ['id'],
        transaction: t
      });
      const anomIds = anoms.map(a => a.id);

      if (anomIds.length > 0) {
        await PodaDetalle.destroy({ where: { anomalia_id: anomIds }, transaction: t });
        await AisladorDetalle.destroy({ where: { anomalia_id: anomIds }, transaction: t });
      }
      await Anomalia.destroy({ where: { piquete_id: piqIds }, transaction: t });
      await Observaciones.destroy({ where: { piquete_id: piqIds }, transaction: t });
      await Piquete.destroy({ where: { recorrido_id: id }, transaction: t });
    }

    await Recorrido.destroy({ where: { id }, transaction: t });

    await t.commit();
    res.json({ ok: true, deleted: String(id) });
  } catch (e) {
    await t.rollback();
    res.status(400).json({ error: e.message });
  }
});

export default router;