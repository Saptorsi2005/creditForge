const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSettings,
  updateSettings,
  resetSettings,
} = require('../controllers/settings.controller');

const router = express.Router();

/**
 * GET /api/settings
 * Get settings
 */
router.get('/', authenticate, getSettings);

/**
 * PUT /api/settings
 * Update settings (Admin only)
 */
router.put(
  '/',
  authenticate,
  authorize('ADMIN'),
  [
    body('revenueWeight').optional().isFloat({ min: 0, max: 1 }),
    body('debtWeight').optional().isFloat({ min: 0, max: 1 }),
    body('litigationWeight').optional().isFloat({ min: 0, max: 1 }),
    body('promoterWeight').optional().isFloat({ min: 0, max: 1 }),
    body('sectorWeight').optional().isFloat({ min: 0, max: 1 }),
    body('highRiskThreshold').optional().isFloat({ min: 0, max: 100 }),
    body('mediumRiskThreshold').optional().isFloat({ min: 0, max: 100 }),
    body('mismatchThreshold').optional().isFloat({ min: 0, max: 100 }),
    body('autoApprovalScore').optional().isFloat({ min: 0, max: 100 }),
    body('autoRejectScore').optional().isFloat({ min: 0, max: 100 }),
    body('baseLendingRate').optional().isFloat({ min: 0, max: 50 }),
    body('maxRiskPremiumCap').optional().isFloat({ min: 0, max: 20 }),
    validate,
  ],
  updateSettings
);

/**
 * POST /api/settings/reset
 * Reset to default settings (Admin only)
 */
router.post('/reset', authenticate, authorize('ADMIN'), resetSettings);

module.exports = router;
