const prisma = require('../config/database');

/**
 * Get settings
 */
const getSettings = async (req, res, next) => {
  try {
    let settings = await prisma.settings.findFirst({
      where: { isActive: true },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          revenueWeight: 0.25,
          debtWeight: 0.20,
          litigationWeight: 0.20,
          promoterWeight: 0.15,
          sectorWeight: 0.20,
          highRiskThreshold: 60,
          mediumRiskThreshold: 40,
          mismatchThreshold: 15,
          autoApprovalScore: 75,
          autoRejectScore: 30,
          sectorRiskConfig: {
            Technology: 85,
            Healthcare: 80,
            FMCG: 80,
            Manufacturing: 75,
            Services: 75,
            Retail: 70,
            'Real Estate': 60,
            Construction: 65,
            Textiles: 70,
            Metals: 65,
            Aviation: 55,
            Hospitality: 60,
          },
          researchKeywords: [
            { keyword: 'fraud', weight: 10, severity: 'CRITICAL' },
            { keyword: 'default', weight: 7, severity: 'HIGH' },
            { keyword: 'litigation', weight: 5, severity: 'MEDIUM' },
          ],
          maxFileSize: 10485760,
          allowedFileTypes: ['application/pdf', 'text/csv'],
        },
      });
    }

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

/**
 * Update settings
 */
const updateSettings = async (req, res, next) => {
  try {
    // Only admins can update settings
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can update settings' });
    }

    const {
      revenueWeight,
      debtWeight,
      litigationWeight,
      promoterWeight,
      sectorWeight,
      highRiskThreshold,
      mediumRiskThreshold,
      mismatchThreshold,
      autoApprovalScore,
      autoRejectScore,
      sectorRiskConfig,
      researchKeywords,
    } = req.body;

    // Validate weights sum to 1.0
    const totalWeight =
      (revenueWeight || 0) +
      (debtWeight || 0) +
      (litigationWeight || 0) +
      (promoterWeight || 0) +
      (sectorWeight || 0);

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return res.status(400).json({
        error: 'Weights must sum to 1.0',
        currentSum: totalWeight,
      });
    }

    let settings = await prisma.settings.findFirst({
      where: { isActive: true },
    });

    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          revenueWeight,
          debtWeight,
          litigationWeight,
          promoterWeight,
          sectorWeight,
          highRiskThreshold,
          mediumRiskThreshold,
          mismatchThreshold,
          autoApprovalScore,
          autoRejectScore,
          sectorRiskConfig,
          researchKeywords,
        },
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          revenueWeight,
          debtWeight,
          litigationWeight,
          promoterWeight,
          sectorWeight,
          highRiskThreshold,
          mediumRiskThreshold,
          mismatchThreshold,
          autoApprovalScore,
          autoRejectScore,
          sectorRiskConfig,
          researchKeywords,
        },
      });
    }

    res.json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset settings to defaults
 */
const resetSettings = async (req, res, next) => {
  try {
    // Only admins can reset settings
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can reset settings' });
    }

    // Deactivate current settings
    await prisma.settings.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new default settings
    const settings = await prisma.settings.create({
      data: {
        revenueWeight: 0.25,
        debtWeight: 0.20,
        litigationWeight: 0.20,
        promoterWeight: 0.15,
        sectorWeight: 0.20,
        highRiskThreshold: 60,
        mediumRiskThreshold: 40,
        mismatchThreshold: 15,
        autoApprovalScore: 75,
        autoRejectScore: 30,
        sectorRiskConfig: {
          Technology: 85,
          Healthcare: 80,
          FMCG: 80,
          Manufacturing: 75,
          Services: 75,
          Retail: 70,
          'Real Estate': 60,
          Construction: 65,
          Textiles: 70,
          Metals: 65,
          Aviation: 55,
          Hospitality: 60,
        },
        researchKeywords: [
          { keyword: 'fraud', weight: 10, severity: 'CRITICAL' },
          { keyword: 'default', weight: 7, severity: 'HIGH' },
          { keyword: 'litigation', weight: 5, severity: 'MEDIUM' },
        ],
        maxFileSize: 10485760,
        allowedFileTypes: ['application/pdf', 'text/csv'],
      },
    });

    res.json({
      message: 'Settings reset to defaults',
      settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
};
