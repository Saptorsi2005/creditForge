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

    // ── Qualitative Notes Signal Taxonomy ─────────────────────────────────────
    // HIGH_RISK signals: indicate serious operational distress
    this.qualitativeHighRiskPatterns = [
      /\b(\d{1,2}|[1-3]\d)\s*%?\s*(capacity|utiliz)\b/i,  // X% capacity (low, e.g. 40% capacity)
      /\boperating at\s*(low|minimal|\d{1,2}%)\b/i,
      /\bidle\s*(plant|factory|production|machinery|unit)\b/i,
      /\b(production|plant|factory|manufacturing)\s*(halt|shutdown|stopped|closed|suspended)\b/i,
      /\bworker\s*(strike|walkout|stoppage|shortage|unrest)\b/i,
      /\bfinancial\s*(stress|distress|crisis|strain)\b/i,
      /\b(supply\s*chain|supply)\s*(disruption|crisis|breakdown)\b/i,
      /\blabour\s*(shortage|dispute|unrest)\b/i,
      /\bmachinery\s*(breakdown|failure|seized)\b/i,
      /\bno\s*(orders|demand|customers|revenue)\b/i,
      /\bcash\s*(crunch|flow problem)\b/i,
    ];

    // MODERATE_RISK signals: temporary or transitional issues
    this.qualitativeModerateRiskPatterns = [
      /\b(expansion|construction|renovation)\s*(under|in\s*progress|ongoing)\b/i,
      /\bunder\s*construction\b/i,
      /\btemporary\s*(slowdown|dip|decline|closure)\b/i,
      /\bmachine\s*(upgrade|update|replacement)\b/i,
      /\bstaffing\s*(issue|challenge|change)\b/i,
      /\bcapacity\s*ramp/i,
      /\bnew\s*management\b/i,
      /\bmanagement\s*(change|transition)\b/i,
      /\bregulatory\s*(approval|clearance|pending)\b/i,
    ];

  }

  // ── Qualitative NLP Analyser ──────────────────────────────────────────────────

  /**
   * Semantically analyse credit officer field notes and derive:
   * - A numeric risk score adjustment (positive = worse, negative = better)
   * - A human-readable explanation for CAM reports
   *
   * @param {string|null} notes - Raw qualitative notes text
   * @returns {{ adjustment: number, label: string, explanation: string }}
   */
  analyzeQualitativeNotes(notes) {
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return { adjustment: 0, label: 'NO_NOTES', explanation: null };
    }

    const text = notes.trim().toLowerCase();
    let highRiskHits = 0;
    let moderateRiskHits = 0;
    const foundSignals = [];

    for (const pattern of this.qualitativeHighRiskPatterns) {
      if (pattern.test(text)) {
        highRiskHits++;
        const match = text.match(pattern);
        if (match) foundSignals.push({ type: 'HIGH_RISK', excerpt: match[0] });
      }
    }
    for (const pattern of this.qualitativeModerateRiskPatterns) {
      if (pattern.test(text)) {
        moderateRiskHits++;
        const match = text.match(pattern);
        if (match) foundSignals.push({ type: 'MODERATE', excerpt: match[0] });
      }
    }

    let adjustment = -2; // Default penalty for having qualitative notes
    let label = 'NEUTRAL_RISK';
    let explanation = '';

    if (highRiskHits > 0) {
      // -8 per high-risk signal, capped at -15  (LOWERS score → higher risk)
      adjustment = Math.max(-15, -(highRiskHits * 8));
      label = 'HIGH_RISK';
      explanation = `Primary Insight Analysis detected ${highRiskHits} operational risk signal(s) in field notes: ` +
        `${foundSignals.filter(s => s.type === 'HIGH_RISK').map(s => `"${s.excerpt}"`).join(', ')}. ` +
        `This indicates potential operational underutilization or distress. Risk Adjustment: ${adjustment} points (score reduced).`;
    } else if (moderateRiskHits > 0) {
      // -3 per moderate signal, capped at -7  (LOWERS score → moderate concern)
      adjustment = Math.max(-7, -(moderateRiskHits * 3));
      label = 'MODERATE_RISK';
      explanation = `Primary Insight Analysis detected ${moderateRiskHits} moderate risk indicator(s): ` +
        `${foundSignals.filter(s => s.type === 'MODERATE').map(s => `"${s.excerpt}"`).join(', ')}. ` +
        `These represent transitional or temporary operational changes. Risk Adjustment: ${adjustment} points (score reduced).`;
    } else {
      // Notes exist but no specific signals found
      label = 'NEUTRAL_RISK';
      explanation = `Primary Insight Analysis: Credit officer field notes present. Standard qualitative risk deduction applied. Risk Adjustment: -2 points (score reduced).`;
    }

    console.log(`[RiskService] Qualitative NLP: label=${label}, adjustment=${adjustment}, highRisk=${highRiskHits}, moderate=${moderateRiskHits}`);
    return { adjustment, label, explanation, signals: foundSignals };
  }

  /**
   * Calculate comprehensive risk score
   * @param {*} application - Application record (includes qualitativeNotes)
   * @param {*} companyAnalysis
   * @param {*} aiResearch
   * @param {*} settings
   * @param {string|null} qualitativeNotes - Optional credit officer field notes
   */
  async calculateRiskScore(application, companyAnalysis, aiResearch, settings = null, qualitativeNotes = null) {
    // Get weights from settings or use defaults
    const weights = settings ? {
      revenueWeight: settings.revenueWeight,
      debtWeight: settings.debtWeight,
      litigationWeight: settings.litigationWeight,
      promoterWeight: settings.promoterWeight,
      sectorWeight: settings.sectorWeight,
    } : this.defaultWeights;

    // Calculate individual factor scores (0-100, higher is better)
    // Calculate individual factor scores (0-100, higher is better)
    const revenueStability = this.calculateRevenueStability(companyAnalysis);
    const debtRatio = this.calculateDebtScore(companyAnalysis);
    const litigationScore = this.calculateLitigationScore(aiResearch);
    const promoterScore = this.calculatePromoterScore(aiResearch, companyAnalysis);
    const sectorScore = this.calculateSectorScore(application.sector, settings?.sectorRiskConfig);

    // Calculate composite score
    let compositeScore = (
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

    // ── Hard-reject override: force score into REJECT zone for critical distress ──────────
    const hardRejectConditions = [];
    if (companyAnalysis?.netWorth < 0) {
      hardRejectConditions.push('Negative Net Worth');
      deductions.unshift({ factor: 'Negative Net Worth', points: 35, reason: `Net worth is negative (₹${companyAnalysis.netWorth} Cr) — insolvency risk` });
    }
    if (companyAnalysis?.netProfit !== null && companyAnalysis?.netProfit !== undefined && companyAnalysis.netProfit < -500) {
      hardRejectConditions.push('Catastrophic Net Loss');
      deductions.unshift({ factor: 'Catastrophic Net Loss', points: 30, reason: `Net loss of ₹${Math.abs(companyAnalysis.netProfit)} Cr` });
    }
    if (companyAnalysis?.debtToEquity && parseFloat(companyAnalysis.debtToEquity) > 15) {
      hardRejectConditions.push('Extreme D/E Ratio');
    }
    // 2+ critical signals = force REJECT
    if (hardRejectConditions.length >= 2) compositeScore = Math.min(compositeScore, 22);
    else if (hardRejectConditions.length === 1) compositeScore = Math.min(compositeScore, 32);

    // ── Qualitative Notes NLP Analysis ───────────────────────────────────────────
    const qualitativeResult = this.analyzeQualitativeNotes(
      qualitativeNotes || application?.qualitativeNotes || null
    );
    if (qualitativeResult.adjustment !== 0) {
      compositeScore = Math.max(0, Math.min(100, compositeScore + qualitativeResult.adjustment));
      // Record as a deduction when score was lowered (adjustment < 0)
      if (qualitativeResult.adjustment < 0) {
        deductions.push({
          factor: 'Qualitative Field Insights',
          points: Math.abs(qualitativeResult.adjustment),   // deduction list uses positive display values
          reason: `${qualitativeResult.label.replace(/_/g, ' ')}: ${qualitativeResult.explanation}`,
        });
      }
    }

    // Recalculate risk level after potential override
    const finalRiskLevel = this.getRiskLevel(compositeScore, settings);

    // ── Recalculate after qualitative adjustment ───────────────────────────────
    const postQualRiskLevel = this.getRiskLevel(compositeScore, settings);

    // Generate recommendation
    const { recommendation, reason } = this.generateRecommendation(
      compositeScore,
      postQualRiskLevel,
      deductions,
      settings
    );

    return {
      compositeScore: parseFloat(compositeScore.toFixed(2)),
      riskLevel: postQualRiskLevel,
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
      recommendationReason: reason,
      // ── Qualitative Insight (new, additive) ──────────────────────────────────
      qualitativeLabel: qualitativeResult.label,
      qualitativeAdjustment: qualitativeResult.adjustment,
      qualitativeInsight: qualitativeResult.explanation,
    };
  }


  /**
   * Calculate revenue stability score (0-100)
   */
  calculateRevenueStability(companyAnalysis) {
    if (!companyAnalysis) return 50;

    let score = 50; // Base = 50 (neutral), not 70

    // Revenue growth bonus/penalty
    if (companyAnalysis.revenueGrowth !== null && companyAnalysis.revenueGrowth !== undefined) {
      if (companyAnalysis.revenueGrowth > 20) score += 20;
      else if (companyAnalysis.revenueGrowth > 10) score += 12;
      else if (companyAnalysis.revenueGrowth > 5) score += 6;
      else if (companyAnalysis.revenueGrowth > 0) score += 2;
      else if (companyAnalysis.revenueGrowth < -30) score -= 35; // catastrophic decline
      else if (companyAnalysis.revenueGrowth < -20) score -= 25;
      else if (companyAnalysis.revenueGrowth < -10) score -= 18;
      else if (companyAnalysis.revenueGrowth < 0) score -= 10;
    }

    // Profitability — net loss is critical
    if (companyAnalysis.netProfit !== null && companyAnalysis.netProfit !== undefined) {
      if (companyAnalysis.netProfit < 0) score -= 20;  // net loss
    }
    if (companyAnalysis.ebitdaMargin !== null && companyAnalysis.ebitdaMargin !== undefined) {
      if (companyAnalysis.ebitdaMargin > 20) score += 12;
      else if (companyAnalysis.ebitdaMargin > 10) score += 6;
      else if (companyAnalysis.ebitdaMargin < 0) score -= 20;  // negative EBITDA
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

    let score = 60;

    // Debt to Equity ratio — hard penalties for extreme values
    if (companyAnalysis.debtToEquity !== null && companyAnalysis.debtToEquity !== undefined) {
      const de = parseFloat(companyAnalysis.debtToEquity);
      if (de < 0.5) score += 25;
      else if (de < 1.0) score += 15;
      else if (de < 1.5) score += 5;
      else if (de < 2.0) score -= 10;
      else if (de < 3.0) score -= 20;
      else if (de < 5.0) score -= 35;
      else if (de < 10.0) score -= 50;
      else score -= 60; // catastrophic D/E > 10
    }

    // Negative net worth = instant floor
    if (companyAnalysis.netWorth !== null && companyAnalysis.netWorth !== undefined) {
      if (companyAnalysis.netWorth < 0) score = Math.min(score, 10);
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
      else if (companyAnalysis.interestCoverage < 0) score -= 30;
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
   * Sector multipliers > 1.0 penalize the score, < 1.0 boost it.
   */
  calculateSectorScore(sector, sectorRiskConfig = null) {
    // Default sector risk multipliers (used when Settings not available)
    const defaultMultipliers = {
      'Technology': 0.85,
      'Healthcare': 0.9,
      'FMCG': 0.8,
      'Manufacturing': 1.2,
      'Services': 1.0,
      'Retail': 1.1,
      'Real Estate': 1.8,
      'Construction': 1.3,
      'Textiles': 1.1,
      'Metals': 1.2,
      'Aviation': 1.5,
      'Hospitality': 1.3,
      'IT Services': 0.8,
    };

    const configMultipliers = sectorRiskConfig || {};
    // Merge DB config over defaults so admins can override any sector
    const effectiveMultipliers = { ...defaultMultipliers, ...configMultipliers };
    const multiplier = effectiveMultipliers[sector] ?? 1.0;

    // Base score of 75, adjusted by multiplier
    // Lower multiplier = higher score (less risky), higher multiplier = lower score (more risky)
    const baseScore = 75;
    const adjustedScore = baseScore / multiplier;
    return Math.max(0, Math.min(100, adjustedScore));
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
    return 'VERY_HIGH'; // Added a default return for scores below 25
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

    // Advanced Data Ingestor: Circular Trading & Off-Balance Sheet
    const circularTradingAlert = this.detectCircularTrading(companyAnalysis);
    if (circularTradingAlert) {
      deductions.push(circularTradingAlert);
    }

    const offBalanceSheetRisk = this.analyzeOffBalanceSheetRisk(companyAnalysis);
    if (offBalanceSheetRisk) {
      deductions.push(offBalanceSheetRisk);
    }

    return deductions;
  }

  /**
   * Data Ingestor Intelligence: Circular Trading Detection
   */
  detectCircularTrading(analysis) {
    if (!analysis) return null;
    const gstRev = analysis.gstRevenue || 0;
    const bankRev = analysis.bankRevenue || 0;
    if (gstRev > 0 && bankRev > 0) {
      const mismatch = Math.abs(gstRev - bankRev) / Math.max(gstRev, bankRev);
      if (mismatch > 0.3) {
        return {
          factor: 'Circular Trading Alert',
          points: 25,
          reason: `Critical mismatch (${(mismatch * 100).toFixed(1)}%) between GST filings and Bank credits suggests potential revenue inflation.`
        };
      }
    }
    return null;
  }

  /**
   * Data Ingestor Intelligence: Off-Balance Sheet Assessment
   */
  analyzeOffBalanceSheetRisk(analysis) {
    if (!analysis) return null;

    // Check top level or financialOverrides JSON block
    const overrides = analysis.financialOverrides || {};
    const contingent = analysis.contingentLiabilities || overrides.contingentLiabilities || 0;
    const commitments = analysis.financialCommitments || overrides.financialCommitments || 0;
    const sanctioned = analysis.sanctionedLimits || overrides.sanctionedLimits || 0;

    const revenue = analysis.revenue || 1;

    if (contingent > (revenue * 0.5)) {
      return {
        factor: 'High Contingent Liability',
        points: 20,
        reason: `Off-balance sheet guarantees (₹${(contingent / 10000000).toFixed(2)} Cr) exceed 50% of annual revenue.`
      };
    }
    return null;
  }

  /**
   * Generate recommendation
   */
  generateRecommendation(score, riskLevel, deductions, settings) {
    const autoApprove = settings?.autoApprovalScore || 75;
    const autoReject = settings?.autoRejectScore || 30;

    let recommendation = 'CONDITIONAL';
    let reason = '';

    // Extract top concerns and strengths for professional reasoning
    const majorConcerns = deductions?.slice(0, 2).map(d => d.factor) || [];

    if (score >= autoApprove) {
      recommendation = 'APPROVE';
      reason = `Strong credit profile with composite score of ${score.toFixed(2)}. All key metrics within acceptable range.`;
    } else if (score <= autoReject) {
      recommendation = 'REJECT';
      reason = `Rejected due to ${majorConcerns.length > 0 ? majorConcerns.join(' and ') : 'high cumulative risk factors'} detected in secondary and primary analysis.`;
    } else {
      recommendation = 'CONDITIONAL';
      // "X despite Y" logic for conditional cases
      if (majorConcerns.length > 0) {
        reason = `Recommended for CONDITIONAL support due to ${majorConcerns.join(' and ')} concerns, despite ${score > 50 ? 'stable financial indicators' : 'moderate business activity'} observed in primary documents.`;
      } else {
        reason = `Moderate risk profile with score of ${score.toFixed(2)}. Recommend approval with standard monitoring and conditions.`;
      }
    }

    return { recommendation, reason };
  }
}

module.exports = new RiskService();
