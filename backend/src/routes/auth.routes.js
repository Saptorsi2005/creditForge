const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { register, login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register new user
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').optional().isIn(['ADMIN', 'ANALYST', 'VIEWER']),
    validate,
  ],
  register
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  login
);

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authenticate, me);

module.exports = router;
