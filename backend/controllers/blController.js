// controllers/blController.js
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const BonLivraison = require("../models/BonLivraison");
const Produit = require("../models/Produit");
const Advancement = require("../models/Advancement");

const { Client } = require("../models");

const BonLivraisonProduit = require("../models/BonLivraisonProduit");

// Générer un numéro unique de bon de livraison
const generateNumeroBL = async () => {
  const prefix = "BL";

  // Trouver le dernier BL
  const lastBon = await BonLivraison.findOne({
    where: {
      num_bon_livraison: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastBon) {
    // Extraire seulement les 4 derniers chiffres
    const lastNum = lastBon.num_bon_livraison;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0; // <-- ici slice(-4)
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Récupérer tous les bons de livraison
const getAllBons = async (req, res) => {
  try {
    const { startDate, endDate, status, clientId } = req.query;

    const whereClause = {};

    // Filtrer par date
    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Filtrer par status - DIRECTEMENT dans whereClause
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filtrer par client
    if (clientId && clientId !== "all") {
      whereClause.clientId = clientId;
    }

    const bons = await BonLivraison.findAll({
      where: whereClause, // Le status est filtré DIRECTEMENT depuis la base de données
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone", "address"],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite", "prix_unitaire", "total_ligne"],
          },
          attributes: ["id", "reference", "designation"],
        },
        {
          model: Advancement,
          as: "advancements",
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
            "notes",
            "createdAt",
            "updatedAt",
          ],
        },
      ],
      order: [["date_creation", "DESC"]],
    });

    // Traiter tous les bons - SANS changer le status
    const bonsWithTotals = bons.map((bon) => {
      const bonJSON = bon.toJSON();

      // Calculer le total des acomptes
      let totalAdvancements = 0;
      if (bonJSON.advancements && bonJSON.advancements.length > 0) {
        totalAdvancements = bonJSON.advancements.reduce((sum, advance) => {
          return sum + (parseFloat(advance.amount) || 0);
        }, 0);
      }

      // Calculer le montant restant
      const montantTTC = parseFloat(bonJSON.montant_ttc) || 0;
      const remainingAmount = montantTTC - totalAdvancements;

      // Retourner le bon avec les données calculées
      // IMPORTANT: On garde le status ORIGINAL de la base de données (bonJSON.status)
      return {
        ...bonJSON,
        // status: bonJSON.status, // Déjà inclus dans ...bonJSON
        totalAdvancements: totalAdvancements.toFixed(2),
        remainingAmount:
          remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00",
        isFullyPaid: remainingAmount <= 0,
      };
    });

    res.json({
      success: true,
      bons: bonsWithTotals,
      totalCount: bonsWithTotals.length,
    });
  } catch (error) {
    console.error("Erreur récupération bons:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des bons de livraison",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Récupérer un bon de livraison spécifique
// controllers/blController.js
const getBonById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Fetching bon with ID:", id);

    // TEST: Vérifiez d'abord ce que Sequelize récupère
    const bon = await BonLivraison.findByPk(id, {
      include: [
        {
          model: Client,
          as: "client",
          attributes: [
            "id",
            "nom_complete",
            "telephone",
            "address",
            "ville",
            "reference",
          ],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite", "prix_unitaire", "total_ligne"],
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
        {
          model: Advancement,
          as: "advancements",
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
            "notes",
            "createdAt",
          ],
        },
      ],
    });

    if (!bon) {
      return res.status(404).json({
        success: false,
        message: "Bon de livraison non trouvé",
      });
    }

    // DEBUG: Affichez la structure
    console.log("Bon récupéré:", bon.id);
    console.log("Bon client:", bon.client ? "Oui" : "Non");
    console.log("Bon produits:", bon.produits ? bon.produits.length : 0);
    console.log(
      "Bon advancements:",
      bon.advancements ? bon.advancements.length : "Pas d'association",
    );

    // SI advancements est vide, cherchez-les manuellement
    let advancementsArray = [];
    if (!bon.advancements || bon.advancements.length === 0) {
      console.log("Chercher advancements manuellement...");

      // Option 1: Avec le nom de champ actuel
      advancementsArray = await Advancement.findAll({
        where: { bonLivraisonId: id },
        attributes: [
          "id",
          "amount",
          "paymentDate",
          "paymentMethod",
          "reference",
          "notes",
          "createdAt",
        ],
        order: [["paymentDate", "ASC"]],
      });

      // Option 2: Si Option 1 ne fonctionne pas, essayez l'autre nom
      if (advancementsArray.length === 0) {
        console.log("Essayer avec bon_livraison_id...");
        advancementsArray = await Advancement.findAll({
          where: { bon_livraison_id: id },
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
            "notes",
            "createdAt",
          ],
          order: [["paymentDate", "ASC"]],
        });
      }

      console.log(
        "Advancements trouvés manuellement:",
        advancementsArray.length,
      );
    } else {
      advancementsArray = bon.advancements;
    }

    // Calculer les totaux
    const totalAdvancements = advancementsArray.reduce((sum, advance) => {
      return sum + (parseFloat(advance.amount) || 0);
    }, 0);

    const montantTTC = parseFloat(bon.montant_ttc) || 0;
    const remainingAmount = Math.max(montantTTC - totalAdvancements, 0);

    // Préparer la réponse
    const response = {
      success: true,
      bon: {
        ...bon.toJSON(),
        advancements: advancementsArray,
        totalAdvancements: totalAdvancements.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        isFullyPaid: remainingAmount === 0,
        paymentStatus:
          remainingAmount === 0
            ? "Payé"
            : totalAdvancements > 0
              ? "Partiellement payé"
              : "Non payé",
        paymentPercentage:
          montantTTC > 0
            ? ((totalAdvancements / montantTTC) * 100).toFixed(2)
            : "0.00",
      },
      debug: {
        bonId: id,
        advancementsCount: advancementsArray.length,
        fieldUsed:
          advancementsArray.length > 0
            ? "Trouvés avec requête manuelle"
            : "Aucun trouvé",
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Erreur récupération bon:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du bon de livraison",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}; // Créer un nouveau bon de livraison
const createBon = async (req, res) => {
  let transaction;

  try {
    const {
      clientId,
      produits,
      mode_reglement,
      status,
      notes = "",
      date_livraison,
      advancements = [],
    } = req.body;

    console.log("Bon Livr Items:" + JSON.stringify(req.body));

    // Validation
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client requis",
      });
    }

    if (!produits || produits.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Au moins un produit est requis",
      });
    }

    // Start transaction
    transaction = await sequelize.transaction();

    // Générer le numéro de bon
    const num_bon_livraison = await generateNumeroBL();

    // Calculer les totaux et vérifier le stock
    let montant_ht = 0;

    // Vérifier d'abord tous les produits et calculer les totaux
    const produitsVerifies = [];
    for (const item of produits) {
      const produit = await Produit.findByPk(item.produitId, { transaction });

      if (!produit) {
        throw new Error(`Produit ${item.produitId} non trouvé`);
      }

      if (produit.qty < item.quantite) {
        throw new Error(
          `Stock insuffisant pour ${produit.designation}. Stock disponible: ${produit.qty}`,
        );
      }

      const prix_unitaire = item.prix_unitaire || produit.prix_vente;
      const total_ligne = prix_unitaire * item.quantite;

      montant_ht += total_ligne;

      produitsVerifies.push({
        produit,
        item,
        prix_unitaire,
        total_ligne,
      });
    }

    // CALCUL DU MONTANT TTC (CORRIGÉ)
    const montant_ttc = montant_ht; // HT = TTC (si pas de TVA)

    // Créer le bon de livraison
    const bonLivraison = await BonLivraison.create(
      {
        num_bon_livraison,
        client_id: clientId,
        mode_reglement: mode_reglement || "espèces",
        status,
        montant_ht,
        montant_ttc, // Montant total du bon
        montant_restant: montant_ttc, // Montant restant à payer initial
        notes,
        date_livraison: date_livraison ? new Date(date_livraison) : null,
        date_creation: new Date(),
      },
      { transaction },
    );

    // Ajouter les produits et mettre à jour le stock
    for (const produitVerifie of produitsVerifies) {
      const { produit, item, prix_unitaire, total_ligne } = produitVerifie;

      // Créer l'association
      await BonLivraisonProduit.create(
        {
          bon_livraison_id: bonLivraison.id,
          produit_id: item.produitId,
          quantite: item.quantite,
          prix_unitaire,
          total_ligne,
        },
        { transaction },
      );

      // Diminuer la quantité du produit
      produit.qty -= item.quantite;
      await produit.save({ transaction });
    }

    // Gestion des acomptes (CORRIGÉ)
    const createdAdvancements = [];
    let totalAdvancements = 0;

    if (advancements && advancements.length > 0) {
      // Valider les acomptes
      for (const advance of advancements) {
        if (!advance.amount || advance.amount <= 0) {
          throw new Error("Le montant d'acompte doit être positif");
        }
        if (!advance.paymentMethod) {
          throw new Error("Méthode de paiement requise pour les acomptes");
        }
      }

      // Créer les acomptes
      for (const advance of advancements) {
        const newAdvancement = await Advancement.create(
          {
            amount: advance.amount,
            paymentDate: advance.paymentDate || new Date(),
            paymentMethod: advance.paymentMethod,
            reference: advance.reference || null,
            notes: advance.notes || null,
            bonLivraisonId: bonLivraison.id,
          },
          { transaction },
        );

        createdAdvancements.push(newAdvancement);
        totalAdvancements += parseFloat(advance.amount);
      }

      // Calculer le montant restant après acomptes
      const montantRestant = montant_ttc - totalAdvancements;

      // Mettre à jour le montant restant

      // Mettre à jour le statut
      if (totalAdvancements >= montant_ttc) {
        bonLivraison.status = "payé";
        bonLivraison.montant_restant = 0;
      } else if (totalAdvancements > 0) {
        bonLivraison.status = "partiellement_payée";
      } else {
        bonLivraison.status = "brouillon";
      }

      // Sauvegarder les modifications
      await bonLivraison.save({ transaction });
    }

    // Commit transaction
    await transaction.commit();

    // Récupérer le bon créé avec ses relations
    const createdBon = await BonLivraison.findByPk(bonLivraison.id, {
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite", "prix_unitaire", "total_ligne"],
          },
        },
        {
          model: Advancement,
          as: "advancements",
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
            "notes",
            "createdAt",
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Bon de livraison créé avec succès",
      bon: createdBon,
      totalAdvancements: totalAdvancements,
      advancements: createdAdvancements,
    });
  } catch (error) {
    // Rollback transaction
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur création bon:", error);
    res.status(400).json({
      success: false,
      message:
        error.message || "Erreur lors de la création du bon de livraison",
    });
  }
};
// Mettre à jour un bon de livraison
const updateBon = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;
    const {
      produits,
      mode_reglement,
      notes,
      date_livraison,
      status,
      advancements,
    } = req.body;

    transaction = await sequelize.transaction();

    const bonLivraison = await BonLivraison.findByPk(id, {
      include: [
        {
          model: Advancement,
          as: "advancements",
        },
      ],
      transaction,
    });

    if (!bonLivraison) {
      throw new Error("Bon de livraison non trouvé");
    }

    // === RÉCUPÉRER LES PRODUITS POUR RECALCULER LE SOUS-TOTAL ===
    // CORRECTION: Utiliser le bon nom de colonne (bon_livraison_id au lieu de bonLivraisonId)
    const produitsActuels = await BonLivraisonProduit.findAll({
      where: { bon_livraison_id: id },
      transaction,
    });

    // Calculer le sous-total actuel
    let sousTotal = 0;
    produitsActuels.forEach((item) => {
      sousTotal += parseFloat(item.total_ligne) || 0;
    });

    // RECALCULER LES MONTANTS
    let montant_ht = Math.max(0, sousTotal);
    let montant_ttc = montant_ht; // TTC = HT quand pas de TVA

    // Mettre à jour les montants
    bonLivraison.montant_ht = montant_ht;
    bonLivraison.montant_ttc = montant_ttc;

    // Gestion des acomptes
    if (advancements && Array.isArray(advancements)) {
      console.log("Processing advancements for bon livraison:", advancements);

      let totalAdvancements = 0;
      const existingAdvancements = await Advancement.findAll({
        where: { bon_livraison_id: id },
        transaction,
      });

      // Map des advancements existants par leur ID
      const existingAdvancementsMap = {};
      existingAdvancements.forEach((adv) => {
        existingAdvancementsMap[adv.id] = adv;
      });

      // Traiter chaque advancement
      for (const advancementData of advancements) {
        const {
          id: advancementId,
          amount,
          paymentDate,
          paymentMethod,
          reference,
          notes: advancementNotes,
        } = advancementData;

        // Valider le montant
        if (!amount || amount <= 0) {
          throw new Error(`Le montant de l'acompte doit être positif`);
        }

        // Si l'acompte a un ID, c'est une mise à jour
        if (advancementId && existingAdvancementsMap[advancementId]) {
          const existingAdvancement = existingAdvancementsMap[advancementId];

          // Mettre à jour l'acompte existant
          await existingAdvancement.update(
            {
              amount,
              paymentDate: new Date(paymentDate),
              paymentMethod,
              reference: reference || null,
              notes: advancementNotes || null,
            },
            { transaction },
          );

          // Marquer comme traité
          delete existingAdvancementsMap[advancementId];
        } else {
          // C'est un nouvel acompte
          await Advancement.create(
            {
              bon_livraison_id: id,
              amount,
              paymentDate: new Date(paymentDate),
              paymentMethod,
              reference: reference || null,
              notes: advancementNotes || null,
            },
            { transaction },
          );
        }

        totalAdvancements += parseFloat(amount);
      }

      // Supprimer les advancements qui ne sont plus dans la liste
      const advancementsToDelete = Object.values(existingAdvancementsMap);
      for (const advancementToDelete of advancementsToDelete) {
        await advancementToDelete.destroy({ transaction });
      }

      // METTRE À JOUR LE STATUT DE PAIEMENT AVEC LES NOUVEAUX MONTANTS
      if (totalAdvancements >= montant_ttc) {
        bonLivraison.status = "payé";
        bonLivraison.montant_restant = 0;
      } else if (totalAdvancements > 0) {
        bonLivraison.status = "partiellement_payée";
        bonLivraison.montant_restant = montant_ttc - totalAdvancements;
      } else {
        bonLivraison.status = status || bonLivraison.status;
        bonLivraison.montant_restant = montant_ttc;
      }
    }

    // Gestion des produits (si modification des produits)
    if (Array.isArray(produits) && produits.length > 0) {
      // CORRECTION: Utiliser le bon nom de colonne
      const oldProduits = await BonLivraisonProduit.findAll({
        where: { bon_livraison_id: id },
        transaction,
      });

      // Restore stock from old products
      for (const oldItem of oldProduits) {
        const produit = await Produit.findByPk(oldItem.produit_id, {
          // CORRECTION: produit_id au lieu de produitId
          transaction,
        });
        if (produit) {
          produit.qty += oldItem.quantite;
          await produit.save({ transaction });
        }
      }

      // Remove old products
      // CORRECTION: Utiliser le bon nom de colonne
      await BonLivraisonProduit.destroy({
        where: { bon_livraison_id: id },
        transaction,
      });

      let montant_ht_new = 0;

      // Add new products
      for (const item of produits) {
        const produit = await Produit.findByPk(item.produitId, { transaction });
        if (!produit) {
          throw new Error(`Produit ${item.produitId} non trouvé`);
        }

        if (produit.qty < item.quantite) {
          throw new Error(
            `Stock insuffisant pour ${produit.designation}. Stock disponible: ${produit.qty}`,
          );
        }

        const prix_unitaire = parseFloat(
          item.prix_unitaire || produit.prix_vente,
        );
        const quantite = parseFloat(item.quantite);

        const total_ligne = +(prix_unitaire * quantite).toFixed(2);

        montant_ht_new += total_ligne;

        // CORRECTION: Utiliser les bons noms de colonnes
        await BonLivraisonProduit.create(
          {
            bon_livraison_id: id,
            produit_id: item.produitId,
            quantite,
            prix_unitaire,
            total_ligne,
          },
          { transaction },
        );

        // Decrease stock
        produit.qty -= quantite;
        await produit.save({ transaction });
      }

      montant_ht_new = Math.max(0, montant_ht_new);

      // Update bon amounts
      bonLivraison.montant_ht = montant_ht_new;
      bonLivraison.montant_ttc = montant_ht_new;
    }

    // METTRE À JOUR LA DATE DE LIVRAISON
    if (date_livraison !== undefined) {
      bonLivraison.date_livraison = date_livraison
        ? new Date(date_livraison)
        : null;
    }

    // Mettre à jour les autres champs
    if (mode_reglement !== undefined)
      bonLivraison.mode_reglement = mode_reglement;
    if (notes !== undefined) bonLivraison.notes = notes;

    // Ne pas écraser le statut si il a été mis à jour automatiquement par les advancements
    if (status && !advancements) {
      bonLivraison.status = status;
    }

    await bonLivraison.save({ transaction });
    await transaction.commit();

    // Récupérer le bon mis à jour avec toutes les relations
    const updatedBon = await BonLivraison.findByPk(id, {
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite", "prix_unitaire", "total_ligne"],
          },
        },
        {
          model: Advancement,
          as: "advancements",
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
            "notes",
            "createdAt",
          ],
          order: [["paymentDate", "ASC"]],
        },
      ],
    });

    // Calculer le total des acomptes
    const totalAdvancements = updatedBon.advancements.reduce(
      (sum, adv) => sum + parseFloat(adv.amount || 0),
      0,
    );

    const montantTTC = parseFloat(updatedBon.montant_ttc) || 0;
    const remainingAmount = Math.max(0, montantTTC - totalAdvancements);

    return res.json({
      success: true,
      message: "Bon de livraison mis à jour avec succès",
      bon: {
        ...updatedBon.toJSON(),
        totalAdvancements: totalAdvancements.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        isFullyPaid: remainingAmount === 0,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();

    console.error("Erreur mise à jour bon:", error);
    return res.status(400).json({
      success: false,
      message:
        error.message || "Erreur lors de la mise à jour du bon de livraison",
    });
  }
};
// Changer le status d'un bon
const updateStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatus = ["brouillon", "validé", "livré", "annulée", "facturé"];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status invalide",
      });
    }

    const bonLivraison = await BonLivraison.findByPk(id, { transaction });

    if (!bonLivraison) {
      return res.status(404).json({
        success: false,
        message: "Bon de livraison non trouvé",
      });
    }

    // Si on annule le bon, restaurer le stock
    if (status === "annulée" && bonLivraison.status !== "annulée") {
      const produits = await BonLivraisonProduit.findAll({
        where: { bonLivraisonId: id },
        transaction,
      });

      for (const item of produits) {
        const produit = await Produit.findByPk(item.produitId, { transaction });
        produit.qty += item.quantite;
        await produit.save({ transaction });
      }
    }

    // Si on passe de annulé à un autre status, diminuer le stock
    if (bonLivraison.status === "annulée" && status !== "annulée") {
      const produits = await BonLivraisonProduit.findAll({
        where: { bonLivraisonId: id },
        transaction,
      });

      for (const item of produits) {
        const produit = await Produit.findByPk(item.produitId, { transaction });

        if (produit.qty < item.quantite) {
          throw new Error(
            `Stock insuffisant pour ${produit.designation}. Stock disponible: ${produit.qty}`,
          );
        }

        produit.qty -= item.quantite;
        await produit.save({ transaction });
      }
    }

    // Mettre à jour le status
    bonLivraison.status = status;

    // Si livré, mettre la date de livraison
    if (status === "livré" && !bonLivraison.date_livraison) {
      bonLivraison.date_livraison = new Date();
    }

    await bonLivraison.save({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: `status mis à jour: ${status}`,
      bon: bonLivraison,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur changement status:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors du changement de status",
    });
  }
};

