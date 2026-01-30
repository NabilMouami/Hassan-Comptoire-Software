const { Op } = require("sequelize");
const sequelize = require("../config/db");
const Facture = require("../models/Facture");
const FactureProduit = require("../models/FactureProduit");
const Produit = require("../models/Produit");
const Advancement = require("../models/Advancement");
const BonLivraison = require("../models/BonLivraison");
const { Client } = require("../models");

// Générer un numéro unique de facture
const generateNumeroFacture = async () => {
  const prefix = "FAC";

  // Trouver le dernier BL
  const lastFacture = await Facture.findOne({
    where: {
      num_facture: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastFacture) {
    // Extraire seulement les 4 derniers chiffres
    const lastNum = lastFacture.num_facture;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0; // <-- ici slice(-4)
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Récupérer toutes les factures
const getAllFactures = async (req, res) => {
  try {
    const { startDate, endDate, status, clientId, isPaid } = req.query;

    const whereClause = {};

    // Filtrer par date
    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Filtrer par statut
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filtrer par client
    if (clientId && clientId !== "all") {
      whereClause.client_id = clientId;
    }

    const factures = await Facture.findAll({
      where: whereClause,
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
            attributes: [
              "quantite",
              "prix_unitaire",
              "montant_ht_ligne",
              "montant_tva_ligne",
              "total_ligne",
              "description",
            ],
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
        {
          model: BonLivraison,
          as: "bon_livraison",
          attributes: ["id", "num_bon_livraison", "date_creation"],
        },
      ],
      order: [["date_creation", "DESC"]],
    });

    // Calculer les totaux et statut de paiement
    const facturesWithTotals = factures.map((facture) => {
      const factureJSON = facture.toJSON();

      // Calculer le total des paiements
      let totalPayments = 0;
      if (factureJSON.advancements && factureJSON.advancements.length > 0) {
        totalPayments = factureJSON.advancements.reduce((sum, advance) => {
          return sum + (parseFloat(advance.amount) || 0);
        }, 0);
      }

      const montantTTC = parseFloat(factureJSON.montant_ttc) || 0;
      const remainingAmount = montantTTC - totalPayments;

      // Déterminer le statut de paiement
      let paymentStatus = "impayée";
      if (remainingAmount <= 0) {
        paymentStatus = "payée";
      } else if (totalPayments > 0) {
        paymentStatus = "partiellement payée";
      }

      return {
        ...factureJSON,
        totalPayments: totalPayments.toFixed(2),
        remainingAmount:
          remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00",
        isFullyPaid: remainingAmount <= 0,
        paymentStatus: paymentStatus,
      };
    });

    // Filtrer par statut de paiement si demandé
    let filteredFactures = facturesWithTotals;
    if (isPaid === "true") {
      filteredFactures = facturesWithTotals.filter((f) => f.isFullyPaid);
    } else if (isPaid === "false") {
      filteredFactures = facturesWithTotals.filter((f) => !f.isFullyPaid);
    }

    res.json({
      success: true,
      factures: filteredFactures,
      totalCount: filteredFactures.length,
    });
  } catch (error) {
    console.error("Erreur récupération factures:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des factures",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Récupérer une facture spécifique
const getFactureById = async (req, res) => {
  try {
    const { id } = req.params;

    const facture = await Facture.findByPk(id, {
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone", "address", "ville"],
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "quantite",
              "prix_unitaire",
              "montant_ht_ligne",
              "montant_tva_ligne",
              "total_ligne",
              "description",
            ],
          },
          attributes: ["id", "reference", "designation", "qty", "prix_achat"],
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
        {
          model: BonLivraison,
          as: "bon_livraison",
          attributes: [
            "id",
            "num_bon_livraison",
            "date_creation",
            "montant_ttc",
          ],
        },
      ],
    });

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Calculer les totaux
    const factureJSON = facture.toJSON();
    let totalPayments = 0;
    if (factureJSON.advancements && factureJSON.advancements.length > 0) {
      totalPayments = factureJSON.advancements.reduce((sum, advance) => {
        return sum + (parseFloat(advance.amount) || 0);
      }, 0);
    }

    const montantTTC = parseFloat(factureJSON.montant_ttc) || 0;
    const remainingAmount = montantTTC - totalPayments;

    res.json({
      success: true,
      facture: {
        ...factureJSON,
        totalPayments: totalPayments.toFixed(2),
        remainingAmount:
          remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00",
        isFullyPaid: remainingAmount <= 0,
      },
    });
  } catch (error) {
    console.error("Erreur récupération facture:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la facture",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const createFacture = async (req, res) => {
  let transaction;

  try {
    const {
      client_id,
      produits,
      mode_reglement,
      tva = 0,
      notes = "",
      date_facturation,
      date_echeance,
      bon_livraison_id,
      advancements = [],
    } = req.body;

    if (!client_id) {
      return res.status(400).json({ success: false, message: "Client requis" });
    }

    if (!produits || produits.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Au moins un produit est requis",
      });
    }

    transaction = await sequelize.transaction();

    const num_facture = await generateNumeroFacture();
    const tauxTVA = parseFloat(tva) || 0;

    let montant_ht = 0;
    const produitsVerifies = [];

    // ---------------- CALCUL + STOCK CHECK ----------------
    for (const item of produits) {
      const produit = await Produit.findByPk(item.produitId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!produit) {
        throw new Error(`Produit ${item.produitId} introuvable`);
      }

      const quantite = parseFloat(item.quantite);
      const prix_unitaire = parseFloat(
        item.prix_unitaire || produit.prix_vente,
      );

      // 🔴 STOCK CHECK (ONLY IF NO BL)
      if (!bon_livraison_id && produit.qty < quantite) {
        throw new Error(
          `Stock insuffisant pour ${produit.designation} (stock: ${produit.qty})`,
        );
      }

      const montant_ht_ligne = +(prix_unitaire * quantite).toFixed(2);

      const total_ligne = montant_ht_ligne;

      montant_ht += montant_ht_ligne;

      produitsVerifies.push({
        produit,
        item,
        prix_unitaire,
        montant_ht_ligne,
        montant_tva_ligne: +((montant_ht_ligne * tauxTVA) / 100).toFixed(2),
        total_ligne,
      });
    }

    // ---------------- CALCULS DÉTAILLÉS ----------------

    const total_ht_initial = montant_ht;
    const montant_ht_after_remise = Math.max(total_ht_initial, 0);

    const montant_tva = +((montant_ht_after_remise * tauxTVA) / 100).toFixed(2);
    const montant_ttc = +(montant_ht_after_remise + montant_tva).toFixed(2);

    // ---------------- CREATE FACTURE ----------------
    const facture = await Facture.create(
      {
        num_facture,
        client_id,
        bon_livraison_id,
        mode_reglement: mode_reglement || "espèces",
        montant_ht: montant_ht_after_remise,
        montant_ht_initial: total_ht_initial,
        tva: tauxTVA,
        montant_tva,
        montant_ttc,
        montant_paye: 0,
        montant_restant: montant_ttc,
        notes,
        date_facturation,
        date_echeance,
        date_creation: new Date(),
        status: "brouillon",
      },
      { transaction },
    );

    // ---------------- PRODUITS + STOCK DECREASE ----------------
    for (const p of produitsVerifies) {
      // CORRECTION: Use correct field names with underscores
      await FactureProduit.create(
        {
          facture_id: facture.id, // Changed from factureId
          produit_id: p.item.produitId, // Changed from produitId
          quantite: p.item.quantite,
          prix_unitaire: p.prix_unitaire,
          montant_ht_ligne: p.montant_ht_ligne,
          montant_tva_ligne: p.montant_tva_ligne,
          total_ligne: p.total_ligne,
        },
        { transaction },
      );

      // 🔥 DECREASE STOCK (ONLY IF NO BL)
      if (!bon_livraison_id) {
        p.produit.qty -= parseFloat(p.item.quantite);
        await p.produit.save({ transaction });
      }
    }

    // ---------------- PAYMENTS ----------------
    let totalAdvancements = 0;

    for (const advance of advancements) {
      await Advancement.create(
        {
          amount: advance.amount,
          paymentDate: advance.paymentDate || new Date(),
          paymentMethod: advance.paymentMethod,
          reference: advance.reference || null,
          notes: advance.notes || null,
          facture_id: facture.id, // Changed from factureId
          bon_livraison_id: bon_livraison_id, // Changed from bonLivraisonId
        },
        { transaction },
      );

      totalAdvancements += parseFloat(advance.amount);
    }

    if (totalAdvancements > 0) {
      facture.montant_paye = totalAdvancements;
      facture.montant_restant = +(montant_ttc - totalAdvancements).toFixed(2);
      facture.status =
        totalAdvancements >= montant_ttc ? "payée" : "partiellement_payée";

      await facture.save({ transaction });
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Facture créée avec succès",
      facture: {
        ...facture.toJSON(),
        calculs_details: {
          total_ht_initial: parseFloat(total_ht_initial.toFixed(2)),
          montant_ht_after_remise: parseFloat(
            montant_ht_after_remise.toFixed(2),
          ),
          taux_tva: parseFloat(tauxTVA.toFixed(2)),
          montant_tva: parseFloat(montant_tva.toFixed(2)),
          montant_ttc: parseFloat(montant_ttc.toFixed(2)),
        },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error(error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur création facture",
    });
  }
};

// Créer une facture à partir d'un bon de livraison
const createFactureFromBonLivraison = async (req, res) => {
  let transaction;

  try {
    const {
      bon_livraison_id,
      date_facturation,
      date_echeance,
      mode_reglement,
      notes,
    } = req.body;

    // Start transaction
    transaction = await sequelize.transaction();

    // Récupérer le bon de livraison avec ses produits
    const bonLivraison = await BonLivraison.findByPk(bon_livraison_id, {
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
        },
      ],
      transaction,
    });

    if (!bonLivraison) {
      return res.status(404).json({
        success: false,
        message: "Bon de livraison non trouvé",
      });
    }

    // Vérifier si une facture existe déjà pour ce bon
    const existingFacture = await Facture.findOne({
      where: { bon_livraison_id },
      transaction,
    });

    if (existingFacture) {
      return res.status(400).json({
        success: false,
        message: "Une facture existe déjà pour ce bon de livraison",
      });
    }

    // Générer le numéro de facture
    const num_facture = await generateNumeroFacture();

    // Calculer les totaux pour la facture
    const montant_ht = parseFloat(bonLivraison.montant_ht);
    const tva = montant_ht * 0.2; // 20% TVA par défaut
    const montant_ttc = montant_ht + tva;

    // Créer la facture
    const facture = await Facture.create(
      {
        num_facture,
        client_id: bonLivraison.clientId,
        bon_livraison_id,
        mode_reglement: mode_reglement || bonLivraison.mode_reglement,
        montant_ht,
        tva,
        montant_tva: tva,
        montant_ttc,
        montant_paye: 0,
        montant_restant: montant_ttc,
        notes: notes || bonLivraison.notes,
        date_facturation: new Date(date_facturation || new Date()),
        date_echeance: new Date(
          date_echeance || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ), // +30 jours par défaut
        date_creation: new Date(),
        status: "brouillon",
      },
      { transaction },
    );

    // Ajouter les produits à la facture
    for (const produit of bonLivraison.produits) {
      const bonProduit = produit.BonLivraisonProduit;

      await FactureProduit.create(
        {
          factureId: facture.id,
          produitId: produit.id,
          quantite: bonProduit.quantite,
          prix_unitaire: bonProduit.prix_unitaire,
          montant_ht_ligne: bonProduit.total_ligne,
          montant_tva_ligne: bonProduit.total_ligne * 0.2,
          total_ligne: bonProduit.total_ligne * 1.2,
          description: produit.designation,
        },
        { transaction },
      );
    }

    // Transférer les acomptes du bon de livraison à la facture
    if (bonLivraison.advancements && bonLivraison.advancements.length > 0) {
      let totalTransferred = 0;

      for (const advancement of bonLivraison.advancements) {
        await advancement.update(
          {
            factureId: facture.id,
            bonLivraisonId: null, // Délier du bon de livraison
          },
          { transaction },
        );

        totalTransferred += parseFloat(advancement.amount);
      }

      // Mettre à jour les paiements de la facture
      facture.montant_paye = totalTransferred;
      facture.montant_restant = facture.montant_ttc - totalTransferred;

      // Mettre à jour le statut
      if (totalTransferred >= facture.montant_ttc) {
        facture.status = "payée";
      } else if (totalTransferred > 0) {
        facture.status = "partiellement_payée";
      }

      await facture.save({ transaction });
    }

    // Mettre à jour le bon de livraison
    bonLivraison.is_facture = true;
    await bonLivraison.save({ transaction });

    // Commit transaction
    await transaction.commit();

    // Récupérer la facture créée
    const createdFacture = await Facture.findByPk(facture.id, {
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "quantite",
              "prix_unitaire",
              "montant_ht_ligne",
              "montant_tva_ligne",
              "total_ligne",
              "description",
            ],
          },
        },
        {
          model: Advancement,
          as: "advancements",
        },
        {
          model: BonLivraison,
          as: "bon_livraison",
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Facture créée à partir du bon de livraison avec succès",
      facture: createdFacture,
    });
  } catch (error) {
    // Rollback transaction
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur création facture depuis BL:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la création de la facture",
    });
  }
};

