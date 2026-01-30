const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BonLivraison = sequelize.define(
  "BonLivraison",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED, // ✅ MUST MATCH
      autoIncrement: true,
      primaryKey: true,
    },

    num_bon_livraison: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    date_creation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    date_livraison: {
      type: DataTypes.DATE,
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

    remise: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_ht: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "clients",
        key: "id",
      },
    },

    devis_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "devis",
        key: "id",
      },
    },
    tva: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    montant_ttc: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "brouillon",
        "envoyée",
        "payé",
        "partiellement_payée",
        "annulée",
      ),
      defaultValue: "brouillon",
    },

    notes: DataTypes.TEXT,

    is_facture: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "bon_livraisons",
    timestamps: true,
  },
);

module.exports = BonLivraison;
