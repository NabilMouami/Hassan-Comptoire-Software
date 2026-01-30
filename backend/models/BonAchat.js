const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BonAchat = sequelize.define(
  "BonAchat",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    num_bon_achat: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    date_creation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    fornisseur_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "fornisseurs",
        key: "id",
      },
    },
    mode_reglement: {
      type: DataTypes.ENUM(
        "espèces",
        "carte_bancaire",
        "chèque",
        "virement",
        "crédit",
        "autre",
      ),
      defaultValue: "espèces",
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
        "commandé",
        "partiellement_reçu",
        "reçu",
        "partiellement_payé",
        "payé",
        "annulé",
      ),
      defaultValue: "brouillon",
    },
  },
  {
    tableName: "bons_achat",
    timestamps: true,
  },
);

module.exports = BonAchat;
