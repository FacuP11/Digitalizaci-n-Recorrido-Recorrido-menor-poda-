const express = require('express');
const router = express.Router();
const { Op } = require('sequelize'); // ← IMPORTANTE
const { sequelize, Piquete, Anomalia, ItemCatalogo, PodaDetalle } = require('../models');

//Borrar un piquete
router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const p = await Piquete.findByPk(id, { transaction: t });
    if (!p) { await t.rollback(); return res.status(404).json({ error: 'Piquete no existe' }); }

    // Anomalías del piquete
    const anoms = await Anomalia.findAll({ where: { piquete_id: p.id }, attributes:['id'], transaction:t });
    const anomIds = anoms.map(a => a.id);

    // 1) detalle de poda
    if (anomIds.length) {
      await PodaDetalle.destroy({ where: { anomalia_id: anomIds }, transaction: t });
    }
    // 2) anomalías
    await Anomalia.destroy({ where: { piquete_id: p.id }, transaction: t });
    // 3) observaciones
    await Observacion.destroy({ where: { piquete_id: p.id }, transaction: t });
    // 4) piquete
    await Piquete.destroy({ where: { id: p.id }, transaction: t });

    await t.commit();
    res.json({ ok: true, deleted: String(id) });
  } catch (e) {
    await t.rollback();
    res.status(400).json({ error: e.message });
  }
});


// Insertar un piquete BIS (antes/después de orden X)
router.post('/:id/insertar', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;               // piquete de referencia
    const { posicion = 'DESPUES', etiqueta } = req.body; // p.ej. '155B'
    const ref = await Piquete.findByPk(id);
    if (!ref) return res.status(404).json({ error: 'Piquete ref no existe' });

    const delta = (posicion === 'ANTES') ? 0 : 1;

    // mover los que vienen después
    await Piquete.increment(
      { orden: 1 },
      { where: { recorrido_id: ref.recorrido_id, orden: { [Op.gte]: ref.orden + delta } }, transaction: t }
    );

    // crear nuevo
    const nuevo = await Piquete.create({
      recorrido_id: ref.recorrido_id,
      etiqueta: etiqueta || (ref.etiqueta + 'B'),
      orden: ref.orden + delta
    }, { transaction: t });

    await t.commit();
    res.json(nuevo);
  } catch (e) {
    await t.rollback();
    res.status(400).json({ error: e.message });
  }
});

// Guardar Tipo de cadena y/o Sin Novedad (PUT existente)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tc_ss, tc_sd, tc_sv, tc_scm, tc_rs, tc_rd,
      tc_lado, tc_cadenas,
      sin_novedad
    } = req.body;

    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

    // Validación: para activar sin_novedad, debe haber al menos un tipo de cadena
    if (sin_novedad) {
      const alguno = [tc_ss, tc_sd, tc_sv, tc_scm, tc_rs, tc_rd].some(v => v === true) ||
        [p.tc_ss, p.tc_sd, p.tc_sv, p.tc_scm, p.tc_rs, p.tc_rd].some(v => v === true);
      if (!alguno) return res.status(400).json({ error: 'Primero registre Tipo de cadena' });
    }

    await p.update({
      tc_ss, tc_sd, tc_sv, tc_scm, tc_rs, tc_rd,
      tc_lado, tc_cadenas,
      sin_novedad: !!sin_novedad
    });

    // Si se marca sin_novedad, limpiar anomalías existentes
    if (sin_novedad) {
      await Anomalia.destroy({ where: { piquete_id: p.id } });
    }

    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Ruta "amigable" para Tipo de Cadena (POST) — opcional
router.post('/:id/tipo-cadena', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tc_ss, tc_sd, tc_sv, tc_scm, tc_rs, tc_rd,
      tc_lado, tc_cadenas
    } = req.body;

    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

    await p.update({
      tc_ss: !!tc_ss, tc_sd: !!tc_sd, tc_sv: !!tc_sv, tc_scm: !!tc_scm, tc_rs: !!tc_rs, tc_rd: !!tc_rd,
      tc_lado: tc_lado || null,
      tc_cadenas: tc_cadenas || null
    });

    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Crear/actualizar una anomalía de catálogo
