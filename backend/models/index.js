// models/index.js
const sequelize = require("../config/db");
const Fornisseur = require("./fornisseur");
const Client = require("./client");
const Produit = require("./Produit");
const BonLivraison = require("./BonLivraison");
const BonLivraisonProduit = require("./BonLivraisonProduit");
const Advancement = require("./Advancement");
const Devis = require("./Devis");
const DevisProduit = require("./DevisProduit");
const Facture = require("./Facture");
const FactureProduit = require("./FactureProduit");
const BonAvoir = require("./BonAvoir");
const BonAvoirProduit = require("./BonAvoirProduit");
const BonAchat = require("./BonAchat");
const BonAchatProduit = require("./BonAchatProduit");

// Define relationships

// Fornisseur - Produit relationships
Fornisseur.hasMany(Produit, {
  foreignKey: "fornisseurId",
  as: "produits",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Produit.belongsTo(Fornisseur, {
  foreignKey: "fornisseurId",
  as: "fornisseur",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Client - Devis relationships
Client.hasMany(Devis, {
  foreignKey: "client_id",
  as: "devis",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Devis.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Client - BonLivraison relationships
Client.hasMany(BonLivraison, {
  foreignKey: "client_id",
  as: "bonLivraisons",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

BonLivraison.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Client - Facture relationships
Client.hasMany(Facture, {
  foreignKey: "client_id",
  as: "factures",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Facture.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// BonLivraison - Advancement relationships
BonLivraison.hasMany(Advancement, {
  foreignKey: "bon_livraison_id",
  as: "advancements",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Advancement.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bon_livraison",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Facture - Advancement relationships
Facture.hasMany(Advancement, {
  foreignKey: "facture_id",
  as: "advancements",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Advancement.belongsTo(Facture, {
  foreignKey: "facture_id",
  as: "facture",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Devis - BonLivraison relationships
Devis.hasOne(BonLivraison, {
  foreignKey: "devis_id",
  as: "bon_livraison",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

BonLivraison.belongsTo(Devis, {
  foreignKey: "devis_id",
  as: "devis_origine",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// BonLivraison - Facture relationships
BonLivraison.hasOne(Facture, {
  foreignKey: "bon_livraison_id",
  as: "facture",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Facture.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bon_livraison",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Many-to-Many relationship between Devis and Produit
Devis.belongsToMany(Produit, {
  through: DevisProduit,
  foreignKey: "devis_id",
  otherKey: "produit_id",
  as: "produits",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Produit.belongsToMany(Devis, {
  through: DevisProduit,
  foreignKey: "produit_id",
  otherKey: "devis_id",
  as: "devis",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Many-to-Many relationship between BonLivraison and Produit
BonLivraison.belongsToMany(Produit, {
  through: BonLivraisonProduit,
  foreignKey: "bon_livraison_id",
  otherKey: "produit_id",
  as: "produits",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Produit.belongsToMany(BonLivraison, {
  through: BonLivraisonProduit,
  foreignKey: "produit_id",
  otherKey: "bon_livraison_id",
  as: "bonLivraisons",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Many-to-Many relationship between Facture and Produit
Facture.belongsToMany(Produit, {
  through: FactureProduit,
  foreignKey: "facture_id",
  otherKey: "produit_id",
  as: "produits",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Produit.belongsToMany(Facture, {
  through: FactureProduit,
  foreignKey: "produit_id",
  otherKey: "facture_id",
  as: "factures",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Direct relationships for DevisProduit
DevisProduit.belongsTo(Devis, {
  foreignKey: "devis_id",
  as: "devis",
});

DevisProduit.belongsTo(Produit, {
  foreignKey: "produit_id",
  as: "produit",
});

Devis.hasMany(DevisProduit, {
  foreignKey: "devis_id",
  as: "lignes",
  onDelete: "CASCADE",
});

Produit.hasMany(DevisProduit, {
  foreignKey: "produit_id",
  as: "devisItems",
  onDelete: "CASCADE",
});

// Direct relationships for BonLivraisonProduit
BonLivraisonProduit.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bonLivraison",
});

BonLivraisonProduit.belongsTo(Produit, {
  foreignKey: "produit_id",
  as: "produit",
});

BonLivraison.hasMany(BonLivraisonProduit, {
  foreignKey: "bon_livraison_id",
  as: "lignes",
  onDelete: "CASCADE",
});

Produit.hasMany(BonLivraisonProduit, {
  foreignKey: "produit_id",
  as: "bonLivraisonItems",
  onDelete: "CASCADE",
});

// Direct relationships for FactureProduit
FactureProduit.belongsTo(Facture, {
  foreignKey: "facture_id",
  as: "facture",
});

FactureProduit.belongsTo(Produit, {
  foreignKey: "produit_id",
  as: "produit",
});

Facture.hasMany(FactureProduit, {
  foreignKey: "facture_id",
  as: "lignes",
  onDelete: "CASCADE",
});

Produit.hasMany(FactureProduit, {
  foreignKey: "produit_id",
  as: "factureItems",
  onDelete: "CASCADE",
});

// Dans votre fichier d'associations (ex: models/index.js)

// Associations pour BonAvoir
BonAvoir.belongsTo(Client, { foreignKey: "client_id", as: "client" });
BonAvoir.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bonLivraison",
});

// Associations many-to-many avec Produit
BonAvoir.belongsToMany(Produit, {
  through: BonAvoirProduit,
  foreignKey: "bon_avoir_id",
  otherKey: "produit_id",
  as: "produits",
});

Produit.belongsToMany(BonAvoir, {
  through: BonAvoirProduit,
  foreignKey: "produit_id",
  otherKey: "bon_avoir_id",
  as: "bonsAvoir",
});

// Association inverse pour BonAvoirProduit
BonAvoirProduit.belongsTo(BonAvoir, { foreignKey: "bon_avoir_id" });
BonAvoirProduit.belongsTo(Produit, { foreignKey: "produit_id" });
BonAvoirProduit.belongsTo(BonLivraisonProduit, {
  foreignKey: "bon_livraison_produit_id",
  as: "bonLivraisonProduit",
});
// Associations pour BonAchat
BonAchat.belongsTo(Fornisseur, {
  foreignKey: "fornisseur_id",
  as: "fornisseur",
});

// Associations many-to-many avec Produit
BonAchat.belongsToMany(Produit, {
  through: BonAchatProduit,
  foreignKey: "bon_achat_id",
  otherKey: "produit_id",
  as: "produits",
});

Produit.belongsToMany(BonAchat, {
  through: BonAchatProduit,
  foreignKey: "produit_id",
  otherKey: "bon_achat_id",
  as: "bonsAchat",
});

// Association inverse pour BonAchatProduit
BonAchatProduit.belongsTo(BonAchat, { foreignKey: "bon_achat_id" });
BonAchatProduit.belongsTo(Produit, { foreignKey: "produit_id" });
const db = {
  sequelize: sequelize,
  User: require("./user"),
  Client: require("./client"),
  Fornisseur: require("./fornisseur"),
  Produit: require("./Produit"),
  BonLivraison: require("./BonLivraison"),
  BonLivraisonProduit: require("./BonLivraisonProduit"),
  Advancement: Advancement,
  Devis: Devis,
  DevisProduit: DevisProduit,
  Facture: Facture,
  FactureProduit: FactureProduit,
  BonAvoir: BonAvoir,
  BonAvoirProduit: BonAvoirProduit,
  BonAchat: BonAchat,
  BonAchatProduit: BonAchatProduit,
};

module.exports = db;