// Mettre à jour une facture
const updateFacture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      produits,
      mode_reglement,
      notes,
      date_facturation,
      date_echeance,
      status,
      advancements,
    } = req.body;

    const facture = await Facture.findByPk(id, {
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

    if (!facture) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Store old status for stock management
    const oldStatus = facture.status;

    // Vérifier si la facture peut être modifiée
    if (oldStatus === "payée" || oldStatus === "annulée") {
      throw new Error(`Impossible de modifier une facture ${oldStatus}`);
    }

    // Mettre à jour les advancements si fournis
    if (advancements && Array.isArray(advancements)) {
      console.log("Processing advancements:", advancements);

      let totalAdvancements = 0;
      const existingAdvancements = await Advancement.findAll({
        where: { facture_id: id }, // Changed from factureId
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
          type,
          reference,
          notes: advancementNotes,
        } = advancementData;

        // Valider le montant
        if (!amount || amount <= 0) {
          throw new Error(`Le montant de l'avancement doit être positif`);
        }

        // Si l'avancement a un ID, c'est une mise à jour
        if (advancementId && existingAdvancementsMap[advancementId]) {
          const existingAdvancement = existingAdvancementsMap[advancementId];

          // Mettre à jour l'avancement existant
          await existingAdvancement.update(
            {
              amount,
              paymentDate: new Date(paymentDate),
              paymentMethod,
              type,
              reference: reference || null,
              notes: advancementNotes || null,
            },
            { transaction },
          );

          // Marquer comme traité
          delete existingAdvancementsMap[advancementId];
        } else {
          // C'est un nouvel advancement
          await Advancement.create(
            {
              facture_id: id, // Changed from factureId
              amount,
              paymentDate: new Date(paymentDate),
              paymentMethod,
              type,
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

      // Mettre à jour le montant payé et le montant restant
      const montantTotal = parseFloat(facture.montant_ttc) || 0;
      facture.montant_paye = totalAdvancements;
      facture.montant_restant = Math.max(0, montantTotal - totalAdvancements);

      // Mettre à jour le statut de paiement automatiquement
      if (totalAdvancements >= montantTotal) {
        facture.status = "payée";
        facture.is_fully_paid = true;
      } else if (totalAdvancements > 0) {
        facture.status = "partiellement_payée";
        facture.is_fully_paid = false;
      } else {
        facture.status = status || facture.status;
        facture.is_fully_paid = false;
      }
    }

    // Si des produits sont fournis, recalculer
    if (produits && produits.length > 0) {
      // Supprimer les anciennes associations
      await FactureProduit.destroy({
        where: { facture_id: id }, // Changed from factureId
        transaction,
      });

      // Recalculer les totaux avec les nouveaux produits
      let montant_ht = 0;
      let montant_tva = 0;

      for (const item of produits) {
        const produit = await Produit.findByPk(item.produitId, { transaction });

        if (!produit) {
          throw new Error(`Produit ${item.produitId} non trouvé`);
        }

        const prix_unitaire = item.prix_unitaire || produit.prix_vente;

        const montant_ht_ligne = prix_unitaire * item.quantite;
        const montant_tva_ligne = montant_ht_ligne;
        const total_ligne = montant_ht_ligne + montant_tva_ligne;

        montant_ht += montant_ht_ligne;
        montant_tva += montant_tva_ligne;

        // Créer la nouvelle association
        await FactureProduit.create(
          {
            facture_id: id, // Changed from factureId
            produit_id: item.produitId, // Changed from produitId
            quantite: item.quantite,
            prix_unitaire,
            montant_ht_ligne,
            montant_tva_ligne,
            total_ligne,
            description: item.description || null,
          },
          { transaction },
        );
      }

      // Calculer les nouveaux totaux
      const montant_ttc = montant_ht + montant_tva;

      // Mettre à jour les totaux
      facture.montant_ht = montant_ht;
      facture.tva = montant_tva;
      facture.montant_tva = montant_tva;
      facture.montant_ttc = montant_ttc;

      // Recalculer le montant restant en fonction des advancements existants
      const totalAdvancements = parseFloat(facture.montant_paye) || 0;
      facture.montant_restant = Math.max(0, montant_ttc - totalAdvancements);
    }

    // Mettre à jour les autres champs
    if (mode_reglement) facture.mode_reglement = mode_reglement;
    if (notes !== undefined) facture.notes = notes;
    if (date_facturation) facture.date_facturation = new Date(date_facturation);
    if (date_echeance) facture.date_echeance = new Date(date_echeance);

    // Ne pas écraser le statut si il a été mis à jour automatiquement par les advancements
    if (status && !advancements) {
      facture.status = status;
    }

    // 🔴 STOCK MANAGEMENT: Handle status change to "annulée"
    if (status === "annulée" && oldStatus !== "annulée") {
      // Restore stock only if:
      // 1. Facture was not created from a BonLivraison (bon_livraison_id is null)
      // 2. AND the old status was not "annulée"

      if (!facture.bon_livraison_id) {
        // Get all products with their quantities from the facture
        const factureProduits = await FactureProduit.findAll({
          where: { facture_id: id },
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
          transaction,
        });

        // Restore stock for each product
        for (const fp of factureProduits) {
          if (fp.produit) {
            fp.produit.qty += parseFloat(fp.quantite);
            await fp.produit.save({ transaction });
            console.log(
              `Stock restored for product ${fp.produit.id}: +${fp.quantite} units`,
            );
          }
        }
      } else {
        console.log(
          "Facture created from BonLivraison, no stock restoration needed",
        );
      }
    }

    // 🔴 STOCK MANAGEMENT: Handle un-cancellation (changing from "annulée" to another status)
    if (
      oldStatus === "annulée" &&
      status !== "annulée" &&
      status !== oldStatus
    ) {
      // Decrease stock again only if:
      // 1. Facture was not created from a BonLivraison
      // 2. AND we're changing FROM "annulée" TO another status

      if (!facture.bon_livraison_id) {
        // Get all products with their quantities from the facture
        const factureProduits = await FactureProduit.findAll({
          where: { facture_id: id },
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
          transaction,
        });

        // Check stock availability before decreasing
        for (const fp of factureProduits) {
          if (fp.produit) {
            if (fp.produit.qty < parseFloat(fp.quantite)) {
              throw new Error(
                `Stock insuffisant pour ${fp.produit.designation}. Stock disponible: ${fp.produit.qty}, Quantité nécessaire: ${fp.quantite}`,
              );
            }
          }
        }

        // Decrease stock for each product
        for (const fp of factureProduits) {
          if (fp.produit) {
            fp.produit.qty -= parseFloat(fp.quantite);
            await fp.produit.save({ transaction });
            console.log(
              `Stock decreased for product ${fp.produit.id}: -${fp.quantite} units`,
            );
          }
        }
      } else {
        console.log(
          "Facture created from BonLivraison, no stock decrease needed",
        );
      }
    }

    await facture.save({ transaction });
    await transaction.commit();

    // Récupérer la facture mise à jour avec toutes les relations
    const updatedFacture = await Facture.findByPk(id, {
      include: [
        {
          model: Client,
          as: "client",
        },
        {
          model: Produit,
          as: "produits",
          through: {
            attributes: [
              "quantite",
              "prix_unitaire",
              "montant_ht_ligne",
              "montant_tva_ligne",
              "total_ligne",
              "description",
            ],
          },
        },
        {
          model: Advancement,
          as: "advancements",
          order: [["paymentDate", "ASC"]],
        },
      ],
    });

    // Formater les données pour le frontend
    const formattedFacture = {
      ...updatedFacture.toJSON(),
      isFullyPaid: updatedFacture.montant_restant <= 0,
      paidAmount: parseFloat(updatedFacture.montant_paye) || 0,
      remainingAmount: parseFloat(updatedFacture.montant_restant) || 0,
    };

    res.json({
      success: true,
      message: "Facture mise à jour avec succès",
      facture: formattedFacture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur mise à jour facture:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la mise à jour de la facture",
    });
  }
};
// Ajouter un paiement à une facture
const addPaymentToFacture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, reference, notes } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Montant invalide",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Méthode de paiement requise",
      });
    }

    const facture = await Facture.findByPk(id, { transaction });

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Vérifier si la facture peut recevoir des paiements
    if (facture.status === "annulée") {
      throw new Error("Impossible d'ajouter un paiement à une facture annulée");
    }

    // Créer le paiement
    const advancement = await Advancement.create(
      {
        amount,
        paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        reference: reference || null,
        notes: notes || null,
        factureId: id,
      },
      { transaction },
    );

    // Mettre à jour les montants de la facture
    facture.montant_paye += parseFloat(amount);
    facture.montant_restant = facture.montant_ttc - facture.montant_paye;

    // Mettre à jour le statut
    if (facture.montant_restant <= 0) {
      facture.status = "payée";
    } else if (facture.montant_paye > 0) {
      facture.status = "partiellement_payée";
    }

    await facture.save({ transaction });
    await transaction.commit();

    // Récupérer la facture mise à jour
    const updatedFacture = await Facture.findByPk(id, {
      include: [
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

    res.json({
      success: true,
      message: "Paiement ajouté avec succès",
      facture: updatedFacture,
      payment: advancement,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur ajout paiement:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de l'ajout du paiement",
    });
  }
};

// Annuler une facture
// Annuler une facture
const cancelFacture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const facture = await Facture.findByPk(id, {
      transaction,
      include: [
        {
          model: Produit,
          as: "produits", // Changed from "Produits" to "produits"
          through: {
            attributes: ["quantite", "prix_unitaire", "unite", "description"],
          },
        },
      ],
    });

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Vérifier si la facture peut être annulée
    if (facture.status === "annulée") {
      return res.status(400).json({
        success: false,
        message: "La facture est déjà annulée",
      });
    }

    // Restituer les quantités de produits
    if (facture.produits && facture.produits.length > 0) {
      // Changed from Produits to produits
      for (const produit of facture.produits) {
        // Get the quantity from the through table
        const factureProduit = produit.FactureProduit; // This should be available from the include
        const quantiteVendue = factureProduit ? factureProduit.quantite : 0;

        if (quantiteVendue > 0) {
          // If facture was created from BonLivraison, don't restore stock
          if (!facture.bon_livraison_id) {
            // Augmenter la quantité en stock
            await Produit.update(
              {
                qty: sequelize.literal(`qty + ${quantiteVendue}`),
              },
              {
                where: { id: produit.id },
                transaction,
              },
            );

            console.log(
              `Produit ${produit.reference} (ID: ${produit.id}) : +${quantiteVendue} unités restituées`,
            );
          } else {
            console.log(
              `Produit ${produit.reference} (ID: ${produit.id}) : Non restitué (facture créée depuis bon de livraison)`,
            );
          }
        }
      }
    }

    // Si des paiements ont été effectués, créer un avoir
    if (facture.montant_paye > 0) {
      // Créer un avoir (negative advancement)
      await Advancement.create(
        {
          amount: facture.montant_paye,
          paymentMethod: "avoir",
          paymentDate: new Date(),
          reference: `AVOIR-${facture.num_facture}`,
          notes: `Avoir suite à annulation de la facture ${facture.num_facture}`,
          facture_id: id,
        },
        { transaction },
      );
    }

    // Annuler la facture
    facture.status = "annulée";
    await facture.save({ transaction });

    // Si liée à un bon de livraison, réinitialiser son statut
    if (facture.bon_livraison_id) {
      const bonLivraison = await BonLivraison.findByPk(
        facture.bon_livraison_id,
        { transaction },
      );
      if (bonLivraison) {
        bonLivraison.is_facture = false;
        await bonLivraison.save({ transaction });
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: facture.bon_livraison_id
        ? "Facture annulée avec succès (pas de restitution de stock - facture créée depuis bon de livraison)."
        : "Facture annulée avec succès. Les quantités de produits ont été restituées au stock.",
      facture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur annulation facture:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de l'annulation de la facture",
    });
  }
};

