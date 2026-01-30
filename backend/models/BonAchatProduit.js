const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BonAchatProduit = sequelize.define(
  "BonAchatProduit",
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
    total_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    bon_achat_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "bons_achat",
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
  },
  {
    tableName: "bon_achat_produits",
    timestamps: true,
  },
);

module.exports = BonAchatProduit;
