const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * CAM (Credit Assessment Memorandum) Generator
 * Generates comprehensive credit appraisal reports
 */
class CAMService {
  /**
   * Generate CAM report content
   */
  async generateCAMReport(application, companyAnalysis, aiResearch, riskScore, settings = null) {
    // Executive Summary
    const executiveSummary = this.generateExecutiveSummary(
      application,
      companyAnalysis,
      riskScore
    );

    // Business Overview
    const businessOverview = this.generateBusinessOverview(
      application,
      companyAnalysis
    );

    // Financial Assessment
    const financialAssessment = this.generateFinancialAssessment(
      companyAnalysis,
      application.loanAmount
    );

    // Strengths Analysis
    const strengthsAnalysis = this.generateStrengthsAnalysis(
      companyAnalysis,
      aiResearch,
      riskScore
    );

    // Risks Analysis
    const risksAnalysis = this.generateRisksAnalysis(
      companyAnalysis,
      aiResearch,
      riskScore
    );

    // Mitigation Strategy
    const mitigationStrategy = this.generateMitigationStrategy(
      riskScore,
      aiResearch
    );

    // Final Recommendation
    const recommendation = this.generateFinalRecommendation(
      application,
      riskScore,
      companyAnalysis,
      settings
    );

    return {
      executiveSummary,
      businessOverview,
      financialAssessment,
      strengthsAnalysis,
      risksAnalysis,
      mitigationStrategy,
      recommendation: recommendation.decision,
      recommendedAmount: recommendation.amount,
      recommendedTenure: recommendation.tenure,
      recommendedRate: recommendation.rate,
      conditions: recommendation.conditions,
      financialCovenants: recommendation.financialCovenants,
      nonFinancialCovenants: recommendation.nonFinancialCovenants,
    };
  }

  /**
   * Helper to format numbers with commas and fixed decimals
   */
  formatCurrency(value, decimals = 2) {
    if (value === null || value === undefined) return '0.00';
    try {
      return Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    } catch (e) {
      return Number(value).toFixed(decimals);
    }
  }

