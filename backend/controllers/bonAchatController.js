// controllers/bonAchatController.js
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const BonAchat = require("../models/BonAchat");
const BonAchatProduit = require("../models/BonAchatProduit");
const Fornisseur = require("../models/fornisseur");
const Produit = require("../models/Produit");

// Générer un numéro unique de bon d'achat
const generateNumeroBonAchat = async () => {
  const prefix = "BAC";

  // Trouver le dernier bon d'achat
  const lastBon = await BonAchat.findOne({
    where: {
      num_bon_achat: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastBon) {
    // Extraire seulement les 4 derniers chiffres
    const lastNum = lastBon.num_bon_achat;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Récupérer tous les bons d'achat
const getAllBonsAchat = async (req, res) => {
  try {
    const { startDate, endDate, status, fornisseurId, typeAchat } = req.query;

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

    // Filtrer par fornisseur
    if (fornisseurId && fornisseurId !== "all") {
      whereClause.fornisseur_id = fornisseurId;
    }

    // Filtrer par type d'achat
    if (typeAchat && typeAchat !== "all") {
      whereClause.type_achat = typeAchat;
    }

    const bons = await BonAchat.findAll({
      where: whereClause,
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone"],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite", "prix_unitaire", "total_ligne"],
          },
          attributes: ["id", "reference", "designation", "qty"],
        },
      ],
      order: [["date_creation", "DESC"]],
    });

    // Calculer les pourcentages de réception
    const bonsWithDetails = bons.map((bon) => {
      const bonJSON = bon.toJSON();

      // Calculer le pourcentage de réception
      let totalQuantite = 0;
      let totalQuantiteRecue = 0;

      if (bonJSON.produits && bonJSON.produits.length > 0) {
        bonJSON.produits.forEach((produit) => {
          const ligne = produit.BonAchatProduit;
          totalQuantite += parseInt(ligne.quantite) || 0;
        });
      }

      return {
        ...bonJSON,
        totalQuantite,
        totalQuantiteRecue,
      };
    });

    res.json({
      success: true,
      bons: bonsWithDetails,
      totalCount: bons.length,
    });
  } catch (error) {
    console.error("Erreur récupération bons achat:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des bons d'achat",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Récupérer un bon d'achat spécifique
const getBonAchatById = async (req, res) => {
  try {
    const { id } = req.params;

    const bon = await BonAchat.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "address", "ville"],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "id",
              "quantite",
              "prix_unitaire",
              "remise_ligne",
              "total_ligne",
            ],
          },
          attributes: [
            "id",
            "reference",
            "designation",
            "qty",
            "prix_achat",
            "prix_vente",
          ],
        },
      ],
    });

    if (!bon) {
      return res.status(404).json({
        success: false,
        message: "Bon d'achat non trouvé",
      });
    }

    // Calculer les totaux et statistiques
    const bonJSON = bon.toJSON();
    let totalQuantite = 0;
    let totalMontantHT = 0;

    if (bonJSON.produits && bonJSON.produits.length > 0) {
      bonJSON.produits.forEach((produit) => {
        const ligne = produit.BonAchatProduit;
        const quantite = parseInt(ligne.quantite) || 0;
        const totalLigne = parseFloat(ligne.total_ligne) || 0;

        totalQuantite += quantite;
        totalMontantHT += totalLigne;
      });
    }

    res.json({
      success: true,
      bon: {
        ...bonJSON,
        totalQuantite,
        totalMontantHT: totalMontantHT.toFixed(2),
        montantRestant: (
          parseFloat(bonJSON.montant_ttc) - totalMontantHT
        ).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Erreur récupération bon achat:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du bon d'achat",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Créer un nouveau bon d'achat
const createBonAchat = async (req, res) => {
  let transaction;

  try {
    const {
      fornisseurId,
      produits,
      mode_reglement,
      remise = 0,
      notes = "",
      updateStock = true, // Option to control stock update
    } = req.body;

    console.log("Bon Achat Items:", JSON.stringify(req.body));

    // Validation
    if (!fornisseurId) {
      return res.status(400).json({
        success: false,
        message: "Fornisseur requis",
      });
    }

    if (!produits || produits.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Au moins un produit est requis",
      });
    }

    // Vérifier que le fornisseur existe
    const fornisseur = await Fornisseur.findByPk(fornisseurId);
    if (!fornisseur) {
      return res.status(404).json({
        success: false,
        message: "Fornisseur non trouvé",
      });
    }

    // Start transaction
    transaction = await sequelize.transaction();

    // Générer le numéro de bon d'achat
    const num_bon_achat = await generateNumeroBonAchat();

    // Calculer les totaux
    let montant_ht = 0;

    // Vérifier les produits
    const produitsVerifies = [];
    for (const item of produits) {
      const produit = await Produit.findByPk(item.produitId, {
        transaction,
        lock: transaction.LOCK.UPDATE, // Lock the product for update
      });

      if (!produit) {
        throw new Error(`Produit ${item.produitId} non trouvé`);
      }

      const quantite = parseInt(item.quantite) || 1;
      if (quantite <= 0) {
        throw new Error(
          `Quantité invalide pour le produit ${produit.designation}`,
        );
      }

      const prix_unitaire =
        parseFloat(item.prix_unitaire) || produit.prix_achat || 0;
      const remise_ligne = parseFloat(item.remise_ligne) || 0;
      const total_ligne = (prix_unitaire * quantite - remise_ligne).toFixed(2);

      montant_ht += parseFloat(total_ligne);

      // Stocker les données du produit vérifié
      produitsVerifies.push({
        produit,
        item,
        quantite,
        prix_unitaire,
        remise_ligne,
        total_ligne,
      });
    }

    // Appliquer la remise globale
    const remiseValue = parseFloat(remise) || 0;
    montant_ht = Math.max(montant_ht - remiseValue, 0);

    // SANS TVA - montant_ttc est égal à montant_ht
    const montant_ttc = montant_ht;

    // Créer le bon d'achat
    const bonAchat = await BonAchat.create(
      {
        num_bon_achat,
        fornisseur_id: fornisseurId,
        mode_reglement: mode_reglement || "espèces",
        remise: remiseValue,
        montant_ht: montant_ht.toFixed(2),
        montant_ttc: montant_ttc.toFixed(2),
        notes,
        status: "brouillon",
      },
      { transaction },
    );

    // Ajouter les produits et mettre à jour le stock
    for (const produitVerifie of produitsVerifies) {
      const {
        produit,
        item,
        quantite,
        prix_unitaire,
        remise_ligne,
        total_ligne,
      } = produitVerifie;

      await BonAchatProduit.create(
        {
          bon_achat_id: bonAchat.id,
          produit_id: item.produitId,
          quantite,
          prix_unitaire,
          remise_ligne,
          total_ligne,
        },
        { transaction },
      );

      // Mettre à jour le stock du produit si updateStock est true
      if (updateStock !== false) {
        // Default to true if not specified
        // Augmenter la quantité du produit
        const nouvelleQuantite = (parseFloat(produit.qty) || 0) + quantite;

        await Produit.update(
          {
            qty: nouvelleQuantite,
            // Optionnel: mettre à jour le dernier prix d'achat
            prix_achat: prix_unitaire,
            date_modification: new Date(),
          },
          {
            where: { id: item.produitId },
            transaction,
          },
        );

        // Optionnel: créer une entrée dans l'historique des mouvements de stock
        try {
          await MouvementStock.create(
            {
              produit_id: item.produitId,
              type_mouvement: "achat",
              quantite: quantite,
              quantite_avant: parseFloat(produit.qty) || 0,
              quantite_apres: nouvelleQuantite,
              reference: `BA-${num_bon_achat}`,
              notes: `Bon d'achat ${num_bon_achat}`,
              created_at: new Date(),
            },
            { transaction },
          );
        } catch (historyError) {
          console.warn("Erreur création historique stock:", historyError);
          // Ne pas annuler la transaction pour cette erreur mineure
        }
      }
    }

    // Commit transaction
    await transaction.commit();

    // Récupérer le bon créé avec ses relations
    const createdBon = await BonAchat.findByPk(bonAchat.id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
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
            ],
          },
        },
      ],
    });

    // Récupérer les produits avec leurs nouvelles quantités
    const updatedProduits = await Promise.all(
      createdBon.produits.map(async (produit) => {
        const updatedProduit = await Produit.findByPk(produit.id);
        return {
          ...produit.toJSON(),
          qty: updatedProduit.qty,
        };
      }),
    );

    createdBon.produits = updatedProduits;

    res.status(201).json({
      success: true,
      message: "Bon d'achat créé avec succès",
      bon: createdBon,
      stockUpdated: updateStock !== false,
    });
  } catch (error) {
    // Rollback transaction
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur création bon achat:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la création du bon d'achat",
    });
  }
};
// Mettre à jour un bon d'achat
const updateBonAchat = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;
    const {
      fornisseurId,
      produits,
      mode_reglement,
      remise,
      notes,
      status,
      type_achat,
      facture_fornisseur,
      date_reception,
      date_paiement,
    } = req.body;

    transaction = await sequelize.transaction();

    const bonAchat = await BonAchat.findByPk(id, { transaction });

    if (!bonAchat) {
      throw new Error("Bon d'achat non trouvé");
    }

    // Si des produits sont fournis, recalculer les totaux
    if (Array.isArray(produits) && produits.length > 0) {
      // Supprimer les anciennes associations
      await BonAchatProduit.destroy({
        where: { bon_achat_id: id },
        transaction,
      });

      let montant_ht = 0;

      // Ajouter les nouveaux produits
      for (const item of produits) {
        const produit = await Produit.findByPk(item.produitId, { transaction });
        if (!produit) {
          throw new Error(`Produit ${item.produitId} non trouvé`);
        }

        const quantite = parseInt(item.quantite) || 1;
        const prix_unitaire =
          parseFloat(item.prix_unitaire) || produit.prix_achat || 0;
        const remise_ligne = parseFloat(item.remise_ligne) || 0;
        const total_ligne = (prix_unitaire * quantite - remise_ligne).toFixed(
          2,
        );

        montant_ht += parseFloat(total_ligne);

        await BonAchatProduit.create(
          {
            bon_achat_id: id,
            produit_id: item.produitId,
            quantite,
            prix_unitaire,
            remise_ligne,
            total_ligne,
          },
          { transaction },
        );
      }

      // Appliquer les modifications
      const remiseValue =
        remise !== undefined
          ? parseFloat(remise)
          : parseFloat(bonAchat.remise || 0);
      montant_ht = Math.max(montant_ht - remiseValue, 0);

      // SANS TVA - montant_ttc est égal à montant_ht
      const montant_ttc = montant_ht;

      bonAchat.montant_ht = montant_ht.toFixed(2);
      bonAchat.montant_ttc = montant_ttc.toFixed(2);
      bonAchat.remise = remiseValue;
    }

    // Mettre à jour les autres champs
    if (fornisseurId) bonAchat.fornisseur_id = fornisseurId;
    if (mode_reglement) bonAchat.mode_reglement = mode_reglement;
    if (notes !== undefined) bonAchat.notes = notes;
    if (status) bonAchat.status = status;
    if (type_achat) bonAchat.type_achat = type_achat;
    if (facture_fornisseur !== undefined)
      bonAchat.facture_fornisseur = facture_fornisseur;
    if (date_reception) bonAchat.date_reception = new Date(date_reception);
    if (date_paiement) bonAchat.date_paiement = new Date(date_paiement);

    await bonAchat.save({ transaction });
    await transaction.commit();

    // Récupérer le bon mis à jour
    const updatedBon = await BonAchat.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
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
            ],
          },
        },
      ],
    });

    res.json({
      success: true,
      message: "Bon d'achat mis à jour avec succès",
      bon: updatedBon,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur mise à jour bon achat:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la mise à jour du bon d'achat",
    });
  }
};

