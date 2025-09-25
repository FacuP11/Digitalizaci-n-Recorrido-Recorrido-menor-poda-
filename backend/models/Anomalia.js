module.exports = (sequelize, DataTypes) => {
  const Anomalia = sequelize.define('Anomalia', {
    recorrido_id: { type: DataTypes.INTEGER, allowNull: false },
    piquete_id:   { type: DataTypes.INTEGER, allowNull: false },
    item_id:      { type: DataTypes.INTEGER, allowNull: false },
    marcado:      { type: DataTypes.BOOLEAN, defaultValue: false }, // para checks
    valor_numero: { type: DataTypes.INTEGER, allowNull: true },     // para señalización, etc.
    valor_texto:  { type: DataTypes.TEXT, allowNull: true }         // para 'BALIZOR' N/D o textos
  }, {
    tableName: 'anomalias'
  });

  return Anomalia;
};
