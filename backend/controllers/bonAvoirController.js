// controllers/bonAvoirController.js
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const BonAvoir = require("../models/BonAvoir");
const BonAvoirProduit = require("../models/BonAvoirProduit");
const BonLivraison = require("../models/BonLivraison");
const Produit = require("../models/Produit");
const Client = require("../models/client");
const BonLivraisonProduit = require("../models/BonLivraisonProduit");

// Générer un numéro unique de bon d'avoir
const generateNumeroBonAvoir = async () => {
  const prefix = "BAV";

  // Trouver le dernier bon d'avoir
  const lastBon = await BonAvoir.findOne({
    where: {
      num_bon_avoir: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastBon) {
    // Extraire seulement les 4 derniers chiffres
    const lastNum = lastBon.num_bon_avoir;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Récupérer tous les bons d'avoir
const getAllBonsAvoir = async (req, res) => {
  try {
    const { startDate, endDate, status, clientId } = req.query;

    const whereClause = {};

    // Filtrer par date
    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Filtrer par status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filtrer par client
    if (clientId && clientId !== "all") {
      whereClause.client_id = clientId;
    }

    const bons = await BonAvoir.findAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone", "address"],
        },
        {
          model: BonLivraison,
          as: "bonLivraison",
          attributes: [
            "id",
            "num_bon_livraison",
            "date_creation",
            "montant_ttc",
          ],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "quantite",
              "prix_unitaire",
              "remise_ligne",
              "total_ligne",
              "bon_livraison_produit_id",
            ],
          },
          attributes: ["id", "reference", "designation"],
        },
      ],
      order: [["date_creation", "DESC"]],
    });

    res.json({
      success: true,
      bons,
      totalCount: bons.length,
    });
  } catch (error) {
    console.error("Erreur récupération bons avoir:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des bons d'avoir",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Récupérer un bon d'avoir spécifique
const getBonAvoirById = async (req, res) => {
  try {
    const { id } = req.params;

    const bon = await BonAvoir.findByPk(id, {
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone", "address", "ville"],
        },
        {
          model: BonLivraison,
          as: "bonLivraison",
          attributes: [
            "id",
            "num_bon_livraison",
            "date_creation",
            "montant_ttc",
            "client_id",
          ],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "quantite",
              "prix_unitaire",
              "remise_ligne",
              "total_ligne",
              "bon_livraison_produit_id",
            ],
          },
          attributes: ["id", "reference", "designation", "qty", "prix_vente"],
        },
      ],
    });

    if (!bon) {
      return res.status(404).json({
        success: false,
        message: "Bon d'avoir non trouvé",
      });
    }

    res.json({
      success: true,
      bon,
    });
  } catch (error) {
    console.error("Erreur récupération bon avoir:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du bon d'avoir",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Créer un nouveau bon d'avoir
const createBonAvoir = async (req, res) => {
  let transaction;

  try {
    const { clientId, bonLivraisonId, produits, motif, notes = "" } = req.body;

    console.log("Bon Avoir Items:" + JSON.stringify(req.body));

    // Validation
    if (!clientId && !bonLivraisonId) {
      return res.status(400).json({
        success: false,
        message: "Client ou bon de livraison requis",
      });
    }

    if (!produits || produits.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Au moins un produit est requis",
      });
    }

    if (!motif) {
      return res.status(400).json({
        success: false,
        message: "Motif requis",
      });
    }

    // Start transaction
    transaction = await sequelize.transaction();

    // Générer le numéro de bon d'avoir
    const num_bon_avoir = await generateNumeroBonAvoir();

    // Calculer le montant total
    let montant_total = 0;

    // Vérifier les produits et calculer les totaux
    const produitsVerifies = [];
    for (const item of produits) {
      const produit = await Produit.findByPk(item.produitId, { transaction });

      if (!produit) {
        throw new Error(`Produit ${item.produitId} non trouvé`);
      }

      // Vérifier le stock disponible AVANT de diminuer
      const quantite = parseInt(item.quantite) || 1;

      if (produit.qty < quantite) {
        throw new Error(
          `Stock insuffisant pour ${produit.designation}. Stock disponible: ${produit.qty}, Quantité demandée: ${quantite}`,
        );
      }

      // Si c'est un retour de produit, vérifier qu'on ne retourne pas plus que vendu
      if (bonLivraisonId && item.bonLivraisonProduitId) {
        const blProduit = await BonLivraisonProduit.findByPk(
          item.bonLivraisonProduitId,
          { transaction },
        );

        if (!blProduit) {
          throw new Error(`Produit du bon de livraison non trouvé`);
        }

        if (item.quantite > blProduit.quantite) {
          throw new Error(
            `Quantité de retour supérieure à la quantité vendue (${blProduit.quantite})`,
          );
        }
      }

      const prix_unitaire = item.prix_unitaire || produit.prix_vente;
      const remise_ligne = parseFloat(item.remise_ligne) || 0;
      const total_ligne = (prix_unitaire * quantite - remise_ligne).toFixed(2);

      montant_total += parseFloat(total_ligne);

      // Stocker les données du produit vérifié
      produitsVerifies.push({
        produit,
        item,
        prix_unitaire,
        quantite,
        remise_ligne,
        total_ligne,
      });
    }

    // Déterminer le client
    let finalClientId = clientId;
    if (!finalClientId && bonLivraisonId) {
      const bonLivraison = await BonLivraison.findByPk(bonLivraisonId, {
        transaction,
      });
      if (bonLivraison) {
        finalClientId = bonLivraison.client_id;
      }
    }

    // Créer le bon d'avoir
    const bonAvoir = await BonAvoir.create(
      {
        num_bon_avoir,
        client_id: finalClientId,
        bon_livraison_id: bonLivraisonId || null,
        motif,
        montant_total,
        notes,
        status: "brouillon",
      },
      { transaction },
    );

    // Ajouter les produits et DIMINUER le stock
    for (const produitVerifie of produitsVerifies) {
      const {
        produit,
        item,
        prix_unitaire,
        quantite,
        remise_ligne,
        total_ligne,
      } = produitVerifie;

      // Créer l'association
      await BonAvoirProduit.create(
        {
          bon_avoir_id: bonAvoir.id,
          produit_id: item.produitId,
          quantite,
          prix_unitaire,
          remise_ligne,
          total_ligne,
          bon_livraison_produit_id: item.bonLivraisonProduitId || null,
        },
        { transaction },
      );

      // ============ DIMINUER TOUJOURS LE STOCK ============
      // Diminuer la quantité du produit (quel que soit le motif)
      produit.qty += quantite;

      // S'assurer que le stock ne devienne pas négatif
      if (produit.qty < 0) {
        produit.qty = 0;
      }

      console.log(
        `Stock diminué pour ${produit.reference}: -${quantite} (Nouveau stock: ${produit.qty})`,
      );

      await produit.save({ transaction });
      // ============ FIN ============
    }

    // Commit transaction
    await transaction.commit();

    // Récupérer le bon créé avec ses relations
    const createdBon = await BonAvoir.findByPk(bonAvoir.id, {
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: BonLivraison,
          as: "bonLivraison",
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "quantite",
              "prix_unitaire",
              "remise_ligne",
              "total_ligne",
              "bon_livraison_produit_id",
            ],
          },
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Bon d'avoir créé avec succès et stock diminué",
      bon: createdBon,
    });
  } catch (error) {
    // Rollback transaction
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur création bon avoir:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la création du bon d'avoir",
    });
  }
};
// Valider un bon d'avoir
const validerBonAvoir = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    transaction = await sequelize.transaction();

    const bonAvoir = await BonAvoir.findByPk(id, { transaction });

    if (!bonAvoir) {
      throw new Error("Bon d'avoir non trouvé");
    }

    if (bonAvoir.status !== "brouillon") {
      throw new Error(`Le bon d'avoir est déjà ${bonAvoir.status}`);
    }

    // Mettre à jour le statut
    bonAvoir.status = "valide";
    await bonAvoir.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Bon d'avoir validé avec succès",
      bon: bonAvoir,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur validation bon avoir:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la validation du bon d'avoir",
    });
  }
};