// Enregistrer la réception de produits
const enregistrerReception = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;
    const { produitsReception, date_reception } = req.body;

    if (!produitsReception || !Array.isArray(produitsReception)) {
      return res.status(400).json({
        success: false,
        message: "Liste des produits reçus requise",
      });
    }

    transaction = await sequelize.transaction();

    const bonAchat = await BonAchat.findByPk(id, { transaction });

    if (!bonAchat) {
      throw new Error("Bon d'achat non trouvé");
    }

    // Vérifier que le bon n'est pas déjà complètement reçu ou annulé
    if (bonAchat.status === "reçu" || bonAchat.status === "annulé") {
      throw new Error(
        `Impossible d'enregistrer la réception pour un bon ${bonAchat.status}`,
      );
    }

    // Enregistrer les quantités reçues
    for (const reception of produitsReception) {
      const { produitId, quantiteRecue } = reception;

      // Trouver la ligne du produit dans le bon d'achat
      const ligneProduit = await BonAchatProduit.findOne({
        where: {
          bon_achat_id: id,
          produit_id: produitId,
        },
        transaction,
      });

      if (!ligneProduit) {
        throw new Error(`Produit ${produitId} non trouvé dans le bon d'achat`);
      }

      // Vérifier que la quantité reçue ne dépasse pas la quantité commandée
      const quantiteCommandee = parseInt(ligneProduit.quantite);
      const nouvelleQuantiteRecue = parseInt(quantiteRecue) || 0;

      if (nouvelleQuantiteRecue > quantiteCommandee) {
        throw new Error(
          `Quantité reçue (${nouvelleQuantiteRecue}) supérieure à la quantité commandée (${quantiteCommandee})`,
        );
      }

      // Calculer la quantité totale reçue (ancienne + nouvelle)
      const totalQuantiteRecue = nouvelleQuantiteRecue;

      if (totalQuantiteRecue > quantiteCommandee) {
        throw new Error(
          `Quantité totale reçue (${totalQuantiteRecue}) dépasse la quantité commandée (${quantiteCommandee})`,
        );
      }

      // Mettre à jour la quantité reçue
      await ligneProduit.save({ transaction });

      // AUGMENTER LE STOCK du produit
      if (nouvelleQuantiteRecue > 0) {
        const produit = await Produit.findByPk(produitId, { transaction });
        if (produit) {
          produit.qty += nouvelleQuantiteRecue;
          await produit.save({ transaction });
          console.log(
            `Stock augmenté: ${produit.reference} (+${nouvelleQuantiteRecue})`,
          );
        }
      }
    }

    // Vérifier le statut de réception
    const toutesLignes = await BonAchatProduit.findAll({
      where: { bon_achat_id: id },
      transaction,
    });

    let totalQuantite = 0;

    toutesLignes.forEach((ligne) => {
      totalQuantite += parseInt(ligne.quantite);
    });

    // Mettre à jour le statut du bon d'achat
    let nouveauStatut = bonAchat.status;

    bonAchat.status = nouveauStatut;
    bonAchat.date_reception = date_reception
      ? new Date(date_reception)
      : new Date();
    await bonAchat.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Réception enregistrée avec succès",
      statut: nouveauStatut,
      totalQuantite,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur enregistrement réception:", error);
    res.status(400).json({
      success: false,
      message:
        error.message || "Erreur lors de l'enregistrement de la réception",
    });
  }
};

