import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import config from './config/config.js';
import uploadRouter from './routes/upload.js';
import compareRouter from './routes/compare.js';
import acrobatCompareRouter from './routes/acrobatCompare.js';
import { testInDesignConnection } from './services/indesignService.js';
import { cleanupOldFiles } from './utils/fileCleanup.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API routes
app.use('/api', uploadRouter);
app.use('/api', compareRouter);
app.use('/api', acrobatCompareRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      maxSize: `${config.maxFileSizeMB}MB`
    });
  }

  if (err.message === 'Only .zip files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  // Generic error
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Initialize server
async function initializeServer() {
  try {
    // Ensure temp directories exist
    await fs.mkdir(config.tempUploadPath, { recursive: true });
    await fs.mkdir(config.tempExtractPath, { recursive: true });
    await fs.mkdir(config.pdfComparison.tempPdfPath, { recursive: true });
    console.log('Temporary directories initialized');

    // Clean up old files on startup
    await cleanupOldFiles(config.tempUploadPath);
    await cleanupOldFiles(config.tempExtractPath);
    console.log('Old temporary files cleaned up');

    // Test InDesign application availability
    console.log('Testing Adobe InDesign availability...');
    const connected = await testInDesignConnection();

    if (connected) {
      console.log('✓ Adobe InDesign is available');
    } else {
      console.warn('⚠ Warning: Adobe InDesign not found');
      console.warn('  The server will start, but PDF conversion will fail until InDesign is installed');
      console.warn('  Run: npm run find:indesign to locate your installation');
      console.warn('  See README.md or MACOS-SERVER-SETUP.md for setup instructions');
    }

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`\n✓ Server running on http://localhost:${config.port}`);
      console.log(`✓ Upload endpoint: http://localhost:${config.port}/api/upload`);
      console.log(`✓ PDF comparison: http://localhost:${config.port}/api/compare-pdfs`);
      console.log(`✓ Acrobat compare: http://localhost:${config.port}/api/acrobat-compare`);
      console.log(`✓ Health check: http://localhost:${config.port}/health\n`);
    });

    // Set timeout for large file uploads (30 minutes)
    server.timeout = 30 * 60 * 1000; // 30 minutes
    server.keepAliveTimeout = 30 * 60 * 1000; // 30 minutes
    server.headersTimeout = 30 * 60 * 1000 + 1000; // Slightly more than keepAliveTimeout

    // Set up periodic cleanup (every 6 hours)
    setInterval(() => {
      cleanupOldFiles(config.tempUploadPath);
      cleanupOldFiles(config.tempExtractPath);
      cleanupOldFiles(config.pdfComparison.tempPdfPath);
    }, 6 * 60 * 60 * 1000);

  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
