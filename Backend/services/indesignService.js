import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import config from "../config/config.js";

/**
 * Converts an InDesign file to PDF using desktop Adobe InDesign
 * @param {string} indesignFilePath - Path to the .indd or .idml file
 * @param {string} outputDir - Directory to save the PDF
 * @param {string[]} availableFontNames - Array of font names available in Document fonts folder
 * @returns {Promise<string>} - Path to the generated PDF file
 */
export async function convertInDesignToPDF(indesignFilePath, outputDir, availableFontNames = []) {
  try {
    // Verify InDesign file exists
    const fileExists = await checkFileExists(indesignFilePath);
    if (!fileExists) {
      const error = new Error(`InDesign file not found: ${indesignFilePath}`);
      error.code = "FILE_NOT_FOUND";
      throw error;
    }

    // Generate output PDF path
    const filename = path.basename(
      indesignFilePath,
      path.extname(indesignFilePath)
    );
    const pdfPath = path.join(outputDir, `${filename}.pdf`);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Create and execute ExtendScript
    await executeInDesignScript(indesignFilePath, pdfPath, availableFontNames);

    // Verify PDF was created
    const pdfExists = await checkFileExists(pdfPath);
    if (!pdfExists) {
      const error = new Error("PDF was not generated successfully");
      error.code = "PDF_NOT_GENERATED";
      throw error;
    }

    return pdfPath;
  } catch (error) {
    // Just mark it as InDesign error and pass through
    if (!error.code) {
      error.code = "INDESIGN_ERROR";
    }
    throw error;
  }
}

/**
 * Executes ExtendScript via desktop InDesign application
 * @param {string} indesignFilePath - Path to the InDesign file
 * @param {string} pdfOutputPath - Path where PDF should be saved
 * @param {string[]} availableFontNames - Array of font names available in Document fonts folder
 */
