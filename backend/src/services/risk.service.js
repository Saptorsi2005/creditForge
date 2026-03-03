/**
 * Risk Scoring Engine
 * Calculates composite risk score based on multiple factors with explainability
 */
class RiskService {
  constructor() {
    // Default weights (can be overridden by settings)
    this.defaultWeights = {
      revenueWeight: 0.25,
      debtWeight: 0.20,
      litigationWeight: 0.20,
      promoterWeight: 0.15,
      sectorWeight: 0.20,
    };
  }

  /**
   * Calculate comprehensive risk score
   */
  async calculateRiskScore(application, companyAnalysis, aiResearch, settings = null) {
    // Get weights from settings or use defaults
    const weights = settings ? {
      revenueWeight: settings.revenueWeight,
      debtWeight: settings.debtWeight,
      litigationWeight: settings.litigationWeight,
      promoterWeight: settings.promoterWeight,
      sectorWeight: settings.sectorWeight,
    } : this.defaultWeights;

    // Calculate individual factor scores (0-100, higher is better)
    const revenueStability = this.calculateRevenueStability(companyAnalysis);
    const debtRatio = this.calculateDebtScore(companyAnalysis);
    const litigationScore = this.calculateLitigationScore(aiResearch);
    const promoterScore = this.calculatePromoterScore(aiResearch, companyAnalysis);
    const sectorScore = this.calculateSectorScore(application.sector, settings?.sectorRiskConfig);

    // Calculate composite score
    const compositeScore = (
      (revenueStability * weights.revenueWeight) +
      (debtRatio * weights.debtWeight) +
      (litigationScore * weights.litigationWeight) +
      (promoterScore * weights.promoterWeight) +
      (sectorScore * weights.sectorWeight)
    );

    // Determine risk level
    const riskLevel = this.getRiskLevel(compositeScore, settings);

    // Calculate Five C's of Credit
    const fiveCs = this.calculateFiveCs(application, companyAnalysis, aiResearch, settings?.sectorRiskConfig);

    // Generate factor breakdown
    const factorBreakdown = this.generateFactorBreakdown({
      revenueStability,
      debtRatio,
      litigationScore,
      promoterScore,
      sectorScore,
    }, weights);

    // Identify deductions
    const deductions = this.identifyDeductions(companyAnalysis, aiResearch);

    // Generate recommendation
    const { recommendation, reason } = this.generateRecommendation(
      compositeScore,
      riskLevel,
      deductions,
      settings
    );

    return {
      compositeScore: parseFloat(compositeScore.toFixed(2)),
      riskLevel,
      revenueStability: parseFloat(revenueStability.toFixed(2)),
      debtRatio: parseFloat(debtRatio.toFixed(2)),
      litigationScore: parseFloat(litigationScore.toFixed(2)),
      promoterScore: parseFloat(promoterScore.toFixed(2)),
      sectorScore: parseFloat(sectorScore.toFixed(2)),
      weights,
      factorBreakdown,
      deductions,
      character: fiveCs.character,
      capacity: fiveCs.capacity,
      capital: fiveCs.capital,
      collateral: fiveCs.collateral,
      conditions: fiveCs.conditions,
      recommendation,
      recommendationReason: reason,
    };
  }