router.post('/:id/anomalias', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { item_codigo, marcado, valor_numero, valor_texto, poda } = req.body;

    const p = await Piquete.findByPk(id, { transaction: t });
    if (!p) { await t.rollback(); return res.status(404).json({ error: 'Piquete no existe' }); }

    const item = await ItemCatalogo.findOne({ where: { codigo: item_codigo }, transaction: t });
    if (!item) { await t.rollback(); return res.status(404).json({ error: 'Item no existe' }); }

    // Validaciones antes de crear nada
    if (item.tipo_entrada === 'numero' && item.max_value != null) {
      const n = Number(valor_numero);
      if (Number.isNaN(n) || n < 0 || n > item.max_value) {
        await t.rollback();
        return res.status(400).json({ error: `Valor fuera de rango (0..${item.max_value})` });
      }
    }

    if (item.tipo_entrada === 'poda') {
      if (!poda || !poda.urgencia || !poda.medio) {
        await t.rollback();
        return res.status(400).json({ error: 'PODA requiere urgencia y medio' });
      }
      if (poda.cantidad_arboles != null && Number.isNaN(Number(poda.cantidad_arboles))) {
        await t.rollback();
        return res.status(400).json({ error: 'cantidad_arboles debe ser número' });
      }
    }

    // Si estaba sin novedad, desactivarlo
    if (p.sin_novedad) {
      await p.update({ sin_novedad: false }, { transaction: t });
    }

    // Crear anomalia
    const a = await Anomalia.create({
      recorrido_id: p.recorrido_id,
      piquete_id: p.id,
      item_id: item.id,
      marcado: !!marcado,
      valor_numero: valor_numero ?? null,
      valor_texto: valor_texto ?? null
    }, { transaction: t });

    // Crear detalle de poda si aplica
    if (item.tipo_entrada === 'poda') {
      await PodaDetalle.create({
        anomalia_id: a.id,
        urgencia: poda.urgencia,     // 's/p','c/p','U','I'
        medio: poda.medio,           // 'c/e','c/h','f/s'
        cantidad_arboles: Number(poda.cantidad_arboles || 0)
      }, { transaction: t });
    }

    await t.commit();
    return res.status(201).json(a);
  } catch (e) {
    await t.rollback();
    return res.status(400).json({ error: e.message });
  }
});

//Agregar la ruta POST /:id/sin-novedad 
router.post('/:id/sin-novedad', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

    const alguno = [p.tc_ss, p.tc_sd, p.tc_sv, p.tc_scm, p.tc_rs, p.tc_rd].some(v => v === true);
    if (!alguno) return res.status(400).json({ error: 'Primero registre Tipo de cadena' });

    await p.update({ sin_novedad: true });

    // coherencia: si es sin novedad, se limpian anomalías previas del piquete
    await Anomalia.destroy({ where: { piquete_id: p.id } });

    res.json({ ok: true, piquete: p });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /piquetes/:id -> detalle con anomalías + catálogo + poda + observaciones
router.get('/:id', async (req, res) => {
  try {
    const { Piquete, Anomalia, ItemCatalogo, PodaDetalle, Observaciones} = require('../models');
    const p = await Piquete.findByPk(req.params.id, {
      include: [
        {
          model: Anomalia,
          include: [
            { model: ItemCatalogo, attributes: ['codigo', 'descripcion', 'tipo_entrada', 'max_value'] },
            { model: PodaDetalle }
          ]
        },
        { model: Observaciones, order: [['createdAt', 'DESC']] }
      ]
    });
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /piquetes/:id/observaciones  { descripcion de las anomalias }
router.post('/:id/observaciones', async (req, res) => {
  try {
    const { Observaciones, Piquete } = require('../models');
    const { id } = req.params;
    const { texto } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: 'texto es requerido' });
    }

    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

    const obs = await Observaciones.create({
      recorrido_id: p.recorrido_id,
      piquete_id: p.id,
      texto: texto.trim()
    });

    res.status(201).json(obs);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /piquetes/:id/observaciones/:obsId --->>> BORRAR OBSERVACION
router.delete('/:id/observaciones/:obsId', async (req, res) => {
  try {
    const { Observaciones, Piquete } = require('../models');
    const { id, obsId } = req.params;

    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

    const deleted = await Observaciones.destroy({ where: { id: obsId, piquete_id: p.id } });
    if (!deleted) return res.status(404).json({ error: 'Observación no existe' });

    res.json({ ok: true, deleted: obsId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});



router.get('/__ping', (_req, res) => res.json({ ok: true, scope: 'piquetes' }));
module.exports = router;
