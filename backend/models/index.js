const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Inicializar modelos (todas funciones que retornan sequelize.define)
const Recorrido      = require('./Recorrido')(sequelize, DataTypes);
const Piquete        = require('./Piquete')(sequelize, DataTypes);
const ItemCatalogo   = require('./ItemCatalogo')(sequelize, DataTypes);
const Anomalia       = require('./Anomalia')(sequelize, DataTypes);
const PodaDetalle    = require('./PodaDetalle')(sequelize, DataTypes);
const Observaciones  = require('./Observaciones')(sequelize, DataTypes);

// Asociaciones (solo aquí)
Recorrido.hasMany(Piquete,   { foreignKey: 'recorrido_id' });
Piquete.belongsTo(Recorrido, { foreignKey: 'recorrido_id' });

Recorrido.hasMany(Anomalia,  { foreignKey: 'recorrido_id' });
Anomalia.belongsTo(Recorrido,{ foreignKey: 'recorrido_id' });

Piquete.hasMany(Anomalia,    { foreignKey: 'piquete_id' });
Anomalia.belongsTo(Piquete,  { foreignKey: 'piquete_id' });

ItemCatalogo.hasMany(Anomalia,  { foreignKey: 'item_id' });
Anomalia.belongsTo(ItemCatalogo, { foreignKey: 'item_id' });

Anomalia.hasOne(PodaDetalle, { foreignKey: 'anomalia_id' });
PodaDetalle.belongsTo(Anomalia, { foreignKey: 'anomalia_id' });

Piquete.hasMany(Observaciones,   { foreignKey: 'piquete_id' });
Observaciones.belongsTo(Piquete, { foreignKey: 'piquete_id' });

Recorrido.hasMany(Observaciones,   { foreignKey: 'recorrido_id' });
Observaciones.belongsTo(Recorrido, { foreignKey: 'recorrido_id' });

// Export
module.exports = {
  sequelize,
  Recorrido,
  Piquete,
  ItemCatalogo,
  Anomalia,
  PodaDetalle,
  Observaciones,
};