// Supprimer un bon de livraison
const deleteBon = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const bonLivraison = await BonLivraison.findByPk(id, { transaction });

    if (!bonLivraison) {
      return res.status(404).json({
        success: false,
        message: "Bon de livraison non trouvé",
      });
    }

    // Vérifier si le bon peut être supprimé
    if (bonLivraison.status === "livré" || bonLivraison.status === "facturé") {
      throw new Error(`Impossible de supprimer un bon ${bonLivraison.status}`);
    }

    // Restaurer le stock - CORRECTED COLUMN NAME
    const produits = await BonLivraisonProduit.findAll({
      where: { bon_livraison_id: id }, // Changed from bonLivraisonId to bon_livraison_id
      transaction,
    });

    for (const item of produits) {
      const produit = await Produit.findByPk(item.produit_id, { transaction }); // Also check if this should be produit_id
      if (produit) {
        produit.qty += item.quantite;
        await produit.save({ transaction });
      }
    }

    // Supprimer les associations - CORRECTED COLUMN NAME
    await BonLivraisonProduit.destroy({
      where: { bon_livraison_id: id }, // Changed from bonLivraisonId to bon_livraison_id
      transaction,
    });

    // Supprimer le bon
    await bonLivraison.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Bon de livraison supprimé avec succès",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur suppression bon:", error);
    res.status(400).json({
      success: false,
      message:
        error.message || "Erreur lors de la suppression du bon de livraison",
    });
  }
};
// Obtenir les statistiques
const getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};

    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const stats = await BonLivraison.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      raw: true,
    });

    // Statistiques par status
    const statsByStatus = await BonLivraison.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    res.json({
      success: true,
      stats: stats[0],
      statsByStatus,
    });
  } catch (error) {
    console.error("Erreur statistiques:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du calcul des statistiques",
    });
  }
};
// Récupérer les bons de livraison d'un client spécifique
const getBonsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "ID client requis",
      });
    }

    const bons = await BonLivraison.findAll({
      where: {
        client_id: clientId,
        // Optionnel: exclure les bons annulés si vous voulez
        // status: {
        //   [Op.not]: "annulée"
        // }
      },
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone"],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: ["quantite"],
          },
          attributes: ["id", "reference", "designation"],
        },
        {
          model: Advancement,
          as: "advancements",
          attributes: ["amount"],
        },
      ],
      order: [["date_creation", "DESC"]],
    });

    // Calculer les totaux et statuts
    const bonsWithDetails = bons.map((bon) => {
      const bonJSON = bon.toJSON();

      // Calculer le total des acomptes
      let totalAdvancements = 0;
      if (bonJSON.advancements && bonJSON.advancements.length > 0) {
        totalAdvancements = bonJSON.advancements.reduce((sum, advance) => {
          return sum + (parseFloat(advance.amount) || 0);
        }, 0);
      }

      // Calculer le montant restant
      const montantTTC = parseFloat(bonJSON.montant_ttc) || 0;
      const remainingAmount = montantTTC - totalAdvancements;

      // Statut de paiement
      let paymentStatus = "non_payé";
      if (totalAdvancements >= montantTTC) {
        paymentStatus = "payé";
      } else if (totalAdvancements > 0) {
        paymentStatus = "partiellement_payée";
      }

      // Nombre de produits
      const productCount = bonJSON.produits?.length || 0;

      return {
        ...bonJSON,
        totalAdvancements: totalAdvancements.toFixed(2),
        remainingAmount:
          remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00",
        paymentStatus,
        productCount,
        isFullyPaid: remainingAmount <= 0,
      };
    });

    res.json({
      success: true,
      clientId,
      bons: bonsWithDetails,
      totalCount: bons.length,
    });
  } catch (error) {
    console.error("Erreur récupération bons client:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des bons de livraison du client",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
module.exports = {
  getAllBons,
  getBonById,
  createBon,
  updateBon,
  updateStatus,
  deleteBon,
  getStats,
  getBonsByClient,
};
