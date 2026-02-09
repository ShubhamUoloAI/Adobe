#!/usr/bin/env node

import { comparePDFsWithAcrobat } from '../services/acrobatService.js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs/promises';

/**
 * CLI script to compare PDFs based on Excel file mapping
 * Usage: node compareFromExcel.js <excelPath> <pdfRootFolder> <outputDir> <mode>
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: node compareFromExcel.js <excelPath> <pdfRootFolder> <outputDir> <mode>');
    console.error('');
    console.error('Arguments:');
    console.error('  excelPath      - Path to the Excel file (.xlsx)');
    console.error('  pdfRootFolder  - Root folder containing all PDF files');
    console.error('  outputDir      - Directory to save comparison PDFs');
    console.error('  mode           - Comparison mode: "Complete" or "Text Only" (default: "Complete")');
    process.exit(1);
  }

  const [excelPath, pdfRootFolder, outputDir, mode] = args;
  const comparisonMode = mode || 'Complete';

  console.log('========================================');
  console.log('Excel-Based PDF Comparison');
  console.log('========================================');
  console.log('Excel File:', excelPath);
  console.log('PDF Root Folder:', pdfRootFolder);
  console.log('Output Dir:', outputDir);
  console.log('Comparison Mode:', comparisonMode);
  console.log('');

  try {
    // Read Excel file
    console.log('[Info] Reading Excel file...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    console.log('[Info] Sheet name:', sheetName);

    // Convert sheet to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('[Info] Total rows in Excel:', data.length);
    console.log('');

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      // Get filenames from column A (index 0) and column B (index 1)
      const file1Name = row[0];
      const file2Name = row[1];

      // Stop at first empty row
      if (!file1Name || !file2Name) {
        console.log(`[Row ${rowNum}] Empty row detected. Stopping processing.`);
        break;
      }

      console.log(`[Row ${rowNum}] Comparing: "${file1Name}" vs "${file2Name}"`);

      // Find PDF files in root folder
      const pdf1Path = path.join(pdfRootFolder, file1Name);
      const pdf2Path = path.join(pdfRootFolder, file2Name);

      // Check if files exist
      try {
        await fs.access(pdf1Path);
      } catch (error) {
        console.error(`[Row ${rowNum}] ✗ File not found: ${file1Name}`);
        failureCount++;
        continue;
      }

      try {
        await fs.access(pdf2Path);
      } catch (error) {
        console.error(`[Row ${rowNum}] ✗ File not found: ${file2Name}`);
        failureCount++;
        continue;
      }

      // Create output name: file1_vs_file2_timestamp.pdf
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                        new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      const baseName1 = path.basename(file1Name, '.pdf').replace(/[^a-zA-Z0-9_-]/g, '_');
      const baseName2 = path.basename(file2Name, '.pdf').replace(/[^a-zA-Z0-9_-]/g, '_');
      const outputName = `${baseName1}_vs_${baseName2}_${timestamp}`;

      try {
        console.log(`[Row ${rowNum}] Starting comparison...`);
        const resultPath = await comparePDFsWithAcrobat(pdf1Path, pdf2Path, outputDir, comparisonMode);

        // Rename to custom name
        const fs2 = await import('fs/promises');
        const customPath = path.join(outputDir, `${outputName}.pdf`);

        if (resultPath !== customPath) {
          await fs2.default.rename(resultPath, customPath);
          console.log(`[Row ${rowNum}] ✓ Success: ${outputName}.pdf`);
        } else {
          console.log(`[Row ${rowNum}] ✓ Success: ${outputName}.pdf`);
        }

        successCount++;
      } catch (error) {
        console.error(`[Row ${rowNum}] ✗ Comparison failed:`, error.message);
        failureCount++;
      }

      console.log('');
    }

    console.log('========================================');
    console.log('Summary');
    console.log('========================================');
    console.log('Successful comparisons:', successCount);
    console.log('Failed comparisons:', failureCount);
    console.log('Skipped rows:', skippedCount);
    console.log('========================================');

    process.exit(failureCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n========================================');
    console.error('ERROR!');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);

    process.exit(1);
  }
}

main();
