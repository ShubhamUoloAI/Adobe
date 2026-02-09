import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import config from '../config/config.js';

// Configure storage for Acrobat comparison PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = config.pdfComparison?.tempPdfPath || './temp/pdfs';
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `acrobat_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// File filter to accept only PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Create multer upload instance for exactly 2 files
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.pdfComparison?.maxPdfSizeBytes || 50 * 1024 * 1024, // 50MB default
    files: 2 // Exactly 2 files for Acrobat comparison
  },
  fileFilter: fileFilter
});

// Export middleware for exactly 2 file upload
export const uploadAcrobatPDFs = upload.array('pdfs', 2);

// Error handling middleware for multer errors
export function handleAcrobatUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: `File size exceeds the maximum limit of ${(config.pdfComparison?.maxPdfSizeMB || 50)}MB`
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Exactly 2 PDF files are required for Acrobat comparison'
      });
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected field',
        message: 'Unexpected file field. Use "pdfs" as the field name.'
      });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: 'Upload error',
      message: err.message
    });
  }
  next();
}
