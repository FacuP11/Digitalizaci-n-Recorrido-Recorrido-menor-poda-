const { sequelize, ItemCatalogo } = require('../models');

(async () => {
  await sequelize.sync();

  const items = [
    // AISLADORES
    { categoria:'AISLADORES', codigo:'AIS_FASE_R', descripcion:'Roto/cachado fase R', tipo_entrada:'check' },
    { categoria:'AISLADORES', codigo:'AIS_FASE_S', descripcion:'Roto/cachado fase S', tipo_entrada:'check' },
    { categoria:'AISLADORES', codigo:'AIS_FASE_T', descripcion:'Roto/cachado fase T', tipo_entrada:'check' },

    // CONDUCTORES (ejemplos clave)
    { categoria:'CONDUCTORES', codigo:'COND_EDIF', descripcion:'Cable a menor distancia línea–edificio', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'COND_TERRENO', descripcion:'Cable a menor distancia del terreno', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'PODA', descripcion:'Poda (urgencia/medio/árboles)', tipo_entrada:'poda' },
    { categoria:'CONDUCTORES', codigo:'BALIZOR', descripcion:'Balizor roto (N/D)', tipo_entrada:'toggle' },
    { categoria:'CONDUCTORES', codigo:'COND_CARTEL', descripcion:'Cable a menor distancia de carteles', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'COND_OTRAS_INST', descripcion:'Cable próximo a otras instalaciones', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'COND_DET', descripcion:'Cable deteriorado', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'COND_MORSE', descripcion:'Morsetería deteriorada', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'HG_BAJO', descripcion:'Hilo de Guardia bajo/desprendido', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'CABLE_ELEMENTOS', descripcion:'Cable con elementos extraños', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'HG_ELEMENTOS', descripcion:'HG con elementos extraños', tipo_entrada:'check' },
    { categoria:'CONDUCTORES', codigo:'HG_DET', descripcion:'Hilo de Guardia deteriorado', tipo_entrada:'check' },

    // COLUMNA
    { categoria:'COLUMNA', codigo:'COL_INCLINADA', descripcion:'Columna inclinada (Met./H°A°)', tipo_entrada:'check' },
    { categoria:'COLUMNA', codigo:'COL_MENSULA', descripcion:'Ménsula H°A° deteriorada', tipo_entrada:'check' },
    { categoria:'COLUMNA', codigo:'COL_SENIAL', descripcion:'Señalización (0–2)', tipo_entrada:'numero', max_value:2 },
    { categoria:'COLUMNA', codigo:'COL_IDENT_ILEG', descripcion:'Identificación ilegible', tipo_entrada:'check' },

    // TORRE
    { categoria:'TORRE', codigo:'TOR_ANTITREP', descripcion:'N° antitrepadores colocados', tipo_entrada:'numero' },
    { categoria:'TORRE', codigo:'TOR_PERFILES', descripcion:'N° perfiles faltantes', tipo_entrada:'numero' },
    { categoria:'TORRE', codigo:'TOR_SENIAL', descripcion:'Señalización (0–4)', tipo_entrada:'numero', max_value:4 },
    { categoria:'TORRE', codigo:'TOR_IDENT_DANIO', descripcion:'Falta/daño identificación', tipo_entrada:'check' },

    // GENERAL
    { categoria:'GENERAL', codigo:'GEN_ELEMENTOS', descripcion:'Estruct./col. con elementos extraños', tipo_entrada:'check' },
    { categoria:'GENERAL', codigo:'GEN_DETERIORO', descripcion:'Estruct./col. deteriorada', tipo_entrada:'check' },
    { categoria:'GENERAL', codigo:'GEN_PTIERRA', descripcion:'Puesta a tierra deteriorada', tipo_entrada:'check' },
    { categoria:'GENERAL', codigo:'GEN_CHOQUE', descripcion:'Choque vehicular', tipo_entrada:'check' },
    { categoria:'GENERAL', codigo:'GEN_SIN_NOVEDAD', descripcion:'SIN NOVEDAD', tipo_entrada:'check' }
  ];

  await ItemCatalogo.bulkCreate(items, { ignoreDuplicates: true });
  console.log('Catálogo sembrado ✔');
  process.exit(0);
})();
