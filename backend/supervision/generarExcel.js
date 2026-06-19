const ExcelJS = require('exceljs');
const path = require('path');

async function generarReporteExcel(datosReporte) {
    try {
        const workbook = new ExcelJS.Workbook();
        // Asegúrate de que tu archivo excel real se llame 'plantilla.xlsx' y esté en esta carpeta
        const pathPlantilla = path.join(__dirname, 'plantilla.xlsx');
        
        await workbook.xlsx.readFile(pathPlantilla);
        
        // Trabajamos sobre la primera hoja
        const hoja = workbook.worksheets[0]; 

        // ==========================================
        // 1. LLENADO DEL ENCABEZADO
        // ==========================================
        const meta = datosReporte.meta;

        hoja.getCell('B7').value = meta.linea;          
        hoja.getCell('F7').value = "132/220";           
        hoja.getCell('G7').value = meta.tramo;          
        hoja.getCell('R7').value = meta.ot;             
        
        // ==========================================
        // 2. LISTADO DE ANOMALÍAS
        // ==========================================
        const filaInicio = 12; 
        let filaActual = filaInicio;

        // Estilos para los encabezados de nuestra tabla insertada
        hoja.getCell(`A${filaActual}`).value = "PIQUETE";
        hoja.getCell(`B${filaActual}`).value = "CÓDIGO";
        hoja.getCell(`C${filaActual}`).value = "DESCRIPCIÓN";
        hoja.getCell(`D${filaActual}`).value = "DETALLE TÉCNICO";
        hoja.getCell(`E${filaActual}`).value = "PRIORIDAD";
        
        // Negrita y fondo gris para el título
        ['A','B','C','D','E'].forEach(col => {
            hoja.getCell(`${col}${filaActual}`).font = { bold: true };
            hoja.getCell(`${col}${filaActual}`).fill = {
                type: 'pattern',
                pattern:'solid',
                fgColor:{argb:'FFCCCCCC'}
            };
        });

        filaActual++; // Bajamos una fila para empezar con los datos

        const lista = datosReporte.planillaGeneral;

        lista.forEach((item) => {
            // =========================================================
            // 🔥 NUEVO: INTERCEPTAMOS Y MEJORAMOS LOS TEXTOS
            // =========================================================
            let detalleFinal = item.detalle || "";
            let descFinal = item.descripcion || "";

            // 1. LÓGICA PARA AISLADORES
            if (item.codigo && item.codigo.startsWith('AISL_') && item.AisladorDetalle) {
                // Forzamos un título claro en la descripción
                const tipoRotura = item.codigo === 'AISL_ROTO' ? 'ROTO' : 'CACHADO';
                descFinal = `💿 AISLADOR ${tipoRotura}`;

                // Armamos el detalle con Fase, Lado y Cantidades
                const aisl = Array.isArray(item.AisladorDetalle) ? item.AisladorDetalle[0] : item.AisladorDetalle;
                if (aisl) {
                    const partes = [];
                    partes.push(`Fase: ${aisl.fase}`);
                    if (aisl.lado_referencia) partes.push(`Lado: ${aisl.lado_referencia}`);
                    
                    const int = Number(aisl.cantidad_interior) || 0;
                    const ext = Number(aisl.cantidad_exterior) || 0;
                    
                    if (int > 0 && ext > 0) partes.push(`Int: ${int} / Ext: ${ext}`);
                    else if (int > 0) partes.push(`Int: ${int}`);
                    else if (ext > 0) partes.push(`Ext: ${ext}`);

                    detalleFinal = partes.join(' | ');
                }
            }

            // 2. LÓGICA PARA PODA
            if (item.codigo === 'PODA' || (item.descripcion && item.descripcion.includes('Poda'))) {
                descFinal = "🌳 PODA - " + descFinal;
                // Si el backend manda los datos crudos de poda, los sumamos al detalle
                if (item.PodaDetalle) {
                    const p = item.PodaDetalle;
                    detalleFinal = `Urgencia: ${p.urgencia} | Medio: ${p.medio} | Cant: ${p.cantidad_arboles} | ${detalleFinal}`;
                }
            }

            // =========================================================
            // INSERCIÓN DE DATOS EN CELDAS
            // =========================================================
            hoja.getCell(`A${filaActual}`).value = item.piquete;
            hoja.getCell(`B${filaActual}`).value = item.codigo;
            hoja.getCell(`C${filaActual}`).value = descFinal;
            hoja.getCell(`D${filaActual}`).value = detalleFinal; // <- Detalle enriquecido
            
            const celdaPrio = hoja.getCell(`E${filaActual}`);
            celdaPrio.value = item.prioridad;

            // Colores de Prioridad y Texto
            if (item.prioridad === 'ALTA') {
                celdaPrio.font = { color: { argb: 'FFFF0000' }, bold: true }; // Rojo
            } else if (item.prioridad === 'MEDIA') {
                celdaPrio.font = { color: { argb: 'FFFFA500' }, bold: true }; // Naranja
            }

            // Si es Poda, pintamos la descripción de verde
            if (item.codigo === 'PODA') {
                hoja.getCell(`C${filaActual}`).font = { bold: true, color: { argb: 'FF006100' } };
            }

            // Bordes para que quede prolijo
            ['A','B','C','D','E'].forEach(col => {
                hoja.getCell(`${col}${filaActual}`).border = {
                    top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
                };
            });

            filaActual++;
        });

        // ==========================================
        // 3. GENERAR NOMBRE Y GUARDAR
        // ==========================================
        const lineaLimpia = (meta.linea || "Sin_Linea").replace(/[^a-zA-Z0-9 \-]/g, "_");
        const tramoLimpio = (meta.tramo || "Sin_Tramo").replace(/[^a-zA-Z0-9 \-]/g, "_");
        const nombreArchivo = `Reporte_Linea_${lineaLimpia}_(${tramoLimpio})_${Date.now().toString().slice(-4)}.xlsx`;
        
        // Lo guardamos en la misma carpeta para que sea fácil de encontrar
        const pathSalida = path.join(__dirname, nombreArchivo);
        await workbook.xlsx.writeFile(pathSalida);
        
        console.log(`✅ Excel NUEVO generado: ${nombreArchivo}`);
        return nombreArchivo; // o pathSalida dependiendo de cómo lo mandes al frontend

    } catch (error) {
        console.error("❌ Error generando Excel:", error);
        throw error;
    }
}

module.exports = { generarReporteExcel };