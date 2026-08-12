// backend/routes/piquetes.js
import express from 'express';
import { crearPiquete } from '../controllers/piquetesController.js';
import { validarSchema } from '../middlewares/validarSchema.js';
import { piqueteSchema } from '../schemas/piqueteSchema.js';

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize, Piquete, Anomalia, ItemCatalogo, PodaDetalle, AisladorDetalle, Observaciones, Recorrido } = require('../models');
const router = express.Router();

// La petición pasa por 'validarSchema(piqueteSchema)' ANTES de llegar a 'crearPiquete'
router.post('/', validarSchema(piqueteSchema), crearPiquete);
// GET Catálogo
router.get('/__catalogo', async (_req, res) => {
  const items = await ItemCatalogo.findAll({ order: [['id', 'ASC']] });
  res.json(items);
});

// Ping
router.get('/__ping', (_req, res) => res.json({ ok: true, scope: 'piquetes' }));

// --------------------------------------------------------------------------
// GET /piquetes/:id -> Detalle completo
// Incluye Anomalías (con Poda y Aisladores), Observaciones y Recorrido
// --------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const p = await Piquete.findByPk(req.params.id, {
      include: [
        {
          model: Anomalia,
          as: 'Anomalias',
          include: [
            { model: ItemCatalogo, attributes: ['codigo', 'descripcion', 'tipo_entrada', 'max_value'] },
            { model: PodaDetalle, as: 'PodaDetalle' },
            { model: AisladorDetalle, as: 'AisladorDetalle' } // <--- NUEVO: Incluir detalle de aisladores
          ]
        },
        { model: Observaciones, as: 'Observaciones' },
        { model: Recorrido } // Para saber Línea y Estaciones (Lado A/B)
      ],
      order: [
        [{ model: Observaciones, as: 'Observaciones' }, 'createdAt', 'DESC']
      ]
    });
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --------------------------------------------------------------------------
// POST /piquetes/:id/anomalias -> Crear anomalía
// Soporta PODA, AISLADORES y BALIZOR
// --------------------------------------------------------------------------
router.post('/:id/anomalias', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { 
        item_codigo, 
        marcado, 
        valor_numero, 
        valor_texto, 
        poda, 
        aislador // <--- objeto con { fase, cantidad_interior, cantidad_exterior, lado_referencia }
    } = req.body;

    const p = await Piquete.findByPk(id, { transaction: t });
    if (!p) { await t.rollback(); return res.status(404).json({ error: 'Piquete no existe' }); }

    // Buscar o Crear Item en Catálogo al vuelo (para facilitar desarrollo)
    let item = await ItemCatalogo.findOne({ where: { codigo: item_codigo }, transaction: t });
    if (!item) {
        // Si no existe, lo creamos como 'texto' por defecto
        item = await ItemCatalogo.create({ 
            codigo: item_codigo, 
            descripcion: item_codigo, 
            tipo_entrada: 'texto' 
        }, { transaction: t });
    }

    // Validaciones PODA
    if (item_codigo === 'PODA') {
      if (!poda || !poda.urgencia || !poda.medio) {
        await t.rollback();
        return res.status(400).json({ error: 'PODA requiere urgencia y medio' });
      }
    }

    // Si estaba sin novedad, desactivarlo
    if (p.sin_novedad) {
      await p.update({ sin_novedad: false }, { transaction: t });
    }

    // 1. Crear la Anomalía Padre
    // Nota: Para BALIZOR, el texto viene en 'valor_texto' y se guarda aquí directo.
    const a = await Anomalia.create({
      recorrido_id: p.recorrido_id,
      piquete_id: p.id,
      item_id: item.id,
      marcado: !!marcado,
      valor_numero: valor_numero ?? null,
      valor_texto: valor_texto ?? null // Detalle de CONDUCTOR
    }, { transaction: t });

    // 2. Guardar Detalle PODA
    if (item_codigo === 'PODA') {
      await PodaDetalle.create({
        anomalia_id: a.id,
        urgencia: poda.urgencia,
        medio: poda.medio,
        cantidad_arboles: Number(poda.cantidad_arboles || 0)
      }, { transaction: t });
    }

    // 3. Guardar Detalle AISLADOR (Roto o Cachado)
    if ((item_codigo === 'AISL_ROTO' || item_codigo === 'AISL_CACHADO') && aislador) {
        await AisladorDetalle.create({
            anomalia_id: a.id,
            fase: aislador.fase,
            cantidad_interior: Number(aislador.cantidad_interior) || 0,
            cantidad_exterior: Number(aislador.cantidad_exterior) || 0,
            lado_referencia: aislador.lado_referencia
        }, { transaction: t });
    }

    await t.commit();
    return res.status(201).json(a);
  } catch (e) {
    await t.rollback();
    return res.status(400).json({ error: e.message });
  }
});

