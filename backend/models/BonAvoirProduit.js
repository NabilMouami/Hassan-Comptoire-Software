// models/BonAvoirProduit.js (version simplifiée sans la référence)
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BonAvoirProduit = sequelize.define(
  "BonAvoirProduit",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    quantite: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    prix_unitaire: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remise_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    bon_avoir_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "bons_avoir",
        key: "id",
      },
    },
    produit_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "produits",
        key: "id",
      },
    },
    bon_livraison_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "bon_livraisons",
        key: "id",
      },
    },
  },
  {
    tableName: "bon_avoir_produits",
    timestamps: true,
  },
);

module.exports = BonAvoirProduit;
