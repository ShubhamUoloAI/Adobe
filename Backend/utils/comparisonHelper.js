import { areTextsIdentical } from '../services/pdfExtractor.js';
import { comparePDFTexts, generateComparisonSummary } from '../services/openaiService.js';

/**
 * Perform pairwise comparisons of all PDFs
 * @param {Array<{name: string, text: string}>} pdfData - Array of PDF data with name and text
 * @returns {Promise<Array>} - Array of comparison results
 */
export async function performPairwiseComparisons(pdfData) {
  const comparisons = [];
  const n = pdfData.length;

  // Quick identical check first
  const identicalGroups = findIdenticalGroups(pdfData);

  // Perform pairwise comparisons
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pdf1 = pdfData[i];
      const pdf2 = pdfData[j];

      // Check if they're in the same identical group
      const isIdentical = areTextsIdentical(pdf1.text, pdf2.text);

      if (isIdentical) {
        // Skip OpenAI call for identical files
        comparisons.push({
          file1: pdf1.name,
          file2: pdf2.name,
          identical: true,
          similarity: 100,
          differences: {
            additions: [],
            deletions: [],
            modifications: []
          },
          summary: 'Documents are identical.'
        });
      } else {
        // Use OpenAI for non-identical files
        const comparison = await comparePDFTexts(
          pdf1.text,
          pdf2.text,
          pdf1.name,
          pdf2.name
        );
        comparisons.push(comparison);
      }
    }
  }

  return comparisons;
}

/**
 * Find groups of identical documents
 * @param {Array<{name: string, text: string}>} pdfData - Array of PDF data
 * @returns {Array<Array<string>>} - Groups of identical file names
 */
export function findIdenticalGroups(pdfData) {
  const groups = [];
  const processed = new Set();

  for (let i = 0; i < pdfData.length; i++) {
    if (processed.has(i)) continue;

    const group = [pdfData[i].name];
    processed.add(i);

    for (let j = i + 1; j < pdfData.length; j++) {
      if (processed.has(j)) continue;

      if (areTextsIdentical(pdfData[i].text, pdfData[j].text)) {
        group.push(pdfData[j].name);
        processed.add(j);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Check if all PDFs are identical
 * @param {Array} comparisons - Array of comparison results
 * @returns {boolean} - True if all PDFs are identical
 */
export function areAllIdentical(comparisons) {
  return comparisons.length > 0 && comparisons.every(comp => comp.identical);
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Create formatted response for comparison results
 * @param {Array} pdfFiles - Array of uploaded file objects
 * @param {Array} pdfData - Array of extracted PDF data
 * @param {Array} comparisons - Array of comparison results
 * @param {string} comparisonId - Unique comparison ID
 * @param {number} startTime - Start timestamp
 * @returns {Promise<Object>} - Formatted response
 */
export async function createComparisonResponse(pdfFiles, pdfData, comparisons, comparisonId, startTime) {
  const fileNames = pdfData.map(pdf => pdf.name);
  const identicalGroups = findIdenticalGroups(pdfData);
  const allIdentical = areAllIdentical(comparisons);

  // Generate overall summary
  const summary = await generateComparisonSummary(comparisons, fileNames);

  // Calculate processing time
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  return {
    success: true,
    comparisonId,
    totalFiles: pdfFiles.length,
    files: pdfFiles.map(file => ({
      name: file.originalname,
      size: formatFileSize(file.size)
    })),
    results: {
      allIdentical,
      pairwiseComparisons: comparisons,
      summary,
      identicalGroups: identicalGroups.length > 0 ? identicalGroups : null
    },
    processingTime
  };
}

/**
 * Validate comparison request
 * @param {Array} files - Uploaded files
 * @param {number} maxCount - Maximum file count
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Object} - Validation result
 */
export function validateComparisonRequest(files, maxCount, maxSize) {
  if (!files || files.length === 0) {
    return {
      valid: false,
      error: 'No files uploaded. Please upload at least 2 PDF files.'
    };
  }

  if (files.length < 2) {
    return {
      valid: false,
      error: 'At least 2 PDF files are required for comparison.'
    };
  }

  if (files.length > maxCount) {
    return {
      valid: false,
      error: `Maximum ${maxCount} PDF files allowed. You uploaded ${files.length} files.`
    };
  }

  for (const file of files) {
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File "${file.originalname}" exceeds maximum size of ${formatFileSize(maxSize)}.`
      };
    }

    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return {
        valid: false,
        error: `File "${file.originalname}" is not a PDF file. Only PDF files are allowed.`
      };
    }
  }

  return { valid: true };
}