  /**
   * Generate Executive Summary
   */
  generateExecutiveSummary(application, companyAnalysis, riskScore) {
    const parts = [];

    parts.push(`EXECUTIVE SUMMARY\n`);
    parts.push(`Application No: ${application.applicationNo}`);
    parts.push(`Company Name: ${application.companyName}`);
    parts.push(`Loan Amount Requested: ₹ ${this.formatCurrency(application.loanAmount / 10000000)} Cr`);
    parts.push(`Purpose: ${application.loanPurpose}`);
    parts.push(`Sector: ${application.sector}\n`);

    parts.push(`Credit Risk Assessment:`);
    parts.push(`- Composite Risk Score: ${riskScore.compositeScore}/100`);
    parts.push(`- Risk Level: ${riskScore.riskLevel}`);
    parts.push(`- Recommendation: ${riskScore.recommendation}\n`);

    if (companyAnalysis?.revenue) {
      parts.push(`Financial Snapshot:`);
      parts.push(`- Annual Revenue: ₹ ${this.formatCurrency(companyAnalysis.revenue / 10000000)} Cr`);
      if (companyAnalysis.ebitdaMargin) {
        parts.push(`- EBITDA Margin: ${companyAnalysis.ebitdaMargin}%`);
      }
      if (companyAnalysis.debtToEquity) {
        parts.push(`- Debt-to-Equity: ${companyAnalysis.debtToEquity}x`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate Business Overview
   */
  generateBusinessOverview(application, companyAnalysis) {
    const parts = [];

    parts.push(`BUSINESS OVERVIEW\n`);
    parts.push(`Company Information:`);
    parts.push(`- Legal Name: ${application.companyName}`);
    parts.push(`- PAN: ${application.pan}`);
    if (application.gstin) parts.push(`- GSTIN: ${application.gstin}`);
    if (application.cin) parts.push(`- CIN: ${application.cin}`);
    parts.push(`- Industry Sector: ${application.sector}\n`);

    if (companyAnalysis?.businessModel) {
      parts.push(`Business Model:\n${companyAnalysis.businessModel}\n`);
    } else {
      parts.push(`Business Model:\nThe company operates in the ${application.sector} sector, providing products/services to its target market.\n`);
    }

    if (companyAnalysis?.competitivePosition) {
      parts.push(`Competitive Position:\n${companyAnalysis.competitivePosition}\n`);
    } else {
      parts.push(`Competitive Position:\nThe company maintains a stable position in its market segment with established customer relationships.\n`);
    }

    parts.push(`Loan Purpose:\n${application.loanPurpose}`);

    return parts.join('\n');
  }

  /**
   * Generate Financial Assessment
   */
  generateFinancialAssessment(companyAnalysis, loanAmount) {
    const parts = [];

    parts.push(`FINANCIAL ASSESSMENT\n`);

    if (companyAnalysis) {
      parts.push(`Income Statement Metrics:`);
      if (companyAnalysis.revenue) {
        parts.push(`- Total Revenue: ₹ ${this.formatCurrency(companyAnalysis.revenue / 10000000)} Cr`);
      }
      if (companyAnalysis.revenueGrowth) {
        parts.push(`- Revenue Growth: ${companyAnalysis.revenueGrowth > 0 ? '+' : ''}${companyAnalysis.revenueGrowth}%`);
      }
      if (companyAnalysis.ebitda) {
        parts.push(`- EBITDA: ₹ ${this.formatCurrency(companyAnalysis.ebitda / 10000000)} Cr`);
      }
      if (companyAnalysis.ebitdaMargin) {
        parts.push(`- EBITDA Margin: ${companyAnalysis.ebitdaMargin}%`);
      }
      if (companyAnalysis.netProfit) {
        parts.push(`- Net Profit: ₹ ${this.formatCurrency(companyAnalysis.netProfit / 10000000)} Cr`);
      }
      if (companyAnalysis.netProfitMargin) {
        parts.push(`- Net Profit Margin: ${companyAnalysis.netProfitMargin}%\n`);
      }

      parts.push(`Balance Sheet Metrics:`);
      if (companyAnalysis.totalAssets) {
        parts.push(`- Total Assets: ₹ ${this.formatCurrency(companyAnalysis.totalAssets / 10000000)} Cr`);
      }
      if (companyAnalysis.totalLiabilities) {
        parts.push(`- Total Liabilities: ₹ ${this.formatCurrency(companyAnalysis.totalLiabilities / 10000000)} Cr`);
      }
      if (companyAnalysis.netWorth) {
        parts.push(`- Net Worth: ₹ ${this.formatCurrency(companyAnalysis.netWorth / 10000000)} Cr`);
      }
      if (companyAnalysis.totalDebt) {
        parts.push(`- Total Debt: ₹ ${this.formatCurrency(companyAnalysis.totalDebt / 10000000)} Cr\n`);
      }

      parts.push(`Key Financial Ratios:`);
      if (companyAnalysis.debtToEquity) {
        parts.push(`- Debt-to-Equity Ratio: ${companyAnalysis.debtToEquity}x`);
        parts.push(`  ${this.analyzeRatio('D/E', parseFloat(companyAnalysis.debtToEquity))}`);
      }
      if (companyAnalysis.currentRatio) {
        parts.push(`- Current Ratio: ${companyAnalysis.currentRatio}x`);
        parts.push(`  ${this.analyzeRatio('Current', parseFloat(companyAnalysis.currentRatio))}`);
      }
      if (companyAnalysis.interestCoverage) {
        parts.push(`- Interest Coverage: ${companyAnalysis.interestCoverage}x`);
        parts.push(`  ${this.analyzeRatio('Interest Coverage', companyAnalysis.interestCoverage)}`);
      }

      // GST-Bank Reconciliation
      if (companyAnalysis.gstRevenue && companyAnalysis.bankRevenue) {
        parts.push(`\nGST-Bank Reconciliation:`);
        parts.push(`- GST Reported Revenue: ₹ ${this.formatCurrency(companyAnalysis.gstRevenue / 10000000)} Cr`);
        parts.push(`- Bank Statement Revenue: ₹ ${this.formatCurrency(companyAnalysis.bankRevenue / 10000000)} Cr`);
        if (companyAnalysis.revenueMismatch) {
          parts.push(`- Variance: ${companyAnalysis.revenueMismatch.toFixed(2)}%`);
          if (companyAnalysis.mismatchFlag) {
            parts.push(`  ⚠️ ALERT: Mismatch exceeds acceptable threshold`);
          }
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate Strengths Analysis
   */
  generateStrengthsAnalysis(companyAnalysis, aiResearch, riskScore) {
    const parts = [];
    const strengths = [];

    parts.push(`STRENGTHS\n`);

    // Financial strengths
    if (companyAnalysis?.ebitdaMargin > 15) {
      strengths.push(`Strong profitability with EBITDA margin of ${companyAnalysis.ebitdaMargin}%`);
    }

    if (companyAnalysis?.revenueGrowth > 10) {
      strengths.push(`Healthy revenue growth of ${companyAnalysis.revenueGrowth}%`);
    }

    if (companyAnalysis?.debtToEquity && companyAnalysis.debtToEquity < 1) {
      strengths.push(`Conservative leverage with D/E ratio of ${companyAnalysis.debtToEquity}`);
    }

    // Litigation strengths
    if (!aiResearch?.litigationCount || aiResearch.litigationCount === 0) {
      strengths.push(`Clean litigation record with no pending cases`);
    }

    if (!aiResearch?.regulatoryIssues || aiResearch.regulatoryIssues === 0) {
      strengths.push(`No regulatory issues or compliance concerns`);
    }

    // Sentiment strengths
    if (aiResearch?.sentimentScore && aiResearch.sentimentScore > 0.3) {
      strengths.push(`Positive market sentiment and reputation`);
    }

    // Score-based strengths
    if (riskScore.revenueStability > 75) {
      strengths.push(`Excellent revenue stability and predictability`);
    }

    if (riskScore.promoterScore > 80) {
      strengths.push(`Strong promoter/management quality`);
    }

    // Add custom strengths from analysis
    if (companyAnalysis?.strengths) {
      const customStrengths = Array.isArray(companyAnalysis.strengths)
        ? companyAnalysis.strengths
        : JSON.parse(companyAnalysis.strengths);
      strengths.push(...customStrengths);
    }

    if (strengths.length === 0) {
      strengths.push('Company maintains standard operational metrics for the sector');
    }

    strengths.forEach((s, i) => {
      parts.push(`${i + 1}. ${s}`);
    });

    return parts.join('\n');
  }

  /**
   * Generate Risks Analysis
   */
  generateRisksAnalysis(companyAnalysis, aiResearch, riskScore) {
    const parts = [];
    const risks = [];

    parts.push(`RISKS & CONCERNS\n`);

    // Financial risks
    if (companyAnalysis?.debtToEquity && companyAnalysis.debtToEquity > 2) {
      risks.push(`High leverage with D/E ratio of ${companyAnalysis.debtToEquity} - increases financial risk`);
    }

    if (companyAnalysis?.currentRatio && companyAnalysis.currentRatio < 1) {
      risks.push(`Current ratio of ${companyAnalysis.currentRatio} indicates potential liquidity concerns`);
    }

    if (companyAnalysis?.mismatchFlag) {
      risks.push(`GST-Bank revenue mismatch of ${companyAnalysis.revenueMismatch.toFixed(2)}% - possible circular trading risk`);
    }

    // Litigation risks
    if (aiResearch?.litigationCount > 0) {
      risks.push(`${aiResearch.litigationCount} ongoing litigation case(s) - potential financial and reputational impact`);
    }

    if (aiResearch?.regulatoryIssues > 0) {
      risks.push(`${aiResearch.regulatoryIssues} regulatory issue(s) - compliance concerns`);
    }

    if (aiResearch?.directorIssues > 0) {
      risks.push(`Director background concerns identified - requires monitoring`);
    }

    // Sentiment risks
    if (aiResearch?.sentimentScore && aiResearch.sentimentScore < -0.3) {
      risks.push(`Negative market sentiment detected - reputational risk`);
    }

    // Deductions from risk score
    if (riskScore.deductions && Array.isArray(riskScore.deductions)) {
      riskScore.deductions.forEach(d => {
        risks.push(`${d.factor}: ${d.reason}`);
      });
    }

    // Add custom weaknesses
    if (companyAnalysis?.weaknesses) {
      const customWeaknesses = Array.isArray(companyAnalysis.weaknesses)
        ? companyAnalysis.weaknesses
        : JSON.parse(companyAnalysis.weaknesses);
      risks.push(...customWeaknesses);
    }

    if (risks.length === 0) {
      risks.push('No significant risk factors identified at this time');
    }

    risks.forEach((r, i) => {
      parts.push(`${i + 1}. ${r}`);
    });

    return parts.join('\n');
  }

  /**
   * Generate Mitigation Strategy
   */
  generateMitigationStrategy(riskScore, aiResearch) {
    const parts = [];
    const strategies = [];

    parts.push(`RISK MITIGATION STRATEGY\n`);

    if (riskScore.riskLevel === 'HIGH' || riskScore.riskLevel === 'VERY_HIGH') {
      strategies.push(`Enhanced monitoring with monthly financial reporting`);
      strategies.push(`Restrict further debt until key ratios improve`);
      strategies.push(`Quarterly compliance reviews and audits`);
    }

    if (aiResearch?.litigationCount > 0) {
      strategies.push(`Obtain updates on litigation status quarterly`);
      strategies.push(`Set aside contingency reserves for potential liabilities`);
    }

    if (riskScore.deductions?.some(d => d.factor.includes('Debt'))) {
      strategies.push(`Mandatory debt reduction plan with milestone targets`);
      strategies.push(`Limit dividend payouts until leverage improves`);
    }

    if (strategies.length === 0) {
      strategies.push('Standard monitoring and periodic review of financial performance');
      strategies.push('Annual renewal assessment with updated financials');
    }

    strategies.forEach((s, i) => {
      parts.push(`${i + 1}. ${s}`);
    });

    return parts.join('\n');
  }

  /**
   * Generate Final Recommendation
   */
  generateFinalRecommendation(application, riskScore, companyAnalysis, settings = null) {
    const decision = riskScore.recommendation;
    let amount = application.loanAmount;
    let tenure = 60; // Default 5 years

    // Calculate interest rate using settings if available
    const baseLendingRate = settings?.baseLendingRate || 8.5;
    const maxRiskPremiumCap = settings?.maxRiskPremiumCap || 3.0;

    // Formula: Final ROI = Base Rate + (Risk Premium × (100 - AI Score)/100)
    const riskFactor = (100 - riskScore.compositeScore) / 100;
    let rate = baseLendingRate + (maxRiskPremiumCap * riskFactor);

    // Adjust based on risk and decision
    if (decision === 'APPROVE') {
      if (riskScore.compositeScore > 80) {
        tenure = 84; // 7 years
        // Already low rate due to high score
      } else if (riskScore.compositeScore > 70) {
        tenure = 60;
      } else {
        tenure = 48;
        // Slightly increase rate for lower scores within approval range
        rate = rate * 1.05;
      }
    } else if (decision === 'CONDITIONAL') {
      amount = application.loanAmount * 0.75; // Reduce by 25%
      tenure = 36;
      // Add conditional premium
      rate = rate * 1.15;
    } else {
      amount = 0;
      rate = 0;
      tenure = 0;
    }

    // Round rate to 2 decimal places
    rate = parseFloat(rate.toFixed(2));

    // Conditions
    const conditions = [];
    if (decision === 'CONDITIONAL') {
      conditions.push('Provide personal guarantee from promoters');
      conditions.push('Pledge of promoter shares as collateral');
      conditions.push('Maintain debt service coverage ratio > 1.5x');
      if (riskScore.deductions?.some(d => d.factor.includes('Litigation'))) {
        conditions.push('Submit quarterly litigation status reports');
      }
    } else if (decision === 'APPROVE' && riskScore.riskLevel === 'MEDIUM') {
      conditions.push('Maintain minimum DSCR of 1.75x throughout loan tenure');
      conditions.push('Submit audited financials within 90 days of FY end');
    }

    // Financial Covenants
    const financialCovenants = [
      'Debt Service Coverage Ratio (DSCR) ≥ 1.5x',
      'Debt-to-Equity Ratio ≤ 2.0x',
      'Current Ratio ≥ 1.2x',
      'Net Worth to remain positive throughout tenure',
    ];

    // Non-Financial Covenants
    const nonFinancialCovenants = [
      'No change in management without prior intimation',
      'No additional secured borrowing without consent',
      'Maintain insurance on all fixed assets',
      'Submit quarterly financial statements',
      'Notify immediately of any litigation > ₹10 lakhs',
    ];

    return {
      decision,
      amount,
      tenure,
      rate,
      conditions,
      financialCovenants,
      nonFinancialCovenants,
    };
  }

  /**
   * Analyze ratio and provide commentary
   */
  analyzeRatio(type, value) {
    if (type === 'D/E') {
      if (value < 0.5) return 'Excellent - Conservative leverage';
      if (value < 1.0) return 'Good - Healthy leverage';
      if (value < 1.5) return 'Acceptable - Moderate leverage';
      if (value < 2.0) return 'Concerning - High leverage';
      return 'Critical - Very high leverage';
    }

    if (type === 'Current') {
      if (value > 2.0) return 'Excellent - Strong liquidity';
      if (value > 1.5) return 'Good - Adequate liquidity';
      if (value > 1.0) return 'Acceptable - Sufficient liquidity';
      return 'Concerning - Liquidity pressure';
    }

    if (type === 'Interest Coverage') {
      if (value > 3.0) return 'Excellent - Comfortable coverage';
      if (value > 2.0) return 'Good - Adequate coverage';
      if (value > 1.5) return 'Acceptable - Minimum coverage';
      return 'Concerning - Weak coverage';
    }

    return '';
  }

  /**
   * Generate PDF report
   */
  async generatePDF(camReport, application, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);

        // Load Unicode font for Rupee symbol support - Using Arial from Windows
        const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
        const boldFontPath = 'C:\\Windows\\Fonts\\arialbd.ttf';

        doc.registerFont('CustomFont', fontPath);
        doc.registerFont('CustomFont-Bold', boldFontPath);

        doc.font('CustomFont');

        // Header
        doc.fontSize(24).font('CustomFont-Bold').text('CREDIT ASSESSMENT MEMORANDUM', {
          align: 'center',
        });

        doc.fontSize(10).font('CustomFont').text(`Generated: ${new Date().toLocaleDateString()}`, {
          align: 'center',
        });

        doc.moveDown(2);

        // Executive Summary
        this.addSection(doc, camReport.executiveSummary);

        doc.addPage();

        // Business Overview
        this.addSection(doc, camReport.businessOverview);

        doc.addPage();

        // Financial Assessment
        this.addSection(doc, camReport.financialAssessment);

        doc.addPage();

        // Strengths
        this.addSection(doc, camReport.strengthsAnalysis);

        doc.moveDown();

        // Risks
        this.addSection(doc, camReport.risksAnalysis);

        doc.addPage();

        // Mitigation
        if (camReport.mitigationStrategy) {
          this.addSection(doc, camReport.mitigationStrategy);
          doc.moveDown();
        }

        // Final Recommendation
        doc.fontSize(16).font('CustomFont-Bold').text('FINAL RECOMMENDATION', {
          underline: true,
        });

        doc.moveDown();
        doc.fontSize(12).font('CustomFont-Bold').text(`Decision: ${camReport.recommendation}`);

        if (camReport.recommendedAmount) {
          doc.fontSize(11).font('CustomFont')
            .text(`Recommended Loan Amount: ₹ ${this.formatCurrency(camReport.recommendedAmount / 10000000)} Cr`);
        }

        if (camReport.recommendedTenure) {
          doc.text(`Tenure: ${camReport.recommendedTenure} months`);
        }

        if (camReport.recommendedRate) {
          doc.text(`Interest Rate: ${camReport.recommendedRate}% p.a.`);
        }

        // Conditions
        if (camReport.conditions && camReport.conditions.length > 0) {
          doc.moveDown();
          doc.fontSize(12).font('CustomFont-Bold').text('Conditions:');
          doc.fontSize(10).font('CustomFont');
          camReport.conditions.forEach((condition, i) => {
            doc.text(`${i + 1}. ${condition}`);
          });
        }

        // Covenants
        if (camReport.financialCovenants && camReport.financialCovenants.length > 0) {
          doc.moveDown();
          doc.fontSize(12).font('CustomFont-Bold').text('Financial Covenants:');
          doc.fontSize(10).font('CustomFont');
          camReport.financialCovenants.forEach((covenant, i) => {
            doc.text(`${i + 1}. ${covenant}`);
          });
        }

        if (camReport.nonFinancialCovenants && camReport.nonFinancialCovenants.length > 0) {
          doc.moveDown();
          doc.fontSize(12).font('CustomFont-Bold').text('Non-Financial Covenants:');
          doc.fontSize(10).font('CustomFont');
          camReport.nonFinancialCovenants.forEach((covenant, i) => {
            doc.text(`${i + 1}. ${covenant}`);
          });
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).font('CustomFont').text(
          '--- End of Credit Assessment Memorandum ---',
          { align: 'center' }
        );

        doc.end();

        stream.on('finish', () => {
          resolve(outputPath);
        });

        stream.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add section to PDF
   */
  addSection(doc, content) {
    doc.fontSize(10).font('CustomFont').text(content, {
      align: 'left',
      lineGap: 2,
    });
  }
}

module.exports = new CAMService();
