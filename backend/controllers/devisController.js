// controllers/devisController.js
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const {
  Devis,
  DevisProduit,
  Client,
  Produit,
  Facture,
  BonLivraison,
  BonLivraisonProduit,
  FactureProduit,
} = require("../models");

// Generate unique quote number
const generateNumeroDevis = async () => {
  const prefix = "DEV";

  // Trouver le dernier BL
  const lastDevis = await Devis.findOne({
    where: {
      num_devis: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastDevis) {
    // Extraire seulement les 4 derniers chiffres
    const lastNum = lastDevis.num_devis;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Generate unique invoice number
const generateNumeroFacture = async () => {
  const prefix = "FAC";

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
    const lastNum = lastFacture.num_facture;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Generate unique delivery note number
const generateNumeroBL = async () => {
  const prefix = "BL";

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
    const lastNum = lastBon.num_bon_livraison;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// Get all quotes
const getAllDevis = async (req, res) => {
  try {
    const { startDate, endDate, status, clientId } = req.query;

    const whereClause = {};

    // Filter by creation date
    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Filter by status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filter by client
    if (clientId && clientId !== "all") {
      whereClause.client_id = clientId;
    }

    const devisList = await Devis.findAll({
      where: whereClause,
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
              "total_ligne",
              "description",
              "unite",
            ],
          },
          attributes: ["id", "reference", "designation"],
        },
      ],
      order: [["date_creation", "DESC"]],
    });

    res.json({
      success: true,
      devis: devisList,
      totalCount: devisList.length,
    });
  } catch (error) {
    console.error("Erreur récupération devis:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des devis",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get specific quote by ID
const getDevisById = async (req, res) => {
  try {
    const { id } = req.params;

    const devis = await Devis.findByPk(id, {
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
              "total_ligne",
              "description",
              "unite",
            ],
          },
          attributes: ["id", "reference", "designation", "qty", "prix_achat"],
        },
      ],
    });

    if (!devis) {
      return res.status(404).json({
        success: false,
        message: "Devis non trouvé",
      });
    }

    res.json({
      success: true,
      devis: devis,
    });
  } catch (error) {
    console.error("Erreur récupération devis:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du devis",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Create new quote - NO STOCK DECREASE FOR QUOTES
const createDevis = async (req, res) => {
  let transaction;

  try {
    const {
      client_id,
      produits,
      mode_reglement,
      notes = "",

      date_creation,
    } = req.body;

    console.log("Devis Items:" + JSON.stringify(req.body));

    // Validation
    if (!client_id) {
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

    // Generate quote number
    const num_devis = await generateNumeroDevis();

    // Calculate totals
    let montant_ht = 0;

    // Verify all products and calculate totals
    const produitsVerifies = [];
    for (const item of produits) {
      const produit = await Produit.findByPk(item.produit_id, { transaction });

      if (!produit) {
        throw new Error(`Produit ${item.produit_id} non trouvé`);
      }

      const prix_unitaire = item.prix_unitaire || produit.prix_vente;
      const total_ligne = prix_unitaire * item.quantite;

      montant_ht += total_ligne;

      // Store verified product data
      produitsVerifies.push({
        produit,
        item,
        prix_unitaire,
        total_ligne,
      });
    }

    const montant_ttc = montant_ht;

    // Create the quote
    const devis = await Devis.create(
      {
        num_devis,
        client_id,
        mode_reglement: mode_reglement || "espèces",
        montant_ht,
        montant_ttc,
        notes,

        date_creation: date_creation ? new Date(date_creation) : new Date(),
        status: "brouillon",
      },
      { transaction },
    );

    // Add products - NO STOCK DECREASE FOR QUOTES
    for (const produitVerifie of produitsVerifies) {
      const { item, prix_unitaire, total_ligne } = produitVerifie;

      // Create association
      await DevisProduit.create(
        {
          devis_id: devis.id,
          produit_id: item.produit_id,
          quantite: item.quantite,
          prix_unitaire,
          total_ligne,
          description: item.description || null,
          unite: item.unite || "unité",
        },
        { transaction },
      );
    }

    // Commit transaction
    await transaction.commit();

    // Retrieve created quote with relations
    const createdDevis = await Devis.findByPk(devis.id, {
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
              "total_ligne",
              "description",
              "unite",
            ],
          },
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Devis créé avec succès",
      devis: createdDevis,
    });
  } catch (error) {
    // Rollback transaction if it exists and hasn't been committed
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur création devis:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la création du devis",
    });
  }
};

// Helper function to decrease stock from created entity
const decreaseStockFromEntity = async (
  entity,
  transaction,
  entityType = "facture",
) => {
  try {
    console.log(`Decreasing stock for ${entityType} ${entity.id}`);

    // Get products with their quantities from the entity
    const entityProduits =
      entityType === "facture"
        ? await FactureProduit.findAll({
            where: { facture_id: entity.id },
            include: [{ model: Produit, as: "produit" }],
            transaction,
          })
        : await BonLivraisonProduit.findAll({
            where: { bon_livraison_id: entity.id },
            include: [{ model: Produit, as: "produit" }],
            transaction,
          });

    for (const entityProduit of entityProduits) {
      if (entityProduit.produit) {
        const quantite = parseFloat(entityProduit.quantite);

        // Check stock availability
        if (entityProduit.produit.qty < quantite) {
          throw new Error(
            `Stock insuffisant pour ${entityProduit.produit.designation}. Stock disponible: ${entityProduit.produit.qty}, Quantité nécessaire: ${quantite}`,
          );
        }

        // Decrease stock
        entityProduit.produit.qty -= quantite;
        await entityProduit.produit.save({ transaction });

        console.log(
          `Stock decreased for product ${entityProduit.produit.id}: -${quantite} units (from ${entityType})`,
        );
      }
    }
  } catch (error) {
    console.error(`Error decreasing stock from ${entityType}:`, error);
    throw error;
  }
};

// Helper function to create Facture from Devis
const createFactureFromDevis = async (devis, transaction) => {
  try {
    // Get produits from devis with through data
    const devisProduits = await DevisProduit.findAll({
      where: { devis_id: devis.id },
      include: [{ model: Produit, as: "produit" }],
      transaction,
    });

    // Check stock before creating facture
    for (const dp of devisProduits) {
      if (dp.produit && dp.produit.qty < dp.quantite) {
        throw new Error(
          `Stock insuffisant pour ${dp.produit.designation}. Stock disponible: ${dp.produit.qty}, Quantité nécessaire: ${dp.quantite}`,
        );
      }
    }

    // Generate facture number
    const num_facture = await generateNumeroFacture();

    // Get TVA from devis or use default 20%
    const tauxTVA = parseFloat(devis.tva) || 20;

    // Calculate totals from devis produits
    let total_ht_initial = 0;
    const produitsVerifies = [];

    for (const dp of devisProduits) {
      const quantite = parseFloat(dp.quantite);
      const prix_unitaire = parseFloat(dp.prix_unitaire) || 0;
      const montant_ht_ligne = parseFloat(
        (prix_unitaire * quantite).toFixed(2),
      );

      total_ht_initial += montant_ht_ligne;

      // Store product data for later use
      produitsVerifies.push({
        produit: dp.produit,
        produit_id: dp.produit_id,
        quantite,
        prix_unitaire,
        montant_ht_ligne,
      });
    }

    // Apply global discount
    const montant_ht_after_remise = Math.max(total_ht_initial, 0);

    // Calculate TVA on discounted amount
    const montant_tva = parseFloat(
      ((montant_ht_after_remise * tauxTVA) / 100).toFixed(2),
    );

    const montant_ttc = parseFloat(
      (montant_ht_after_remise + montant_tva).toFixed(2),
    );

    // FIXED: Ensure mode_reglement is not null
    const modeReglement = devis.mode_reglement || "espèces";

    // Get current date for facturation and due date
    const currentDate = new Date();
    const dateFacturation = currentDate;

    // Calculate due date (30 days from now by default)
    const dateEcheance = new Date();
    dateEcheance.setDate(dateEcheance.getDate() + 30);

    // Create facture with proper decimal values
    const facture = await Facture.create(
      {
        num_facture,
        client_id: devis.client_id,
        devis_id: devis.id,
        mode_reglement: modeReglement,
        montant_ht: montant_ht_after_remise,
        montant_ht_initial: total_ht_initial,
        tva: tauxTVA,
        montant_tva,
        montant_ttc,
        montant_paye: 0,
        montant_restant: montant_ttc,
        notes: `Créé à partir du devis ${devis.num_devis}`,
        date_creation: currentDate,
        date_facturation: dateFacturation,
        date_echeance: dateEcheance,
        status: "brouillon",
      },
      { transaction },
    );

    // Add produits to facture - NO TVA at line level
    for (const p of produitsVerifies) {
      // For "Total Ligne HT", we only store the HT amount
      await FactureProduit.create(
        {
          facture_id: facture.id,
          produit_id: p.produit_id,
          quantite: p.quantite,
          prix_unitaire: p.prix_unitaire,
          montant_ht_ligne: p.montant_ht_ligne,
          montant_tva_ligne: 0, // TVA is calculated at total level, not per line
          total_ligne: p.montant_ht_ligne, // Total ligne = HT amount only
        },
        { transaction },
      );
    }

    // Decrease stock for facture
    await decreaseStockFromEntity(facture, transaction, "facture");

    console.log(
      `Facture ${num_facture} créée à partir du devis ${devis.num_devis}`,
    );

    return {
      facture,
      calculs_details: {
        total_ht_initial: parseFloat(total_ht_initial.toFixed(2)),
        montant_ht_after_remise: parseFloat(montant_ht_after_remise.toFixed(2)),
        taux_tva: parseFloat(tauxTVA.toFixed(2)),
        montant_tva: parseFloat(montant_tva.toFixed(2)),
        montant_ttc: parseFloat(montant_ttc.toFixed(2)),
      },
    };
  } catch (error) {
    console.error("Error creating facture from devis:", error);
    throw error;
  }
};
// Helper function to create BonLivraison from Devis
const createBonLivraisonFromDevis = async (devis, transaction) => {
  try {
    // Get produits from devis with through data
    const devisProduits = await DevisProduit.findAll({
      where: { devis_id: devis.id },
      include: [{ model: Produit, as: "produit" }],
      transaction,
    });

    // Check stock before creating bon livraison
    for (const dp of devisProduits) {
      if (dp.produit && dp.produit.qty < dp.quantite) {
        throw new Error(
          `Stock insuffisant pour ${dp.produit.designation}. Stock disponible: ${dp.produit.qty}, Quantité nécessaire: ${dp.quantite}`,
        );
      }
    }

    // Generate bon livraison number
    const num_bon_livraison = await generateNumeroBL();

    // Calculate TVA properly - FIXED
    const tauxTVA = 20;

    // Ensure montant_ht is a number
    const montantHT = parseFloat(devis.montant_ht) || 0;

    // Calculate montant_ttc properly
    const montantTVA = (montantHT * tauxTVA) / 100;
    const montantTTC = montantHT + montantTVA;

    // FIXED: Ensure mode_reglement is not null
    const modeReglement = devis.mode_reglement || "espèces";

    // Create bon livraison with proper decimal values
    const bonLivraison = await BonLivraison.create(
      {
        num_bon_livraison,
        client_id: devis.client_id,
        devis_id: devis.id,
        mode_reglement: modeReglement,
        montant_ht: parseFloat(montantHT.toFixed(2)),
        montant_ttc: parseFloat(montantTTC.toFixed(2)),
        tva: tauxTVA, // Add TVA field if your model has it
        notes: `Créé à partir du devis ${devis.num_devis}`,
        date_creation: new Date(),
        date_livraison: new Date(),
        status: "brouillon",
      },
      { transaction },
    );

    // Add produits to bon livraison
    for (const dp of devisProduits) {
      await BonLivraisonProduit.create(
        {
          bon_livraison_id: bonLivraison.id,
          produit_id: dp.produit_id,
          quantite: dp.quantite,
          prix_unitaire: parseFloat(dp.prix_unitaire) || 0,
          total_ligne: parseFloat(dp.total_ligne) || 0,
        },
        { transaction },
      );
    }

    // Decrease stock for bon livraison
    await decreaseStockFromEntity(bonLivraison, transaction, "bon_livraison");

    console.log(
      `Bon de livraison ${num_bon_livraison} créé à partir du devis ${devis.num_devis}`,
    );
    return bonLivraison;
  } catch (error) {
    console.error("Error creating bon livraison from devis:", error);
    throw error;
  }
}; // Update a quote
const updateDevis = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { produits, mode_reglement, notes, status } = req.body;

    console.log("Req Body: " + JSON.stringify(req.body));

    const devis = await Devis.findByPk(id, {
      transaction,
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
              "total_ligne",
              "description",
              "unite",
            ],
          },
        },
      ],
    });

    if (!devis) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Devis non trouvé",
      });
    }

    // Store old status for comparison
    const oldStatus = devis.status;

    // If products are provided, recalculate
    if (produits && produits.length > 0) {
      // Delete old associations
      await DevisProduit.destroy({
        where: { devis_id: id },
        transaction,
      });

      // Calculate totals with new products
      let montant_ht = 0;

      for (const item of produits) {
        const produit = await Produit.findByPk(item.produit_id, {
          transaction,
        });

        if (!produit) {
          await transaction.rollback();
          throw new Error(`Produit ${item.produit_id} non trouvé`);
        }

        const prix_unitaire = item.prix_unitaire || produit.prix_vente;
        const total_ligne = prix_unitaire * item.quantite;

        montant_ht += total_ligne;

        // Create new association
        await DevisProduit.create(
          {
            devis_id: id,
            produit_id: item.produit_id,
            quantite: item.quantite,
            prix_unitaire,
            total_ligne,
            description: item.description || null,
            unite: item.unite || "unité",
          },
          { transaction },
        );
      }

      // Apply discount
      montant_ht = Math.max(0, montant_ht);

      const montant_ttc = montant_ht;

      // Update totals
      devis.montant_ht = montant_ht;
      devis.montant_ttc = montant_ttc;
    }

    // Update other fields
    if (mode_reglement) devis.mode_reglement = mode_reglement;
    if (notes !== undefined) devis.notes = notes;

    // Handle status change
    let createdEntity = null;
    if (status && status !== oldStatus) {
      devis.status = status;

      // Create Facture when status changes to "transformé_en_facture"
      if (status === "transformé_en_facture") {
        createdEntity = await createFactureFromDevis(devis, transaction);
      }

      // Create BonLivraison when status changes to "transformé_en_bl"
      if (status === "transformé_en_bl") {
        createdEntity = await createBonLivraisonFromDevis(devis, transaction);
      }
    } else if (status) {
      devis.status = status;
    }

    await devis.save({ transaction });
    await transaction.commit();

    const updatedDevis = await Devis.findByPk(id, {
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
              "total_ligne",
              "description",
              "unite",
            ],
          },
        },
      ],
    });

    const response = {
      success: true,
      message: "Devis mis à jour avec succès",
      devis: updatedDevis,
    };

    // Include created entity info in response
    if (createdEntity) {
      response.createdEntity = {
        type: status === "transformé_en_facture" ? "facture" : "bon_livraison",
        id: createdEntity.id,
        num:
          status === "transformé_en_facture"
            ? createdEntity.num_facture
            : createdEntity.num_bon_livraison,
      };

      if (status === "transformé_en_facture") {
        response.message += " et facture créée";
      } else {
        response.message += " et bon de livraison créé";
      }
    }

    res.json(response);
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur mise à jour devis:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la mise à jour du devis",
    });
  }
};