// Utiliser un bon d'avoir sur une facture
const utiliserBonAvoir = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;
    const { bonLivraisonId } = req.body;

    transaction = await sequelize.transaction();

    const bonAvoir = await BonAvoir.findByPk(id, { transaction });

    if (!bonAvoir) {
      throw new Error("Bon d'avoir non trouvé");
    }

    if (bonAvoir.status !== "valide") {
      throw new Error(`Le bon d'avoir n'est pas valide (${bonAvoir.status})`);
    }

    // Vérifier que le bon de livraison existe
    const bonLivraison = await BonLivraison.findByPk(bonLivraisonId, {
      transaction,
    });
    if (!bonLivraison) {
      throw new Error("Bon de livraison non trouvé");
    }

    // Vérifier que le bon de livraison appartient au même client
    if (bonLivraison.client_id !== bonAvoir.client_id) {
      throw new Error("Le bon de livraison n'appartient pas au même client");
    }

    // Appliquer le bon d'avoir sur le bon de livraison
    const nouveauMontantTTC =
      parseFloat(bonLivraison.montant_ttc) - parseFloat(bonAvoir.montant_total);

    bonLivraison.montant_ttc = Math.max(nouveauMontantTTC, 0).toFixed(2);
    bonLivraison.notes =
      (bonLivraison.notes || "") +
      `\nBon d'avoir ${bonAvoir.num_bon_avoir} appliqué: -${bonAvoir.montant_total} DH`;

    await bonLivraison.save({ transaction });

    // Marquer le bon d'avoir comme utilisé
    bonAvoir.status = "utilise";
    bonAvoir.utilise_le = new Date();
    await bonAvoir.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Bon d'avoir ${bonAvoir.num_bon_avoir} appliqué sur le bon de livraison ${bonLivraison.num_bon_livraison}`,
      montantApplique: bonAvoir.montant_total,
      nouveauMontantTTC: bonLivraison.montant_ttc,
      bon: bonAvoir,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur utilisation bon avoir:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de l'utilisation du bon d'avoir",
    });
  }
};

