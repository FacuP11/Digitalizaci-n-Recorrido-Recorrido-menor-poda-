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
            { header: '', key: 'colD', width: 40 }, // Detalle
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
        // Estilo para las etiquetas (Negrita)
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

        // Si fue emergencia, aviso en rojo
        if (meta.estadoCierre && meta.estadoCierre.includes('EMERGENCIA')) {
            hoja.getCell(`D${filaActual}`).value = "⚠️ CIERRE POR EMERGENCIA";
            hoja.getCell(`D${filaActual}`).font = { bold: true, color: { argb: 'FFFF0000' } };
            filaActual++;
            hoja.getCell(`D${filaActual}`).value = `Motivo: ${meta.motivo}`;
        }

        filaActual += 2; // Espacio antes de la tabla

        // ==========================================
        // 5. ENCABEZADOS DE LA TABLA
        // ==========================================
        const headers = ["UBICACIÓN / PIQUETE", "CÓDIGO", "DESCRIPCIÓN", "DETALLE TÉCNICO", "PRIORIDAD"];
        const letras = ['A', 'B', 'C', 'D', 'E'];

        letras.forEach((l, i) => {
            const cell = hoja.getCell(`${l}${filaActual}`);
            cell.value = headers[i];
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Blanco
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }; // Azul medio
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
            celdaPiquete.value = nombrePiquete; // Ej: "Piquete 5"
            celdaPiquete.font = { bold: true, size: 11 };
            celdaPiquete.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; // Azul muy clarito
            celdaPiquete.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
            
            filaActual++;

            // --- B. LISTA DE ANOMALÍAS ---
            anomalias.forEach(item => {
                // Sangría visual en Columna A
                hoja.getCell(`A${filaActual}`).value = "      ↳"; 
                
                hoja.getCell(`B${filaActual}`).value = item.codigo;
                hoja.getCell(`C${filaActual}`).value = item.descripcion;
                hoja.getCell(`D${filaActual}`).value = item.detalle;
                
                const celdaPrio = hoja.getCell(`E${filaActual}`);
                celdaPrio.value = item.prioridad;
                celdaPrio.alignment = { horizontal: 'center' };

                // ESTILOS CONDICIONALES
                
                // 1. PODA (Verde y Negrita)
                if (item.codigo === 'PODA' || (item.descripcion && item.descripcion.includes('Poda'))) {
                    const celdaDesc = hoja.getCell(`C${filaActual}`);
                    celdaDesc.font = { bold: true, color: { argb: 'FF006100' } }; // Verde oscuro
                    celdaDesc.value = "🌳 PODA - " + item.descripcion;
                }

                // 2. PRIORIDAD (Colores de semáforo)
                if (item.prioridad === 'ALTA') {
                    celdaPrio.font = { color: { argb: 'FFFF0000' }, bold: true }; // Rojo
                } else if (item.prioridad === 'MEDIA') {
                    celdaPrio.font = { color: { argb: 'FFED7D31' }, bold: true }; // Naranja
                }

                // Bordes de la fila
                letras.forEach(col => {
                    hoja.getCell(`${col}${filaActual}`).border = {
                        left: {style:'thin'}, right: {style:'thin'}, bottom: {style:'dotted'}
                    };
                });

                filaActual++;
            });
            
            // Un pequeño separador invisible para que no quede todo pegado
            // filaActual++; 
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

// --- FUNCIÓN DE ORDENAMIENTO (Mantenemos la lógica de Poda primero) ---
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