import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import config from "../config/config.js";

/**
 * Converts an InDesign file to PDF using desktop Adobe InDesign
 * @param {string} indesignFilePath - Path to the .indd or .idml file
 * @param {string} outputDir - Directory to save the PDF
 * @returns {Promise<string>} - Path to the generated PDF file
 */
export async function convertInDesignToPDF(indesignFilePath, outputDir) {
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
    await executeInDesignScript(indesignFilePath, pdfPath);

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
 */
async function executeInDesignScript(indesignFilePath, pdfOutputPath) {
  // Create temporary ExtendScript file
  const scriptPath = path.join(
    os.tmpdir(),
    `indesign_export_${Date.now()}.jsx`
  );

  // ExtendScript to open InDesign file and export to PDF
  const script = `
#target indesign

// Helper function to build error message
function buildErrorMessage(doc) {
  var errorMsg = "Document has critical errors that prevent PDF export:\\n\\n";
  var hasErrors = false;

  try {
    // Check for missing fonts
    var missingFonts = [];
    for (var i = 0; i < doc.fonts.length; i++) {
      var font = doc.fonts[i];
      if (font.status === FontStatus.NOT_AVAILABLE || font.status === FontStatus.UNKNOWN) {
        missingFonts.push(font.name + " (" + font.fontFamily + " " + font.fontStyleName + ")");
      }
    }

    if (missingFonts.length > 0) {
      hasErrors = true;
      errorMsg += "• Missing Fonts (" + missingFonts.length + "):\\n";
      for (var i = 0; i < Math.min(missingFonts.length, 10); i++) {
        errorMsg += "  - " + missingFonts[i] + "\\n";
      }
      if (missingFonts.length > 10) {
        errorMsg += "  ... and " + (missingFonts.length - 10) + " more\\n";
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
    errorMsg += "Error checking document: " + e.message + "\\n";
    hasErrors = true;
  }

  if (hasErrors) {
    errorMsg += "\\nPlease fix these issues in InDesign before converting to PDF.";
    return errorMsg;
  }

  return null;
}

try {
  $.writeln("Starting InDesign conversion script...");

  // Suppress all dialogs and user interaction
  app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

  $.writeln("Opening InDesign document...");

  // Open the InDesign document
  var sourceFile = File("${indesignFilePath.replace(/\\/g, "/")}");
  if (!sourceFile.exists) {
    throw new Error("Source file not found");
  }

  var doc;
  try {
    doc = app.open(sourceFile, false);
  } catch (openErr) {
    throw new Error("Failed to open document. The file may be corrupt or created in a newer version of InDesign.");
  }

  $.writeln("Document opened successfully. Pages: " + doc.pages.length);

  // Check for errors
  var errorMessage = buildErrorMessage(doc);
  if (errorMessage) {
    doc.close(SaveOptions.NO);
    app.quit();
    throw new Error(errorMessage);
  }

  // Export to PDF
  var pdfFile = File("${pdfOutputPath.replace(/\\/g, "/")}");

  $.writeln("Starting PDF export...");

  try {
    app.pdfExportPreferences.pageRange = PageRange.ALL_PAGES;
    doc.exportFile(ExportFormat.PDF_TYPE, pdfFile, false);

    if (!pdfFile.exists) {
      throw new Error("PDF file was not created");
    }

    $.writeln("PDF export completed successfully");
  } catch (exportErr) {
    throw new Error("PDF export failed: " + exportErr.message);
  }

  // Close the document
  doc.close(SaveOptions.NO);
  app.quit();

  "SUCCESS";

} catch (err) {
  $.writeln("ERROR: " + err.message);

  if (typeof doc !== 'undefined') {
    try {
      doc.close(SaveOptions.NO);
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
      console.log("[InDesign stdout]:", output.trim());
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
