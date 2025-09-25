module.exports = (sequelize, DataTypes) => {
  const PodaDetalle = sequelize.define('PodaDetalle', {
    anomalia_id:      { type: DataTypes.INTEGER, allowNull: false },
    urgencia:         { type: DataTypes.ENUM('s/p','c/p','U','I'), allowNull: false },
    medio:            { type: DataTypes.ENUM('c/e','c/h','f/s'), allowNull: false },
    cantidad_arboles: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    tableName: 'poda_detalle'
  });

  return PodaDetalle;
};
