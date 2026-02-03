import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { uploadPDFs, handleUploadErrors } from '../middleware/pdfUpload.js';
import { comparePDFsDirectly } from '../services/openaiService.js';
import { validateComparisonRequest, formatFileSize } from '../utils/comparisonHelper.js';
import { deleteMultiple } from '../utils/fileCleanup.js';
import config from '../config/config.js';

const router = express.Router();

/**
 * POST /api/compare-pdfs
 * Compare multiple PDF files by sending them directly to OpenAI
 */
router.post('/compare-pdfs', uploadPDFs, handleUploadErrors, async (req, res) => {
  const startTime = Date.now();
  let uploadedFiles = req.files || [];

  try {
    console.log(`[PDF Comparison] Received ${uploadedFiles.length} files for comparison`);

    // Validate request
    const validation = validateComparisonRequest(
      uploadedFiles,
      config.pdfComparison.maxPdfCount,
      config.pdfComparison.maxPdfSizeBytes
    );

    if (!validation.valid) {
      await deleteMultiple(uploadedFiles.map(f => f.path));
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: validation.error
      });
    }

    // Generate unique comparison ID
    const comparisonId = uuidv4();

    // Send PDFs directly to OpenAI for comparison
    console.log('[PDF Comparison] Sending PDFs to OpenAI for comparison...');
    const comparisonResults = await comparePDFsDirectly(uploadedFiles);
    console.log('[PDF Comparison] Comparison complete');

    // Calculate processing time
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

    // Format response
    const response = {
      success: true,
      comparisonId,
      totalFiles: uploadedFiles.length,
      files: uploadedFiles.map(file => ({
        name: file.originalname,
        size: formatFileSize(file.size)
      })),
      results: comparisonResults,
      processingTime
    };

    // Clean up uploaded files
    await deleteMultiple(uploadedFiles.map(f => f.path));
    console.log(`[PDF Comparison] Completed in ${processingTime}`);

    res.json(response);

  } catch (error) {
    console.error('[PDF Comparison Error]', error);

    // Clean up uploaded files on error
    if (uploadedFiles.length > 0) {
      await deleteMultiple(uploadedFiles.map(f => f.path)).catch(err =>
        console.error('Error cleaning up files:', err)
      );
    }

    // Handle specific error types
    if (error.message.includes('OpenAI') || error.message.includes('API key')) {
      return res.status(503).json({
        success: false,
        error: 'AI service error',
        message: error.message
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: 'Comparison failed',
      message: error.message || 'An error occurred during PDF comparison. Please try again.'
    });
  }
});

/**
 * GET /api/compare-pdfs/status
 * Health check endpoint for PDF comparison feature
 */
router.get('/compare-pdfs/status', (req, res) => {
  const hasOpenAIKey = !!config.openai.apiKey && config.openai.apiKey !== 'your-openai-api-key-here';

  res.json({
    success: true,
    status: 'operational',
    configuration: {
      maxFiles: config.pdfComparison.maxPdfCount,
      maxFileSizeMB: config.pdfComparison.maxPdfSizeMB,
      model: config.openai.model,
      openAIConfigured: hasOpenAIKey
    },
    message: hasOpenAIKey
      ? 'PDF comparison feature is ready'
      : 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file'
  });
});

export default router;
