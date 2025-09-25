module.exports = (sequelize, DataTypes) => {
  const ItemCatalogo = sequelize.define('ItemCatalogo', {
    codigo:       { type: DataTypes.STRING, allowNull: false, unique: true }, // p.ej. 'PODA','BALIZOR','SENAL_TORRE'
    descripcion:  { type: DataTypes.STRING, allowNull: false },
    tipo_entrada: { type: DataTypes.ENUM('check','numero','texto','poda'), allowNull: false },
    max_value:    { type: DataTypes.INTEGER, allowNull: true } // para límites (ej. 2 o 4)
  }, {
    tableName: 'items_catalogo'
  });

  return ItemCatalogo;
};
