import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import XLSX from 'xlsx';
import { extractZipAndFindInDesignFile, isValidZipFile } from '../services/zipHandler.js';
import { convertInDesignToPDF } from '../services/indesignService.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Close Adobe InDesign completely
 * @returns {Promise<void>}
 */
async function closeInDesign() {
  try {
    await execAsync('pkill -9 "Adobe InDesign"');
    console.log('  🔒 Closed Adobe InDesign');
    // Wait for process to fully terminate
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (err) {
    // pkill returns error if no process found, which is fine
    console.log('  ✓ InDesign was not running');
  }
}

/**
 * Check if error is a network connection lost error
 * @param {Error} error - The error to check
 * @returns {boolean} True if it's a network connection error
 */
function isNetworkConnectionError(error) {
  const errorMsg = error.message.toLowerCase();
  return errorMsg.includes('network connection was lost') ||
         errorMsg.includes('modified by another process') ||
         errorMsg.includes('file was modified');
}

/**
 * Show folder selection dialog (macOS)
 * @param {string} promptMessage - Message to display in dialog
 * @returns {Promise<string>} Selected folder path
 */
async function selectFolder(promptMessage) {
  try {
    const appleScript = `
      tell application "System Events"
        activate
        set folderPath to choose folder with prompt "${promptMessage}"
        return POSIX path of folderPath
      end tell
    `;

    const result = execSync(`osascript -e '${appleScript}'`, { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    throw new Error(`Folder selection cancelled or failed: ${error.message}`);
  }
}

/**
 * Get folder configuration from user
 * @returns {Promise<Object>} Configuration object with folder paths
 */
async function getFolderConfiguration() {
  console.log('\n📁 Folder Configuration');
  console.log('='.repeat(60));
  console.log('Please select the required folders...\n');

  // Select source folder
  console.log('1️⃣  Select SOURCE folder (containing .zip files)');
  const SOURCE_FOLDER = await selectFolder('Select SOURCE folder with InDesign ZIP files');
  console.log(`   ✓ Source: ${SOURCE_FOLDER}\n`);

  // Select output folder
  console.log('2️⃣  Select OUTPUT folder (for generated PDFs)');
  const OUTPUT_FOLDER = await selectFolder('Select OUTPUT folder for PDFs');
  console.log(`   ✓ Output: ${OUTPUT_FOLDER}\n`);

  // Select report folder
  console.log('3️⃣  Select REPORT folder (for error logs)');
  const REPORT_FOLDER = await selectFolder('Select REPORT folder for error logs');
  console.log(`   ✓ Report: ${REPORT_FOLDER}\n`);

  // Create config file in source folder
  const configPath = path.join(SOURCE_FOLDER, 'batch-config.json');
  const config = {
    SOURCE_FOLDER,
    OUTPUT_FOLDER,
    REPORT_FOLDER,
    TEMP_EXTRACT_PATH: path.join(__dirname, '..', 'temp', 'batch_extract'),
    createdAt: new Date().toISOString()
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  console.log(`💾 Configuration saved to: ${configPath}`);
  console.log('='.repeat(60));

  return config;
}

/**
 * Main batch conversion function
 */
async function batchConvert() {
  console.log('='.repeat(60));
  console.log('InDesign Batch PDF Converter');
  console.log('='.repeat(60));

  // Get folder configuration from user
  const config = await getFolderConfiguration();
  const { SOURCE_FOLDER, OUTPUT_FOLDER, REPORT_FOLDER, TEMP_EXTRACT_PATH } = config;

  console.log('\n' + '='.repeat(60));
  console.log('Starting Batch Conversion');
  console.log('='.repeat(60));
  console.log(`Source: ${SOURCE_FOLDER}`);
  console.log(`Output: ${OUTPUT_FOLDER}`);
  console.log(`Report: ${REPORT_FOLDER}`);
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
    const zipFiles = files.filter(file => file.toLowerCase().endsWith('.zip') && file !== '__MACOSX');

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

      // Close InDesign before processing each file
      await closeInDesign();

      let extractPath = null;
      let pdfPath = null;
      let retryCount = 0;
      const MAX_RETRIES = 1; // One retry for network errors

      // Retry loop for network connection errors
      while (retryCount <= MAX_RETRIES) {
        try {
          // Validate zip file
          if (retryCount === 0) {
            console.log('  ↻ Validating zip file...');
            const isValid = await isValidZipFile(zipPath);
            if (!isValid) {
              throw new Error('Invalid or corrupt zip file');
            }
          } else {
            console.log(`  🔄 Retry attempt ${retryCount}/${MAX_RETRIES}...`);
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

          // Success - break out of retry loop
          break;

        } catch (error) {
          // Check if it's a network connection error and we haven't exhausted retries
          if (isNetworkConnectionError(error) && retryCount < MAX_RETRIES) {
            console.error(`  ⚠️  Network connection error detected: ${error.message}`);
            console.log('  🔄 Closing InDesign and preparing to retry...');

            // Close InDesign completely before retry
            await closeInDesign();

            // Clean up extraction directory before retry
            if (extractPath) {
              try {
                await fs.rm(extractPath, { recursive: true, force: true });
                console.log(`  🗑  Cleaned up temporary files before retry`);
              } catch (cleanupErr) {
                console.warn(`  ⚠  Failed to cleanup: ${cleanupErr.message}`);
              }
            }

            retryCount++;
            continue; // Try again
          }

          // Not a network error or no more retries - log and move to next file
          errorCount++;
          console.error(`  ❌ ERROR: ${error.message}`);

          // Log error for Excel report
          errors.push({
            filename: zipFile,
            error: error.message
          });

          break; // Exit retry loop
        } finally {
          // Clean up temporary files only if we're done with retries
          if ((retryCount > MAX_RETRIES || pdfPath) && extractPath) {
            try {
              await fs.rm(extractPath, { recursive: true, force: true });
              console.log(`  🗑  Cleaned up temporary files`);
            } catch (cleanupErr) {
              console.warn(`  ⚠  Failed to cleanup: ${cleanupErr.message}`);
            }
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
      await generateErrorLog(errors, REPORT_FOLDER);
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
 * @param {string} REPORT_FOLDER - Path to report folder
 */
async function generateErrorLog(errors, REPORT_FOLDER) {
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


  // use: npm run batch:convert