#!/usr/bin/env node

import { comparePDFsWithAcrobat } from '../services/acrobatService.js';
import path from 'path';

/**
 * CLI script to compare two PDFs using Acrobat
 * Usage: node comparePdfs.js <pdf1> <pdf2> <outputDir> [outputName]
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: node comparePdfs.js <pdf1> <pdf2> <outputDir> [outputName] [mode]');
    console.error('');
    console.error('Arguments:');
    console.error('  pdf1       - Path to the first PDF file');
    console.error('  pdf2       - Path to the second PDF file');
    console.error('  outputDir  - Directory to save the comparison PDF');
    console.error('  outputName - (Optional) Custom name for output PDF (without .pdf extension)');
    console.error('  mode       - (Optional) Comparison mode: "Complete" or "Text Only" (default: "Complete")');
    process.exit(1);
  }

  const [pdf1, pdf2, outputDir, outputName, mode] = args;
  const comparisonMode = mode || 'Complete';

  console.log('========================================');
  console.log('PDF Comparison');
  console.log('========================================');
  console.log('PDF 1:', pdf1);
  console.log('PDF 2:', pdf2);
  console.log('Output Dir:', outputDir);
  if (outputName) {
    console.log('Output Name:', outputName);
  }
  console.log('Comparison Mode:', comparisonMode);
  console.log('');

  try {
    const resultPath = await comparePDFsWithAcrobat(pdf1, pdf2, outputDir, comparisonMode);

    // If custom output name is provided, rename the file
    if (outputName) {
      const fs = await import('fs/promises');
      const customPath = path.join(outputDir, `${outputName}.pdf`);

      if (resultPath !== customPath) {
        console.log(`[Info] Renaming to custom name: ${outputName}.pdf`);
        await fs.rename(resultPath, customPath);
        console.log('[Info] Rename successful');

        console.log('\n========================================');
        console.log('SUCCESS!');
        console.log('========================================');
        console.log('Comparison PDF created at:', customPath);

        // Output the path for bash script to capture
        console.log('RESULT_PATH=' + customPath);
      } else {
        console.log('\n========================================');
        console.log('SUCCESS!');
        console.log('========================================');
        console.log('Comparison PDF created at:', resultPath);

        // Output the path for bash script to capture
        console.log('RESULT_PATH=' + resultPath);
      }
    } else {
      console.log('\n========================================');
      console.log('SUCCESS!');
      console.log('========================================');
      console.log('Comparison PDF created at:', resultPath);

      // Output the path for bash script to capture
      console.log('RESULT_PATH=' + resultPath);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('ERROR!');
    console.error('========================================');
    console.error('Error code:', error.code || 'UNKNOWN');
    console.error('Error message:', error.message);

    // Output error for bash script to capture
    console.error('ERROR_MESSAGE=' + error.message);

    process.exit(1);
  }
}

main();
