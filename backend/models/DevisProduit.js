// models/DevisProduit.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const DevisProduit = sequelize.define(
  "DevisProduit",
  {
    quantite: {
      type: DataTypes.DECIMAL(10, 2),
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

    total_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    unite: {
      type: DataTypes.STRING(20),
      defaultValue: "unité",
    },
  },
  {
    tableName: "devis_produits",
    timestamps: false,
  },
);

module.exports = DevisProduit;