// Annuler un bon d'avoir
const annulerBonAvoir = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    transaction = await sequelize.transaction();

    const bonAvoir = await BonAvoir.findByPk(id, {
      include: [
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite"],
          },
        },
      ],
      transaction,
    });

    if (!bonAvoir) {
      throw new Error("Bon d'avoir non trouvé");
    }

    if (bonAvoir.status === "utilise") {
      throw new Error("Impossible d'annuler un bon d'avoir déjà utilisé");
    }

    // Si c'était un retour de produit, réduire à nouveau le stock
    if (bonAvoir.motif === "retour_produit" && bonAvoir.status === "valide") {
      for (const produit of bonAvoir.produits) {
        const bonAvoirProduit = produit.BonAvoirProduit;
        const produitDB = await Produit.findByPk(produit.id, { transaction });

        if (produitDB && bonAvoirProduit.quantite) {
          produitDB.qty -= bonAvoirProduit.quantite;
          if (produitDB.qty < 0) produitDB.qty = 0;
          await produitDB.save({ transaction });
        }
      }
    }

    // Mettre à jour le statut
    bonAvoir.status = "annule";
    await bonAvoir.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Bon d'avoir annulé avec succès",
      bon: bonAvoir,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur annulation bon avoir:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de l'annulation du bon d'avoir",
    });
  }
};

// Obtenir les bons d'avoir disponibles pour un client
const getBonsAvoirDisponibles = async (req, res) => {
  try {
    const { clientId } = req.params;

    const bons = await BonAvoir.findAll({
      where: {
        client_id: clientId,
        status: "valide",
      },
      attributes: ["id", "num_bon_avoir", "montant_total", "date_creation"],
      order: [["date_creation", "ASC"]],
    });

    res.json({
      success: true,
      bons,
      totalDisponible: bons.reduce(
        (sum, bon) => sum + parseFloat(bon.montant_total),
        0,
      ),
    });
  } catch (error) {
    console.error("Erreur récupération bons disponibles:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des bons d'avoir disponibles",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Obtenir les statistiques des bons d'avoir
const getStatsBonAvoir = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};

    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Total par statut
    const stats = await BonAvoir.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("SUM", sequelize.col("montant_total")), "total_montant"],
      ],
      raw: true,
    });

    // Statistiques par statut
    const statsByStatus = await BonAvoir.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_total")), "total_montant"],
      ],
      group: ["status"],
      raw: true,
    });

    // Statistiques par motif
    const statsByMotif = await BonAvoir.findAll({
      where: whereClause,
      attributes: [
        "motif",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_total")), "total_montant"],
      ],
      group: ["motif"],
      raw: true,
    });

    res.json({
      success: true,
      stats: stats[0],
      statsByStatus,
      statsByMotif,
    });
  } catch (error) {
    console.error("Erreur statistiques bon avoir:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du calcul des statistiques",
    });
  }
};

module.exports = {
  getAllBonsAvoir,
  getBonAvoirById,
  createBonAvoir,
  validerBonAvoir,
  utiliserBonAvoir,
  annulerBonAvoir,
  getBonsAvoirDisponibles,
  getStatsBonAvoir,
};
