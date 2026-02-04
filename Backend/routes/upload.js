import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config.js';
import { extractZipAndFindInDesignFile, isValidZipFile } from '../services/zipHandler.js';
import { convertInDesignToPDF } from '../services/indesignService.js';
import { deleteMultiple } from '../utils/fileCleanup.js';
import { downloadMissingFonts } from '../services/fontDownloader.js';
import fs from 'fs/promises';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.tempUploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeBytes
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return cb(new Error('Only .zip files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * POST /api/upload
 * Handles zip file upload and converts InDesign files to PDF
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  let uploadedFilePath = null;
  let extractPath = null;
  let pdfPath = null;
  let installedFonts = [];

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    uploadedFilePath = req.file.path;
    console.log(`File uploaded: ${uploadedFilePath}`);

    // Validate zip file
    const isValid = await isValidZipFile(uploadedFilePath);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or corrupt zip file' });
    }

    // Create unique extraction directory
    const extractId = uuidv4();
    extractPath = path.join(config.tempExtractPath, extractId);

    // Extract zip and find InDesign file
    console.log('Extracting zip file...');
    const result = await extractZipAndFindInDesignFile(uploadedFilePath, extractPath);
    installedFonts = result.installedFonts || [];
    console.log(`InDesign file found: ${result.indesignFile}`);

    // Convert to PDF using InDesign (with automatic font download retry)
    console.log('Converting to PDF...');
    try {
      pdfPath = await convertInDesignToPDF(result.indesignFile, extractPath, result.availableFontNames || []);
      console.log(`PDF generated: ${pdfPath}`);
    } catch (conversionError) {
      // Check if this is a font missing error or preflight error
      if (conversionError.code === 'INDESIGN_CONVERSION_FAILED' &&
          (conversionError.message.includes('Missing Fonts') || conversionError.message.includes('Preflight Failed'))) {

        // Store the original error message to show to user if retry fails
        const originalErrorMessage = conversionError.message;

        console.log('\n⚠ Font missing detected. Attempting to download missing fonts...');
        console.log('Error message:', conversionError.message);

        // Parse missing font names from error message
        const missingFonts = parseMissingFonts(conversionError.message);
        console.log('Parsed missing fonts:', missingFonts);

        if (missingFonts.length > 0) {
          console.log(`Found ${missingFonts.length} missing font(s):`, missingFonts);

          // Try to download missing fonts
          try {
            const downloadDir = path.join(extractPath, 'downloaded_fonts');
            const downloadedFonts = await downloadMissingFonts(missingFonts, downloadDir);
            console.log('Downloaded fonts:', downloadedFonts);

            if (downloadedFonts.length > 0) {
              // Install the downloaded fonts permanently
              const { availableFontNames: newFontNames } = await installAdditionalFonts(downloadedFonts);

              // Merge available font names
              const updatedFontNames = [...(result.availableFontNames || []), ...newFontNames];

              console.log(`✓ Successfully downloaded and installed ${downloadedFonts.length} font(s)`);
              result.availableFontNames = updatedFontNames;
            } else {
              console.log('⚠ No fonts could be downloaded from available sources');
            }
          } catch (downloadError) {
            console.error('⚠ Error during font download/install:', downloadError.message);
            // Continue to retry anyway - fonts might be available from other sources
          }
        } else {
          console.log('⚠ Could not parse missing fonts from error message');
        }

        // ALWAYS retry conversion once, regardless of download success
        // The fonts might be available after cache refresh or manual installation
        console.log('\n↻ Retrying PDF conversion (one retry allowed)...');
        try {
          pdfPath = await convertInDesignToPDF(result.indesignFile, extractPath, result.availableFontNames || []);
          console.log(`✓ PDF generated successfully on retry: ${pdfPath}`);
        } catch (retryError) {
          // Retry failed - throw the ORIGINAL error with preflight details, not the retry error
          console.error('✗ PDF conversion failed on retry:', retryError.message);
          console.log('⚠ Returning original preflight error to user');

          // Throw the original error which has the detailed preflight information
          const originalError = new Error(originalErrorMessage);
          originalError.code = 'INDESIGN_CONVERSION_FAILED';
          throw originalError;
        }
      } else {
        // Not a font error, re-throw
        throw conversionError;
      }
    }

    // Send PDF file to client
    const originalName = path.basename(req.file.originalname, '.zip');
    res.download(pdfPath, `${originalName}.pdf`, async (err) => {
      // Clean up temporary files (but NOT fonts - they stay permanently)
      await cleanupFiles([uploadedFilePath, extractPath, pdfPath]);

      if (err) {
        console.error('Error sending file:', err);
      }
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Clean up temporary files on error (but NOT fonts - they stay permanently)
    await cleanupFiles([uploadedFilePath, extractPath, pdfPath]);

    // Handle InDesign conversion errors (including preflight failures)
    if (error.code === 'INDESIGN_CONVERSION_FAILED') {
      // Check if this is a preflight error
      const isPreflightError = error.message.includes('Preflight Failed');

      return res.status(422).json({
        error: isPreflightError ? 'Preflight Check Failed' : 'InDesign Conversion Failed',
        message: error.message,
        code: error.code,
        isPreflight: isPreflightError
      });
    }

    // Handle file not found errors
    if (error.code === 'FILE_NOT_FOUND' || error.message.includes('No InDesign file')) {
      return res.status(400).json({
        error: 'File Not Found',
        message: error.message,
        code: error.code
      });
    }

    // Handle timeout errors
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        error: 'Conversion Timeout',
        message: error.message,
        code: error.code
      });
    }

    // Generic error
    res.status(500).json({
      error: 'Failed to process file',
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * Helper function to clean up temporary files
 * @param {string[]} paths - Array of file/directory paths to delete
 */
async function cleanupFiles(paths) {
  const validPaths = paths.filter(p => p !== null && p !== undefined);
  if (validPaths.length > 0) {
    await deleteMultiple(validPaths);
    console.log('Cleaned up temporary files');
  }
}

/**
 * Parses missing font names from error message
 * @param {string} errorMessage - Error message containing missing fonts
 * @returns {string[]} - Array of missing font names
 */
function parseMissingFonts(errorMessage) {
  const fonts = [];
  const lines = errorMessage.split('\n');

  console.log('\n=== DEBUG: Font Parsing ===');
  console.log('Total lines:', lines.length);

  let inFontSection = false;
  let foundFontListHeader = false;
  let linesSinceHeader = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're entering the font section
    if (line.includes('Missing Fonts')) {
      inFontSection = true;
      console.log(`Line ${i}: Entering font section - "${line}"`);
      continue;
    }

    // Skip the "The following fonts are NOT..." line
    if (inFontSection && line.includes('following fonts are')) {
      foundFontListHeader = true;
      console.log(`Line ${i}: Found font list header - "${line}"`);
      continue;
    }

    if (inFontSection && foundFontListHeader) {
      linesSinceHeader++;
      const trimmedLine = line.trim();

      console.log(`Line ${i} (after header +${linesSinceHeader}):`, {
        raw: line,
        trimmed: trimmedLine,
        charCodes: Array.from(trimmedLine).map(c => `${c}(${c.charCodeAt(0)})`).join(' ')
      });

      // Skip empty lines immediately after header
      if (trimmedLine === '' && linesSinceHeader < 3) {
        console.log('  -> Skipping empty line after header');
        continue;
      }

      // Check for end of font list
      if (trimmedLine === '' || trimmedLine.includes('Solutions') || trimmedLine.includes('Available')) {
        console.log('  -> End of font list detected');
        break;
      }

      // Extract font name by finding the pattern:
      // - Font names typically start with capital letter
      // - May contain spaces, hyphens, parentheses (for format like "(OTF)")
      // - Followed by optional weight (Medium, Bold, etc.)

      // Try to match font name pattern: letters/spaces/hyphens/parentheses
      const fontMatch = trimmedLine.match(/([A-Z][A-Za-z0-9\s\-()]+)/);

      if (fontMatch) {
        let fontName = fontMatch[1].trim();
        console.log('  -> Extracted font name:', fontName);

        // Make sure it's not empty and looks like a font name
        if (fontName && fontName.length > 2 && !fontName.includes('Solutions') && !fontName.includes('Available')) {
          console.log('  -> ✓ Adding font:', fontName);
          fonts.push(fontName);
        } else {
          console.log('  -> ✗ Rejected (empty, too short, or contains stop words)');
        }
      } else {
        console.log('  -> ✗ No font pattern matched');
      }
    }
  }

  console.log('Final parsed fonts:', fonts);
  console.log('=== END DEBUG ===\n');

  // If we couldn't parse any fonts using the structured approach, try a regex fallback
  if (fonts.length === 0 && errorMessage.includes('Missing Fonts')) {
    console.log('No fonts found with structured parsing, trying regex fallback...');

    // Extract font names using patterns like "FontFamily-Weight" or "FontFamily (Format) Weight"
    // This regex looks for capitalized words followed by optional (format) and weight descriptors
    const fontPattern = /([A-Z][a-z]+(?:-[A-Z][a-z]+)*)\s*(?:\([^)]+\))?\s*(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black|[\d]+)?/gi;
    const matches = errorMessage.matchAll(fontPattern);

    const candidateFonts = new Set();
    for (const match of matches) {
      const family = match[1];
      const weight = match[2];

      // Skip common words that aren't fonts
      if (['Missing', 'Fonts', 'The', 'Following', 'Available', 'Solutions', 'Document'].includes(family)) {
        continue;
      }

      // Construct font name
      if (weight) {
        candidateFonts.add(`${family} ${weight}`);
      } else {
        candidateFonts.add(family);
      }
    }

    console.log('Regex fallback found candidates:', Array.from(candidateFonts));
    return Array.from(candidateFonts);
  }

  return fonts;
}

