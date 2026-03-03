const prisma = require('../config/database');
const camService = require('../services/cam.service');
const riskService = require('../services/risk.service');
const path = require('path');
const fs = require('fs').promises;

/**
 * Get company analysis
 */
const getCompanyAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.companyAnalysis.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            sector: true,
            loanAmount: true,
          },
        },
      },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Company analysis not found' });
    }

    res.json({ analysis });
  } catch (error) {
    next(error);
  }
};

/**
 * Get AI research
 */
const getAIResearch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const research = await prisma.aIResearch.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            pan: true,
          },
        },
      },
    });

    if (!research) {
      return res.status(404).json({ error: 'AI research not found' });
    }

    res.json({ research });
  } catch (error) {
    next(error);
  }
};

/**
 * Get risk score
 */
const getRiskScore = async (req, res, next) => {
  try {
    const { id } = req.params;

    const riskScore = await prisma.riskScore.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            applicationNo: true,
          },
        },
      },
    });

    if (!riskScore) {
      return res.status(404).json({ error: 'Risk score not found' });
    }

    res.json({ riskScore });
  } catch (error) {
    next(error);
  }
};

/**
 * Get CAM report
 */
const getCAMReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    let camReport = await prisma.camReport.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            applicationNo: true,
          },
        },
      },
    });

    // If CAM report doesn't exist, generate it
    if (!camReport) {
      const application = await prisma.application.findUnique({
        where: { id },
      });

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const companyAnalysis = await prisma.companyAnalysis.findUnique({
        where: { applicationId: id },
      });

      const aiResearch = await prisma.aIResearch.findUnique({
        where: { applicationId: id },
      });

      const riskScore = await prisma.riskScore.findUnique({
        where: { applicationId: id },
      });

      if (!companyAnalysis || !aiResearch || !riskScore) {
        return res.status(400).json({
          error: 'Complete analysis not available. Please run analysis first.',
        });
      }

      // Generate CAM report
      const camData = await camService.generateCAMReport(
        application,
        companyAnalysis,
        aiResearch,
        riskScore
      );

      camReport = await prisma.camReport.upsert({
        where: { applicationId: id },
        create: {
          applicationId: id,
          ...camData,
        },
        update: { ...camData },
        include: {
          application: {
            select: {
              companyName: true,
              applicationNo: true,
            },
          },
        },
      });
    }

    res.json({ camReport });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate and download CAM PDF
 */
const getCAMPDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get or create CAM report
    let camReport = await prisma.camReport.findUnique({
      where: { applicationId: id },
    });

    if (!camReport) {
      // Generate CAM report first
      const application = await prisma.application.findUnique({
        where: { id },
      });

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const companyAnalysis = await prisma.companyAnalysis.findUnique({
        where: { applicationId: id },
      });

      const aiResearch = await prisma.aIResearch.findUnique({
        where: { applicationId: id },
      });

      const riskScore = await prisma.riskScore.findUnique({
        where: { applicationId: id },
      });

      if (!companyAnalysis || !aiResearch || !riskScore) {
        return res.status(400).json({
          error: 'Complete analysis not available. Please run analysis first.',
        });
      }

      const camData = await camService.generateCAMReport(
        application,
        companyAnalysis,
        aiResearch,
        riskScore
      );

      camReport = await prisma.camReport.upsert({
        where: { applicationId: id },
        create: {
          applicationId: id,
          ...camData,
        },
        update: { ...camData },
      });
    }

    // Generate PDF if not already generated
    let pdfPath = camReport.pdfPath;

    if (!camReport.pdfGenerated || !pdfPath) {
      const application = await prisma.application.findUnique({
        where: { id },
      });

      const uploadsDir = path.join(__dirname, '../../uploads');
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `CAM-${application.applicationNo}-${Date.now()}.pdf`;
      pdfPath = path.join(uploadsDir, filename);

      await camService.generatePDF(camReport, application, pdfPath);

      // Update CAM report with PDF path
      await prisma.camReport.update({
        where: { id: camReport.id },
        data: {
          pdfGenerated: true,
          pdfPath,
        },
      });
    }

    // Send PDF file
    res.download(pdfPath, `CAM-Report-${Date.now()}.pdf`);
  } catch (error) {
    next(error);
  }
};

