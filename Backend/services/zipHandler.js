import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Extracts a zip file and finds InDesign files
 * @param {string} zipPath - Path to the zip file
 * @param {string} extractPath - Path to extract the contents to
 * @returns {Promise<{indesignFile: string, extractedPath: string, installedFonts: string[]}>}
 */
export async function extractZipAndFindInDesignFile(zipPath, extractPath) {
  try {
    // Extract the zip file
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    // Find InDesign file (.indd or .idml)
    const indesignFile = await findInDesignFile(extractPath);

    if (!indesignFile) {
      throw new Error('No InDesign file (.indd or .idml) found in the zip');
    }

    // Ensure Document fonts folder is accessible to InDesign
    const { installedFonts, availableFontNames } = await ensureDocumentFontsAccessible(indesignFile, extractPath);

    return {
      indesignFile,
      extractedPath: extractPath,
      installedFonts,
      availableFontNames
    };
  } catch (error) {
    if (error.message.includes('No InDesign file')) {
      throw error;
    }
    throw new Error(`Failed to extract zip file: ${error.message}`);
  }
}

/**
 * Recursively searches for InDesign files in a directory
 * @param {string} dirPath - Directory to search
 * @returns {Promise<string|null>} - Path to the InDesign file or null
 */
async function findInDesignFile(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip system directories
        if (entry.name.startsWith('.') || entry.name === '__MACOSX') {
          continue;
        }

        // Recursively search subdirectories
        const found = await findInDesignFile(fullPath);
        if (found) return found;
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.indd' || ext === '.idml') {
          return fullPath;
        }
      }
    }

    return null;
  } catch (error) {
    throw new Error(`Error searching for InDesign file: ${error.message}`);
  }
}

/**
 * Ensures "Document fonts" folder is accessible to InDesign
 * Installs fonts temporarily to ~/Library/Fonts for InDesign to access
 *
 * @param {string} indesignFilePath - Path to the InDesign file
 * @param {string} extractPath - Root extraction path
 * @returns {Promise<{installedFonts: string[], availableFontNames: string[]}>} - Installed fonts and available font names
 */
