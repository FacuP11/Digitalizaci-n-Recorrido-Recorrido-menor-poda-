// backend/routes/recorridos.js
const express = require('express');
const router = express.Router();
const { sequelize, Recorrido, Piquete, Anomalia, PodaDetalle, Observaciones, AisladorDetalle } = require('../models');
const { generarReporteExcel } = require('../generarExcel');
const path = require('path');
const fs = require('fs');

/* RUTAS FIJAS PRIMERO*/
router.get('/__ping', (_req, res) => res.json({ ok: true, scope: 'recorridos' })); // Ping para chequear montaje
router.get('/', async (req, res) => {  // GET: lista de recorridos
  try {
    const { Recorrido } = require('../models');
    const lista = await Recorrido.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'linea', 'kv', 'entre_desde', 'entre_hasta', 'ot_numero', 'carga_amp', 'estado', 'createdAt']
    });
    res.json(lista);
  } catch (e) { res.status(400).json({ error: e.message }); }
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
    // Aseguramos que AisladorDetalle se importe aquí adentro
    const { Recorrido, Piquete, Anomalia, ItemCatalogo, PodaDetalle, Observaciones, AisladorDetalle } = require('../models');

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
          model: Anomalia, // NIVEL 1: Anomalías
          as: 'Anomalias', 
          include: [
            // NIVEL 2: Lo que está adentro de las Anomalías
            { model: ItemCatalogo, attributes: ['codigo', 'descripcion', 'tipo_entrada', 'max_value'] },
            { model: PodaDetalle, as: 'PodaDetalle' },
            { model: AisladorDetalle, as: 'AisladorDetalle' } // <- ¡Ahora sí está adentro de la anomalía!
          ]
        },
        { model: Observaciones, as: 'Observaciones' } // Esto va al nivel del piquete
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



