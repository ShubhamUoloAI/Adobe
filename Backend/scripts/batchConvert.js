import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import XLSX from 'xlsx';
import { extractZipAndFindInDesignFile, isValidZipFile } from '../services/zipHandler.js';
import { convertInDesignToPDF } from '../services/indesignService.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SOURCE_FOLDER = '/Users/shubham/Downloads/UoloZip';
const OUTPUT_FOLDER = '/Users/shubham/Downloads/UoloPdf';
const REPORT_FOLDER = '/Users/shubham/Downloads/UoloReport';
const TEMP_EXTRACT_PATH = path.join(__dirname, '..', 'temp', 'batch_extract');

/**
 * Main batch conversion function
 */
async function batchConvert() {
  console.log('='.repeat(60));
  console.log('InDesign Batch PDF Converter');
  console.log('='.repeat(60));
  console.log(`Source: ${SOURCE_FOLDER}`);
  console.log(`Output: ${OUTPUT_FOLDER}`);
  console.log('='.repeat(60));

  const errors = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    // Ensure output folder exists
    await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
    await fs.mkdir(TEMP_EXTRACT_PATH, { recursive: true });

    // Get all zip files from source folder
    const files = await fs.readdir(SOURCE_FOLDER);
    const zipFiles = files.filter(file => file.toLowerCase().endsWith('.zip'));

    console.log(`\nFound ${zipFiles.length} zip file(s) to process\n`);

    if (zipFiles.length === 0) {
      console.log('No zip files found in source folder.');
      return;
    }

    // Process each zip file
    for (let i = 0; i < zipFiles.length; i++) {
      const zipFile = zipFiles[i];
      const zipPath = path.join(SOURCE_FOLDER, zipFile);
      const baseName = path.basename(zipFile, '.zip');

      console.log(`\n[${ i + 1}/${zipFiles.length}] Processing: ${zipFile}`);
      console.log('-'.repeat(60));

      let extractPath = null;
      let pdfPath = null;

      try {
        // Validate zip file
        console.log('  ↻ Validating zip file...');
        const isValid = await isValidZipFile(zipPath);
        if (!isValid) {
          throw new Error('Invalid or corrupt zip file');
        }

        // Create unique extraction directory
        const extractId = uuidv4();
        extractPath = path.join(TEMP_EXTRACT_PATH, extractId);

        // Extract zip and find InDesign file
        console.log('  ↻ Extracting zip file...');
        const result = await extractZipAndFindInDesignFile(zipPath, extractPath);
        console.log(`  ✓ InDesign file found: ${path.basename(result.indesignFile)}`);

        // Convert to PDF
        console.log('  ↻ Converting to PDF...');
        pdfPath = await convertInDesignToPDF(
          result.indesignFile,
          extractPath,
          result.availableFontNames || []
        );
        console.log(`  ✓ PDF generated: ${path.basename(pdfPath)}`);

        // Copy PDF to output folder
        const outputPdfPath = path.join(OUTPUT_FOLDER, `${baseName}.pdf`);
        await fs.copyFile(pdfPath, outputPdfPath);
        console.log(`  ✓ Saved to: ${outputPdfPath}`);

        successCount++;
        console.log(`  ✅ SUCCESS`);

      } catch (error) {
        errorCount++;
        console.error(`  ❌ ERROR: ${error.message}`);

        // Log error for Excel report
        errors.push({
          filename: zipFile,
          error: error.message
        });
      } finally {
        // Clean up temporary files
        if (extractPath) {
          try {
            await fs.rm(extractPath, { recursive: true, force: true });
            console.log(`  🗑  Cleaned up temporary files`);
          } catch (cleanupErr) {
            console.warn(`  ⚠  Failed to cleanup: ${cleanupErr.message}`);
          }
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('BATCH CONVERSION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files: ${zipFiles.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('='.repeat(60));

    // Generate error log if there were errors
    if (errors.length > 0) {
      await generateErrorLog(errors);
    } else {
      console.log('\n🎉 All files converted successfully!');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Generate Excel error log
 * @param {Array} errors - Array of error objects with filename and error message
 */
async function generateErrorLog(errors) {
  console.log('\n📝 Generating error log...');

  try {
    // Ensure report folder exists
    await fs.mkdir(REPORT_FOLDER, { recursive: true });

    // Find next available numeric filename (1.xlsx, 2.xlsx, 3.xlsx, etc.)
    let counter = 1;
    let logFilename = `${counter}.xlsx`;
    let logPath = path.join(REPORT_FOLDER, logFilename);

    while (true) {
      try {
        await fs.access(logPath);
        // File exists, try next number
        counter++;
        logFilename = `${counter}.xlsx`;
        logPath = path.join(REPORT_FOLDER, logFilename);
      } catch {
        // File doesn't exist, we can use this name
        break;
      }
    }

    // Prepare data for Excel
    const worksheetData = [
      ['Filename', 'Error Message'], // Header row
      ...errors.map(err => [err.filename, err.error])
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 40 }, // Filename column width
      { wch: 80 }  // Error message column width
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Error Log');

    // Write to file
    XLSX.writeFile(workbook, logPath);

    console.log(`✓ Error log saved: ${logPath}`);
    console.log(`  Total errors logged: ${errors.length}`);

  } catch (error) {
    console.error('❌ Failed to generate error log:', error.message);
  }
}

// Run the batch conversion
console.log('\n🚀 Starting batch conversion...\n');
batchConvert()
  .then(() => {
    console.log('\n✅ Batch conversion completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Batch conversion failed:', error);
    process.exit(1);
  });
