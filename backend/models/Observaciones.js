// backend/models/Observaciones.js
module.exports = (sequelize, DataTypes) => {
  const Observaciones = sequelize.define('Observaciones', {
    recorrido_id: { type: DataTypes.INTEGER, allowNull: false },
    piquete_id:   { type: DataTypes.INTEGER, allowNull: false },
    texto:        { type: DataTypes.TEXT,    allowNull: false }
  }, {
    tableName: 'observaciones'
  });

  return Observaciones;
};
