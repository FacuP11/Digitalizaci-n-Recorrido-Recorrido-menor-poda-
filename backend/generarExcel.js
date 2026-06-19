const ExcelJS = require('exceljs');

async function generarReporteExcel(datosReporte) {
    try {
        // 1. CREAMOS UN LIBRO NUEVO (VACÍO)
        const workbook = new ExcelJS.Workbook();
        
        // Creamos la hoja principal
        const hoja = workbook.addWorksheet('Reporte de Inspección');

        // ==========================================
        // 2. CONFIGURACIÓN VISUAL (ANCHO DE COLUMNAS)
        // ==========================================
        hoja.columns = [
            { header: '', key: 'colA', width: 30 }, // Piquete
            { header: '', key: 'colB', width: 20 }, // Código
            { header: '', key: 'colC', width: 45 }, // Descripción
            { header: '', key: 'colD', width: 55 }, // Detalle (Lo hacemos un poco más ancho para los aisladores)
            { header: '', key: 'colE', width: 15 }, // Prioridad
        ];

        // ==========================================
        // 3. ENCABEZADO DEL REPORTE (TÍTULO GRANDE)
        // ==========================================
        const meta = datosReporte.meta;
        let filaActual = 1;

        // Título Principal
        hoja.mergeCells(`A${filaActual}:E${filaActual}`);
        const titulo = hoja.getCell(`A${filaActual}`);
        titulo.value = "REPORTE TÉCNICO DE INSPECCIÓN - LÍNEAS DE ALTA TENSIÓN";
        titulo.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; // Letra blanca
        titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }; // Azul oscuro
        titulo.alignment = { horizontal: 'center', vertical: 'middle' };
        
        filaActual += 2; // Dejamos un renglón

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
            cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
        });

        filaActual++;

        // ==========================================
        // 6. VOLCADO DE DATOS (AGRUPADOS)
        // ==========================================
        const grupos = organizarDatosPorPiquete(datosReporte.planillaGeneral);

        for (const [nombrePiquete, anomalias] of Object.entries(grupos)) {
            
            // --- A. TÍTULO DEL GRUPO (PIQUETE) ---
            hoja.mergeCells(`A${filaActual}:E${filaActual}`);
            const celdaPiquete = hoja.getCell(`A${filaActual}`);
            celdaPiquete.value = nombrePiquete; 
            celdaPiquete.font = { bold: true, size: 11 };
            celdaPiquete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; 
            celdaPiquete.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
            
            filaActual++;

            // --- B. LISTA DE ANOMALÍAS ---
            anomalias.forEach(item => {
                
                // ----------------------------------------------------
                // 🔥 NUEVO: PROCESAMIENTO DINÁMICO DE DETALLES (AISLADORES)
                // ----------------------------------------------------
                let detalleFinal = item.detalle || "";

                // Verificamos si es un Aislador y si el backend nos mandó los datos crudos (AisladorDetalle)
                if (item.codigo && item.codigo.startsWith('AISL_') && item.AisladorDetalle) {
                    const aisl = Array.isArray(item.AisladorDetalle) ? item.AisladorDetalle[0] : item.AisladorDetalle;
                    if (aisl) {
                        // Construimos un string profesional. Ej: "Fase R | Lado: INICIO | Int: 2 - Ext: 1"
                        const partes = [];
                        partes.push(`Fase: ${aisl.fase}`);
                        if (aisl.lado_referencia) partes.push(`Lado: ${aisl.lado_referencia}`);
                        
                        // Solo mostramos 'Int' o 'Ext' si tienen un valor mayor a cero
                        const int = Number(aisl.cantidad_interior) || 0;
                        const ext = Number(aisl.cantidad_exterior) || 0;
                        
                        if (int > 0 && ext > 0) partes.push(`Roturas -> Int: ${int} / Ext: ${ext}`);
                        else if (int > 0) partes.push(`Cantidad Int: ${int}`);
                        else if (ext > 0) partes.push(`Cantidad Ext: ${ext}`);

                        // Unimos todo con el separador " | "
                        detalleFinal = partes.join(' | ');
                    }
                }

                // Sangría visual en Columna A
                hoja.getCell(`A${filaActual}`).value = "      ↳"; 
                hoja.getCell(`B${filaActual}`).value = item.codigo;
                hoja.getCell(`C${filaActual}`).value = item.descripcion;
                
                // Usamos la variable formateada
                hoja.getCell(`D${filaActual}`).value = detalleFinal; 
                
                const celdaPrio = hoja.getCell(`E${filaActual}`);
                celdaPrio.value = item.prioridad;
                celdaPrio.alignment = { horizontal: 'center' };

                // ESTILOS CONDICIONALES
                
                // 1. PODA (Verde y Negrita)
                if (item.codigo === 'PODA' || (item.descripcion && item.descripcion.includes('Poda'))) {
                    const celdaDesc = hoja.getCell(`C${filaActual}`);
                    celdaDesc.font = { bold: true, color: { argb: 'FF006100' } }; 
                    celdaDesc.value = "🌳 PODA - " + item.descripcion;
                }

                // 2. AISLADORES (Icono para destacar en descripción)
                if (item.codigo && item.codigo.startsWith('AISL_')) {
                    const celdaDesc = hoja.getCell(`C${filaActual}`);
                    const tipoRotura = item.codigo === 'AISL_ROTO' ? 'ROTO' : 'CACHADO';
                    celdaDesc.value = `💿 AISLADOR ${tipoRotura}`; // Fuerza un título claro en la columna C
                    // Damos un fondo muy sutil a la celda del detalle para que resalte
                    hoja.getCell(`D${filaActual}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                }

                // 3. PRIORIDAD (Colores de semáforo)
                if (item.prioridad === 'ALTA') {
                    celdaPrio.font = { color: { argb: 'FFFF0000' }, bold: true }; 
                } else if (item.prioridad === 'MEDIA') {
                    celdaPrio.font = { color: { argb: 'FFED7D31' }, bold: true }; 
                }

                // Bordes de la fila
                letras.forEach(col => {
                    hoja.getCell(`${col}${filaActual}`).border = {
                        left: {style:'thin'}, right: {style:'thin'}, bottom: {style:'dotted'}
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
        console.log(`✅ Excel NUEVO generado: ${nombreArchivo}`);
        return nombreArchivo;

    } catch (error) {
        console.error("❌ Error Excel:", error);
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
            // PODA PRIMERO
            const esPodaA = a.codigo === 'PODA' || (a.descripcion && a.descripcion.includes('Poda'));
            const esPodaB = b.codigo === 'PODA' || (b.descripcion && b.descripcion.includes('Poda'));
            
            if (esPodaA && !esPodaB) return -1;
            if (!esPodaA && esPodaB) return 1;

            // LUEGO PRIORIDAD
            const mapPrio = { 'ALTA': 1, 'MEDIA': 2, 'BAJA': 3 };
            const prioA = mapPrio[a.prioridad] || 99;
            const prioB = mapPrio[b.prioridad] || 99;
            return prioA - prioB;
        });
    }
    return grupos;
}

module.exports = { generarReporteExcel };