// --------------------------------------------------------------------------
// DELETE /piquetes/:id/anomalias/:anomaliaId -> Borrar anomalía específica
// --------------------------------------------------------------------------
router.delete('/:id/anomalias/:anomaliaId', async (req, res) => {
  try {
    const { anomaliaId } = req.params;

    // Borrado manual de detalles hijos si no hay CASCADE en DB
    await PodaDetalle.destroy({ where: { anomalia_id: anomaliaId } });
    await AisladorDetalle.destroy({ where: { anomalia_id: anomaliaId } });
    
    const deleted = await Anomalia.destroy({ where: { id: anomaliaId } });
    
    if (!deleted) return res.status(404).json({ error: 'Anomalía no encontrada' });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --------------------------------------------------------------------------
// RUTAS EXISTENTES (Sin cambios mayores, solo ordenadas)
// --------------------------------------------------------------------------

// Borrar Piquete completo
router.delete('/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const p = await Piquete.findByPk(id, { transaction: t });
    if (!p) { await t.rollback(); return res.status(404).json({ error: 'Piquete no existe' }); }

    const anoms = await Anomalia.findAll({ where: { piquete_id: p.id }, attributes: ['id'], transaction: t });
    const anomIds = anoms.map(a => a.id);

    if (anomIds.length) {
      await PodaDetalle.destroy({ where: { anomalia_id: anomIds }, transaction: t });
      await AisladorDetalle.destroy({ where: { anomalia_id: anomIds }, transaction: t }); // Borrar Aisladores
    }
    await Anomalia.destroy({ where: { piquete_id: p.id }, transaction: t });
    await Observaciones.destroy({ where: { piquete_id: p.id }, transaction: t });
    await Piquete.destroy({ where: { id: p.id }, transaction: t });

    await t.commit();
    res.json({ ok: true, deleted: String(id) });
  } catch (e) {
    await t.rollback();
    res.status(400).json({ error: e.message });
  }
});

// Insertar BIS
router.post('/:id/insertar', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { posicion = 'DESPUES', etiqueta } = req.body;
    const ref = await Piquete.findByPk(id);
    if (!ref) return res.status(404).json({ error: 'Piquete ref no existe' });

    const delta = (posicion === 'ANTES') ? 0 : 1;
    await Piquete.increment(
      { orden: 1 },
      { where: { recorrido_id: ref.recorrido_id, orden: { [Op.gte]: ref.orden + delta } }, transaction: t }
    );

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

// Guardar Tipo de Cadena / Sin Novedad (PUT)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tc_ss, tc_sd, tc_sv, tc_scm, tc_rs, tc_rd, tc_lado, tc_cadenas, sin_novedad } = req.body;

    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

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

    if (sin_novedad) {
      await Anomalia.destroy({ where: { piquete_id: p.id } });
    }
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Guardar Tipo Cadena (Ruta específica)
router.post('/:id/tipo-cadena', async (req, res) => {
  try {
    const { id } = req.params;
    const { tc_ss, tc_sd, tc_sv, tc_scm, tc_rs, tc_rd, tc_lado, tc_cadenas } = req.body;
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

// Marcar Sin Novedad
router.post('/:id/sin-novedad', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Piquete.findByPk(id);
    if (!p) return res.status(404).json({ error: 'Piquete no existe' });

    const alguno = [p.tc_ss, p.tc_sd, p.tc_sv, p.tc_scm, p.tc_rs, p.tc_rd].some(v => v === true);
    if (!alguno) return res.status(400).json({ error: 'Primero registre Tipo de cadena' });

    await p.update({ sin_novedad: true });
    await Anomalia.destroy({ where: { piquete_id: p.id } });
    res.json({ ok: true, piquete: p });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Guardar Observaciones
router.post('/:id/observaciones', async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: 'texto es requerido' });

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

module.exports = router;