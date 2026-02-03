import https from 'https';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

/**
 * Downloads a font from Google Fonts
 * @param {string} fontFamily - Font family name (e.g., "Poppins")
 * @param {string} variant - Font variant (e.g., "500" for Medium, "800" for ExtraBold)
 * @param {string} outputPath - Path to save the font file
 * @returns {Promise<string>} - Path to the downloaded font file
 */
async function downloadFromGoogleFonts(fontFamily, variant, outputPath) {
  return new Promise((resolve, reject) => {
    // Google Fonts CSS API URL
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@${variant}`;

    console.log(`  Fetching font CSS from: ${cssUrl}`);

    // First, get the CSS to find the font file URL
    https.get(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (cssRes) => {
      let cssData = '';

      cssRes.on('data', (chunk) => {
        cssData += chunk;
      });

      cssRes.on('end', () => {
        // Extract the font file URL from the CSS
        const urlMatch = cssData.match(/url\((https:\/\/[^)]+\.(?:ttf|woff2))\)/);

        if (!urlMatch) {
          reject(new Error(`Could not find font file URL for ${fontFamily} ${variant}`));
          return;
        }

        const fontUrl = urlMatch[1];
        console.log(`  Downloading font from: ${fontUrl}`);

        // Download the actual font file
        https.get(fontUrl, (fontRes) => {
          const writeStream = fs.createWriteStream(outputPath);

          fontRes.pipe(writeStream);

          writeStream.on('finish', () => {
            writeStream.close();
            console.log(`  ✓ Downloaded: ${path.basename(outputPath)}`);
            resolve(outputPath);
          });

          writeStream.on('error', (err) => {
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Maps font names to Google Fonts family and variant
 */
const FONT_MAPPING = {
  // Poppins variants
  'poppins-thin': { family: 'Poppins', variant: '100' },
  'poppins-extralight': { family: 'Poppins', variant: '200' },
  'poppins-light': { family: 'Poppins', variant: '300' },
  'poppins-regular': { family: 'Poppins', variant: '400' },
  'poppins-medium': { family: 'Poppins', variant: '500' },
  'poppins-semibold': { family: 'Poppins', variant: '600' },
  'poppins-bold': { family: 'Poppins', variant: '700' },
  'poppins-extrabold': { family: 'Poppins', variant: '800' },
  'poppins-black': { family: 'Poppins', variant: '900' },

  // Solway variants
  'solway-light': { family: 'Solway', variant: '300' },
  'solway-regular': { family: 'Solway', variant: '400' },
  'solway-medium': { family: 'Solway', variant: '500' },
  'solway-bold': { family: 'Solway', variant: '700' },
  'solway-extrabold': { family: 'Solway', variant: '800' },

  // Add more fonts as needed
  'roboto-regular': { family: 'Roboto', variant: '400' },
  'roboto-medium': { family: 'Roboto', variant: '500' },
  'roboto-bold': { family: 'Roboto', variant: '700' },
  'opensans-regular': { family: 'Open Sans', variant: '400' },
  'opensans-semibold': { family: 'Open Sans', variant: '600' },
  'opensans-bold': { family: 'Open Sans', variant: '700' },
  'lato-regular': { family: 'Lato', variant: '400' },
  'lato-bold': { family: 'Lato', variant: '700' },
};

/**
 * Parses a font name and attempts to download it
 * @param {string} fontDisplayName - Font display name (e.g., "Poppins (OTF) Medium")
 * @param {string} outputDir - Directory to save the downloaded font
 * @returns {Promise<string|null>} - Path to downloaded font or null if not found
 */
export async function downloadMissingFont(fontDisplayName, outputDir) {
  try {
    console.log(`  Attempting to download: ${fontDisplayName}`);

    // Extract font family and weight using pattern matching
    // This handles cases like "Poppins (OTF) Medium (Poppins (OTF) Medium)"

    // First, try to extract the font family (first capitalized word)
    const familyMatch = fontDisplayName.match(/^([A-Z][a-z]+)/);
    const family = familyMatch ? familyMatch[1].toLowerCase() : null;

    // Extract weight/style keywords
    const weights = ['thin', 'extralight', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
    let weight = null;

    const lowerName = fontDisplayName.toLowerCase();
    for (const w of weights) {
      if (lowerName.includes(w)) {
        weight = w;
        break; // Take the first match
      }
    }

    // Construct normalized name
    let normalized = null;
    if (family && weight) {
      normalized = `${family}-${weight}`;
    } else if (family) {
      normalized = family;
    } else {
      // Fallback: use original approach but with better cleanup
      normalized = fontDisplayName
        .toLowerCase()
        .replace(/\([^)]*\)/g, '') // Remove all parentheses and their contents
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim();

      // Remove duplicates
      const parts = normalized.split('-');
      const uniqueParts = [];
      const seen = new Set();

      for (const part of parts) {
        if (part && !seen.has(part)) {
          uniqueParts.push(part);
          seen.add(part);
        }
      }

      normalized = uniqueParts.join('-');
    }

    console.log(`  Normalized to: ${normalized}`);

    // Check if we have a mapping for this font
    const fontInfo = FONT_MAPPING[normalized];

    if (!fontInfo) {
      console.log(`  ⚠ No download source available for: ${fontDisplayName}`);
      console.log(`  Available mappings: ${Object.keys(FONT_MAPPING).join(', ')}`);
      return null;
    }

    // Create output path
    await fsPromises.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${normalized}.ttf`);

    // Download the font
    await downloadFromGoogleFonts(fontInfo.family, fontInfo.variant, outputPath);

    return outputPath;
  } catch (error) {
    console.warn(`  ⚠ Failed to download ${fontDisplayName}: ${error.message}`);
    return null;
  }
}

/**
 * Downloads multiple missing fonts
 * @param {string[]} fontNames - Array of font display names
 * @param {string} outputDir - Directory to save downloaded fonts
 * @returns {Promise<string[]>} - Array of paths to successfully downloaded fonts
 */
export async function downloadMissingFonts(fontNames, outputDir) {
  const downloadedFonts = [];

  console.log(`\nAttempting to download ${fontNames.length} missing font(s)...`);

  for (const fontName of fontNames) {
    const downloadedPath = await downloadMissingFont(fontName, outputDir);
    if (downloadedPath) {
      downloadedFonts.push(downloadedPath);
    }
  }

  console.log(`✓ Successfully downloaded ${downloadedFonts.length}/${fontNames.length} font(s)\n`);

  return downloadedFonts;
}
