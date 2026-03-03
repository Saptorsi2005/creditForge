const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getStats, getCharts } = require('../controllers/dashboard.controller');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get('/stats', authenticate, getStats);

/**
 * GET /api/dashboard/charts
 * Get chart data
 */
router.get('/charts', authenticate, getCharts);

module.exports = router;