/**
 * Installs downloaded fonts permanently to the system
 * @param {string[]} fontPaths - Array of font file paths to install
 * @returns {Promise<{availableFontNames: string[]}>}
 */
async function installAdditionalFonts(fontPaths) {
  const availableFontNames = [];

  if (fontPaths.length === 0) {
    return { availableFontNames };
  }

  console.log(`Installing ${fontPaths.length} downloaded font(s) permanently...`);

  // Install directly to user fonts directory (no temp subdirectory)
  const userFontsDir = path.join(process.env.HOME || '/Users/' + process.env.USER, 'Library', 'Fonts');
  await fs.mkdir(userFontsDir, { recursive: true });

  for (const fontPath of fontPaths) {
    const fontName = path.basename(fontPath);
    const destPath = path.join(userFontsDir, fontName);

    try {
      // Check if font already exists
      try {
        await fs.access(destPath);
        console.log(`  ℹ Already exists: ${fontName}`);
      } catch {
        // Font doesn't exist, install it
        await fs.copyFile(fontPath, destPath);
        console.log(`  ✓ Installed permanently: ${fontName}`);
      }

      // Extract font base name for validation
      const baseName = path.basename(fontName, path.extname(fontName));
      availableFontNames.push(baseName);

    } catch (err) {
      console.warn(`  ⚠ Failed to install ${fontName}: ${err.message}`);
    }
  }

  // Refresh font cache
  console.log('Refreshing font cache for new fonts...');
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync('atsutil databases -remove');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('  ✓ Font cache refreshed');
  } catch (err) {
    console.warn('  ⚠ Could not refresh font cache:', err.message);
  }

  console.log(`✓ Downloaded fonts installed permanently to ~/Library/Fonts`);

  return { availableFontNames };
}

export default router;
