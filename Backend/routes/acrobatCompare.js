import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { uploadAcrobatPDFs, handleAcrobatUploadErrors } from '../middleware/acrobatUpload.js';
import { comparePDFsWithAcrobat, checkAcrobatInstallation, getAcrobatPath } from '../services/acrobatService.js';
import { deleteMultiple } from '../utils/fileCleanup.js';
import config from '../config/config.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * POST /api/acrobat-compare
 * Compare exactly 2 PDF files using Adobe Acrobat DC
 */
router.post('/acrobat-compare', uploadAcrobatPDFs, handleAcrobatUploadErrors, async (req, res) => {
  const startTime = Date.now();
  let uploadedFiles = req.files || [];
  let comparisonPdfPath = null;

  try {
    console.log(`[Acrobat Comparison] Received ${uploadedFiles.length} files for comparison`);

    // Validate exactly 2 files
    if (uploadedFiles.length !== 2) {
      await deleteMultiple(uploadedFiles.map(f => f.path));
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Exactly 2 PDF files are required for Acrobat comparison'
      });
    }

    // Check if Acrobat is installed
    const acrobatInstalled = await checkAcrobatInstallation();
    if (!acrobatInstalled) {
      await deleteMultiple(uploadedFiles.map(f => f.path));
      return res.status(503).json({
        success: false,
        error: 'Acrobat not found',
        message: `Adobe Acrobat DC is not installed at ${getAcrobatPath()}. Please install Adobe Acrobat DC or set ACROBAT_APP_PATH in .env`
      });
    }

    // Generate unique comparison ID
    const comparisonId = uuidv4();

    // Get file paths
    const pdf1Path = uploadedFiles[0].path;
    const pdf2Path = uploadedFiles[1].path;
    const outputDir = path.dirname(pdf1Path);

    // Perform Acrobat comparison
    console.log('[Acrobat Comparison] Starting comparison with Adobe Acrobat...');
    comparisonPdfPath = await comparePDFsWithAcrobat(pdf1Path, pdf2Path, outputDir);
    console.log('[Acrobat Comparison] Comparison complete');

    // Calculate processing time
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

    // Send the comparison PDF file as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="comparison-report-${comparisonId}.pdf"`);

    // Stream the PDF file
    const fileStream = fs.createReadStream(comparisonPdfPath);
    fileStream.pipe(res);

    // Clean up after streaming
    fileStream.on('end', async () => {
      console.log(`[Acrobat Comparison] Completed in ${processingTime}`);

      // Clean up uploaded files and comparison PDF
      const filesToDelete = [
        ...uploadedFiles.map(f => f.path),
        comparisonPdfPath
      ];

      await deleteMultiple(filesToDelete);
      console.log('[Acrobat Comparison] Cleanup completed');
    });

    fileStream.on('error', async (streamError) => {
      console.error('[Acrobat Comparison] Stream error:', streamError);

      // Clean up on stream error
      const filesToDelete = [
        ...uploadedFiles.map(f => f.path),
        comparisonPdfPath
      ];

      await deleteMultiple(filesToDelete);
    });

  } catch (error) {
    console.error('[Acrobat Comparison Error]', error);

    // Clean up uploaded files and comparison PDF on error
    const filesToDelete = [
      ...uploadedFiles.map(f => f.path)
    ];
    if (comparisonPdfPath) {
      filesToDelete.push(comparisonPdfPath);
    }

    await deleteMultiple(filesToDelete).catch(err =>
      console.error('Error cleaning up files:', err)
    );

    // Handle specific error types
    if (error.code === 'FILE_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        error: 'File not found',
        message: error.message
      });
    }

    if (error.code === 'TIMEOUT') {
      return res.status(408).json({
        success: false,
        error: 'Comparison timeout',
        message: error.message
      });
    }

    if (error.code === 'ACROBAT_ERROR' || error.code === 'ACROBAT_EXECUTION_FAILED') {
      return res.status(500).json({
        success: false,
        error: 'Acrobat comparison failed',
        message: error.message
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: 'Comparison failed',
      message: error.message || 'An error occurred during Acrobat PDF comparison. Please try again.'
    });
  }
});

/**
 * GET /api/acrobat-compare/status
 * Health check endpoint for Acrobat comparison feature
 */
router.get('/acrobat-compare/status', async (req, res) => {
  try {
    const acrobatInstalled = await checkAcrobatInstallation();
    const acrobatPath = getAcrobatPath();

    res.json({
      success: true,
      status: acrobatInstalled ? 'operational' : 'unavailable',
      configuration: {
        acrobatInstalled,
        acrobatPath,
        timeoutSeconds: (config.acrobat?.timeoutMs || 300000) / 1000,
        maxFileSizeMB: config.pdfComparison?.maxPdfSizeMB || 50,
        requiredFiles: 2
      },
      message: acrobatInstalled
        ? 'Acrobat PDF comparison feature is ready'
        : `Adobe Acrobat DC is not installed at ${acrobatPath}. Please install Adobe Acrobat DC.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: error.message
    });
  }
});

export default router;
