const prisma = require('../config/database');

/**
 * Get dashboard statistics
 */
const getStats = async (req, res, next) => {
  try {
    // Total applications
    const totalApplications = await prisma.application.count();

    // Applications by status
    const statusCounts = await prisma.application.groupBy({
      by: ['status'],
      _count: true,
    });

    // Applications this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const applicationsThisMonth = await prisma.application.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Approved amount — use aggregate for efficiency (no in-memory reduce)
    const approvedAggregate = await prisma.application.aggregate({
      where: { status: 'APPROVED' },
      _sum: { loanAmount: true },
    });
    const approvedAmount = approvedAggregate._sum.loanAmount || 0;

    // Average processing time (for completed applications)
    const completedApps = await prisma.application.findMany({
      where: {
        status: {
          in: ['APPROVED', 'REJECTED', 'COMPLETED'],
        },
        submittedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        submittedAt: true,
        completedAt: true,
      },
    });

    let avgProcessingTime = 0;
    if (completedApps.length > 0) {
      const totalTime = completedApps.reduce((sum, app) => {
        const diff = app.completedAt - app.submittedAt;
        return sum + diff;
      }, 0);
      avgProcessingTime = Math.round(totalTime / completedApps.length / (1000 * 60 * 60 * 24)); // days
    }

    // Risk distribution
    const riskDistribution = await prisma.riskScore.groupBy({
      by: ['riskLevel'],
      _count: true,
    });

    res.json({
      totalApplications,
      applicationsThisMonth,
      approvedAmount,
      avgProcessingTime,
      statusBreakdown: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      riskDistribution: riskDistribution.reduce((acc, item) => {
        acc[item.riskLevel] = item._count;
        return acc;
      }, {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get chart data
 */
const getCharts = async (req, res, next) => {
  try {
    // Applications trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const applications = await prisma.application.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        createdAt: true,
        status: true,
        loanAmount: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by month
    const monthlyData = {};
    applications.forEach((app) => {
      const monthKey = `${app.createdAt.getFullYear()}-${String(
        app.createdAt.getMonth() + 1
      ).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          count: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          totalAmount: 0,
        };
      }

      monthlyData[monthKey].count += 1;
      monthlyData[monthKey].totalAmount += app.loanAmount;

      if (app.status === 'APPROVED') monthlyData[monthKey].approved += 1;
      else if (app.status === 'REJECTED') monthlyData[monthKey].rejected += 1;
      else monthlyData[monthKey].pending += 1;
    });

    const applicationsTrend = Object.values(monthlyData);

    // Sector distribution
    const sectorData = await prisma.application.groupBy({
      by: ['sector'],
      _count: true,
      _sum: {
        loanAmount: true,
      },
    });

    const sectorDistribution = sectorData.map((item) => ({
      sector: item.sector,
      count: item._count,
      totalAmount: item._sum.loanAmount || 0,
    }));

    // Risk score distribution
    const riskScores = await prisma.riskScore.findMany({
      select: {
        compositeScore: true,
        riskLevel: true,
      },
    });

    // Group into buckets
    const scoreBuckets = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    };

    riskScores.forEach((rs) => {
      const score = rs.compositeScore;
      if (score <= 20) scoreBuckets['0-20']++;
      else if (score <= 40) scoreBuckets['21-40']++;
      else if (score <= 60) scoreBuckets['41-60']++;
      else if (score <= 80) scoreBuckets['61-80']++;
      else scoreBuckets['81-100']++;
    });

    res.json({
      applicationsTrend,
      sectorDistribution,
      riskScoreDistribution: Object.entries(scoreBuckets).map(([range, count]) => ({
        range,
        count,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats,
  getCharts,
};