async function executeInDesignScript(indesignFilePath, pdfOutputPath, availableFontNames = []) {
  // Create temporary ExtendScript file
  const scriptPath = path.join(
    os.tmpdir(),
    `indesign_export_${Date.now()}.jsx`
  );

  // Convert available font names to JSON for the script
  const availableFontsJSON = JSON.stringify(availableFontNames);

  // ExtendScript to open InDesign file and export to PDF
  const script = `
#target indesign

// Parse available fonts from Document fonts folder
var availableFonts = ${availableFontsJSON};

// Helper function to check if a font is similar to any available font
function isFontAvailable(missingFontName) {
  if (!availableFonts || availableFonts.length === 0) {
    return false;
  }

  // Normalize the missing font name (remove spaces, hyphens, make lowercase)
  var normalizedMissing = missingFontName.toLowerCase().replace(/[\\s-_]/g, '');

  for (var i = 0; i < availableFonts.length; i++) {
    var availableFont = availableFonts[i].toLowerCase().replace(/[\\s-_]/g, '');

    // Check if the missing font name is contained in the available font
    // e.g., "solwayextrabold" matches "Solway-ExtraBold"
    if (normalizedMissing.indexOf(availableFont) >= 0 || availableFont.indexOf(normalizedMissing) >= 0) {
      return true;
    }
  }

  return false;
}

// Helper function to run preflight on a book
function runBookPreflight(book) {
  try {
    $.writeln("[Preflight Debug] Starting book preflight check...");
    $.writeln("[Preflight Debug] Book has " + book.bookContents.length + " document(s)");

    // Check if preflight is available
    if (typeof app.preflightOptions === 'undefined') {
      $.writeln("[Preflight Debug] Preflight not available - checking basic errors only");
      return checkBookBasicErrors(book);
    }

    var allErrors = [];
    var bookFile = book.fullName;
    var bookFolder = bookFile.parent;

    $.writeln("[Preflight Debug] Book location: " + bookFile.fsName);
    $.writeln("[Preflight Debug] Book folder: " + bookFolder.fsName);

    // Run preflight on each document in the book
    for (var i = 0; i < book.bookContents.length; i++) {
      var bookContent = book.bookContents[i];
      var docName = bookContent.name;

      $.writeln("[Preflight Debug] Checking document " + (i + 1) + "/" + book.bookContents.length + ": " + docName);

      try {
        // Try multiple locations to find the document
        var docFile = null;

        // 1. Try same directory as book
        $.writeln("[Preflight Debug] Trying: " + bookFolder.fsName + "/" + docName);
        docFile = File(bookFolder.fsName + "/" + docName);

        // 2. If not found, search recursively
        if (!docFile.exists) {
          $.writeln("[Preflight Debug] Not found in book directory, searching recursively...");
          docFile = findFileInFolder(bookFolder, docName);
        }

        // 3. If still not found, try parent directory
        if (!docFile || !docFile.exists) {
          $.writeln("[Preflight Debug] Trying parent directory...");
          var parentFolder = bookFolder.parent;
          if (parentFolder) {
            docFile = findFileInFolder(parentFolder, docName);
          }
        }

        if (!docFile || !docFile.exists) {
          throw new Error("Document file not found: " + docName);
        }

        $.writeln("[Preflight Debug] Opening: " + docFile.fsName);
        var doc = app.open(docFile, false);

        // Check basic errors (fonts/links)
        var basicErrors = buildErrorMessage(doc);

        // Close the document
        doc.close(SaveOptions.NO);

        if (basicErrors) {
          $.writeln("[Preflight Debug] Document '" + docName + "' has errors");
          allErrors.push("Document: " + docName + "\\n" + basicErrors);
        } else {
          $.writeln("[Preflight Debug] Document '" + docName + "' passed checks");
        }

      } catch (e) {
        $.writeln("[Preflight Debug] Error checking document '" + docName + "': " + e.message);
        allErrors.push("Document: " + docName + "\\nError: " + e.message);
      }
    }

    // If any document had errors, return combined message
    if (allErrors.length > 0) {
      var message = "Found issues in " + allErrors.length + " document(s) in the book:\\n\\n";
      for (var i = 0; i < allErrors.length; i++) {
        message += allErrors[i] + "\\n\\n";
      }
      return message;
    }

    $.writeln("[Preflight Debug] Book check completed successfully with no errors");
    return null;

  } catch (e) {
    $.writeln("[Preflight Debug] EXCEPTION in book preflight: " + e.message);
    return "Book check failed: " + e.message;
  }
}

// Helper function to find a file in a folder recursively
function findFileInFolder(folder, fileName) {
  try {
    var files = folder.getFiles();
    for (var i = 0; i < files.length; i++) {
      if (files[i] instanceof Folder) {
        var found = findFileInFolder(files[i], fileName);
        if (found) return found;
      } else if (files[i].name === fileName) {
        return files[i];
      }
    }
  } catch (e) {
    $.writeln("[Preflight Debug] Error searching folder: " + e.message);
  }
  return null;
}

// Helper function to check basic errors in book (if preflight not available)
function checkBookBasicErrors(book) {
  $.writeln("[Preflight Debug] Checking basic errors in book documents...");
  var allErrors = [];
  var bookFile = book.fullName;
  var bookFolder = bookFile.parent;

  $.writeln("[Preflight Debug] Book location: " + bookFile.fsName);

  for (var i = 0; i < book.bookContents.length; i++) {
    var bookContent = book.bookContents[i];
    var docName = bookContent.name;

    try {
      // Try multiple locations to find the document
      var docFile = File(bookFolder.fsName + "/" + docName);

      if (!docFile.exists) {
        docFile = findFileInFolder(bookFolder, docName);
      }

      if (!docFile || !docFile.exists) {
        var parentFolder = bookFolder.parent;
        if (parentFolder) {
          docFile = findFileInFolder(parentFolder, docName);
        }
      }

      if (!docFile || !docFile.exists) {
        allErrors.push("Document: " + docName + "\\nError: File not found");
        continue;
      }

      var doc = app.open(docFile, false);
      var basicErrors = buildErrorMessage(doc);
      doc.close(SaveOptions.NO);

      if (basicErrors) {
        allErrors.push("Document: " + docName + "\\n" + basicErrors);
      }
    } catch (e) {
      allErrors.push("Document: " + docName + "\\nError: " + e.message);
    }
  }

  if (allErrors.length > 0) {
    var message = "Found issues in " + allErrors.length + " document(s):\\n\\n";
    for (var i = 0; i < allErrors.length; i++) {
      message += allErrors[i] + "\\n\\n";
    }
    return message;
  }

  return null;
}

// Helper function to run preflight and check for errors
function runPreflight(doc) {
  try {
    $.writeln("[Preflight Debug] Starting preflight check...");

    // Check if preflight is available
    if (typeof app.preflightOptions === 'undefined') {
      $.writeln("[Preflight Debug] ERROR: app.preflightOptions is undefined");
      return "Preflight is not available in this version of InDesign";
    }

    $.writeln("[Preflight Debug] Preflight options available");
    $.writeln("[Preflight Debug] Current preflightOff: " + app.preflightOptions.preflightOff);

    // Enable preflight if not already enabled
    app.preflightOptions.preflightOff = false;
    $.writeln("[Preflight Debug] Set preflightOff to false");

    // Try to get the preflight process
    var preflightProcess = null;
    try {
      preflightProcess = doc.preflightProcess;
    } catch (e) {
      $.writeln("[Preflight Debug] preflightProcess not available: " + e.message);
    }

    if (!preflightProcess) {
      $.writeln("[Preflight Debug] preflightProcess not available - using basic error checks only");
      // Fall back to basic error checking
      return buildErrorMessage(doc);
    }

    $.writeln("[Preflight Debug] Preflight process obtained");

    // Check current profile
    var currentProfile = null;
    try {
      currentProfile = preflightProcess.preflightProfile;
      if (currentProfile) {
        $.writeln("[Preflight Debug] Current profile: " + currentProfile.name);
        $.writeln("[Preflight Debug] Profile valid: " + currentProfile.isValid);
      } else {
        $.writeln("[Preflight Debug] No current profile set");
      }
    } catch (e) {
      $.writeln("[Preflight Debug] Error checking current profile: " + e.message);
    }

    // If there's no valid profile, try to use the "[Basic]" profile
    if (!currentProfile || !currentProfile.isValid) {
      $.writeln("[Preflight Debug] Attempting to set Basic profile...");
      try {
        var profiles = app.preflightProfiles;
        $.writeln("[Preflight Debug] Available profiles count: " + profiles.length);

        for (var i = 0; i < profiles.length; i++) {
          $.writeln("[Preflight Debug] Profile " + i + ": " + profiles[i].name);
          if (profiles[i].name === "[Basic]" || profiles[i].name === "Basic" || profiles[i].name.indexOf("Basic") >= 0) {
            preflightProcess.preflightProfile = profiles[i];
            $.writeln("[Preflight Debug] Set profile to: " + profiles[i].name);
            break;
          }
        }
      } catch (e) {
        $.writeln("[Preflight Debug] Error setting preflight profile: " + e.message);
      }
    }

    // Wait for preflight to process the document
    $.writeln("[Preflight Debug] Waiting for preflight to process (2 seconds)...");
    $.sleep(2000);

    // Wait for preflight process to complete
    $.writeln("[Preflight Debug] Calling waitForProcess...");
    try {
      preflightProcess.waitForProcess(30); // Wait up to 30 seconds
      $.writeln("[Preflight Debug] waitForProcess completed");
    } catch (e) {
      $.writeln("[Preflight Debug] waitForProcess error: " + e.message);
    }

    // Check for errors
    $.writeln("[Preflight Debug] Getting aggregatedResults...");
    var results = null;
    try {
      results = preflightProcess.aggregatedResults;
      $.writeln("[Preflight Debug] Results count: " + results.length);
    } catch (e) {
      $.writeln("[Preflight Debug] Error getting results: " + e.message);
      return "Could not retrieve preflight results: " + e.message;
    }

    var errorCount = 0;
    var warningCount = 0;
    var infoCount = 0;
    var errorMessages = [];

    // Count results by severity
    $.writeln("[Preflight Debug] Processing " + results.length + " results...");
    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      var severity = "UNKNOWN";

      try {
        $.writeln("[Preflight Debug] Result " + i + " severity value: " + result.severity);

        if (result.severity === PreflightSeverity.PREFLIGHT_SEVERITY_ERROR) {
          severity = "ERROR";
          errorCount++;
        } else if (result.severity === PreflightSeverity.PREFLIGHT_SEVERITY_WARNING) {
          severity = "WARNING";
          warningCount++;
        } else if (result.severity === PreflightSeverity.PREFLIGHT_SEVERITY_INFO) {
          severity = "INFO";
          infoCount++;
        }

        $.writeln("[Preflight Debug] Result " + i + " severity: " + severity);
      } catch (e) {
        $.writeln("[Preflight Debug] Error checking severity: " + e.message);
        severity = "UNKNOWN";
      }

      // Only include errors and warnings in the message
      if (severity === "ERROR" || severity === "WARNING") {
        var ruleName = "Unknown Rule";
        var description = "No description available";

        try {
          ruleName = result.rule.name || "Unknown Rule";
          $.writeln("[Preflight Debug] Rule name: " + ruleName);
        } catch (e) {
          $.writeln("[Preflight Debug] Error getting rule name: " + e.message);
        }

        try {
          description = result.rule.description || "No description available";
          $.writeln("[Preflight Debug] Description: " + description);
        } catch (e) {
          $.writeln("[Preflight Debug] Error getting description: " + e.message);
        }

        errorMessages.push(severity + ": " + ruleName + " - " + description);
      }
    }

    $.writeln("[Preflight Debug] Final counts - Errors: " + errorCount + ", Warnings: " + warningCount + ", Info: " + infoCount);

    // If there are errors, format and return them
    if (errorCount > 0 || warningCount > 0) {
      var message = "Preflight found issues in the document:\\n\\n";
      message += "• Errors: " + errorCount + "\\n";
      message += "• Warnings: " + warningCount + "\\n";
      message += "• Info: " + infoCount + "\\n\\n";

      if (errorMessages.length > 0) {
        message += "Details:\\n";
        for (var i = 0; i < Math.min(errorMessages.length, 10); i++) {
          message += "  " + (i + 1) + ". " + errorMessages[i] + "\\n";
        }
        if (errorMessages.length > 10) {
          message += "  ... and " + (errorMessages.length - 10) + " more\\n";
        }
      }

      return message;
    }

    // No errors found
    $.writeln("[Preflight Debug] Preflight completed successfully with no errors");
    return null;

  } catch (e) {
    $.writeln("[Preflight Debug] EXCEPTION: " + e.message);
    $.writeln("[Preflight Debug] Stack: " + e.line);
    // Return the error instead of ignoring it
    return "Preflight check failed: " + e.message;
  }
}

// Helper function to build error message
function buildErrorMessage(doc) {
  var errorMsg = "Document has critical errors that prevent PDF export:\\n\\n";
  var hasErrors = false;

  try {
    // Check for missing fonts
    var missingFonts = [];
    var skippedFonts = []; // Fonts in Document fonts folder but not yet loaded by InDesign

    for (var i = 0; i < doc.fonts.length; i++) {
      try {
        var font = doc.fonts[i];
        // Try to access font properties - if they're not available, skip this font
        if (font.status === FontStatus.NOT_AVAILABLE || font.status === FontStatus.UNKNOWN) {
          var fontName = font.name || "Unknown";
          var fontFamily = "";
          var fontStyle = "";

          try {
            fontFamily = font.fontFamily || "";
          } catch (e) {}

          try {
            fontStyle = font.fontStyleName || "";
          } catch (e) {}

          var displayName = fontName;
          if (fontFamily || fontStyle) {
            displayName += " (" + fontFamily + " " + fontStyle + ")";
          }

          // Check if this font is available in Document fonts folder
          var fontBaseName = fontName.replace(/\\s*\\([^)]*\\)/g, ''); // Remove parentheses parts
          if (isFontAvailable(fontBaseName) || isFontAvailable(fontFamily) || isFontAvailable(displayName)) {
            // Font is in Document fonts but InDesign hasn't loaded it yet
            skippedFonts.push(displayName);
            $.writeln("INFO: Font '" + displayName + "' is in Document fonts folder, will proceed with conversion");
          } else {
            // Font is genuinely missing from Document fonts folder
            missingFonts.push(displayName);
          }
        }
      } catch (fontErr) {
        // If we can't access this font's properties, skip it
        // This prevents the entire export from failing due to problematic fonts
        continue;
      }
    }

    // Report skipped fonts as info
    if (skippedFonts.length > 0) {
      $.writeln("\\nINFO: " + skippedFonts.length + " font(s) from Document fonts folder not yet loaded by InDesign:");
      for (var i = 0; i < skippedFonts.length; i++) {
        $.writeln("  - " + skippedFonts[i]);
      }
      $.writeln("These fonts will be substituted or loaded during export.\\n");
    }

    // Only report genuinely missing fonts as errors
    if (missingFonts.length > 0) {
      hasErrors = true;
      errorMsg += "• Missing Fonts (" + missingFonts.length + "):\\n";
      errorMsg += "  The following fonts are NOT in your Document fonts folder:\\n\\n";

      for (var i = 0; i < Math.min(missingFonts.length, 10); i++) {
        errorMsg += "  - " + missingFonts[i] + "\\n";
      }

      if (missingFonts.length > 10) {
        errorMsg += "  ... and " + (missingFonts.length - 10) + " more\\n";
      }

      errorMsg += "\\n";
      errorMsg += "Solutions:\\n";
      errorMsg += "  1. Add the missing font files to the 'Document fonts' folder in your zip file\\n";
      errorMsg += "  2. Replace the fonts in your InDesign document with available alternatives\\n";

      if (availableFonts && availableFonts.length > 0) {
        errorMsg += "\\n";
        errorMsg += "Available fonts in your Document fonts folder:\\n";
        for (var j = 0; j < Math.min(availableFonts.length, 10); j++) {
          errorMsg += "  ✓ " + availableFonts[j] + "\\n";
        }
        if (availableFonts.length > 10) {
          errorMsg += "  ... and " + (availableFonts.length - 10) + " more\\n";
        }
      }

      errorMsg += "\\n";
    }

    // Check for missing links
    var missingLinks = [];
    var corruptLinks = [];
    var links = doc.links;

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.status === LinkStatus.LINK_MISSING) {
        missingLinks.push(link.name);
      } else if (link.status === LinkStatus.NORMAL || link.status === LinkStatus.LINK_EMBEDDED) {
        try {
          if (link.status !== LinkStatus.LINK_EMBEDDED) {
            var linkFile = File(link.filePath);
            if (!linkFile.exists) {
              corruptLinks.push(link.name);
            }
          }
        } catch (e) {
          corruptLinks.push(link.name);
        }
      }
    }

    if (missingLinks.length > 0) {
      hasErrors = true;
      errorMsg += "• Missing Images/Links (" + missingLinks.length + "):\\n";
      for (var i = 0; i < Math.min(missingLinks.length, 10); i++) {
        errorMsg += "  - " + missingLinks[i] + "\\n";
      }
      if (missingLinks.length > 10) {
        errorMsg += "  ... and " + (missingLinks.length - 10) + " more\\n";
      }
      errorMsg += "\\n";
    }

    if (corruptLinks.length > 0) {
      hasErrors = true;
      errorMsg += "• Corrupt/Inaccessible Images (" + corruptLinks.length + "):\\n";
      for (var i = 0; i < Math.min(corruptLinks.length, 10); i++) {
        errorMsg += "  - " + corruptLinks[i] + "\\n";
      }
      if (corruptLinks.length > 10) {
        errorMsg += "  ... and " + (corruptLinks.length - 10) + " more\\n";
      }
      errorMsg += "\\n";
    }

  } catch (e) {
    // Log the error but don't treat it as critical
    // This allows PDF export to proceed even if we can't fully validate the document
    $.writeln("Warning: Could not fully check document - " + e.message);
  }

  if (hasErrors) {
    errorMsg += "\\nPlease fix these issues in InDesign before converting to PDF.";
    return errorMsg;
  }

  return null;
}

try {
  $.writeln("Starting InDesign conversion script...");

  // Don't set userInteractionLevel - let InDesign use default behavior
  // Setting it to NEVER_INTERACT causes "script error" on documents with warnings
  $.writeln("Skipping userInteractionLevel setting to avoid script errors");

  $.writeln("Opening InDesign file...");

  // Open the InDesign file (document or book)
  var sourceFile = File("${indesignFilePath.replace(/\\/g, "/")}");
  if (!sourceFile.exists) {
    throw new Error("Source file not found");
  }

  // Detect file type
  var fileName = sourceFile.name.toLowerCase();
  var isBook = fileName.indexOf('.indb') >= 0;
  var doc = null;
  var book = null;

  try {
    if (isBook) {
      $.writeln("Opening InDesign Book file...");
      book = app.open(sourceFile, false);
      $.writeln("Book opened successfully. Documents: " + book.bookContents.length);
    } else {
      $.writeln("Opening InDesign Document file...");
      doc = app.open(sourceFile, false);
      $.writeln("Document opened successfully. Pages: " + doc.pages.length);
    }
  } catch (openErr) {
    throw new Error("Failed to open file. It may be corrupt or created in a newer version of InDesign.");
  }

  // For regular documents: check for basic errors (fonts/links)
  // For books: skip basic checks, we'll run full preflight on all documents
  if (!isBook) {
    var errorMessage = buildErrorMessage(doc);
    if (errorMessage) {
      doc.close(SaveOptions.NO);
      app.quit();
      throw new Error(errorMessage);
    }
    $.writeln("✓ Basic error checks passed (fonts/links)");
    $.writeln("Skipping preflight for regular documents - only running on books");
  } else {
    // Run preflight ONLY on books
    $.writeln("Running preflight check on book...");
    var preflightErrors = runBookPreflight(book);

    if (preflightErrors) {
      $.writeln("\\n❌ PREFLIGHT FAILED:");
      $.writeln(preflightErrors);
      book.close(SaveOptions.NO);
      app.quit();
      throw new Error("Preflight Failed:\\n\\n" + preflightErrors);
    }
    $.writeln("✓ Preflight passed");
  }

  // Export to PDF
  var pdfFile = File("${pdfOutputPath.replace(/\\/g, "/")}");

  $.writeln("Starting PDF export...");

  try {
    app.pdfExportPreferences.pageRange = PageRange.ALL_PAGES;

    if (isBook) {
      $.writeln("Exporting book to PDF...");
      book.exportFile(ExportFormat.PDF_TYPE, pdfFile, false);
    } else {
      $.writeln("Exporting document to PDF...");
      doc.exportFile(ExportFormat.PDF_TYPE, pdfFile, false);
    }

    if (!pdfFile.exists) {
      throw new Error("PDF file was not created");
    }

    $.writeln("PDF export completed successfully");
  } catch (exportErr) {
    throw new Error("PDF export failed: " + exportErr.message);
  }

  // Close the file
  if (isBook) {
    book.close(SaveOptions.NO);
  } else {
    doc.close(SaveOptions.NO);
  }
  app.quit();

  "SUCCESS";

} catch (err) {
  $.writeln("ERROR: " + err.message);

  // Close document or book if open
  if (typeof doc !== 'undefined' && doc !== null) {
    try {
      doc.close(SaveOptions.NO);
    } catch (e) {}
  }

  if (typeof book !== 'undefined' && book !== null) {
    try {
      book.close(SaveOptions.NO);
    } catch (e) {}
  }

  try {
    app.quit();
  } catch (e) {}

  throw err;
}
`;

  try {
    // Write script to temporary file
    await fs.writeFile(scriptPath, script, "utf8");

    // Execute InDesign with the script
    await runInDesignWithScript(scriptPath);

    // Clean up temporary script file
    await fs.unlink(scriptPath).catch(() => {});
  } catch (error) {
    // Clean up temporary script file
    await fs.unlink(scriptPath).catch(() => {});
    throw error;
  }
}

