const prisma = require('../config/database');

/**
 * Get dashboard statistics
 */
const getStats = async (req, res, next) => {
  try {
    // Total applications
    const totalApplications = await prisma.application.count();

    // Applications by status — Prisma groupBy _count returns { _all: N }
    const statusCounts = await prisma.application.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    // Build statusBreakdown map AND derive individual counts for the frontend
    const statusBreakdown = {};
    statusCounts.forEach((item) => {
      statusBreakdown[item.status] = item._count._all;
    });

    // Friendly aliases the frontend KPI cards read directly
    const approved = statusBreakdown['APPROVED'] || 0;
    const rejected = statusBreakdown['REJECTED'] || 0;
    const underReview = (statusBreakdown['UNDER_REVIEW'] || 0)
      + (statusBreakdown['SUBMITTED'] || 0)
      + (statusBreakdown['ANALYZING'] || 0)
      + (statusBreakdown['PROCESSING'] || 0);

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

    // Approved amount — use aggregate for efficiency
    const approvedAggregate = await prisma.application.aggregate({
      where: { status: 'APPROVED' },
      _sum: { loanAmount: true },
    });
    const approvedAmount = approvedAggregate._sum.loanAmount || 0;

    // Average processing time (for completed applications)
    const completedApps = await prisma.application.findMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED', 'COMPLETED'] },
        submittedAt: { not: null },
        completedAt: { not: null },
      },
      select: { submittedAt: true, completedAt: true },
    });

    let avgProcessingTime = 0;
    if (completedApps.length > 0) {
      const totalTime = completedApps.reduce((sum, app) => {
        return sum + (app.completedAt - app.submittedAt);
      }, 0);
      avgProcessingTime = Math.round(totalTime / completedApps.length / (1000 * 60 * 60 * 24));
    }

    // Risk distribution — classify by compositeScore, not riskLevel enum
    // >= 80 → LOW,  60–79 → MEDIUM,  < 60 → HIGH
    // Only count risk scores for existing applications
    const allRiskScores = await prisma.riskScore.findMany({
      select: {
        compositeScore: true,
        application: {
          select: { id: true },
        },
      },
    });

    const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    allRiskScores
      .filter((rs) => rs.application) // Only count if application exists
      .forEach(({ compositeScore }) => {
        if (compositeScore >= 80) riskDistribution.LOW++;
        else if (compositeScore >= 60) riskDistribution.MEDIUM++;
        else riskDistribution.HIGH++;
      });

    // Debug logs — safe to keep, minimal overhead
    console.log('[Dashboard Stats] totalApplications:', totalApplications,
      '| approved:', approved, '| rejected:', rejected, '| underReview:', underReview);
    console.log('[Dashboard Stats] riskDistribution:', riskDistribution);
    console.log('[Dashboard Stats] statusBreakdown:', statusBreakdown);

    res.json({
      totalApplications,
      applicationsThisMonth,
      approvedAmount,
      avgProcessingTime,
      approved,
      rejected,
      underReview,
      statusBreakdown,
      riskDistribution,
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

    // Sector distribution — _count._all for Prisma v5 groupBy
    const sectorData = await prisma.application.groupBy({
      by: ['sector'],
      _count: { _all: true },
      _sum: { loanAmount: true },
    });

    // Key name matches what Dashboard.jsx reads: charts.applicationsBySector
    const applicationsBySector = sectorData.map((item) => ({
      sector: item.sector,
      count: item._count._all,
      totalAmount: item._sum.loanAmount || 0,
    }));

    // Risk score distribution buckets
    const riskScores = await prisma.riskScore.findMany({
      select: { compositeScore: true },
    });

    const scoreBuckets = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    };

    riskScores.forEach(({ compositeScore }) => {
      if (compositeScore <= 20) scoreBuckets['0-20']++;
      else if (compositeScore <= 40) scoreBuckets['21-40']++;
      else if (compositeScore <= 60) scoreBuckets['41-60']++;
      else if (compositeScore <= 80) scoreBuckets['61-80']++;
      else scoreBuckets['81-100']++;
    });

    console.log('[Dashboard Charts] applicationsBySector:', applicationsBySector);

    res.json({
      applicationsTrend,
      applicationsBySector,
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
