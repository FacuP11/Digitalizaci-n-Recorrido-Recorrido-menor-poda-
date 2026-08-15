import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Importar funciones de inicialización de cada modelo
import initRecorrido from './Recorrido.js';
import initPiquete from './Piquete.js';
import initItemCatalogo from './ItemCatalogo.js';
import initAnomalia from './Anomalia.js';
import initPodaDetalle from './PodaDetalle.js';
import initObservaciones from './Observaciones.js';
import initAisladorDetalle from './AisladorDetalle.js';

// Inicializar modelos
const Recorrido = initRecorrido(sequelize, DataTypes);
const Piquete = initPiquete(sequelize, DataTypes);
const ItemCatalogo = initItemCatalogo(sequelize, DataTypes);
const Anomalia = initAnomalia(sequelize, DataTypes);
const PodaDetalle = initPodaDetalle(sequelize, DataTypes);
const Observaciones = initObservaciones(sequelize, DataTypes);
const AisladorDetalle = initAisladorDetalle(sequelize, DataTypes);

// Asociaciones
Recorrido.hasMany(Piquete, { foreignKey: 'recorrido_id' });
Piquete.belongsTo(Recorrido, { foreignKey: 'recorrido_id' });

Recorrido.hasMany(Anomalia, { as: 'Anomalias', foreignKey: 'recorrido_id' });
Anomalia.belongsTo(Recorrido, { as: 'Recorrido', foreignKey: 'recorrido_id' });

Piquete.hasMany(Anomalia, { as: 'Anomalias', foreignKey: 'piquete_id' });
Anomalia.belongsTo(Piquete, { as: 'Piquete', foreignKey: 'piquete_id' });

ItemCatalogo.hasMany(Anomalia, { foreignKey: 'item_id' });
Anomalia.belongsTo(ItemCatalogo, { foreignKey: 'item_id' });

Anomalia.hasOne(PodaDetalle, { as: 'PodaDetalle', foreignKey: 'anomalia_id' });
PodaDetalle.belongsTo(Anomalia, { as: 'Anomalia', foreignKey: 'anomalia_id' });

Piquete.hasMany(Observaciones, { as: 'Observaciones', foreignKey: 'piquete_id' });
Observaciones.belongsTo(Piquete, { as: 'Piquete', foreignKey: 'piquete_id' });

Recorrido.hasMany(Observaciones, { as: 'Observaciones', foreignKey: 'recorrido_id' });
Observaciones.belongsTo(Recorrido, { as: 'Recorrido', foreignKey: 'recorrido_id' });

Anomalia.hasMany(AisladorDetalle, { as: 'AisladorDetalle', foreignKey: 'anomalia_id' });
AisladorDetalle.belongsTo(Anomalia, { as: 'Anomalia', foreignKey: 'anomalia_id' });

// Exportación compatible con ES Modules (import { Recorrido, ... } from '../models/index.js')
export {
  sequelize,
  Recorrido,
  Piquete,
  ItemCatalogo,
  Anomalia,
  PodaDetalle,
  Observaciones,
  AisladorDetalle
};