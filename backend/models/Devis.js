// models/Devis.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Devis = sequelize.define(
  "Devis",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    num_devis: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    date_creation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    remise: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_ht: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    montant_ttc: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM(
        "brouillon",
        "accepté",
        "refusé",

        "transformé_en_commande",
        "transformé_en_facture",
        "transformé_en_bl",
      ),
      defaultValue: "brouillon",
    },

    notes: DataTypes.TEXT,

    // References to other entities
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    bon_livraison_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "devis",
    timestamps: true,
    indexes: [
      {
        fields: ["client_id"],
      },

      {
        fields: ["status"],
      },
    ],
  },
);

module.exports = Devis;