// Supprimer une facture
const deleteFacture = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const facture = await Facture.findByPk(id, {
      transaction,
      include: [
        {
          model: Produit,
          as: "produits", // Changed from "Produits" to "produits"
          through: {
            attributes: ["quantite", "prix_unitaire", "description"],
          },
        },
      ],
    });

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Vérifier si la facture peut être supprimée
    if (
      facture.status === "payée" ||
      facture.status === "partiellement_payée"
    ) {
      throw new Error("Impossible de supprimer une facture avec des paiements");
    }

    // Restituer les quantités de produits avant suppression
    if (facture.produits && facture.produits.length > 0) {
      // Changed from Produits to produits
      for (const produit of facture.produits) {
        const factureProduit = produit.FactureProduit;
        const quantiteVendue = factureProduit ? factureProduit.quantite : 0;

        if (quantiteVendue > 0) {
          // If facture was created from BonLivraison, don't restore stock
          if (!facture.bon_livraison_id) {
            // Augmenter la quantité en stock
            await Produit.update(
              {
                qty: sequelize.literal(`qty + ${quantiteVendue}`),
              },
              {
                where: { id: produit.id },
                transaction,
              },
            );

            console.log(
              `Produit ${produit.reference} (ID: ${produit.id}) : +${quantiteVendue} unités restituées`,
            );
          } else {
            console.log(
              `Produit ${produit.reference} (ID: ${produit.id}) : Non restitué (facture créée depuis bon de livraison)`,
            );
          }
        }
      }
    }

    // Supprimer les associations produits
    await FactureProduit.destroy({
      where: { facture_id: id },
      transaction,
    });

    // Supprimer les paiements associés
    await Advancement.destroy({
      where: { facture_id: id },
      transaction,
    });

    // Si liée à un bon de livraison, réinitialiser son statut
    if (facture.bon_livraison_id) {
      const bonLivraison = await BonLivraison.findByPk(
        facture.bon_livraison_id,
        { transaction },
      );
      if (bonLivraison) {
        bonLivraison.is_facture = false;
        await bonLivraison.save({ transaction });
      }
    }

    // Supprimer la facture
    await facture.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: facture.bon_livraison_id
        ? "Facture supprimée avec succès (pas de restitution de stock - facture créée depuis bon de livraison)."
        : "Facture supprimée avec succès. Les quantités de produits ont été restituées au stock.",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur suppression facture:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la suppression de la facture",
    });
  }
};
// Obtenir les statistiques des factures
const getFactureStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};

    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const stats = await Facture.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("SUM", sequelize.col("montant_ht")), "total_ht"],
        [sequelize.fn("SUM", sequelize.col("montant_tva")), "total_tva"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_ttc"],
        [sequelize.fn("SUM", sequelize.col("montant_paye")), "total_paye"],
        [
          sequelize.fn("SUM", sequelize.col("montant_restant")),
          "total_restant",
        ],
      ],
      raw: true,
    });

    // Statistiques par statut
    const statsByStatus = await Facture.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "montant_total"],
      ],
      group: ["status"],
      raw: true,
    });

    // Statistiques par mois
    const statsByMonth = await Facture.findAll({
      where: whereClause,
      attributes: [
        [
          sequelize.fn("DATE_FORMAT", sequelize.col("date_creation"), "%Y-%m"),
          "month",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "montant_total"],
      ],
      group: ["month"],
      order: [["month", "DESC"]],
      raw: true,
    });

    res.json({
      success: true,
      stats: stats[0],
      statsByStatus,
      statsByMonth,
    });
  } catch (error) {
    console.error("Erreur statistiques factures:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du calcul des statistiques des factures",
    });
  }
};

module.exports = {
  getAllFactures,
  getFactureById,
  createFacture,
  createFactureFromBonLivraison,
  updateFacture,
  addPaymentToFacture,
  cancelFacture,
  deleteFacture,
  getFactureStats,
};