async function ensureDocumentFontsAccessible(indesignFilePath, extractPath) {
  const installedFonts = [];
  const availableFontNames = [];

  try {
    const indesignDir = path.dirname(indesignFilePath);
    const indesignParentDir = path.dirname(indesignDir);

    // Search for Document fonts folder
    const searchLocations = [
      path.join(indesignDir, 'Document fonts'),
      path.join(indesignParentDir, 'Document fonts')
    ];

    let documentFontsPath = null;

    // Check common locations first
    for (const location of searchLocations) {
      try {
        await fs.access(location);
        documentFontsPath = location;
        console.log(`✓ Found "Document fonts" folder at: ${location}`);
        break;
      } catch (e) {
        // Continue searching
      }
    }

    // If not found in common locations, search entire extracted directory
    if (!documentFontsPath) {
      console.log('Searching for "Document fonts" folder...');
      documentFontsPath = await findDocumentFontsFolder(extractPath);
    }

    if (documentFontsPath) {
      // Get list of font files
      const fontFiles = await getFontFiles(documentFontsPath);

      if (fontFiles.length > 0) {
        console.log(`Found ${fontFiles.length} font file(s) in "Document fonts" folder:`);
        fontFiles.forEach(f => console.log(`  - ${path.basename(f)}`));

        // Ensure InDesign is not running (so it doesn't cache old font list)
        console.log('\nEnsuring InDesign is not running...');
        try {
          await execAsync('pkill -9 "Adobe InDesign"');
          console.log('  ✓ Closed any running InDesign instances');
          // Wait a moment for the process to fully terminate
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          // pkill returns error if no process found, which is fine
          console.log('  ✓ No InDesign instances were running');
        }

        console.log('\nInstalling fonts permanently to ~/Library/Fonts...');

        // Install directly to user fonts directory (no temp subdirectory)
        const userFontsDir = path.join(process.env.HOME || '/Users/' + process.env.USER, 'Library', 'Fonts');
        await fs.mkdir(userFontsDir, { recursive: true });

        for (const fontFile of fontFiles) {
          const fontName = path.basename(fontFile);
          const destPath = path.join(userFontsDir, fontName);

          try {
            // Check if font already exists
            try {
              await fs.access(destPath);
              console.log(`  ℹ Already exists: ${fontName}`);
            } catch {
              // Font doesn't exist, install it
              await fs.copyFile(fontFile, destPath);
              console.log(`  ✓ Installed permanently: ${fontName}`);
            }

            // Track installed font (but won't be cleaned up)
            installedFonts.push(destPath);

            // Extract font base name for validation (e.g., "Poppins-Bold", "Solway-ExtraBold")
            const baseName = path.basename(fontName, path.extname(fontName));
            availableFontNames.push(baseName);

          } catch (err) {
            console.warn(`  ⚠ Failed to install ${fontName}: ${err.message}`);
          }
        }

        console.log(`✓ Successfully installed ${installedFonts.length} font(s) permanently`);

        // Refresh macOS font cache to ensure fonts are recognized
        console.log('Refreshing macOS font cache...');
        try {
          // Clear font caches - this forces macOS to rebuild and recognize new fonts
          await execAsync('atsutil databases -remove');
          console.log('  ✓ Font cache cleared');

          // Wait for font cache to rebuild (5 seconds should be enough)
          console.log('Waiting for font cache to rebuild...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log('  ✓ Font cache rebuilt');
        } catch (err) {
          console.warn(`  ⚠ Could not refresh font cache: ${err.message}`);
          console.warn('  Fonts may not be immediately available to InDesign');
          // Still wait to give fonts a chance to register naturally
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } else {
        console.log('⚠ "Document fonts" folder is empty');
      }
    } else {
      console.log('⚠ No "Document fonts" folder found in the zip file');
      console.log('  If the document uses custom fonts, the conversion may fail');
    }

  } catch (error) {
    console.warn('Warning: Error processing Document fonts folder:', error.message);
  }

  return { installedFonts, availableFontNames };
}

/**
 * Gets all font files from a directory
 * @param {string} dirPath - Directory to search
 * @returns {Promise<string[]>} - Array of font file paths
 */
async function getFontFiles(dirPath) {
  const fontFiles = [];
  const fontExtensions = ['.ttf', '.otf', '.ttc', '.dfont', '.suit'];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFonts = await getFontFiles(fullPath);
        fontFiles.push(...subFonts);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (fontExtensions.includes(ext)) {
          fontFiles.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn('Error reading font directory:', error.message);
  }

  return fontFiles;
}

/**
 * Recursively searches for "Document fonts" folder
 * @param {string} dirPath - Directory to search
 * @returns {Promise<string|null>} - Path to the Document fonts folder or null
 */
async function findDocumentFontsFolder(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Skip system directories
        if (entry.name.startsWith('.') || entry.name === '__MACOSX') {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        // Check if this is the Document fonts folder
        if (entry.name === 'Document fonts') {
          return fullPath;
        }

        // Recursively search subdirectories
        const found = await findDocumentFontsFolder(fullPath);
        if (found) return found;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Validates that a file is a valid zip file
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>}
 */
export async function isValidZipFile(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    return zipEntries.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Removes temporarily installed fonts
 * @param {string[]} fontPaths - Array of font file paths and directory to remove
 */
export async function cleanupInstalledFonts(fontPaths) {
  if (!fontPaths || fontPaths.length === 0) {
    return;
  }

  console.log(`Cleaning up ${fontPaths.length - 1} temporarily installed font(s)...`);

  // The last item is the directory path
  const dirPath = fontPaths[fontPaths.length - 1];
  const filePaths = fontPaths.slice(0, -1);

  // Remove individual font files first
  for (const fontPath of filePaths) {
    try {
      await fs.unlink(fontPath);
      console.log(`  ✓ Removed: ${path.basename(fontPath)}`);
    } catch (err) {
      console.warn(`  ⚠ Failed to remove ${path.basename(fontPath)}: ${err.message}`);
    }
  }

  // Remove the temporary directory
  try {
    await fs.rmdir(dirPath);
    console.log(`  ✓ Removed temporary fonts directory`);
  } catch (err) {
    console.warn(`  ⚠ Failed to remove fonts directory: ${err.message}`);
  }
}