// GET: /recorridos/:id/piquetes -> obtenemos la lista (vacía si aún no hay)
router.get('/:id/piquetes', async (req, res) => {
  try {
    const { Recorrido, Piquete } = require('../models');

    const rec = await Recorrido.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    const lista = await Piquete.findAll({
      where: { recorrido_id: rec.id },
      order: [['orden', 'ASC']],
      attributes: ['id', 'recorrido_id', 'etiqueta', 'orden', 'sin_novedad']
    });

    // Devolver 200 aunque no haya piquetes
    return res.json(lista);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});



// RUTA FINALIZAR: Actualiza DB + Genera Excel
router.post('/:id/finalizar', async (req, res) => {
  try {
    const { id } = req.params;
    const datosReporte = req.body; // El JSON completo que manda el frontend
    const { meta } = datosReporte;

    console.log(`📡 Finalizando Recorrido ID: ${id}`);

    // 1. Actualizar Base de Datos (PostgreSQL)
    const r = await Recorrido.findByPk(id);
    if (!r) return res.status(404).json({ error: 'Recorrido no encontrado' });

    const nuevoEstado = meta.estadoCierre.includes('EMERGENCIA') ? 'EMERGENCIA' : 'COMPLETO';

    await r.update({
      estado: nuevoEstado,
      motivo_cierre: meta.motivo || null,
      fecha_fin: new Date()
    });
    console.log("✅ Base de datos actualizada.");

    // 2. Generar el Excel
    console.log("📊 Iniciando generación de Excel...");
    let nombreArchivoGenerado = null;
    try {
        // Pasamos los datos que vinieron del frontend al generador
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

// Agregar un piquete inteligente
router.post('/:id/piquetes/final', async (req, res) => {
    try {
        const { id } = req.params;
        const { Piquete } = require('../models');

        // 1. Traemos todos los piquetes ordenados
        const piquetes = await Piquete.findAll({
            where: { recorrido_id: id },
            order: [['orden', 'ASC']]
        });

        // 2. Filtramos solo los que son puramente números
        const numerados = piquetes.filter(p => !isNaN(parseInt(p.etiqueta)) && !p.etiqueta.includes('BIS'));

        let nuevaEtiqueta = "NUEVO";
        let nuevoOrden = 1000;

        if (numerados.length > 0) {
            // Buscamos cuál fue el último número real
            const ultimoNumerado = numerados[numerados.length - 1];
            const indiceOriginal = piquetes.findIndex(p => p.id === ultimoNumerado.id);
            
            // 3. ¿La línea va en subida (54->55) o en bajada (75->74)?
            let paso = 1; // Por defecto sube
            if (numerados.length >= 2) {
                const penultimo = parseInt(numerados[numerados.length - 2].etiqueta);
                const ultimo = parseInt(ultimoNumerado.etiqueta);
                if (ultimo < penultimo) paso = -1; // Va en bajada
            }
            
            // Asignamos el número que sigue matemáticamente
            nuevaEtiqueta = (parseInt(ultimoNumerado.etiqueta) + paso).toString();

            // 4. Calculamos su posición física (orden)
            if (indiceOriginal === piquetes.length - 1) {
                // No hay nada después (no hay POR final). Lo ponemos al final.
                nuevoOrden = ultimoNumerado.orden + 1000;
            } else {
                // Hay algo después (ej: un POR final o ANT). Lo metemos justo en el medio.
                const siguiente = piquetes[indiceOriginal + 1];
                nuevoOrden = (ultimoNumerado.orden + siguiente.orden) / 2;
            }
        } else if (piquetes.length > 0) {
             // Fallback por si no hay números en toda la línea
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

// GENERAR PIQUETES (Soporta subida, bajada, POR y ANT)
// =======================================================
router.post('/:id/piquetes/generar', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Leemos los datos tal cual los manda el nuevo formulario del frontend
    const { 
        piq_desde, 
        piq_hasta, 
        por_inicio, 
        por_final, 
        ant_inicio, 
        ant_final 
    } = req.body;

    const { Recorrido, Piquete } = require('../models');

    const rec = await Recorrido.findByPk(id);
    if (!rec) return res.status(404).json({ error: 'Recorrido no existe' });

    // Evitar duplicados
    const yaHay = await Piquete.count({ where: { recorrido_id: id } });
    if (yaHay > 0) return res.status(400).json({ error: 'Este recorrido ya tiene piquetes generados' });

    const piquetes = [];
    let ordenBase = 10; // Usamos saltos de 10 para poder insertar "BIS" después

    // 1. ANT al INICIO
    const cantAntInicio = Math.max(0, parseInt(ant_inicio) || 0);
    for (let i = 0; i < cantAntInicio; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: 'ANT', orden: ordenBase });
      ordenBase += 10;
    }

    // 2. POR al INICIO
    if (por_inicio === true || por_inicio === 'true') {
      piquetes.push({ recorrido_id: id, etiqueta: 'POR', orden: ordenBase });
      ordenBase += 10;
    }

    // 3. PIQUETES NUMERADOS (Detecta subida o bajada)
    const inicio = parseInt(piq_desde);
    const fin = parseInt(piq_hasta);

    if (!isNaN(inicio) && !isNaN(fin)) {
        const paso = (inicio <= fin) ? 1 : -1;
        // Bucle inteligente: si paso es 1, suma hasta 'fin'. Si es -1, resta hasta 'fin'.
        for (let i = inicio; (paso > 0 ? i <= fin : i >= fin); i += paso) {
            piquetes.push({ recorrido_id: id, etiqueta: i.toString(), orden: ordenBase });
            ordenBase += 10;
        }
    }

    // 4. POR al FINAL
    if (por_final === true || por_final === 'true') {
      piquetes.push({ recorrido_id: id, etiqueta: 'POR', orden: ordenBase });
      ordenBase += 10;
    }

    // 5. ANT al FINAL
    const cantAntFinal = Math.max(0, parseInt(ant_final) || 0);
    for (let i = 0; i < cantAntFinal; i++) {
      piquetes.push({ recorrido_id: id, etiqueta: 'ANT', orden: ordenBase });
      ordenBase += 10;
    }

    // 6. Guardamos todos en la base de datos de un solo impacto (muy rápido)
    await Piquete.bulkCreate(piquetes);

    // Devolvemos la lista generada
    const lista = await Piquete.findAll({ where: { recorrido_id: id }, order: [['orden', 'ASC']] });
    res.json(lista);

  } catch (e) { 
    console.error("❌ Error generando piquetes:", e);
    res.status(400).json({ error: e.message }); 
  }
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

// Descargar archivo Excel
router.get('/descargar/:nombreArchivo', (req, res) => {
    const { nombreArchivo } = req.params;
    
    // Buscamos el archivo en la raíz del backend
    const filePath = path.join(__dirname, '../', nombreArchivo);

    if (fs.existsSync(filePath)) {
        // res.download le dice al navegador "Descarga este archivo, no intentes leerlo"
        res.download(filePath, nombreArchivo, (err) => {
            if (err) console.error("Error al descargar:", err);
            // Opcional: Borrar el archivo del servidor después de descargarlo para no ocupar espacio
            // fs.unlinkSync(filePath); 
        });
    } else {
        res.status(404).json({ error: "El archivo ya no existe o caducó." });
    }
});
module.exports = router;
