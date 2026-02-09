import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { comparePDFsWithAcrobat } from '../services/acrobatService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_FOLDER = '/Users/shubham/Downloads/Uolo-pdf';
const OUTPUT_FOLDER = '/Users/shubham/Downloads/Uolo-pdf/Report';

/**
 * Get all folders in a directory
 */
function getFolders(dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    return items.filter(item => {
      const fullPath = path.join(dirPath, item);
      return fs.statSync(fullPath).isDirectory() && !item.startsWith('.');
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
    return [];
  }
}

/**
 * Get all PDF files in a folder
 */
function getPdfsInFolder(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    return files
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => path.join(folderPath, file));
  } catch (error) {
    console.error(`Error reading PDFs in ${folderPath}:`, error.message);
    return [];
  }
}

/**
 * Main function to batch compare PDFs
 */
async function batchComparePdfs() {
  console.log('='.repeat(60));
  console.log('Adobe Acrobat Batch PDF Comparison');
  console.log('='.repeat(60));
  console.log(`Base folder: ${BASE_FOLDER}`);
  console.log(`Output folder: ${OUTPUT_FOLDER}`);
  console.log('='.repeat(60));
  console.log();

  // Check if base folder exists
  if (!fs.existsSync(BASE_FOLDER)) {
    console.error(`❌ Error: Base folder does not exist: ${BASE_FOLDER}`);
    process.exit(1);
  }

  // Create output folder if it doesn't exist
  if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
    console.log(`✓ Created output folder: ${OUTPUT_FOLDER}\n`);
  }

  // Get all folders
  const folders = getFolders(BASE_FOLDER);

  if (folders.length === 0) {
    console.log('No folders found in base directory.');
    return;
  }

  console.log(`Found ${folders.length} folders to process\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process each folder
  for (let i = 0; i < folders.length; i++) {
    const folderName = folders[i];
    const folderPath = path.join(BASE_FOLDER, folderName);

    console.log(`[${i + 1}/${folders.length}] Processing: ${folderName}`);

    // Get PDFs in this folder
    const pdfs = getPdfsInFolder(folderPath);

    if (pdfs.length !== 2) {
      console.log(`  ⚠️  Skipped - Found ${pdfs.length} PDFs (expected 2)`);
      skippedCount++;
      console.log();
      continue;
    }

    const [pdf1, pdf2] = pdfs;
    console.log(`  PDF 1: ${path.basename(pdf1)}`);
    console.log(`  PDF 2: ${path.basename(pdf2)}`);

    // Save comparison PDF in the output folder (create subfolder for each source folder)
    const folderOutputDir = path.join(OUTPUT_FOLDER, folderName);
    const outputPath = path.join(folderOutputDir, 'comparison-report.pdf');

    // Create subfolder in output directory
    if (!fs.existsSync(folderOutputDir)) {
      fs.mkdirSync(folderOutputDir, { recursive: true });
    }

    try {
      console.log('  🔄 Starting comparison...');

      // Call Acrobat comparison - output will be saved in the output folder
      const resultPath = await comparePDFsWithAcrobat(pdf1, pdf2, folderOutputDir);

      // Check if result was created
      if (fs.existsSync(resultPath)) {
        // Rename to standard name
        if (resultPath !== outputPath) {
          fs.renameSync(resultPath, outputPath);
        }

        const stats = fs.statSync(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`  ✅ Success - Comparison saved (${fileSizeMB} MB)`);
        console.log(`  📄 Output: ${outputPath}`);
        successCount++;
      } else {
        console.log('  ❌ Failed - Output file was not created');
        errorCount++;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errorCount++;
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total folders: ${folders.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);
  console.log('='.repeat(60));
}

// Run the script
batchComparePdfs()
  .then(() => {
    console.log('\n✓ Batch comparison completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
