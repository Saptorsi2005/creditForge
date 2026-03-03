const prisma = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const { upload } = require('../config/multer');
const pdfService = require('../services/pdf.service');
const researchService = require('../services/research.service');
const riskService = require('../services/risk.service');
const camService = require('../services/cam.service');

/**
 * Create new application
 */
const createApplication = async (req, res, next) => {
  try {
    const { companyName, pan, gstin, cin, loanAmount, loanPurpose, sector } = req.body;

    // Generate unique application number — use timestamp suffix to avoid race conditions
    const count = await prisma.application.count();
    const applicationNo = `CRF${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;

    const application = await prisma.application.create({
      data: {
        applicationNo,
        companyName,
        pan,
        gstin: gstin || null,
        cin: cin || null,
        loanAmount: parseFloat(loanAmount),
        loanPurpose,
        sector,
        userId: req.user.id,
        status: 'DRAFT',
      },
    });

    res.status(201).json({
      message: 'Application created successfully',
      application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all applications (with pagination)
 */
const getApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, sector } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (sector) where.sector = sector;

    // VIEWERs only see their own applications; ADMIN and ANALYST see all
    if (req.user.role === 'VIEWER') {
      where.userId = req.user.id;
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          riskScore: { select: { compositeScore: true, riskLevel: true, recommendation: true } },
        },
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single application
 */
const getApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        documents: true,
        companyAnalysis: true,
        aiResearch: true,
        riskScore: true,
        camReport: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Only VIEWER role is blocked from accessing other users' applications
    if (req.user.role === 'VIEWER' && application.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload documents — Phase 2 (Multer Integration, Fully Persistent)
 *
 * Flow:
 * 1. Authenticate (handled by middleware)
 * 2. Enforce role (Admin, Analyst only — handled by route middleware)
 * 3. Upload file via multer
 * 4. Upsert Document record in DB (re-upload replaces, not duplicates)
 * 5. Parse PDF / CSV
 * 6. Update Document.extractedData
 * 7. If financial doc → upsert CompanyAnalysis
 * All inside a transaction
 */
const uploadDocuments = async (req, res, next) => {
  upload.array('documents', 10)(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    try {
      const { id } = req.params;
      const documentType = req.body.documentType || 'OTHER';

      // Verify application exists and user has access
      const application = await prisma.application.findUnique({ where: { id } });
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
      if (req.user.role === 'VIEWER' && application.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Process each file inside a transaction
      const documents = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const file of files) {
          // Step: Extract data from PDF
          let extractedData = null;
          if (file.mimetype === 'application/pdf') {
            try {
              extractedData = await pdfService.processDocument(file.path);
            } catch (pdfErr) {
              console.error('[Upload] PDF extraction error:', pdfErr.message);
            }
          }

          // Step: Upsert Document (re-upload replaces existing same-type doc)
          // Check for existing document of the same type for this application
          const existingDoc = await tx.document.findFirst({
            where: { applicationId: id, documentType },
          });

          let doc;
          if (existingDoc) {
            // Delete old file from disk
            try {
              await fs.unlink(existingDoc.path);
            } catch (_) { /* ignore if file already gone */ }

            doc = await tx.document.update({
              where: { id: existingDoc.id },
              data: {
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: file.path,
                extractedData,
                uploadedAt: new Date(),
              },
            });
          } else {
            doc = await tx.document.create({
              data: {
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: file.path,
                documentType,
                extractedData,
                applicationId: id,
              },
            });
          }

          results.push(doc);

          // Step: If financial document → upsert CompanyAnalysis from extracted data
          const financialTypes = ['FINANCIAL_STATEMENT', 'BALANCE_SHEET', 'PL_STATEMENT'];
          if (financialTypes.includes(documentType) && extractedData?.financialData) {
            const fd = extractedData.financialData;
            console.log('[uploadDocuments] Upserting CompanyAnalysis with fd:', JSON.stringify(fd, null, 2));
            const fdPayload = {
              revenue: fd.revenue ?? null,
              revenueGrowth: fd.revenueGrowth ?? null,
              ebitda: fd.ebitda ?? null,
              ebitdaMargin: fd.ebitdaMargin ?? null,
              netProfit: fd.netProfit ?? null,
              netProfitMargin: fd.netProfitMargin ?? null,
              totalAssets: fd.totalAssets ?? null,
              totalDebt: fd.totalDebt ?? null,
              netWorth: fd.netWorth ?? null,
              debtToEquity: fd.debtToEquity ?? null,
              currentRatio: fd.currentRatio ?? null,
              multiYearRevenue: fd.multiYearRevenue ?? null,
            };
            await tx.companyAnalysis.upsert({
              where: { applicationId: id },
              create: { applicationId: id, ...fdPayload },
              update: fdPayload,
            });
          }
        }

        // Update application status
        await tx.application.update({
          where: { id },
          data: { status: 'DOCUMENTS_UPLOADED' },
        });

        return results;
      });

      res.json({
        message: 'Documents uploaded successfully',
        documents,
      });
    } catch (error) {
      next(error);
    }
  });
};

/**
 * Analyze application — Phase 7 (Full Transactional Pipeline)
 *
 * Steps inside a single Prisma transaction:
 *  1. status = PROCESSING
 *  2. Load documents
 *  3. Run AI research (real news)
 *  4. Upsert AIResearch
 *  5. Build CompanyAnalysis from docs + GST/Bank reconciliation
 *  6. Upsert CompanyAnalysis
 *  7. Load active Settings
 *  8. Calculate risk score
 *  9. Upsert RiskScore
 * 10. Generate CAM report
 * 11. Upsert CamReport
 * 12. Update Application: status, aiScore, completedAt
 *
 * On failure: set status = FAILED (outside transaction)
 */
const analyzeApplication = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Pre-check: application must exist
    const appCheck = await prisma.application.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!appCheck) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (req.user.role === 'VIEWER' && appCheck.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ── Run research OUTSIDE the transaction (external API calls cannot be rolled back) ──
    const aiResearchData = await researchService.analyzeCompany(
      appCheck.companyName,
      appCheck.pan,
      appCheck.documents
    );

    // ── Everything that writes to DB goes inside the transaction ──────────────────────────
    const result = await prisma.$transaction(async (tx) => {

      // Step 1: Mark as PROCESSING
      await tx.application.update({
        where: { id },
        data: { status: 'PROCESSING' },
      });

      // Step 2: Load documents fresh inside tx
      const docs = await tx.document.findMany({ where: { applicationId: id } });

      // Step 3: Upsert AIResearch
      const aiResearchRecord = await tx.aIResearch.upsert({
        where: { applicationId: id },
        create: { applicationId: id, ...aiResearchData },
        update: { ...aiResearchData },
      });

      // Step 4: Build financial data from uploaded documents
      const financialDoc = docs.find(
        (d) => d.documentType === 'FINANCIAL_STATEMENT' ||
          d.documentType === 'BALANCE_SHEET' ||
          d.documentType === 'PL_STATEMENT'
      );
      const gstDoc = docs.find((d) => d.documentType === 'GST_RETURN');
      const bankDoc = docs.find((d) => d.documentType === 'BANK_STATEMENT');

      const fd = financialDoc?.extractedData?.financialData || {};

      // GST-Bank reconciliation
      let gstRevenue = gstDoc?.extractedData?.totalTurnover || null;
      let bankRevenue = bankDoc?.extractedData?.totalCredits || null;
      let revenueMismatch = null;
      let mismatchFlag = false;

      // Load mismatch threshold from settings
      const settings = await tx.settings.findFirst({ where: { isActive: true } });
      const mismatchThreshold = settings?.mismatchThreshold ?? 15;

      if (gstRevenue && bankRevenue && gstRevenue !== 0) {
        revenueMismatch = parseFloat((Math.abs((gstRevenue - bankRevenue) / gstRevenue) * 100).toFixed(2));
        mismatchFlag = revenueMismatch > mismatchThreshold;
      }

      // Step 5: Upsert CompanyAnalysis — use ?? null to preserve 0 values
      console.log('[analyzeApplication] fd from financialDoc:', JSON.stringify(fd, null, 2));
      const caPayload = {
        revenue: fd.revenue ?? null,
        revenueGrowth: fd.revenueGrowth ?? null,
        ebitda: fd.ebitda ?? null,
        ebitdaMargin: fd.ebitdaMargin ?? null,
        netProfit: fd.netProfit ?? null,
        netProfitMargin: fd.netProfitMargin ?? null,
        totalAssets: fd.totalAssets ?? null,
        totalDebt: fd.totalDebt ?? null,
        netWorth: fd.netWorth ?? null,
        debtToEquity: fd.debtToEquity ?? null,
        currentRatio: fd.currentRatio ?? null,
        multiYearRevenue: fd.multiYearRevenue ?? null,
        gstRevenue,
        bankRevenue,
        revenueMismatch,
        mismatchFlag,
      };

      const companyAnalysisRecord = await tx.companyAnalysis.upsert({
        where: { applicationId: id },
        create: { applicationId: id, strengths: [], weaknesses: [], ...caPayload },
        update: caPayload,
      });

      // Step 6: Calculate risk score (uses settings from DB)
      const riskScoreData = await riskService.calculateRiskScore(
        appCheck,
        companyAnalysisRecord,
        aiResearchRecord,
        settings
      );

      // Step 7: Upsert RiskScore
      const riskScoreRecord = await tx.riskScore.upsert({
        where: { applicationId: id },
        create: {
          applicationId: id,
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
        },
        update: {
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
        },
      });

      // Step 8: Generate CAM report
      const camData = await camService.generateCAMReport(
        appCheck,
        companyAnalysisRecord,
        aiResearchRecord,
        riskScoreRecord
      );

      // Step 9: Upsert CamReport
      const camReportRecord = await tx.camReport.upsert({
        where: { applicationId: id },
        create: { applicationId: id, ...camData },
        update: { ...camData, pdfGenerated: false, pdfPath: null }, // re-run invalidates old PDF
      });

      // Step 10: Determine final application status from risk recommendation
      const score = riskScoreData.compositeScore;
      const autoApprove = settings?.autoApprovalScore ?? 75;
      const autoReject = settings?.autoRejectScore ?? 30;

      let finalStatus = 'COMPLETED';
      if (score >= autoApprove) finalStatus = 'APPROVED';
      else if (score <= autoReject) finalStatus = 'REJECTED';

      // Step 11: Update application with final status and score
      const updatedApp = await tx.application.update({
        where: { id },
        data: {
          status: finalStatus,
          aiScore: riskScoreData.compositeScore,
          completedAt: new Date(),
        },
      });

      return {
        application: updatedApp,
        companyAnalysis: companyAnalysisRecord,
        aiResearch: aiResearchRecord,
        riskScore: riskScoreRecord,
        camReport: camReportRecord,
      };
    }); // end $transaction

    res.json({
      message: 'Analysis completed successfully',
      ...result,
    });
  } catch (error) {
    console.error('[Analyze] Pipeline error:', error.message);
    // Set FAILED status outside transaction (transaction already rolled back)
    try {
      await prisma.application.update({
        where: { id },
        data: { status: 'FAILED' },
      });
    } catch (_) { /* best-effort */ }
    next(error);
  }
};

/**
 * Get application status — reads from DB, access-controlled
 */
const getStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        applicationNo: true,
        status: true,
        aiScore: true,
        userId: true,  // ← Required for access control check
        submittedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Access control: non-Admins can only see their own applications
    if (req.user.role !== 'ADMIN' && application.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't leak userId in response
    const { userId, ...statusData } = application;
    res.json({ status: statusData });
  } catch (error) {
    next(error);
  }
};

/**
 * Re-run analysis for an existing application
 *
 * POST /applications/:id/rerun-analysis
 * - Finds the application and its documents
 * - Re-runs the full pipeline (research → financial → risk → CAM)
 * - Updates existing records via prisma.update (NOT create) to avoid duplicates
 * - Wrapped in a transaction for safety
 * - Returns 400 if analysis does not yet exist
 */
const rerunAnalysis = async (req, res, next) => {
  const { id } = req.params;

  try {
    console.log('[RerunAnalysis] Starting for application:', id);

    // Pre-check: application must exist with documents
    const appCheck = await prisma.application.findUnique({
      where: { id },
      include: { documents: true, companyAnalysis: true },
    });

    if (!appCheck) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (req.user.role === 'VIEWER' && appCheck.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!appCheck.companyAnalysis) {
      return res.status(400).json({
        error: 'No existing analysis found. Please run the initial analysis first.',
      });
    }

    // Capture existing overrides BEFORE transaction so they are
    // preserved after fresh extraction (overrides survive re-runs)
    const existingFinancialOverrides = appCheck.companyAnalysis.financialOverrides ?? null;
    console.log('[RerunAnalysis] Existing financialOverrides will be preserved:', !!existingFinancialOverrides);

    // Run AI research OUTSIDE the transaction (external API, cannot be rolled back)
    console.log('[RerunAnalysis] Running AI research...');
    const aiResearchData = await researchService.analyzeCompany(
      appCheck.companyName,
      appCheck.pan,
      appCheck.documents
    );

    // Everything that writes to DB goes inside the transaction
    const result = await prisma.$transaction(async (tx) => {

      // Mark as PROCESSING
      await tx.application.update({
        where: { id },
        data: { status: 'PROCESSING' },
      });

      // Load documents fresh inside tx
      const docs = await tx.document.findMany({ where: { applicationId: id } });

      // Update AIResearch (NOT upsert — record must already exist from initial run)
      const existingResearch = await tx.aIResearch.findUnique({ where: { applicationId: id } });
      let aiResearchRecord;
      if (existingResearch) {
        aiResearchRecord = await tx.aIResearch.update({
          where: { applicationId: id },
          data: { ...aiResearchData },
        });
      } else {
        // Fallback: create if somehow missing
        aiResearchRecord = await tx.aIResearch.create({
          data: { applicationId: id, ...aiResearchData },
        });
      }
      console.log('[RerunAnalysis] AIResearch updated');

      // Build financial data from uploaded documents
      const financialDoc = docs.find(
        (d) => d.documentType === 'FINANCIAL_STATEMENT' ||
          d.documentType === 'BALANCE_SHEET' ||
          d.documentType === 'PL_STATEMENT'
      );
      const gstDoc = docs.find((d) => d.documentType === 'GST_RETURN');
      const bankDoc = docs.find((d) => d.documentType === 'BANK_STATEMENT');

      const fd = financialDoc?.extractedData?.financialData || {};

      // GST-Bank reconciliation
      let gstRevenue = gstDoc?.extractedData?.totalTurnover || null;
      let bankRevenue = bankDoc?.extractedData?.totalCredits || null;
      let revenueMismatch = null;
      let mismatchFlag = false;

      const settings = await tx.settings.findFirst({ where: { isActive: true } });
      const mismatchThreshold = settings?.mismatchThreshold ?? 15;

      if (gstRevenue && bankRevenue && gstRevenue !== 0) {
        revenueMismatch = parseFloat(
          (Math.abs((gstRevenue - bankRevenue) / gstRevenue) * 100).toFixed(2)
        );
        mismatchFlag = revenueMismatch > mismatchThreshold;
      }

      // Update CompanyAnalysis — use override-priority values for derived metrics
      // and always preserve existing financialOverrides (they must survive re-runs)
      const overrides = existingFinancialOverrides || {};
      const ov = (key, fallback) => (overrides[key] !== undefined ? overrides[key] : (fallback ?? null));

      // Fresh extracted raw values
      const freshRevenue = fd.revenue ?? null;
      const freshEbitda = fd.ebitda ?? null;
      const freshNetProfit = fd.netProfit ?? null;
      const freshTotalDebt = fd.totalDebt ?? null;
      const freshNetWorth = fd.netWorth ?? null;

      // Effective values = override ?? fresh extracted
      const effRevenue = ov('revenue', freshRevenue);
      const effEbitda = ov('ebitda', freshEbitda);
      const effNetProfit = ov('netProfit', freshNetProfit);
      const effTotalDebt = ov('totalDebt', freshTotalDebt);
      const effNetWorth = ov('netWorth', freshNetWorth);
      const effCurrAssets = ov('currentAssets', fd.totalAssets ?? null);
      const effCurrLiab = ov('currentLiabilities', fd.totalLiabilities ?? null);

      const effEbitdaMargin = (effRevenue && effRevenue !== 0 && effEbitda !== null)
        ? parseFloat(((effEbitda / effRevenue) * 100).toFixed(2))
        : (fd.ebitdaMargin ?? null);

      const effNetProfitMargin = (effRevenue && effRevenue !== 0 && effNetProfit !== null)
        ? parseFloat(((effNetProfit / effRevenue) * 100).toFixed(2))
        : (fd.netProfitMargin ?? null);

      const effDebtToEquity = (effTotalDebt !== null && effNetWorth && effNetWorth !== 0)
        ? parseFloat((effTotalDebt / effNetWorth).toFixed(4))
        : (fd.debtToEquity ?? null);

      const effCurrentRatio = (effCurrAssets !== null && effCurrLiab && effCurrLiab !== 0)
        ? parseFloat((effCurrAssets / effCurrLiab).toFixed(4))
        : (fd.currentRatio ?? null);

      const caPayload = {
        // Raw extracted columns — always updated with fresh data
        revenue: freshRevenue,
        revenueGrowth: fd.revenueGrowth ?? null,
        ebitda: freshEbitda,
        netProfit: freshNetProfit,
        totalAssets: fd.totalAssets ?? null,
        totalDebt: freshTotalDebt,
        netWorth: freshNetWorth,
        multiYearRevenue: fd.multiYearRevenue ?? null,
        gstRevenue,
        bankRevenue,
        revenueMismatch,
        mismatchFlag,
        // Derived metrics recomputed with override-priority
        ebitdaMargin: effEbitdaMargin,
        netProfitMargin: effNetProfitMargin,
        debtToEquity: effDebtToEquity,
        currentRatio: effCurrentRatio,
        // CRITICAL: preserve existing overrides — never clear on re-run
        financialOverrides: existingFinancialOverrides,
      };


      const companyAnalysisRecord = await tx.companyAnalysis.update({
        where: { applicationId: id },
        data: caPayload,
      });
      console.log('[RerunAnalysis] CompanyAnalysis updated (overrides preserved:', !!existingFinancialOverrides, ')');

      // Use override-priority merged view for risk scoring
      const mergedForRisk = {
        ...companyAnalysisRecord,
        revenue: effRevenue,
        ebitda: effEbitda,
        netProfit: effNetProfit,
        totalDebt: effTotalDebt,
        netWorth: effNetWorth,
        ebitdaMargin: effEbitdaMargin,
        netProfitMargin: effNetProfitMargin,
        debtToEquity: effDebtToEquity,
        currentRatio: effCurrentRatio,
      };

      // Recalculate risk score using merged financial view
      const riskScoreData = await riskService.calculateRiskScore(
        appCheck,
        mergedForRisk,
        aiResearchRecord,
        settings
      );

      // Update RiskScore (NOT create)
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

      const existingRisk = await tx.riskScore.findUnique({ where: { applicationId: id } });
      let riskScoreRecord;
      if (existingRisk) {
        riskScoreRecord = await tx.riskScore.update({
          where: { applicationId: id },
          data: riskPayload,
        });
      } else {
        riskScoreRecord = await tx.riskScore.create({
          data: { applicationId: id, ...riskPayload },
        });
      }
      console.log('[RerunAnalysis] RiskScore updated, compositeScore:', riskScoreData.compositeScore);

      // Regenerate CAM report
      const camData = await camService.generateCAMReport(
        appCheck,
        companyAnalysisRecord,
        aiResearchRecord,
        riskScoreRecord
      );

      const existingCam = await tx.camReport.findUnique({ where: { applicationId: id } });
      let camReportRecord;
      if (existingCam) {
        camReportRecord = await tx.camReport.update({
          where: { applicationId: id },
          data: { ...camData, pdfGenerated: false, pdfPath: null },
        });
      } else {
        camReportRecord = await tx.camReport.create({
          data: { applicationId: id, ...camData },
        });
      }
      console.log('[RerunAnalysis] CamReport updated');

      // Determine final status from score
      const score = riskScoreData.compositeScore;
      const autoApprove = settings?.autoApprovalScore ?? 75;
      const autoReject = settings?.autoRejectScore ?? 30;

      let finalStatus = 'COMPLETED';
      if (score >= autoApprove) finalStatus = 'APPROVED';
      else if (score <= autoReject) finalStatus = 'REJECTED';

      const updatedApp = await tx.application.update({
        where: { id },
        data: {
          status: finalStatus,
          aiScore: riskScoreData.compositeScore,
          completedAt: new Date(),
        },
      });

      console.log('[RerunAnalysis] Done. finalStatus:', finalStatus, 'aiScore:', riskScoreData.compositeScore);

      return {
        application: updatedApp,
        companyAnalysis: companyAnalysisRecord,
        aiResearch: aiResearchRecord,
        riskScore: riskScoreRecord,
        camReport: camReportRecord,
      };
    }); // end $transaction

    res.json({
      message: 'Re-run analysis completed successfully',
      ...result,
    });
  } catch (error) {
    console.error('[RerunAnalysis] Error:', error.message);
    // Best-effort: restore a non-PROCESSING status
    try {
      await prisma.application.update({
        where: { id },
        data: { status: 'FAILED' },
      });
    } catch (_) { /* ignore */ }
    next(error);
  }
};

module.exports = {
  createApplication,
  getApplications,
  getApplication,
  uploadDocuments,
  analyzeApplication,
  rerunAnalysis,
  getStatus,
};
