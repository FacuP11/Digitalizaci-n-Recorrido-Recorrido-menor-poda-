module.exports = (sequelize, DataTypes) => {
  const Recorrido = sequelize.define('Recorrido', {
    linea:       { type: DataTypes.STRING, allowNull: false },
    kv:          { type: DataTypes.ENUM('132', '220'), allowNull: false },
    entre_desde: { type: DataTypes.STRING, allowNull: false },
    entre_hasta: { type: DataTypes.STRING, allowNull: false },
    ot_numero:   { type: DataTypes.STRING, allowNull: false },
    carga_amp:   { type: DataTypes.INTEGER, allowNull: false },
    fecha:       { type: DataTypes.DATEONLY, allowNull: false },
    estado:      { type: DataTypes.ENUM('ACTIVO','FINALIZADO'), defaultValue: 'ACTIVO' }
  }, {
    tableName: 'recorridos'
  });

  return Recorrido;
};