/**
 * Apply financial overrides to an existing company analysis.
 *
 * PUT /api/applications/:id/company-analysis/override
 *
 * Body (all fields optional, only provided fields are overridden):
 * {
 *   multiYearRevenue: [{ year, revenue, ebitda }],   // replaces chart data
 *   revenue: number,
 *   ebitda: number,
 *   netProfit: number,
 *   totalDebt: number,
 *   netWorth: number,
 *   currentAssets: number,
 *   currentLiabilities: number
 * }
 *
 * Safety:
 *  - Original extracted columns are NEVER modified.
 *  - financialOverrides is merged (patch), not replaced, so partial updates work.
 *  - Derived metrics (margins, ratios) are recomputed and saved.
 *  - RiskScore is recalculated and saved.
 */
const applyFinancialOverride = async (req, res, next) => {
  const { id } = req.params;
  try {
    // ── 1. Find existing analysis ──────────────────────────────────────────────
    const analysis = await prisma.companyAnalysis.findUnique({
      where: { applicationId: id },
      include: {
        application: { select: { companyName: true, sector: true, loanAmount: true, id: true } },
      },
    });

    if (!analysis) {
      return res.status(404).json({
        error: 'Company analysis not found. Run initial analysis first.',
      });
    }

    const application = await prisma.application.findUnique({ where: { id } });
    const aiResearch = await prisma.aIResearch.findUnique({ where: { applicationId: id } });
    const riskRecord = await prisma.riskScore.findUnique({ where: { applicationId: id } });

    // ── 2. Validate incoming override values ───────────────────────────────────
    const NUMERIC_FIELDS = [
      'revenue', 'ebitda', 'netProfit', 'totalDebt', 'netWorth',
      'currentAssets', 'currentLiabilities',
    ];

    const incomingOverrides = {};
    for (const field of NUMERIC_FIELDS) {
      if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
        const val = parseFloat(req.body[field]);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({
            error: `Invalid value for '${field}': must be a non-negative number.`,
          });
        }
        incomingOverrides[field] = val;
      }
    }

    // multiYearRevenue override validation
    if (req.body.multiYearRevenue !== undefined) {
      if (!Array.isArray(req.body.multiYearRevenue)) {
        return res.status(400).json({ error: 'multiYearRevenue must be an array.' });
      }
      for (const item of req.body.multiYearRevenue) {
        if (!item.year || isNaN(Number(item.year))) {
          return res.status(400).json({ error: 'Each multiYearRevenue entry must have a valid year.' });
        }
        if (item.revenue !== undefined && (isNaN(parseFloat(item.revenue)) || parseFloat(item.revenue) < 0)) {
          return res.status(400).json({ error: 'multiYearRevenue revenue values must be non-negative numbers.' });
        }
        if (item.ebitda !== undefined && (isNaN(parseFloat(item.ebitda)) || parseFloat(item.ebitda) < 0)) {
          return res.status(400).json({ error: 'multiYearRevenue ebitda values must be non-negative numbers.' });
        }
      }
      incomingOverrides.multiYearRevenue = req.body.multiYearRevenue.map(item => ({
        year: Number(item.year),
        revenue: item.revenue !== undefined ? parseFloat(item.revenue) : undefined,
        ebitda: item.ebitda !== undefined ? parseFloat(item.ebitda) : undefined,
      }));
    }

    // ── 2b. Validate reason field (Feature 3) ─────────────────────────────────
    //        Required if any numeric override value changes from extracted.
    const reason = (typeof req.body.reason === 'string') ? req.body.reason.trim() : '';
    const hasNumericChange = Object.keys(incomingOverrides).some(k => k !== 'multiYearRevenue');
    if (hasNumericChange && !reason) {
      return res.status(400).json({ error: 'Reason for override is required.' });
    }

    if (Object.keys(incomingOverrides).length === 0) {
      return res.status(400).json({ error: 'No valid override fields provided.' });
    }

    // ── 3. Merge into existing financialOverrides (patch semantics) ────────────
    const existingOverrides = (analysis.financialOverrides && typeof analysis.financialOverrides === 'object')
      ? analysis.financialOverrides
      : {};
    // Remove meta-fields before merging numeric overrides, re-attach below
    const { reason: _r, overriddenAt: _oa, overriddenBy: _ob, ...existingNumeric } = existingOverrides;
    const mergedOverrides = {
      ...existingNumeric,
      ...incomingOverrides,
      // Feature 3: audit metadata stored inside JSONB
      reason: reason || _r || '',
      overriddenAt: new Date().toISOString(),
      overriddenBy: req.user?.name || req.user?.email || 'Unknown',
    };

    // ── 4. Recompute derived metrics using override-priority logic ─────────────
    //       Formula: use override value if present, else fall back to extracted.
    const eff = (overrideKey, extractedKey) =>
      mergedOverrides[overrideKey] ?? analysis[extractedKey] ?? null;

    const effectiveRevenue = eff('revenue', 'revenue');
    const effectiveEbitda = eff('ebitda', 'ebitda');
    const effectiveNetProfit = eff('netProfit', 'netProfit');
    const effectiveTotalDebt = eff('totalDebt', 'totalDebt');
    const effectiveNetWorth = eff('netWorth', 'netWorth');
    const effectiveCurrentAssets = eff('currentAssets', 'totalAssets');  // best mapping
    const effectiveCurrentLiabilities = eff('currentLiabilities', 'totalLiabilities');

    // Derived computations
    const ebitdaMargin = (effectiveRevenue && effectiveRevenue !== 0 && effectiveEbitda !== null)
      ? parseFloat(((effectiveEbitda / effectiveRevenue) * 100).toFixed(2))
      : analysis.ebitdaMargin;

    const netProfitMargin = (effectiveRevenue && effectiveRevenue !== 0 && effectiveNetProfit !== null)
      ? parseFloat(((effectiveNetProfit / effectiveRevenue) * 100).toFixed(2))
      : analysis.netProfitMargin;

    const debtToEquity = (effectiveTotalDebt !== null && effectiveNetWorth && effectiveNetWorth !== 0)
      ? parseFloat((effectiveTotalDebt / effectiveNetWorth).toFixed(4))
      : analysis.debtToEquity;

    const currentRatio = (effectiveCurrentAssets !== null && effectiveCurrentLiabilities && effectiveCurrentLiabilities !== 0)
      ? parseFloat((effectiveCurrentAssets / effectiveCurrentLiabilities).toFixed(4))
      : analysis.currentRatio;

    // ── 5. Save updated analysis ───────────────────────────────────────────────
    const updatedAnalysis = await prisma.companyAnalysis.update({
      where: { applicationId: id },
      data: {
        financialOverrides: mergedOverrides,
        // Update derived fields so risk engine and CAM see correct values
        ebitdaMargin,
        netProfitMargin,
        debtToEquity,
        currentRatio,
      },
    });

    // ── 6. Recalculate risk score with merged financial view ───────────────────
    const settings = await prisma.settings.findFirst({ where: { isActive: true } });

    // Build merged companyAnalysis view that risk engine will use
    const mergedAnalysisForRisk = {
      ...updatedAnalysis,
      revenue: effectiveRevenue,
      ebitda: effectiveEbitda,
      netProfit: effectiveNetProfit,
      totalDebt: effectiveTotalDebt,
      netWorth: effectiveNetWorth,
      ebitdaMargin,
      netProfitMargin,
      debtToEquity,
      currentRatio,
    };

    const previousScore = riskRecord?.compositeScore ?? null;
    const riskScoreData = await riskService.calculateRiskScore(
      application,
      mergedAnalysisForRisk,
      aiResearch,
      settings
    );

    // ── 7. Update RiskScore and application.aiScore ────────────────────────────
    const riskPayload = {
      compositeScore: riskScoreData.compositeScore,
      riskLevel: riskScoreData.riskLevel,
      revenueStability: riskScoreData.revenueStability,
      debtRatio: riskScoreData.debtRatio,
      litigationScore: riskScoreData.litigationScore,
      promoterScore: riskScoreData.promoterScore,
      sectorScore: riskScoreData.sectorScore,
      weights: riskScoreData.weights,
      factorBreakdown: riskScoreData.factorBreakdown,
      deductions: riskScoreData.deductions || [],
      character: riskScoreData.character,
      capacity: riskScoreData.capacity,
      capital: riskScoreData.capital,
      collateral: riskScoreData.collateral,
      conditions: riskScoreData.conditions,
      recommendation: riskScoreData.recommendation,
      recommendationReason: riskScoreData.recommendationReason,
    };

    let updatedRiskScore;
    if (riskRecord) {
      updatedRiskScore = await prisma.riskScore.update({
        where: { applicationId: id },
        data: riskPayload,
      });
    } else {
      updatedRiskScore = await prisma.riskScore.create({
        data: { applicationId: id, ...riskPayload },
      });
    }

    // Determine new application status based on score
    const autoApprove = settings?.autoApprovalScore ?? 75;
    const autoReject = settings?.autoRejectScore ?? 30;
    let newStatus = 'COMPLETED';
    if (riskScoreData.compositeScore >= autoApprove) newStatus = 'APPROVED';
    else if (riskScoreData.compositeScore <= autoReject) newStatus = 'REJECTED';

    await prisma.application.update({
      where: { id },
      data: {
        aiScore: riskScoreData.compositeScore,
        status: newStatus,
      },
    });

    console.log(
      '[Override] applicationId:', id,
      '| previousScore:', previousScore,
      '| newScore:', riskScoreData.compositeScore,
      '| overrides:', Object.keys(mergedOverrides).join(', ')
    );

    res.json({
      message: 'Financial override applied successfully',
      analysis: updatedAnalysis,
      riskScore: updatedRiskScore,
      previousScore,
      newScore: riskScoreData.compositeScore,
    });
  } catch (error) {
    console.error('[Override] Error:', error.message);
    next(error);
  }
};

