const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const FactureProduit = sequelize.define(
  "FactureProduit",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    quantite: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    prix_unitaire: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    remise_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_ht_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    montant_tva_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    total_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "facture_produits",
    timestamps: true,
  },
);

module.exports = FactureProduit;