// Change quote status
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatus = [
      "brouillon",
      "envoyé",
      "accepté",
      "refusé",
      "expiré",
      "transformé_en_commande",
      "en_attente",
    ];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Statut invalide",
      });
    }

    const devis = await Devis.findByPk(id);

    if (!devis) {
      return res.status(404).json({
        success: false,
        message: "Devis non trouvé",
      });
    }

    // Update status
    devis.status = status;

    // If accepted, set acceptance date
    if (status === "accepté") {
      devis.date_acceptation = new Date();
    }

    await devis.save();

    res.json({
      success: true,
      message: `Statut mis à jour: ${status}`,
      devis: devis,
    });
  } catch (error) {
    console.error("Erreur changement statut:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors du changement de statut",
    });
  }
};

// Delete a quote
const deleteDevis = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const devis = await Devis.findByPk(id, { transaction });

    if (!devis) {
      return res.status(404).json({
        success: false,
        message: "Devis non trouvé",
      });
    }

    // Check if quote can be deleted
    if (
      devis.status === "accepté" ||
      devis.status === "transformé_en_commande"
    ) {
      throw new Error(`Impossible de supprimer un devis ${devis.status}`);
    }

    // Delete associations
    await DevisProduit.destroy({
      where: { devis_id: id },
      transaction,
    });

    // Delete the quote
    await devis.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Devis supprimé avec succès",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erreur suppression devis:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la suppression du devis",
    });
  }
};

