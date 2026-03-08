const ExcelJS = require('exceljs');
const path = require('path');

async function generarReporteExcel(datosReporte) {
    try {
        const workbook = new ExcelJS.Workbook();
        // Asegúrate de que tu archivo excel real se llame 'plantilla.xlsx' y esté en esta carpeta
        const pathPlantilla = path.join(__dirname, 'plantilla.xlsx');
        
        await workbook.xlsx.readFile(pathPlantilla);
        
        // Trabajamos sobre la primera hoja
        const hoja = workbook.worksheets[0]; // Toma la primera hoja del array

        // ==========================================
        // 1. LLENADO DEL ENCABEZADO
        // (Ajusta estas celdas mirando tu Excel original)
        const meta = datosReporte.meta;

        // Según tu CSV, la línea de datos está aprox en la Fila 7
        // Verifica en tu Excel real si estas son las letras de columna correctas:
        hoja.getCell('B7').value = meta.linea;          // Donde dice "LINEA N° ____"
        hoja.getCell('F7').value = "132/220";           // Donde dice "RED ____ KV" (O saca el dato de meta si lo tienes)
        hoja.getCell('G7').value = meta.tramo;          // Donde dice "Entre ___ y ___"
        hoja.getCell('R7').value = meta.ot;             // Donde dice "OT N° ____" (está bien a la derecha)
        
        // Firma del Supervisor / Operario (al final del archivo, filas 40 aprox)
        // hoja.getCell('C45').value = meta.usuario; 

        // ==========================================
        // 2. LISTADO DE ANOMALÍAS
        // ==========================================
        // Como la planilla tiene textos fijos, vamos a empezar a escribir 
        // NUESTRA lista a partir de la fila 12 (debajo de los títulos),
        // empujando lo que haya abajo o sobrescribiendo si prefieres.
        
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
            // Insertamos los valores
            hoja.getCell(`A${filaActual}`).value = item.piquete;
            hoja.getCell(`B${filaActual}`).value = item.codigo;
            hoja.getCell(`C${filaActual}`).value = item.descripcion;
            hoja.getCell(`D${filaActual}`).value = item.detalle;
            
            const celdaPrio = hoja.getCell(`E${filaActual}`);
            celdaPrio.value = item.prioridad;

            // Colores de Prioridad
            if (item.prioridad === 'ALTA') {
                celdaPrio.font = { color: { argb: 'FFFF0000' }, bold: true }; // Rojo
            } else if (item.prioridad === 'MEDIA') {
                celdaPrio.font = { color: { argb: 'FFFFA500' }, bold: true }; // Naranja
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
        // Limpiamos el nombre para que no tenga caracteres raros
       const lineaLimpia = (meta.linea || "Sin_Linea").replace(/[^a-zA-Z0-9 \-]/g, "_");
        const tramoLimpio = (meta.tramo || "Sin_Tramo").replace(/[^a-zA-Z0-9 \-]/g, "_");
        const nombreArchivo = `Reporte Linea ${lineaLimpia} (${tramoLimpio})_${Date.now().toString().slice(-4)}.xlsx`;
        
        await workbook.xlsx.writeFile(nombreArchivo);
        console.log(`✅ Excel NUEVO generado: ${nombreArchivo}`);
        return nombreArchivo;

    } catch (error) {
        console.error("❌ Error generando Excel:", error);
        throw error;
    }
}

module.exports = { generarReporteExcel };