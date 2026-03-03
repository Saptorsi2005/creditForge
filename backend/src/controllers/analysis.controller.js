const prisma = require('../config/database');
const camService = require('../services/cam.service');
const path = require('path');
const fs = require('fs').promises;

/**
 * Get company analysis
 */
const getCompanyAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;

    const analysis = await prisma.companyAnalysis.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            sector: true,
            loanAmount: true,
          },
        },
      },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Company analysis not found' });
    }

    res.json({ analysis });
  } catch (error) {
    next(error);
  }
};

/**
 * Get AI research
 */
const getAIResearch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const research = await prisma.aIResearch.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            pan: true,
          },
        },
      },
    });

    if (!research) {
      return res.status(404).json({ error: 'AI research not found' });
    }

    res.json({ research });
  } catch (error) {
    next(error);
  }
};

/**
 * Get risk score
 */
const getRiskScore = async (req, res, next) => {
  try {
    const { id } = req.params;

    const riskScore = await prisma.riskScore.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            applicationNo: true,
          },
        },
      },
    });

    if (!riskScore) {
      return res.status(404).json({ error: 'Risk score not found' });
    }

    res.json({ riskScore });
  } catch (error) {
    next(error);
  }
};

/**
 * Get CAM report
 */
const getCAMReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    let camReport = await prisma.camReport.findUnique({
      where: { applicationId: id },
      include: {
        application: {
          select: {
            companyName: true,
            applicationNo: true,
          },
        },
      },
    });

    // If CAM report doesn't exist, generate it
    if (!camReport) {
      const application = await prisma.application.findUnique({
        where: { id },
      });

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const companyAnalysis = await prisma.companyAnalysis.findUnique({
        where: { applicationId: id },
      });

      const aiResearch = await prisma.aIResearch.findUnique({
        where: { applicationId: id },
      });

      const riskScore = await prisma.riskScore.findUnique({
        where: { applicationId: id },
      });

      if (!companyAnalysis || !aiResearch || !riskScore) {
        return res.status(400).json({
          error: 'Complete analysis not available. Please run analysis first.',
        });
      }

      // Generate CAM report
      const camData = await camService.generateCAMReport(
        application,
        companyAnalysis,
        aiResearch,
        riskScore
      );

      camReport = await prisma.camReport.upsert({
        where: { applicationId: id },
        create: {
          applicationId: id,
          ...camData,
        },
        update: { ...camData },
        include: {
          application: {
            select: {
              companyName: true,
              applicationNo: true,
            },
          },
        },
      });
    }

    res.json({ camReport });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate and download CAM PDF
 */
const getCAMPDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get or create CAM report
    let camReport = await prisma.camReport.findUnique({
      where: { applicationId: id },
    });

    if (!camReport) {
      // Generate CAM report first
      const application = await prisma.application.findUnique({
        where: { id },
      });

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const companyAnalysis = await prisma.companyAnalysis.findUnique({
        where: { applicationId: id },
      });

      const aiResearch = await prisma.aIResearch.findUnique({
        where: { applicationId: id },
      });

      const riskScore = await prisma.riskScore.findUnique({
        where: { applicationId: id },
      });

      if (!companyAnalysis || !aiResearch || !riskScore) {
        return res.status(400).json({
          error: 'Complete analysis not available. Please run analysis first.',
        });
      }

      const camData = await camService.generateCAMReport(
        application,
        companyAnalysis,
        aiResearch,
        riskScore
      );

      camReport = await prisma.camReport.upsert({
        where: { applicationId: id },
        create: {
          applicationId: id,
          ...camData,
        },
        update: { ...camData },
      });
    }

    // Generate PDF if not already generated
    let pdfPath = camReport.pdfPath;

    if (!camReport.pdfGenerated || !pdfPath) {
      const application = await prisma.application.findUnique({
        where: { id },
      });

      const uploadsDir = path.join(__dirname, '../../uploads');
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `CAM-${application.applicationNo}-${Date.now()}.pdf`;
      pdfPath = path.join(uploadsDir, filename);

      await camService.generatePDF(camReport, application, pdfPath);

      // Update CAM report with PDF path
      await prisma.camReport.update({
        where: { id: camReport.id },
        data: {
          pdfGenerated: true,
          pdfPath,
        },
      });
    }

    // Send PDF file
    res.download(pdfPath, `CAM-Report-${Date.now()}.pdf`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanyAnalysis,
  getAIResearch,
  getRiskScore,
  getCAMReport,
  getCAMPDF,
};