// Marquer comme payé
const marquerPaye = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;
    const { date_paiement, mode_reglement } = req.body;

    transaction = await sequelize.transaction();

    const bonAchat = await BonAchat.findByPk(id, { transaction });

    if (!bonAchat) {
      throw new Error("Bon d'achat non trouvé");
    }

    // Vérifier que le bon est reçu ou partiellement reçu
    if (!["reçu", "partiellement_reçu"].includes(bonAchat.status)) {
      throw new Error(
        "Le bon d'achat doit être reçu avant d'être marqué comme payé",
      );
    }

    // Mettre à jour le statut
    bonAchat.status = "payé";
    bonAchat.date_paiement = date_paiement
      ? new Date(date_paiement)
      : new Date();

    if (mode_reglement) {
      bonAchat.mode_reglement = mode_reglement;
    }

    await bonAchat.save({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: "Bon d'achat marqué comme payé avec succès",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur marquage payé:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors du marquage comme payé",
    });
  }
};

// Annuler un bon d'achat
const annulerBonAchat = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    transaction = await sequelize.transaction();

    const bonAchat = await BonAchat.findByPk(id, { transaction });

    if (!bonAchat) {
      throw new Error("Bon d'achat non trouvé");
    }

    // Vérifier que le bon peut être annulé
    if (bonAchat.status === "payé") {
      throw new Error("Impossible d'annuler un bon d'achat déjà payé");
    }

    // Si des produits ont été reçus, diminuer le stock
    if (
      bonAchat.status === "reçu" ||
      bonAchat.status === "partiellement_reçu"
    ) {
      const lignesProduits = await BonAchatProduit.findAll({
        where: { bon_achat_id: id },
        transaction,
      });
    }

    // Marquer comme annulé
    bonAchat.status = "annulé";
    await bonAchat.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Bon d'achat annulé avec succès",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur annulation bon achat:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de l'annulation du bon d'achat",
    });
  }
};