/**
 * Reset financial overrides — DELETE /applications/:id/company-analysis/override
 *
 * Sets financialOverrides = null and restores all derived metrics
 * from the original extracted columns. Risk score is recalculated.
 *
 * Safety:
 *  - Extracted columns (revenue, ebitda, etc.) are NEVER modified.
 *  - Only financialOverrides JSONB field is set to null.
 *  - A new CompanyAnalysis / RiskScore row is NEVER created.
 */
const resetFinancialOverride = async (req, res, next) => {
  const { id } = req.params;
  try {
    const analysis = await prisma.companyAnalysis.findUnique({
      where: { applicationId: id },
      include: {
        application: { select: { companyName: true, sector: true, loanAmount: true, id: true } },
      },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Company analysis not found.' });
    }

    if (!analysis.financialOverrides) {
      return res.status(200).json({
        message: 'No overrides to reset.',
        analysis,
      });
    }

    const application = await prisma.application.findUnique({ where: { id } });
    const aiResearch = await prisma.aIResearch.findUnique({ where: { applicationId: id } });
    const riskRecord = await prisma.riskScore.findUnique({ where: { applicationId: id } });
    const settings = await prisma.settings.findFirst({ where: { isActive: true } });

    // Restore derived metrics from raw extracted columns only
    const rawRevenue = analysis.revenue;
    const rawEbitda = analysis.ebitda;
    const rawNetProfit = analysis.netProfit;
    const rawTotalDebt = analysis.totalDebt;
    const rawNetWorth = analysis.netWorth;
    const rawTotalAssets = analysis.totalAssets;
    const rawTotalLiabilities = analysis.totalLiabilities;

    const restoredEbitdaMargin = (rawRevenue && rawRevenue !== 0 && rawEbitda !== null)
      ? parseFloat(((rawEbitda / rawRevenue) * 100).toFixed(2))
      : analysis.ebitdaMargin;

    const restoredNetProfitMargin = (rawRevenue && rawRevenue !== 0 && rawNetProfit !== null)
      ? parseFloat(((rawNetProfit / rawRevenue) * 100).toFixed(2))
      : analysis.netProfitMargin;

    const restoredDebtToEquity = (rawTotalDebt !== null && rawNetWorth && rawNetWorth !== 0)
      ? parseFloat((rawTotalDebt / rawNetWorth).toFixed(4))
      : analysis.debtToEquity;

    const restoredCurrentRatio = (rawTotalAssets !== null && rawTotalLiabilities && rawTotalLiabilities !== 0)
      ? parseFloat((rawTotalAssets / rawTotalLiabilities).toFixed(4))
      : analysis.currentRatio;

    // Update CompanyAnalysis: clear overrides + restore derived metrics
    const updatedAnalysis = await prisma.companyAnalysis.update({
      where: { applicationId: id },
      data: {
        financialOverrides: null,
        ebitdaMargin: restoredEbitdaMargin,
        netProfitMargin: restoredNetProfitMargin,
        debtToEquity: restoredDebtToEquity,
        currentRatio: restoredCurrentRatio,
      },
    });

    // Recalculate risk score using extracted-only analysis view
    const extractedOnlyAnalysis = {
      ...updatedAnalysis,
      revenue: rawRevenue,
      ebitda: rawEbitda,
      netProfit: rawNetProfit,
      totalDebt: rawTotalDebt,
      netWorth: rawNetWorth,
      ebitdaMargin: restoredEbitdaMargin,
      netProfitMargin: restoredNetProfitMargin,
      debtToEquity: restoredDebtToEquity,
      currentRatio: restoredCurrentRatio,
    };

    const previousScore = riskRecord?.compositeScore ?? null;
    const riskScoreData = await riskService.calculateRiskScore(
      application,
      extractedOnlyAnalysis,
      aiResearch,
      settings
    );

    const riskPayload = {
      compositeScore: riskScoreData.compositeScore,
      riskLevel: riskScoreData.riskLevel,
      revenueStability: riskScoreData.revenueStability,
      debtRatio: riskScoreData.debtRatio,
      litigationScore: riskScoreData.litigationScore,
      promoterScore: riskScoreData.promoterScore,
      sectorScore: riskScoreData.sectorScore,
      weights: riskScoreData.weights,
      factorBreakdown: riskScoreData.factorBreakdown,
      deductions: riskScoreData.deductions || [],
      character: riskScoreData.character,
      capacity: riskScoreData.capacity,
      capital: riskScoreData.capital,
      collateral: riskScoreData.collateral,
      conditions: riskScoreData.conditions,
      recommendation: riskScoreData.recommendation,
      recommendationReason: riskScoreData.recommendationReason,
    };

    let updatedRiskScore;
    if (riskRecord) {
      updatedRiskScore = await prisma.riskScore.update({
        where: { applicationId: id },
        data: riskPayload,
      });
    } else {
      updatedRiskScore = await prisma.riskScore.create({
        data: { applicationId: id, ...riskPayload },
      });
    }

    // Restore application status from recalculated score
    const autoApprove = settings?.autoApprovalScore ?? 75;
    const autoReject = settings?.autoRejectScore ?? 30;
    let newStatus = 'COMPLETED';
    if (riskScoreData.compositeScore >= autoApprove) newStatus = 'APPROVED';
    else if (riskScoreData.compositeScore <= autoReject) newStatus = 'REJECTED';

    await prisma.application.update({
      where: { id },
      data: { aiScore: riskScoreData.compositeScore, status: newStatus },
    });

    console.log(
      '[Override Reset] applicationId:', id,
      '| previousScore:', previousScore,
      '| restoredScore:', riskScoreData.compositeScore
    );

    res.json({
      message: 'Overrides cleared. Financial metrics restored to extracted values.',
      analysis: updatedAnalysis,
      riskScore: updatedRiskScore,
      previousScore,
      newScore: riskScoreData.compositeScore,
    });
  } catch (error) {
    console.error('[Override Reset] Error:', error.message);
    next(error);
  }
};

module.exports = {
  getCompanyAnalysis,
  getAIResearch,
  getRiskScore,
  getCAMReport,
  getCAMPDF,
  applyFinancialOverride,
  resetFinancialOverride,
};
