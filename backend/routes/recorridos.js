// backend/routes/recorridos.js
const express = require('express');
const router = express.Router();
const { sequelize, Recorrido, Piquete, Anomalia, PodaDetalle } = require('../models');
/* RUTAS FIJAS PRIMERO*/
router.get('/__ping', (_req, res) => res.json({ ok:true, scope:'recorridos' })); // Ping para chequear montaje
router.get('/', async (req, res) => {  // GET: lista de recorridos
  try {
    const { Recorrido } = require('../models');
    const lista = await Recorrido.findAll({
      order: [['createdAt','DESC']],
      attributes: ['id','linea','kv','entre_desde','entre_hasta','ot_numero','carga_amp','estado','createdAt']
    });
    res.json(lista);
  } catch (e) { res.status(400).json({ error:e.message }); }
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
      fecha // estado por defecto lo define el modelo (EN_CURSO)
    });

    return res.status(201).json(creado);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

//Traer encabezado ******************************
router.get('/:id', async (req, res) => {
  const { Recorrido } = require('../models');
  const rec = await Recorrido.findByPk(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });
  res.json(rec);
});


// ************************* Detalle. Se muetra los detalles en la lista de piquetes
// GET /recorridos/:id/piquetes/detalle
router.get('/:id/piquetes/detalle', async (req, res) => {
  try {
    const { Recorrido, Piquete, Anomalia, ItemCatalogo, PodaDetalle } = require('../models');
    const rec = await Recorrido.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const piquetes = await Piquete.findAll({
      where: { recorrido_id: rec.id },
      order: [['orden','ASC']],
      include: [{
        model: Anomalia,
        include: [
          { model: ItemCatalogo, attributes: ['codigo','descripcion','tipo_entrada','max_value'] },
          { model: PodaDetalle }
        ]
      }]
    });

    // Derivados: tc_set y anomalias_count
    const out = piquetes.map(p => {
      const plain = p.toJSON();
      plain.tc_set = !!(plain.tc_ss || plain.tc_sd || plain.tc_sv || plain.tc_scm || plain.tc_rs || plain.tc_rd);
      plain.anomalias_count = Array.isArray(plain.Anomalia) ? plain.Anomalia.length : 0;
      return plain;
    });

    res.json(out);
  } catch (e) { res.status(400).json({ error: e.message }); }
});



// GET: /recorridos/:id/piquetes -> obtenemos la lista (vacía si aún no hay)
router.get('/:id/piquetes', async (req, res) => {
  try {
    const { Recorrido, Piquete } = require('../models');

    const rec = await Recorrido.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const lista = await Piquete.findAll({
      where: { recorrido_id: rec.id },
      order: [['orden', 'ASC']],
      attributes: ['id','recorrido_id','etiqueta','orden','sin_novedad']
    });

     // Devolver 200 aunque no haya piquetes
    return res.json(lista);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});



// (opcional) POST /recorridos/:id/finalizar → marca FINALIZADO
router.post('/:id/finalizar', async (req, res) => {
  try {
    const rec = await Recorrido.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });
    rec.estado = 'FINALIZADO';
    await rec.save();
    res.json({ ok: true, recorrido: rec });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// **************** rutas (POST crear, generar piquetes, finalizar, etc.)...********************************

router.post('/:id/piquetes/generar', async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad = 0, por = {}, ant = {} } = req.body;

    const rec = await Recorrido.findByPk(id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const n = Number(cantidad) || 0;
    if (n < 0) return res.status(400).json({ error: 'cantidad inválida' });

    const yaHay = await Piquete.count({ where: { recorrido_id: id } });
    if (yaHay > 0) return res.status(400).json({ error: 'Este recorrido ya tiene piquetes generados' });

    const piquetes = [];
    let orden = 1;

    // ANT al INICIO (uno o más)
    const antIni = Math.max(0, Number(ant.inicio || 0));
    for (let i = 0; i < antIni; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: 'ANT', orden: orden++ });
    }

    // POR al INICIO (boolean)
    if (por.inicio) {
      piquetes.push({ recorrido_id: id, etiqueta: 'POR', orden: orden++ });
    }

    // Piquetes numerados
    for (let i = 1; i <= n; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: String(i), orden: orden++ });
    }

    // POR al FINAL (boolean)
    if (por.final) {
      piquetes.push({ recorrido_id: id, etiqueta: 'POR', orden: orden++ });
    }

    // ANT al FINAL (uno o más)
    const antFin = Math.max(0, Number(ant.final || 0));
    for (let i = 0; i < antFin; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: 'ANT', orden: orden++ });
    }

    await Piquete.bulkCreate(piquetes);
    const lista = await Piquete.findAll({ where: { recorrido_id: id }, order: [['orden','ASC']] });
    res.json(lista);
  } catch (e) { res.status(400).json({ error: e.message }); }
});



// DELETE: /recorridos/:id → borrar recorrido
router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const rec = await Recorrido.findByPk(id, { transaction: t });
    if (!rec) {
      await t.rollback();
      return res.status(404).json({ error: 'Recorrido no existe' });
    }

    // Para bloquear borrado de recorridos finalizados, descomentar:
    // if (rec.estado === 'FINALIZADO') {
    //   await t.rollback();
    //   return res.status(400).json({ error: 'No se puede borrar un recorrido FINALIZADO' });
    // }

    // Piquetes del recorrido
    const piquetes = await Piquete.findAll({
      where: { recorrido_id: id },
      attributes: ['id'],
      transaction: t
    });
    const piqIds = piquetes.map(p => p.id);

    if (piqIds.length > 0) {
      // Anomalías de esos piquetes
      const anoms = await Anomalia.findAll({
        where: { piquete_id: piqIds },
        attributes: ['id'],
        transaction: t
      });
      const anomIds = anoms.map(a => a.id);

      // 1) Detalle de poda
      if (anomIds.length > 0) {
        await PodaDetalle.destroy({ where: { anomalia_id: anomIds }, transaction: t });
      }
      // 2) Anomalías
      await Anomalia.destroy({ where: { piquete_id: piqIds }, transaction: t });
      // 3) Piquetes
      await Piquete.destroy({ where: { recorrido_id: id }, transaction: t });
    }

    // 4) Recorrido
    await Recorrido.destroy({ where: { id }, transaction: t });

    await t.commit();
    res.json({ ok: true, deleted: String(id) });
  } catch (e) {
    await t.rollback();
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
