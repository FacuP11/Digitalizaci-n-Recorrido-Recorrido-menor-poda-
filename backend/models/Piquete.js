module.exports = (sequelize, DataTypes) => {
  const Piquete = sequelize.define('Piquete', {
    recorrido_id: { type: DataTypes.INTEGER, allowNull: false },
    etiqueta:     { type: DataTypes.STRING, allowNull: false }, // 'POR','ANT','1','2','155B', etc.
    orden:        { type: DataTypes.INTEGER, allowNull: false }, // orden secuencial
    // Tipo de cadena (checks)
    tc_ss:  { type: DataTypes.BOOLEAN, defaultValue: false },
    tc_sd:  { type: DataTypes.BOOLEAN, defaultValue: false },
    tc_sv:  { type: DataTypes.BOOLEAN, defaultValue: false },
    tc_scm: { type: DataTypes.BOOLEAN, defaultValue: false },
    tc_rs:  { type: DataTypes.BOOLEAN, defaultValue: false },
    tc_rd:  { type: DataTypes.BOOLEAN, defaultValue: false },
    tc_lado:     { type: DataTypes.STRING, allowNull: true },  // 'INICIO'|'FIN'
    tc_cadenas:  { type: DataTypes.STRING, allowNull: true },  // 'V'|'P'|'C'|'LP'|'M'
    // Estado
    sin_novedad: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'piquetes'
  });

  return Piquete;
};