/**
 * Runs Adobe InDesign with an ExtendScript file
 * @param {string} scriptPath - Path to the .jsx script file
 */
async function runInDesignWithScript(scriptPath) {
  return new Promise(async (resolve, reject) => {
    console.log("[InDesign] Starting InDesign process...");
    const platform = os.platform();
    let indesignPath = config.indesignAppPath;
    let args;

    // Default paths if not configured
    if (!indesignPath) {
      if (platform === "darwin") {
        // macOS default path
        indesignPath =
          "/Applications/Adobe InDesign 2024/Adobe InDesign 2024.app/Contents/MacOS/Adobe InDesign 2024";
      } else if (platform === "win32") {
        // Windows default path (adjust version as needed)
        indesignPath =
          "C:\\Program Files\\Adobe\\Adobe InDesign 2024\\InDesign.exe";
      } else {
        reject(new Error("Unsupported platform for Adobe InDesign automation"));
        return;
      }
    }

    // Set up command arguments based on platform
    if (platform === "darwin") {
      // macOS: Create AppleScript file to execute the ExtendScript
      const appleScriptPath = scriptPath.replace(".jsx", ".scpt");
      const appleScriptContent = `tell application "Adobe InDesign 2026"
\tactivate
\tset scriptFile to POSIX file "${scriptPath}"
\tdo script scriptFile language javascript
end tell`;

      await fs.writeFile(appleScriptPath, appleScriptContent, "utf8");

      indesignPath = "osascript";
      args = [appleScriptPath];
    } else if (platform === "win32") {
      // Windows: Use -ScriptPath argument
      args = ["-ScriptPath", scriptPath];
    } else {
      reject(new Error("Unsupported platform for Adobe InDesign automation"));
      return;
    }

    // Set up environment to suppress macOS duplicate class warnings
    const env = {
      ...process.env,
      OBJC_DISABLE_INITIALIZE_FORK_SAFETY: "YES",
    };

    const childProcess = spawn(indesignPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: env,
      detached: false,
    });

    console.log(`[InDesign] Process spawned with PID: ${childProcess.pid}`);

    let stdout = "";
    let stderr = "";
    let isResolved = false;

    // Set a timeout for the InDesign process (5 minutes)
    const timeout = setTimeout(() => {
      if (!isResolved) {
        console.log("[InDesign] Process timeout - killing InDesign...");
        childProcess.kill("SIGTERM");
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill("SIGKILL");
          }
        }, 5000);
        reject(
          new Error(
            "InDesign process timed out after 5 minutes. This may indicate missing fonts, missing links, or InDesign waiting for user input."
          )
        );
      }
    }, 5 * 60 * 1000); // 5 minutes timeout

    childProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;

      // Highlight preflight debug messages with colors
      if (output.includes("[Preflight Debug]")) {
        console.log("\x1b[36m%s\x1b[0m", "[🔍 PREFLIGHT] " + output.trim());
      } else if (output.includes("Running preflight check")) {
        console.log("\x1b[33m%s\x1b[0m", "[InDesign] 🔍 STARTING PREFLIGHT CHECK");
      } else if (output.includes("Preflight passed")) {
        console.log("\x1b[32m%s\x1b[0m", "[InDesign] ✅ PREFLIGHT PASSED");
      } else if (output.includes("PREFLIGHT FAILED")) {
        console.log("\x1b[31m%s\x1b[0m", "[InDesign] ❌ PREFLIGHT FAILED");
      } else {
        console.log("[InDesign stdout]:", output.trim());
      }
    });

    childProcess.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      console.log("[InDesign stderr]:", output.trim());
    });

    childProcess.on("error", (error) => {
      isResolved = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `Failed to launch InDesign: ${error.message}. Please ensure InDesign is installed at: ${indesignPath}`
        )
      );
    });

    childProcess.on("close", (code) => {
      isResolved = true;
      clearTimeout(timeout);

      console.log(`[InDesign] Process closed with exit code: ${code}`);

      // Filter out macOS objc duplicate class warnings (they're harmless)
      const filteredStderr = stderr
        .split("\n")
        .filter(
          (line) =>
            !line.includes("Class AdobeSimpleURLSession") &&
            !line.includes("objc[") &&
            !line.includes("is implemented in both") &&
            !line.includes("One of the duplicates must be removed")
        )
        .join("\n")
        .trim();

      if (code !== 0 || filteredStderr.includes("ERROR:") || stdout.includes("ERROR:")) {
        console.log("[InDesign] Conversion FAILED");

        // Extract error message from stderr/stdout
        let errorMessage = "";

        // Look for ERROR: in combined output
        const combinedOutput = filteredStderr + "\n" + stdout;
        const errorMatch = combinedOutput.match(/ERROR:\s*(.+)/s);

        if (errorMatch) {
          // Extract everything after "ERROR:"
          errorMessage = errorMatch[1].replace(/\\n/g, '\n').trim();
        } else {
          // No "ERROR:" prefix found, use the full stderr/stdout
          errorMessage = (filteredStderr || stdout || `Process exited with code ${code}`)
            .replace(/\\n/g, '\n')
            .trim();
        }

        // Clean up AppleScript/InDesign error prefixes and suffixes (works for all errors)
        errorMessage = errorMessage
          // Remove temp file path and line numbers (e.g., "/var/folders/.../script.scpt:165:205:")
          .replace(/^.*\.scpt:\d+:\d+:\s*/gm, '')
          // Remove "execution error: Adobe InDesign XXXX got an error:"
          .replace(/execution error:\s*Adobe InDesign \d+\s+got an error:\s*/gi, '')
          // Remove "Uncaught JavaScript exception:"
          .replace(/Uncaught JavaScript exception:\s*/gi, '')
          // Remove error codes at the end like "(54)" or "(-1234)"
          .replace(/\s*\([-0-9]+\)\s*$/gm, '')
          // Clean up extra whitespace and newlines
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        const error = new Error(errorMessage);
        error.code = "INDESIGN_CONVERSION_FAILED";
        reject(error);
      } else {
        console.log("[InDesign] Conversion SUCCESS");
        resolve();
      }
    });
  });
}

/**
 * Checks if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function checkFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tests if Adobe InDesign application is available
 * @returns {Promise<boolean>}
 */
export async function testInDesignConnection() {
  try {
    const platform = os.platform();
    let indesignPath = config.indesignAppPath;

    if (!indesignPath) {
      if (platform === "darwin") {
        indesignPath =
          "/Applications/Adobe InDesign 2024/Adobe InDesign 2024.app/Contents/MacOS/Adobe InDesign 2024";
      } else if (platform === "win32") {
        indesignPath =
          "C:\\Program Files\\Adobe\\Adobe InDesign 2024\\InDesign.exe";
      } else {
        return false;
      }
    }

    const exists = await checkFileExists(indesignPath);
    return exists;
  } catch (error) {
    return false;
  }
}
