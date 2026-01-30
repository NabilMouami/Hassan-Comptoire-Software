const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Produit extends Model {}

Produit.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "La référence est requise",
        },
        len: {
          args: [1, 100],
          msg: "La référence doit contenir entre 1 et 100 caractères",
        },
      },
    },
    designation: {
      type: DataTypes.TEXT("medium"),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "La désignation est requise",
        },
      },
    },
    observation: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "La quantité ne peut pas être négative",
        },
      },
    },
    prix_achat: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Le prix d'achat ne peut pas être négatif",
        },
      },
    },
    prix_vente: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Le prix de vente ne peut pas être négatif",
        },
      },
    },
    fornisseurId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "fornisseurs",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    sequelize,
    modelName: "Produit",
    tableName: "produits",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["reference"],
      },
      {
        fields: ["designation"],
        type: "FULLTEXT", // For text search
      },
      {
        fields: ["fornisseurId"],
      },
    ],
  }
);

module.exports = Produit;
