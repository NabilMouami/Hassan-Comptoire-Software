const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Facture = sequelize.define(
  "Facture",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    num_facture: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    date_creation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    date_facturation: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    mode_reglement: {
      type: DataTypes.ENUM(
        "espèces",
        "carte_bancaire",
        "chèque",
        "virement",
        "autre",
      ),
      allowNull: false,
    },

    remise_total: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_ht: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    tva: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_tva: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_ttc: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    montant_restant: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_paye: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM(
        "brouillon",
        "payée",
        "partiellement_payée",
        "annulée",
      ),
      defaultValue: "brouillon",
    },

    notes: {
      type: DataTypes.TEXT,
    },

    bon_livraison_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "bon_livraisons",
        key: "id",
      },
    },

    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "clients", // Assuming you have a clients table
        key: "id",
      },
    },
  },
  {
    tableName: "factures",
    timestamps: true,
  },
);

module.exports = Facture;