  /**
   * Calculate revenue stability score (0-100)
   */
  calculateRevenueStability(companyAnalysis) {
    if (!companyAnalysis) return 50;

    let score = 70; // Base score

    // Revenue growth bonus/penalty
    if (companyAnalysis.revenueGrowth) {
      if (companyAnalysis.revenueGrowth > 20) score += 15;
      else if (companyAnalysis.revenueGrowth > 10) score += 10;
      else if (companyAnalysis.revenueGrowth > 5) score += 5;
      else if (companyAnalysis.revenueGrowth < -10) score -= 20;
      else if (companyAnalysis.revenueGrowth < 0) score -= 10;
    }

    // Profitability
    if (companyAnalysis.ebitdaMargin) {
      if (companyAnalysis.ebitdaMargin > 20) score += 10;
      else if (companyAnalysis.ebitdaMargin > 10) score += 5;
      else if (companyAnalysis.ebitdaMargin < 5) score -= 10;
    }

    // GST-Bank mismatch penalty
    if (companyAnalysis.mismatchFlag) {
      score -= 25;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate debt score (0-100)
   */
  calculateDebtScore(companyAnalysis) {
    if (!companyAnalysis) return 50;

    let score = 70;

    // Debt to Equity ratio
    if (companyAnalysis.debtToEquity) {
      const de = parseFloat(companyAnalysis.debtToEquity);
      if (de < 0.5) score += 20;
      else if (de < 1.0) score += 10;
      else if (de < 1.5) score += 0;
      else if (de < 2.0) score -= 10;
      else if (de < 3.0) score -= 20;
      else score -= 30;
    }

    // Current ratio
    if (companyAnalysis.currentRatio) {
      const cr = parseFloat(companyAnalysis.currentRatio);
      if (cr > 2.0) score += 10;
      else if (cr > 1.5) score += 5;
      else if (cr < 1.0) score -= 15;
    }

    // Interest coverage
    if (companyAnalysis.interestCoverage) {
      if (companyAnalysis.interestCoverage > 3) score += 10;
      else if (companyAnalysis.interestCoverage < 1.5) score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate litigation score (0-100)
   */
  calculateLitigationScore(aiResearch) {
    if (!aiResearch) return 80;

    let score = 90;

    // Litigation penalty
    if (aiResearch.litigationCount > 0) {
      score -= aiResearch.litigationCount * 10;
    }

    // Regulatory issues
    if (aiResearch.regulatoryIssues > 0) {
      score -= aiResearch.regulatoryIssues * 8;
    }

    // Red flags
    if (aiResearch.redFlags && Array.isArray(aiResearch.redFlags)) {
      const criticalFlags = aiResearch.redFlags.filter(f => f.severity === 'CRITICAL').length;
      const highFlags = aiResearch.redFlags.filter(f => f.severity === 'HIGH').length;
      score -= (criticalFlags * 15 + highFlags * 8);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate promoter/director score (0-100)
   */
  calculatePromoterScore(aiResearch, companyAnalysis) {
    if (!aiResearch) return 80;

    let score = 85;

    // Director issues
    if (aiResearch.directorIssues > 0) {
      score -= aiResearch.directorIssues * 12;
    }

    // Sentiment penalty
    if (aiResearch.sentimentScore) {
      if (aiResearch.sentimentScore < -0.5) score -= 20;
      else if (aiResearch.sentimentScore < -0.2) score -= 10;
      else if (aiResearch.sentimentScore > 0.5) score += 10;
    }

    // Management quality from company analysis
    if (companyAnalysis?.managementQuality === 'EXCELLENT') score += 10;
    else if (companyAnalysis?.managementQuality === 'POOR') score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate sector score (0-100)
   * Uses sectorRiskConfig from Settings if provided, otherwise falls back to safe defaults.
   */
  calculateSectorScore(sector, sectorRiskConfig = null) {
    // Default sector risk map (used when Settings not available)
    const defaultMap = {
      'Technology': 85,
      'Healthcare': 80,
      'FMCG': 80,
      'Manufacturing': 75,
      'Services': 75,
      'Retail': 70,
      'Real Estate': 60,
      'Construction': 65,
      'Textiles': 70,
      'Metals': 65,
      'Aviation': 55,
      'Hospitality': 60,
    };

    const configMap = sectorRiskConfig || {};
    // Merge DB config over defaults so admins can override any sector
    const effectiveMap = { ...defaultMap, ...configMap };
    return effectiveMap[sector] ?? 70;
  }

  /**
   * Determine risk level based on composite score
   */
  getRiskLevel(score, settings) {
    const highThreshold = settings?.highRiskThreshold || 60;
    const mediumThreshold = settings?.mediumRiskThreshold || 40;

    if (score >= 75) return 'VERY_LOW';
    if (score >= highThreshold) return 'LOW';
    if (score >= mediumThreshold) return 'MEDIUM';
    if (score >= 25) return 'HIGH';
    return 'VERY_HIGH';
  }

  /**
   * Calculate Five C's of Credit
   */
  calculateFiveCs(application, companyAnalysis, aiResearch) {
    // Character - willingness to repay
    let character = 80;
    if (aiResearch?.directorIssues > 0) character -= 20;
    if (aiResearch?.litigationCount > 2) character -= 15;

    // Capacity - ability to repay
    let capacity = 75;
    if (companyAnalysis?.ebitdaMargin > 15) capacity += 15;
    else if (companyAnalysis?.ebitdaMargin < 5) capacity -= 20;

    // Capital - financial strength
    let capital = 70;
    if (companyAnalysis?.netWorth > 50000000) capital += 20;
    if (companyAnalysis?.debtToEquity && companyAnalysis.debtToEquity < 1) capital += 10;

    // Collateral - assets backing the loan
    let collateral = 65;
    if (companyAnalysis?.totalAssets > 100000000) collateral += 25;

    // Conditions - economic and industry conditions
    let conditions = this.calculateSectorScore(application.sector);

    return {
      character: Math.max(0, Math.min(100, character)),
      capacity: Math.max(0, Math.min(100, capacity)),
      capital: Math.max(0, Math.min(100, capital)),
      collateral: Math.max(0, Math.min(100, collateral)),
      conditions: Math.max(0, Math.min(100, conditions)),
    };
  }

  /**
   * Generate factor breakdown with explanations
   */
  generateFactorBreakdown(scores, weights) {
    return [
      {
        factor: 'Revenue Stability',
        score: scores.revenueStability,
        weight: weights.revenueWeight,
        contribution: scores.revenueStability * weights.revenueWeight,
        impact: this.getImpactLabel(scores.revenueStability),
      },
      {
        factor: 'Debt Management',
        score: scores.debtRatio,
        weight: weights.debtWeight,
        contribution: scores.debtRatio * weights.debtWeight,
        impact: this.getImpactLabel(scores.debtRatio),
      },
      {
        factor: 'Litigation & Compliance',
        score: scores.litigationScore,
        weight: weights.litigationWeight,
        contribution: scores.litigationScore * weights.litigationWeight,
        impact: this.getImpactLabel(scores.litigationScore),
      },
      {
        factor: 'Promoter Quality',
        score: scores.promoterScore,
        weight: weights.promoterWeight,
        contribution: scores.promoterScore * weights.promoterWeight,
        impact: this.getImpactLabel(scores.promoterScore),
      },
      {
        factor: 'Sector Risk',
        score: scores.sectorScore,
        weight: weights.sectorWeight,
        contribution: scores.sectorScore * weights.sectorWeight,
        impact: this.getImpactLabel(scores.sectorScore),
      },
    ];
  }

  /**
   * Get impact label based on score
   */
  getImpactLabel(score) {
    if (score >= 80) return 'VERY_POSITIVE';
    if (score >= 60) return 'POSITIVE';
    if (score >= 40) return 'NEUTRAL';
    if (score >= 25) return 'NEGATIVE';
    return 'VERY_NEGATIVE';
  }

  /**
   * Identify deductions from ideal score
   */
  identifyDeductions(companyAnalysis, aiResearch) {
    const deductions = [];

    if (companyAnalysis?.mismatchFlag) {
      deductions.push({
        factor: 'GST-Bank Mismatch',
        points: 25,
        reason: `Revenue mismatch of ${companyAnalysis.revenueMismatch?.toFixed(2)}% detected`,
      });
    }

    if (companyAnalysis?.debtToEquity && companyAnalysis.debtToEquity > 2) {
      deductions.push({
        factor: 'High Debt-to-Equity Ratio',
        points: 20,
        reason: `D/E ratio of ${companyAnalysis.debtToEquity} exceeds safe threshold`,
      });
    }

    if (aiResearch?.litigationCount > 0) {
      deductions.push({
        factor: 'Ongoing Litigation',
        points: aiResearch.litigationCount * 10,
        reason: `${aiResearch.litigationCount} active litigation case(s)`,
      });
    }

    if (aiResearch?.regulatoryIssues > 0) {
      deductions.push({
        factor: 'Regulatory Issues',
        points: aiResearch.regulatoryIssues * 8,
        reason: `${aiResearch.regulatoryIssues} regulatory concern(s)`,
      });
    }

    if (aiResearch?.sentimentScore && aiResearch.sentimentScore < -0.3) {
      deductions.push({
        factor: 'Negative Market Sentiment',
        points: 15,
        reason: 'Predominantly negative news and reports',
      });
    }

    return deductions;
  }

  /**
   * Generate recommendation
   */
  generateRecommendation(score, riskLevel, deductions, settings) {
    const autoApprove = settings?.autoApprovalScore || 75;
    const autoReject = settings?.autoRejectScore || 30;

    let recommendation = 'CONDITIONAL';
    let reason = '';

    if (score >= autoApprove) {
      recommendation = 'APPROVE';
      reason = `Strong credit profile with composite score of ${score.toFixed(2)}. All key metrics within acceptable range.`;
    } else if (score <= autoReject) {
      recommendation = 'REJECT';
      reason = `High risk profile with composite score of ${score.toFixed(2)}. `;
      if (deductions.length > 0) {
        reason += `Major concerns: ${deductions.slice(0, 2).map(d => d.factor).join(', ')}.`;
      }
    } else {
      recommendation = 'CONDITIONAL';
      reason = `Moderate risk profile with score of ${score.toFixed(2)}. `;
      if (deductions.length > 0) {
        reason += `Recommend approval with conditions to mitigate: ${deductions.slice(0, 2).map(d => d.factor).join(', ')}.`;
      } else {
        reason += 'Recommend approval with standard monitoring.';
      }
    }

    return { recommendation, reason };
  }
}

module.exports = new RiskService();
