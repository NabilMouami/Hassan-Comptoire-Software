const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BonAvoir = sequelize.define(
  "BonAvoir",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    num_bon_avoir: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    date_creation: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    motif: {
      type: DataTypes.ENUM(
        "retour_produit",
        "erreur_facturation",
        "remise_commerciale",
        "annulation",
        "autre",
      ),
      allowNull: false,
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
      allowNull: true,
      references: {
        model: "clients",
        key: "id",
      },
    },
    montant_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("brouillon", "valide", "utilise", "annule"),
      defaultValue: "brouillon",
    },
    notes: DataTypes.TEXT,
    utilise_le: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "bons_avoir",
    timestamps: true,
  },
);

module.exports = BonAvoir;