// Supprimer un bon d'achat
const deleteBonAchat = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    transaction = await sequelize.transaction();

    const bonAchat = await BonAchat.findByPk(id, { transaction });

    if (!bonAchat) {
      return res.status(404).json({
        success: false,
        message: "Bon d'achat non trouvé",
      });
    }

    // Vérifier que le bon peut être supprimé
    if (!["brouillon", "annulé"].includes(bonAchat.status)) {
      throw new Error(
        "Impossible de supprimer un bon d'achat qui n'est pas en brouillon ou annulé",
      );
    }

    // Si le bon est reçu, diminuer le stock avant suppression
    if (
      bonAchat.status === "reçu" ||
      bonAchat.status === "partiellement_reçu"
    ) {
      const lignesProduits = await BonAchatProduit.findAll({
        where: { bon_achat_id: id },
        transaction,
      });
    }

    // Supprimer les associations
    await BonAchatProduit.destroy({
      where: { bon_achat_id: id },
      transaction,
    });

    // Supprimer le bon
    await bonAchat.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Bon d'achat supprimé avec succès",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur suppression bon achat:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la suppression du bon d'achat",
    });
  }
};

// Obtenir les statistiques des achats
const getStatsAchats = async (req, res) => {
  try {
    const { startDate, endDate, fornisseurId } = req.query;

    const whereClause = {};

    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    if (fornisseurId && fornisseurId !== "all") {
      whereClause.fornisseur_id = fornisseurId;
    }

    // Total par statut
    const stats = await BonAchat.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
        [sequelize.fn("SUM", sequelize.col("montant_ht")), "total_ht"],
        [sequelize.fn("SUM", sequelize.col("tva")), "total_tva"],
      ],
      raw: true,
    });

    // Statistiques par statut
    const statsByStatus = await BonAchat.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      group: ["status"],
      raw: true,
    });

    // Statistiques par type d'achat
    const statsByType = await BonAchat.findAll({
      where: whereClause,
      attributes: [
        "type_achat",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      group: ["type_achat"],
      raw: true,
    });

    // Achats par fornisseur
    const achatsParfornisseur = await BonAchat.findAll({
      where: whereClause,
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["nom_complete"],
        },
      ],
      attributes: [
        "fornisseur_id",
        [sequelize.fn("COUNT", sequelize.col("BonAchat.id")), "nombre_achats"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      group: ["fornisseur_id"],
      raw: true,
    });

    res.json({
      success: true,
      stats: stats[0],
      statsByStatus,
      statsByType,
      achatsParfornisseur,
    });
  } catch (error) {
    console.error("Erreur statistiques achats:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du calcul des statistiques",
    });
  }
};

// Obtenir les bons d'achat en attente de réception
const getBonsEnAttenteReception = async (req, res) => {
  try {
    const bons = await BonAchat.findAll({
      where: {
        status: {
          [Op.in]: ["commandé", "partiellement_reçu"],
        },
      },
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["nom_complete", "telephone"],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite"],
          },
        },
      ],
      order: [["date_creation", "ASC"]],
    });

    res.json({
      success: true,
      bons,
      totalCount: bons.length,
    });
  } catch (error) {
    console.error("Erreur récupération bons en attente:", error);
    res.status(500).json({
      success: false,
      message:
        "Erreur lors de la récupération des bons en attente de réception",
    });
  }
};

module.exports = {
  getAllBonsAchat,
  getBonAchatById,
  createBonAchat,
  updateBonAchat,
  enregistrerReception,
  marquerPaye,
  annulerBonAchat,
  deleteBonAchat,
  getStatsAchats,
  getBonsEnAttenteReception,
};
