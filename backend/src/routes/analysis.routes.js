const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getCompanyAnalysis,
  getAIResearch,
  getRiskScore,
  getCAMReport,
  getCAMPDF,
  applyFinancialOverride,
  resetFinancialOverride,
} = require('../controllers/analysis.controller');

const router = express.Router();

/**
 * GET /api/applications/:id/company-analysis
 * Get company analysis
 */
router.get('/:id/company-analysis', authenticate, getCompanyAnalysis);

/**
 * GET /api/applications/:id/ai-research
 * Get AI research
 */
router.get('/:id/ai-research', authenticate, getAIResearch);

/**
 * GET /api/applications/:id/risk-score
 * Get risk score
 */
router.get('/:id/risk-score', authenticate, getRiskScore);

/**
 * GET /api/applications/:id/cam-report
 * Get CAM report
 */
router.get('/:id/cam-report', authenticate, getCAMReport);

/**
 * GET /api/applications/:id/cam-report/pdf
 * Download CAM PDF
 */
router.get('/:id/cam-report/pdf', authenticate, getCAMPDF);

/**
 * PUT /api/applications/:id/company-analysis/override
 * Apply financial overrides — Admin and Analyst only
 */
router.put('/:id/company-analysis/override', authenticate, authorize('ADMIN', 'ANALYST'), applyFinancialOverride);

/**
 * DELETE /api/applications/:id/company-analysis/override
 * Reset all financial overrides — Admin and Analyst only
 */
router.delete('/:id/company-analysis/override', authenticate, authorize('ADMIN', 'ANALYST'), resetFinancialOverride);

module.exports = router;
