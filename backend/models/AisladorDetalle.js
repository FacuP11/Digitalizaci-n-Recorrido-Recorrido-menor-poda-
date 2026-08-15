// backend/models/AisladorDetalle.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const AisladorDetalle = sequelize.define('AisladorDetalle', {
    anomalia_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // FASE: R, S, T (Obligatorio)
    fase: {
      type: DataTypes.STRING(5), 
      allowNull: false
    },
    // Cantidad en cadena INTERIOR (número)
    cantidad_interior: {
      type: DataTypes.INTEGER, 
      allowNull: false,
      defaultValue: 0
    },
    // Cantidad en cadena EXTERIOR (número)
    cantidad_exterior: {
      type: DataTypes.INTEGER, 
      allowNull: false,
      defaultValue: 0
    },
    // Lado Subestación (Texto)
    lado_referencia: {
      type: DataTypes.STRING, 
      allowNull: true
    }
  }, {
    tableName: 'aislador_detalles',
    timestamps: false
  });

  AisladorDetalle.associate = (models) => {
    AisladorDetalle.belongsTo(models.Anomalia, {
      foreignKey: 'anomalia_id',
      onDelete: 'CASCADE'
    });
  };

  return AisladorDetalle;
};