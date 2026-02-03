import { createRequire } from 'module';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const PDFParser = require('pdf2json');

/**
 * Extract text from a PDF file using pdf2json
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<{text: string, pages: number, info: object}>} - Extracted text and metadata
 */
export async function extractTextFromPDF(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(`Failed to extract text from PDF: ${errData.parserError}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        // Extract text from all pages
        let text = '';
        if (pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                for (const run of textItem.R) {
                  text += decodeURIComponent(run.T) + ' ';
                }
              }
            }
          }
        }

        // Normalize text - replace multiple whitespace with single space and trim
        text = text.replace(/\s+/g, ' ').trim();

        resolve({
          text,
          pages: pdfData.Pages?.length || 0,
          info: {
            title: pdfData.Meta?.Title || '',
            author: pdfData.Meta?.Author || ''
          }
        });
      } catch (error) {
        reject(new Error(`Failed to process PDF data: ${error.message}`));
      }
    });

    pdfParser.loadPDF(pdfPath);
  });
}

/**
 * Extract text from multiple PDFs in parallel
 * @param {Array<{path: string, name: string}>} pdfFiles - Array of PDF file objects with path and name
 * @returns {Promise<Array<{path: string, name: string, text: string, pages: number, info: object}>>}
 */
export async function extractTextFromMultiplePDFs(pdfFiles) {
  const results = await Promise.all(
    pdfFiles.map(async (pdfFile) => {
      const data = await extractTextFromPDF(pdfFile.path);

      return {
        path: pdfFile.path,
        name: pdfFile.name,
        text: data.text,
        pages: data.pages,
        info: data.info
      };
    })
  );

  return results;
}

/**
 * Calculate simple hash of text content for quick comparison
 * @param {string} text - Text content
 * @returns {string} - Simple hash
 */
export function getTextHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Quick comparison of two texts to check if they're identical
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {boolean} - True if texts are identical
 */
export function areTextsIdentical(text1, text2) {
  return text1 === text2;
}
