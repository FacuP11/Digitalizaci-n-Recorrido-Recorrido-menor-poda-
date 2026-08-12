import ExcelJS from 'exceljs';
import { Recorrido, Piquete, Anomalia, PodaDetalle, AisladorDetalle } from './models/index.js';

/**
 * Genera el reporte técnico en Excel.
 * Acepa un 'recorridoId' (número/string) o un objeto 'datosReporte' ya armado.
 */
export async function generarReporteExcel(recorridoOId) {
    try {
        let datosReporte = recorridoOId;

        // =========================================================
        // 1. OBTENCIÓN DE DATOS DESDE POSTGRESQL (SI RECIBE UN ID)
        // =========================================================
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

            // Aplanamos la información para alimentar la plantilla
            const planillaGeneral = [];

            (recorridoDB.Piquetes || []).forEach(piquete => {
                const nombrePiquete = `Piquete N° ${piquete.numeroPiquete}`;

                // Mapear Poda
                if (piquete.PodaDetalles && piquete.PodaDetalles.length > 0) {
                    piquete.PodaDetalles.forEach(poda => {
                        planillaGeneral.push({
                            piquete: nombrePiquete,
                            codigo: 'PODA',
                            descripcion: `Poda nivel ${poda.nivelPoda || ''} - ${poda.observaciones || ''}`,
                            detalle: `Especie: ${poda.especie || 'N/A'}`,
                            prioridad: poda.prioridad || 'MEDIA'
                        });
                    });
                }

                // Mapear Anomalías
                if (piquete.Anomalias && piquete.Anomalias.length > 0) {
                    piquete.Anomalias.forEach(anom => {
                        planillaGeneral.push({
                            piquete: nombrePiquete,
                            codigo: anom.codigo,
                            descripcion: anom.descripcion,
                            detalle: anom.observacion,
                            prioridad: anom.prioridad || 'MEDIA',
                            AisladorDetalle: anom.AisladorDetalle
                        });
                    });
                }
            });

            // Armamos la metadata estructurada
            datosReporte = {
                meta: {
                    linea: recorridoDB.linea,
                    ot: recorridoDB.ot || 'N/A',
                    tramo: recorridoDB.tramo || 'N/A',
                    fecha: recorridoDB.fecha,
                    usuario: recorridoDB.usuario || 'Técnico de Campo',
                    estadoCierre: recorridoDB.estadoCierre,
                    motivo: recorridoDB.motivo
                },
                planillaGeneral
            };
        }

        // ==========================================
        // 2. CREACIÓN DEL LIBRO Y HOJA DE EXCEL
        // ==========================================
        const workbook = new ExcelJS.Workbook();
        const hoja = workbook.addWorksheet('Reporte de Inspección');

        // Configuración de ancho de columnas
        hoja.columns = [
            { header: '', key: 'colA', width: 30 }, // Piquete
            { header: '', key: 'colB', width: 20 }, // Código
            { header: '', key: 'colC', width: 45 }, // Descripción
            { header: '', key: 'colD', width: 55 }, // Detalle Técnico
            { header: '', key: 'colE', width: 15 }, // Prioridad
        ];

        // ==========================================
        // 3. ENCABEZADO DEL REPORTE (TÍTULO)
        // ==========================================
        const meta = datosReporte.meta;
        let filaActual = 1;

        hoja.mergeCells(`A${filaActual}:E${filaActual}`);
        const titulo = hoja.getCell(`A${filaActual}`);
        titulo.value = "REPORTE TÉCNICO DE INSPECCIÓN - LÍNEAS DE ALTA TENSIÓN";
        titulo.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        titulo.alignment = { horizontal: 'center', vertical: 'middle' };

        filaActual += 2;

        // ==========================================
        // 4. METADATA (DATOS DEL RECORRIDO)
        // ==========================================
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
        hoja.getCell(`E${filaActual}`).value = new Date(meta.fecha).toLocaleDateString();

        filaActual++;

        hoja.getCell(`A${filaActual}`).value = "OPERARIO:";
        hoja.getCell(`A${filaActual}`).font = styleLabel;
        hoja.getCell(`B${filaActual}`).value = meta.usuario || "Técnico de Campo";

        if (meta.estadoCierre && meta.estadoCierre.includes('EMERGENCIA')) {
            hoja.getCell(`D${filaActual}`).value = "⚠️ CIERRE POR EMERGENCIA";
            hoja.getCell(`D${filaActual}`).font = { bold: true, color: { argb: 'FFFF0000' } };
            filaActual++;
            hoja.getCell(`D${filaActual}`).value = `Motivo: ${meta.motivo}`;
        }

        filaActual += 2;

        // ==========================================
        // 5. ENCABEZADOS DE LA TABLA
        // ==========================================
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

        filaActual++;

        // ==========================================
        // 6. VOLCADO DE DATOS (AGRUPADOS)
        // ==========================================
        const grupos = organizarDatosPorPiquete(datosReporte.planillaGeneral);

        for (const [nombrePiquete, anomalias] of Object.entries(grupos)) {

            // A. TÍTULO DEL PIQUETE
            hoja.mergeCells(`A${filaActual}:E${filaActual}`);
            const celdaPiquete = hoja.getCell(`A${filaActual}`);
            celdaPiquete.value = nombrePiquete;
            celdaPiquete.font = { bold: true, size: 11 };
            celdaPiquete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            celdaPiquete.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

            filaActual++;

            // B. ANOMALÍAS
            anomalias.forEach(item => {
                let detalleFinal = item.detalle || "";

                if (item.codigo && item.codigo.startsWith('AISL_') && item.AisladorDetalle) {
                    const aisl = Array.isArray(item.AisladorDetalle) ? item.AisladorDetalle[0] : item.AisladorDetalle;
                    if (aisl) {
                        const partes = [];
                        partes.push(`Fase: ${aisl.fase}`);
                        if (aisl.lado_referencia) partes.push(`Lado: ${aisl.lado_referencia}`);

                        const int = Number(aisl.cantidad_interior) || 0;
                        const ext = Number(aisl.cantidad_exterior) || 0;

                        if (int > 0 && ext > 0) partes.push(`Roturas -> Int: ${int} / Ext: ${ext}`);
                        else if (int > 0) partes.push(`Cantidad Int: ${int}`);
                        else if (ext > 0) partes.push(`Cantidad Ext: ${ext}`);

                        detalleFinal = partes.join(' | ');
                    }
                }

                hoja.getCell(`A${filaActual}`).value = "      ↳";
                hoja.getCell(`B${filaActual}`).value = item.codigo;
                hoja.getCell(`C${filaActual}`).value = item.descripcion;
                hoja.getCell(`D${filaActual}`).value = detalleFinal;

                const celdaPrio = hoja.getCell(`E${filaActual}`);
                celdaPrio.value = item.prioridad;
                celdaPrio.alignment = { horizontal: 'center' };

                // Estilos Condicionales
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

        // ==========================================
        // 7. GUARDAR ARCHIVO
        // ==========================================
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

// --- FUNCIÓN DE ORDENAMIENTO ---
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