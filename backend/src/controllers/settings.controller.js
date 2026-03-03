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
          baseLendingRate: 8.5,
          maxRiskPremiumCap: 3.0,
          sectorRiskConfig: {
            Manufacturing: 1.2,
            'IT Services': 0.8,
            'Real Estate': 1.8,
            Healthcare: 0.9,
            Retail: 1.1,
            Technology: 0.85,
            FMCG: 0.8,
            Services: 1.0,
            Construction: 1.3,
            Textiles: 1.1,
            Metals: 1.2,
            Aviation: 1.5,
            Hospitality: 1.3,
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

    // Step 1: Fetch existing active settings
    const existing = await prisma.settings.findFirst({
      where: { isActive: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Active settings not found' });
    }

    // Step 2: Merge existing settings with incoming payload
    const updatedData = {
      ...existing,
      ...req.body,
    };

    // Step 3: Extract weights from merged object
    const {
      revenueWeight,
      debtWeight,
      litigationWeight,
      promoterWeight,
      sectorWeight,
    } = updatedData;

    // Step 4: Validate weights safely
    const weights = [
      revenueWeight,
      debtWeight,
      litigationWeight,
      promoterWeight,
      sectorWeight,
    ];

    if (weights.some((w) => typeof w !== 'number' || isNaN(w))) {
      return res.status(400).json({
        error: 'All weights must be valid numbers',
      });
    }

    if (weights.some((w) => w < 0 || w > 1)) {
      return res.status(400).json({
        error: 'Weights must be between 0 and 1',
      });
    }

    const total = weights.reduce((a, b) => a + b, 0);

    if (Math.abs(total - 1.0) > 0.001) {
      return res.status(400).json({
        error: 'Weights must sum to 1.0',
        currentSum: total,
      });
    }

    // Step 5: Update database using only fields from req.body
    const settings = await prisma.settings.update({
      where: { id: existing.id },
      data: req.body,
    });

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
        baseLendingRate: 8.5,
        maxRiskPremiumCap: 3.0,
        sectorRiskConfig: {
          Manufacturing: 1.2,
          'IT Services': 0.8,
          'Real Estate': 1.8,
          Healthcare: 0.9,
          Retail: 1.1,
          Technology: 0.85,
          FMCG: 0.8,
          Services: 1.0,
          Construction: 1.3,
          Textiles: 1.1,
          Metals: 1.2,
          Aviation: 1.5,
          Hospitality: 1.3,
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