// Get statistics
const getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};

    if (startDate && endDate) {
      whereClause.date_creation = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const stats = await Devis.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      raw: true,
    });

    // Statistics by status
    const statsByStatus = await Devis.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      group: ["status"],
      raw: true,
    });

    // Accepted quotes statistics
    const acceptedStats = await Devis.findAll({
      where: {
        ...whereClause,
        status: "accepté",
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("montant_ttc")), "total_montant"],
      ],
      raw: true,
    });

    res.json({
      success: true,
      stats: stats[0],
      statsByStatus,
      acceptedStats: acceptedStats[0],
    });
  } catch (error) {
    console.error("Erreur statistiques:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du calcul des statistiques",
    });
  }
};

// Convert quote to delivery note
// Convert quote to delivery note
const convertToBonLivraison = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;
    const { mode_reglement, notes, date_livraison } = req.body;

    // Get the quote
    const devis = await Devis.findByPk(id, {
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
      ],
    });

    if (!devis) {
      return res.status(404).json({
        success: false,
        message: "Devis non trouvé",
      });
    }

    // Start transaction
    transaction = await sequelize.transaction();

    // Generate delivery note number
    const num_bon_livraison = await generateNumeroBL();

    // Check product stock
    for (const produit of devis.produits) {
      const productDevis = produit.DevisProduit;
      const stockProduct = await Produit.findByPk(produit.id, { transaction });

      if (!stockProduct) {
        throw new Error(`Produit ${produit.id} non trouvé`);
      }

      if (stockProduct.qty < productDevis.quantite) {
        throw new Error(
          `Stock insuffisant pour ${stockProduct.designation}. Stock disponible: ${stockProduct.qty}`,
        );
      }
    }

    // FIXED: Ensure mode_reglement is not null
    const modeReglement = mode_reglement || devis.mode_reglement || "espèces";

    // Create delivery note
    const bonLivraison = await BonLivraison.create(
      {
        num_bon_livraison,
        client_id: devis.client_id,
        devis_id: devis.id,
        mode_reglement: modeReglement, // Use the fixed value
        montant_ht: devis.montant_ht || 0,
        montant_ttc: devis.montant_ttc || 0,
        notes:
          notes || devis.notes || `Créé à partir du devis ${devis.num_devis}`,
        date_livraison: date_livraison ? new Date(date_livraison) : new Date(),
        date_creation: new Date(),
        status: "brouillon",
      },
      { transaction },
    );

    // Add products and update stock
    for (const produit of devis.produits) {
      const productDevis = produit.DevisProduit;
      const stockProduct = await Produit.findByPk(produit.id, { transaction });

      if (!stockProduct) {
        throw new Error(`Produit ${produit.id} non trouvé`);
      }

      // Create association
      await BonLivraisonProduit.create(
        {
          bon_livraison_id: bonLivraison.id,
          produit_id: produit.id,
          quantite: productDevis.quantite,
          prix_unitaire: productDevis.prix_unitaire,
          total_ligne: productDevis.total_ligne,
        },
        { transaction },
      );

      // Decrease product quantity
      stockProduct.qty -= productDevis.quantite;
      await stockProduct.save({ transaction });
    }

    // Update quote status
    devis.status = "transformé_en_commande";
    await devis.save({ transaction });

    // Commit transaction
    await transaction.commit();

    // Get created delivery note
    const createdBL = await BonLivraison.findByPk(bonLivraison.id, {
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
      ],
    });

    res.status(201).json({
      success: true,
      message: "Devis transformé en bon de livraison avec succès",
      bonLivraison: createdBL,
      devis: devis,
    });
  } catch (error) {
    // Rollback transaction
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Erreur conversion devis:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Erreur lors de la conversion du devis",
    });
  }
};
module.exports = {
  getAllDevis,
  getDevisById,
  createDevis,
  updateDevis,
  updateStatus,
  deleteDevis,
  getStats,
  convertToBonLivraison,
};
