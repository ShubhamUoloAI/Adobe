import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import config from '../config/config.js';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.pdfComparison.tempPdfPath);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
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

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.pdfComparison.maxPdfSizeBytes,
    files: config.pdfComparison.maxPdfCount
  },
  fileFilter: fileFilter
});

// Export middleware for multiple file upload
export const uploadPDFs = upload.array('pdfs', config.pdfComparison.maxPdfCount);

// Error handling middleware for multer errors
export function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: `File size exceeds the maximum limit of ${config.pdfComparison.maxPdfSizeMB}MB`
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: `Maximum ${config.pdfComparison.maxPdfCount} files allowed`
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
