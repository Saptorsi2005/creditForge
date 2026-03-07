const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('Clearing existing data...');
    await prisma.camReport.deleteMany();
    await prisma.riskScore.deleteMany();
    await prisma.aIResearch.deleteMany();
    await prisma.companyAnalysis.deleteMany();
    await prisma.document.deleteMany();
    await prisma.application.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.user.deleteMany();
  }

  // 1. Create Users
  console.log('Creating users...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@creditforge.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const analyst = await prisma.user.create({
    data: {
      email: 'analyst@creditforge.com',
      password: hashedPassword,
      name: 'Credit Analyst',
      role: 'ANALYST',
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@creditforge.com',
      password: hashedPassword,
      name: 'Portfolio Viewer',
      role: 'VIEWER',
    },
  });

  console.log('✓ Created users');

  // 2. Create Settings
  console.log('Creating default settings...');

  const settings = await prisma.settings.create({
    data: {
      revenueWeight: 0.25,
      debtWeight: 0.20,
      litigationWeight: 0.20,
      promoterWeight: 0.15,
      sectorWeight: 0.20,
      highRiskThreshold: 60,
      mediumRiskThreshold: 40,
      mismatchThreshold: 15,
      autoApprovalScore: 75,
      autoRejectScore: 30,
      sectorRiskConfig: {
        Technology: 85,
        Healthcare: 80,
        FMCG: 80,
        Manufacturing: 75,
        Services: 75,
        Retail: 70,
        'Real Estate': 60,
        Construction: 65,
        Textiles: 70,
        Metals: 65,
        Aviation: 55,
        Hospitality: 60,
      },
      researchKeywords: [
        { keyword: 'fraud', weight: 10, severity: 'CRITICAL' },
        { keyword: 'default', weight: 7, severity: 'HIGH' },
        { keyword: 'litigation', weight: 5, severity: 'MEDIUM' },
        { keyword: 'npa', weight: 7, severity: 'HIGH' },
        { keyword: 'insolvency', weight: 10, severity: 'CRITICAL' },
      ],
      maxFileSize: 10485760,
      allowedFileTypes: ['application/pdf', 'text/csv'],
    },
  });

  console.log('✓ Created default settings');

  // 3. Create Sample Applications
  console.log('Creating sample applications...');

  const applications = [
    {
      applicationNo: 'CRF2026000001',
      companyName: 'ABC Manufacturing Pvt Ltd',
      pan: 'AABCA1234B',
      gstin: '27AABCA1234B1Z5',
      cin: 'U25199MH2015PTC123456',
      loanAmount: 50000000, // 5 Cr
      loanPurpose: 'Working Capital and Machinery Purchase',
      sector: 'Manufacturing',
      status: 'COMPLETED',
      userId: analyst.id,
      submittedAt: new Date('2026-02-15'),
      completedAt: new Date('2026-02-25'),
    },
    {
      applicationNo: 'CRF2026000002',
      companyName: 'TechVision Solutions Ltd',
      pan: 'AABCT5678C',
      gstin: '29AABCT5678C1Z3',
      cin: 'U72900KA2018PLC098765',
      loanAmount: 75000000, // 7.5 Cr
      loanPurpose: 'Business Expansion and R&D',
      sector: 'Technology',
      status: 'UNDER_REVIEW',
      userId: analyst.id,
      submittedAt: new Date('2026-02-28'),
    },
    {
      applicationNo: 'CRF2026000003',
      companyName: 'Green Retail Enterprises',
      pan: 'AABCR9012D',
      gstin: '33AABCR9012D1Z8',
      cin: 'U51909TN2019PTC054321',
      loanAmount: 30000000, // 3 Cr
      loanPurpose: 'Store Expansion',
      sector: 'Retail',
      status: 'DOCUMENTS_UPLOADED',
      userId: admin.id,
      submittedAt: new Date('2026-03-01'),
    },
  ];

  for (const appData of applications) {
    const app = await prisma.application.create({
      data: appData,
    });
    console.log(`  ✓ Created application ${app.applicationNo}`);

    // Add complete analysis for first application
    if (app.applicationNo === 'CRF2026000001') {
      // Company Analysis
      const companyAnalysis = await prisma.companyAnalysis.create({
        data: {
          applicationId: app.id,
          revenue: 250000000, // 25 Cr
          revenueGrowth: 15.5,
          ebitda: 37500000, // 3.75 Cr
          ebitdaMargin: 15.0,
          netProfit: 18750000, // 1.875 Cr
          netProfitMargin: 7.5,
          totalAssets: 180000000, // 18 Cr
          totalLiabilities: 90000000, // 9 Cr
          netWorth: 90000000, // 9 Cr
          totalDebt: 60000000, // 6 Cr
          debtToEquity: 0.67,
          currentRatio: 1.8,
          interestCoverage: 3.5,
          gstRevenue: 250000000,
          bankRevenue: 245000000,
          revenueMismatch: 2.0,
          mismatchFlag: false,
          businessModel: 'B2B and B2C manufacturing with own distribution network',
          competitivePosition: 'Strong market presence in regional markets',
          managementQuality: 'GOOD',
          strengths: [
            'Strong revenue growth trajectory',
            'Healthy profitability margins',
            'Conservative leverage',
            'Diversified customer base',
          ],
          weaknesses: [
            'Geographic concentration in single state',
            'Dependency on imported raw materials',
          ],
        },
      });

      // AI Research
      const aiResearch = await prisma.aIResearch.create({
        data: {
          applicationId: app.id,
          litigationCount: 1,
          litigationDetails: [
            {
              type: 'Civil Litigation',
              status: 'Ongoing',
              amount: 2500000,
              description: 'Contract dispute with supplier',
              court: 'District Court',
              year: 2025,
            },
          ],
          regulatoryIssues: 0,
          regulatoryDetails: [],
          directorIssues: 0,
          directorDetails: [],
          negativeNews: 0,
          newsDetails: [],
          overallSentiment: 'POSITIVE',
          sentimentScore: 0.45,
          riskKeywords: [
            { keyword: 'litigation', count: 1, severity: 'MEDIUM', impact: 4 },
          ],
          sources: [
            'Ministry of Corporate Affairs',
            'Court Records Database',
            'Company Website',
          ],
          executiveSummary:
            'Research conducted reveals 1 ongoing civil litigation case. Overall sentiment is positive with no major regulatory or director concerns.',
          redFlags: [],
          riskScore: 4,
          serviceNote: null,
        },
      });

      // Risk Score
      const riskScore = await prisma.riskScore.create({
        data: {
          applicationId: app.id,
          compositeScore: 78.5,
          riskLevel: 'LOW',
          revenueStability: 85.0,
          debtRatio: 82.0,
          litigationScore: 70.0,
          promoterScore: 80.0,
          sectorScore: 75.0,
          weights: {
            revenueWeight: 0.25,
            debtWeight: 0.20,
            litigationWeight: 0.20,
            promoterWeight: 0.15,
            sectorWeight: 0.20,
          },
          factorBreakdown: [
            {
              factor: 'Revenue Stability',
              score: 85.0,
              weight: 0.25,
              contribution: 21.25,
              impact: 'VERY_POSITIVE',
            },
            {
              factor: 'Debt Management',
              score: 82.0,
              weight: 0.20,
              contribution: 16.4,
              impact: 'VERY_POSITIVE',
            },
            {
              factor: 'Litigation & Compliance',
              score: 70.0,
              weight: 0.20,
              contribution: 14.0,
              impact: 'POSITIVE',
            },
            {
              factor: 'Promoter Quality',
              score: 80.0,
              weight: 0.15,
              contribution: 12.0,
              impact: 'VERY_POSITIVE',
            },
            {
              factor: 'Sector Risk',
              score: 75.0,
              weight: 0.20,
              contribution: 15.0,
              impact: 'POSITIVE',
            },
          ],
          deductions: [
            {
              factor: 'Ongoing Litigation',
              points: 10,
              reason: '1 active litigation case(s)',
            },
          ],
          character: 85.0,
          capacity: 88.0,
          capital: 82.0,
          collateral: 75.0,
          conditions: 75.0,
          recommendation: 'APPROVE',
          recommendationReason:
            'Strong credit profile with composite score of 78.50. All key metrics within acceptable range.',
        },
      });

      // CAM Report
      await prisma.camReport.create({
        data: {
          applicationId: app.id,
          executiveSummary: `Application for ₹5 Cr working capital facility from ABC Manufacturing shows strong fundamentals with composite risk score of 78.5/100.`,
          businessOverview: `ABC Manufacturing is an established player in the manufacturing sector with 8+ years of operations.`,
          financialAssessment: `Company demonstrates healthy financial performance with revenue of ₹25 Cr and EBITDA margin of 15%.`,
          strengthsAnalysis: `Key strengths include strong revenue growth (15.5%), healthy profitability, and conservative leverage (D/E: 0.67x).`,
          risksAnalysis: `One ongoing civil litigation case worth ₹25 lakhs. Geographic concentration presents moderate risk.`,
          mitigationStrategy: `Standard monitoring with quarterly financial reviews. Litigation should be tracked for resolution.`,
          recommendation: 'APPROVE',
          recommendedAmount: 50000000,
          recommendedTenure: 60,
          recommendedRate: 10.0,
          conditions: ['Submit quarterly financials', 'Maintain DSCR > 1.5x'],
          financialCovenants: [
            'DSCR ≥ 1.5x',
            'D/E Ratio ≤ 2.0x',
            'Current Ratio ≥ 1.2x',
          ],
          nonFinancialCovenants: [
            'No management change without intimation',
            'Maintain asset insurance',
          ],
        },
      });

      console.log(`  ✓ Added complete analysis for ${app.applicationNo}`);
    }
  }

  console.log('✓ Created sample applications');

  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('📧 Test Credentials:');
  console.log('  Admin:   admin@creditforge.com / password123');
  console.log('  Analyst: analyst@creditforge.com / password123');
  console.log('  Viewer:  viewer@creditforge.com / password123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
