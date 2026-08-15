import ExcelJS from 'exceljs';
import { Recorrido, Piquete, Anomalia, PodaDetalle, AisladorDetalle } from './models/index.js';

/**
 * Genera el reporte técnico en Excel.
 * Acepta un 'recorridoId' o un objeto 'datosReporte' ya armado desde el frontend.
 */
export async function generarReporteExcel(recorridoOId) {
  try {
    let datosReporte = recorridoOId;

    // 1. Obtención desde base de datos si recibe un ID
    if (typeof recorridoOId === 'number' || typeof recorridoOId === 'string') {
      const recorridoDB = await Recorrido.findByPk(recorridoOId, {
        include: [
          {
            model: Piquete,
            include: [
              { model: Anomalia },
              { model: PodaDetalle },
              { model: AisladorDetalle }
            ]
          }
        ]
      });

      if (!recorridoDB) {
        throw new Error(`No se encontró el Recorrido con ID: ${recorridoOId}`);
      }

      const planillaGeneral = [];

      (recorridoDB.Piquetes || []).forEach(piquete => {
        const nombrePiquete = `Piquete N° ${piquete.etiqueta || piquete.numeroPiquete}`;

        // Cadena del piquete
        const tiposCadena = [];
        if (piquete.tc_ss) tiposCadena.push("SS");
        if (piquete.tc_sd) tiposCadena.push("SD");
        if (piquete.tc_sv) tiposCadena.push("SV");
        if (piquete.tc_scm) tiposCadena.push("SCM");
        if (piquete.tc_rs) tiposCadena.push("RS");
        if (piquete.tc_rd) tiposCadena.push("RD");
        const tipoCadenaTxt = tiposCadena.join(" / ") || "S/D";

        if (piquete.PodaDetalles && piquete.PodaDetalles.length > 0) {
          piquete.PodaDetalles.forEach(poda => {
            planillaGeneral.push({
              piquete: nombrePiquete,
              codigo: 'PODA',
              descripcion: 'PODA DE ÁRBOLES',
              detalle: `Urgencia: ${poda.urgencia || 'N/A'} | Medio: ${poda.medio || 'N/A'} | Cantidad: ${poda.cantidad_arboles || 0} árbol(es)`,
              prioridad: poda.urgencia === 'I' || poda.urgencia === 'U' ? 'ALTA' : 'MEDIA',
              PodaDetalle: poda,
              tipo_cadena: tipoCadenaTxt
            });
          });
        }

        if (piquete.Anomalias && piquete.Anomalias.length > 0) {
          piquete.Anomalias.forEach(anom => {
            planillaGeneral.push({
              piquete: nombrePiquete,
              codigo: anom.codigo,
              descripcion: anom.descripcion,
              detalle: anom.valor_texto || anom.observacion || '',
              prioridad: anom.prioridad || 'MEDIA',
              AisladorDetalle: anom.AisladorDetalle,
              tipo_cadena: tipoCadenaTxt
            });
          });
        }
      });

      datosReporte = {
        meta: {
          linea: recorridoDB.linea,
          ot: recorridoDB.ot_numero || recorridoDB.ot || 'N/A',
          tramo: `${recorridoDB.entre_desde} - ${recorridoDB.entre_hasta}`,
          fecha: recorridoDB.fecha,
          operarios: recorridoDB.usuario || 'Operario Campo',
          estadoCierre: recorridoDB.estado,
          motivo: recorridoDB.motivo_cierre
        },
        planillaGeneral
      };
    }

    // 2. Creación del libro y hoja de Excel
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet('Reporte de Inspección');

    hoja.columns = [
      { header: '', key: 'colA', width: 28 }, // Piquete
      { header: '', key: 'colB', width: 18 }, // Código
      { header: '', key: 'colC', width: 42 }, // Descripción
      { header: '', key: 'colD', width: 60 }, // Detalle Técnico
      { header: '', key: 'colE', width: 16 }, // Prioridad
    ];

    // 3. Encabezado del reporte
    const meta = datosReporte.meta;
    let filaActual = 1;

    hoja.mergeCells(`A${filaActual}:E${filaActual}`);
    const titulo = hoja.getCell(`A${filaActual}`);
    titulo.value = "REPORTE TÉCNICO DE INSPECCIÓN - LÍNEAS DE ALTA TENSIÓN";
    titulo.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    hoja.getRow(filaActual).height = 32;

    filaActual += 2;

    // 4. Metadatos del recorrido
    const styleLabel = { font: { bold: true } };

    hoja.getCell(`A${filaActual}`).value = "LÍNEA:";
    hoja.getCell(`A${filaActual}`).font = styleLabel;
    hoja.getCell(`B${filaActual}`).value = meta.linea;

    hoja.getCell(`D${filaActual}`).value = "OT N°:";
    hoja.getCell(`D${filaActual}`).font = styleLabel;
    hoja.getCell(`E${filaActual}`).value = meta.ot;

    filaActual++;

    hoja.getCell(`A${filaActual}`).value = "TRAMO:";
    hoja.getCell(`A${filaActual}`).font = styleLabel;
    hoja.getCell(`B${filaActual}`).value = meta.tramo;

    hoja.getCell(`D${filaActual}`).value = "FECHA:";
    hoja.getCell(`D${filaActual}`).font = styleLabel;
    hoja.getCell(`E${filaActual}`).value = new Date(meta.fecha).toLocaleDateString('es-AR');

    filaActual++;

    hoja.getCell(`A${filaActual}`).value = "OPERARIOS:";
    hoja.getCell(`A${filaActual}`).font = styleLabel;
    hoja.getCell(`B${filaActual}`).value = meta.operarios || meta.usuario || "Operario Campo";

    if (meta.estadoCierre && meta.estadoCierre.includes('EMERGENCIA')) {
      hoja.getCell(`D${filaActual}`).value = "⚠️ CIERRE POR EMERGENCIA";
      hoja.getCell(`D${filaActual}`).font = { bold: true, color: { argb: 'FFFF0000' } };
      filaActual++;
      hoja.getCell(`D${filaActual}`).value = `Motivo: ${meta.motivo}`;
    }

    filaActual += 2;

    // 5. Encabezados de tabla
    const headers = ["UBICACIÓN / PIQUETE", "CÓDIGO", "DESCRIPCIÓN", "DETALLE TÉCNICO", "PRIORIDAD"];
    const letras = ['A', 'B', 'C', 'D', 'E'];

    letras.forEach((l, i) => {
      const cell = hoja.getCell(`${l}${filaActual}`);
      cell.value = headers[i];
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    hoja.getRow(filaActual).height = 24;

    filaActual++;

    // 6. Volcado de anomalías agrupadas
    const grupos = organizarDatosPorPiquete(datosReporte.planillaGeneral);

    for (const [nombrePiquete, anomalias] of Object.entries(grupos)) {

      // Título del piquete
      hoja.mergeCells(`A${filaActual}:E${filaActual}`);
      const celdaPiquete = hoja.getCell(`A${filaActual}`);
      celdaPiquete.value = nombrePiquete;
      celdaPiquete.font = { bold: true, size: 11 };
      celdaPiquete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      celdaPiquete.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      hoja.getRow(filaActual).height = 20;

      filaActual++;

      // Líneas de anomalías
      anomalias.forEach(item => {
        let detalleFinal = item.detalle || "";

        // DETALLE TÉCNICO ENRIQUECIDO DE AISLADORES
        if (item.codigo && item.codigo.startsWith('AISL_') && item.AisladorDetalle) {
          const aisl = Array.isArray(item.AisladorDetalle) ? item.AisladorDetalle[0] : item.AisladorDetalle;
          if (aisl) {
            const partes = [];
            if (item.tipo_cadena) partes.push(`Cadena: ${item.tipo_cadena}`);
            if (aisl.fase) partes.push(`Fase: ${aisl.fase}`);
            if (aisl.lado_referencia) partes.push(`Lado: ${aisl.lado_referencia}`);

            const int = Number(aisl.cantidad_interior) || 0;
            const ext = Number(aisl.cantidad_exterior) || 0;

            if (int > 0 && ext > 0) {
              partes.push(`Roturas -> Int: ${int} / Ext: ${ext}`);
            } else if (int > 0) {
              partes.push(`Roturas Int: ${int}`);
            } else if (ext > 0) {
              partes.push(`Roturas Ext: ${ext}`);
            }

            detalleFinal = partes.join(' | ');
          }
        }

        // DETALLE TÉCNICO ENRIQUECIDO DE PODA
        if (item.codigo === 'PODA' && item.PodaDetalle) {
          const poda = Array.isArray(item.PodaDetalle) ? item.PodaDetalle[0] : item.PodaDetalle;
          if (poda) {
            const uMap = { 'I': 'Inmediata', 'U': 'Urgente', 'c/p': 'Corto Plazo', 's/p': 'Sin Plazo', 'ALTA': 'Alta', 'MEDIA': 'Media', 'BAJA': 'Baja' };
            const urg = uMap[poda.urgencia] || poda.urgencia || 'N/A';
            const med = poda.medio || 'N/A';
            const arb = poda.cantidad_arboles ? `${poda.cantidad_arboles} árbol(es)` : '';

            const partesPoda = [`Urgencia: ${urg}`, `Medio: ${med}`];
            if (arb) partesPoda.push(arb);
            if (item.detalle && item.detalle !== 'Ver detalle') partesPoda.push(item.detalle);

            detalleFinal = partesPoda.join(' | ');
          }
        }

        hoja.getCell(`A${filaActual}`).value = "      ↳";
        hoja.getCell(`B${filaActual}`).value = item.codigo;
        hoja.getCell(`C${filaActual}`).value = item.descripcion;
        hoja.getCell(`D${filaActual}`).value = detalleFinal;

        const celdaPrio = hoja.getCell(`E${filaActual}`);
        celdaPrio.value = item.prioridad;
        celdaPrio.alignment = { horizontal: 'center' };

        // Estilos específicos
        if (item.codigo === 'PODA' || (item.descripcion && item.descripcion.includes('Poda'))) {
          const celdaDesc = hoja.getCell(`C${filaActual}`);
          celdaDesc.font = { bold: true, color: { argb: 'FF006100' } };
          celdaDesc.value = "🌳 PODA - " + item.descripcion;
        }

        if (item.codigo && item.codigo.startsWith('AISL_')) {
          const celdaDesc = hoja.getCell(`C${filaActual}`);
          const tipoRotura = item.codigo === 'AISL_ROTO' ? 'ROTO' : 'CACHADO';
          celdaDesc.value = `💿 AISLADOR ${tipoRotura}`;
          hoja.getCell(`D${filaActual}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }

        if (item.prioridad === 'ALTA') {
          celdaPrio.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else if (item.prioridad === 'MEDIA') {
          celdaPrio.font = { color: { argb: 'FFED7D31' }, bold: true };
        }

        letras.forEach(col => {
          hoja.getCell(`${col}${filaActual}`).border = {
            left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'dotted' }
          };
        });

        filaActual++;
      });
    }

    // 7. Guardar archivo
    const nombreLimpio = (meta.linea || "REPORTE").replace(/[^a-zA-Z0-9]/g, "_");
    const nombreArchivo = `NUEVO_REPORTE_${nombreLimpio}_OT${meta.ot}_${Date.now()}.xlsx`;

    await workbook.xlsx.writeFile(nombreArchivo);
    console.log(`✅ Excel generado exitosamente: ${nombreArchivo}`);
    return nombreArchivo;

  } catch (error) {
    console.error("❌ Error generando Excel:", error);
    throw error;
  }
}

function organizarDatosPorPiquete(listaPlana) {
  const grupos = {};
  if (!listaPlana) return grupos;

  listaPlana.forEach(item => {
    if (!grupos[item.piquete]) grupos[item.piquete] = [];
    grupos[item.piquete].push(item);
  });

  for (const piquete in grupos) {
    grupos[piquete].sort((a, b) => {
      const esPodaA = a.codigo === 'PODA' || (a.descripcion && a.descripcion.includes('Poda'));
      const esPodaB = b.codigo === 'PODA' || (b.descripcion && b.descripcion.includes('Poda'));

      if (esPodaA && !esPodaB) return -1;
      if (!esPodaA && esPodaB) return 1;

      const mapPrio = { 'ALTA': 1, 'MEDIA': 2, 'BAJA': 3 };
      const prioA = mapPrio[a.prioridad] || 99;
      const prioB = mapPrio[b.prioridad] || 99;
      return prioA - prioB;
    });
  }
  return grupos;
}