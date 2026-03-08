// prueba_excel.js
const { generarReporteExcel } = require('./generarExcel');

console.log("🧪 INICIANDO PRUEBA DE EXCEL...");

// Datos falsos para probar
const datosDePrueba = {
    meta: {
        linea: "LINEA DE PRUEBA 132kV",
        ot: "99999",
        fecha: new Date(),
        tramo: "Estación A - Estación B",
        usuario: "Tester",
        estadoCierre: "COMPLETO",
        motivo: ""
    },
    planillaGeneral: [
        { piquete: "Piquete 1", codigo: "AISL_ROTO", descripcion: "Aislador Roto", detalle: "Int: 1", prioridad: "ALTA" },
        { piquete: "Piquete 2", codigo: "PODA", descripcion: "Poda", detalle: "Urgente", prioridad: "MEDIA" }
    ]
};

// Ejecutamos la función manualmente
generarReporteExcel(datosDePrueba)
    .then((nombre) => {
        console.log(`✅ ¡ÉXITO! El archivo debería estar aquí: ${nombre}`);
    })
    .catch((error) => {
        console.error("❌ FALLÓ LA PRUEBA. Aquí está el error exacto:");
        console.error(error);
    });