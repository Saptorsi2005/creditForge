const express = require('express');
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createApplication,
  getApplications,
  getApplication,
  uploadDocuments,
  analyzeApplication,
  rerunAnalysis,
  getStatus,
} = require('../controllers/application.controller');

const router = express.Router();

/**
 * POST /api/applications
 * Create new application
 */
router.post(
  '/',
  authenticate,
  [
    body('companyName').notEmpty().withMessage('Company name is required'),
    body('pan')
      .notEmpty()
      .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
      .withMessage('Valid PAN is required'),
    body('loanAmount')
      .isNumeric()
      .withMessage('Loan amount must be a number')
      .isFloat({ min: 100000 })
      .withMessage('Minimum loan amount is ₹1 lakh'),
    body('loanPurpose').notEmpty().withMessage('Loan purpose is required'),
    body('sector').notEmpty().withMessage('Sector is required'),
    validate,
  ],
  createApplication
);

/**
 * GET /api/applications
 * Get all applications (paginated)
 */
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  getApplications
);

/**
 * GET /api/applications/:id
 * Get single application
 */
router.get('/:id', authenticate, getApplication);

/**
 * POST /api/applications/:id/documents
 * Upload documents — Admin and Analyst only
 */
router.post('/:id/documents', authenticate, authorize('ADMIN', 'ANALYST'), uploadDocuments);

/**
 * POST /api/applications/:id/analyze
 * Analyze application — Admin and Analyst only
 */
router.post('/:id/analyze', authenticate, authorize('ADMIN', 'ANALYST'), analyzeApplication);

/**
 * POST /api/applications/:id/rerun-analysis
 * Re-run analysis for an existing application — Admin and Analyst only
 */
router.post('/:id/rerun-analysis', authenticate, authorize('ADMIN', 'ANALYST'), rerunAnalysis);

/**
 * GET /api/applications/:id/status
 * Get application status
 */
router.get('/:id/status', authenticate, getStatus);

module.exports = router;
