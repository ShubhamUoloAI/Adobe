import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/config.js';

/**
 * Compares two PDF files using Adobe Acrobat DC
 * @param {string} pdf1Path - Path to the first PDF file
 * @param {string} pdf2Path - Path to the second PDF file
 * @param {string} outputDir - Directory to save the comparison PDF
 * @returns {Promise<string>} - Path to the generated comparison PDF file
 */
export async function comparePDFsWithAcrobat(pdf1Path, pdf2Path, outputDir) {
  console.log('[Acrobat Debug] =================================');
  console.log('[Acrobat Debug] Starting PDF comparison');
  console.log('[Acrobat Debug] =================================');

  try {
    console.log('[Acrobat Debug] Checking if input files exist...');
    // Verify both PDF files exist
    const file1Exists = await checkFileExists(pdf1Path);
    const file2Exists = await checkFileExists(pdf2Path);

    console.log('[Acrobat Debug] File 1 exists:', file1Exists);
    console.log('[Acrobat Debug] File 2 exists:', file2Exists);

    if (!file1Exists) {
      const error = new Error(`First PDF file not found: ${pdf1Path}`);
      error.code = 'FILE_NOT_FOUND';
      throw error;
    }

    if (!file2Exists) {
      const error = new Error(`Second PDF file not found: ${pdf2Path}`);
      error.code = 'FILE_NOT_FOUND';
      throw error;
    }

    // Generate output PDF path
    const timestamp = Date.now();
    const comparisonPdfPath = path.join(outputDir, `comparison-${timestamp}.pdf`);

    console.log('[Acrobat Debug] Output PDF will be:', comparisonPdfPath);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    console.log('[Acrobat Debug] Output directory created/verified');

    // Execute Acrobat comparison
    console.log('[Acrobat Debug] Calling executeAcrobatComparison...');
    await executeAcrobatComparison(pdf1Path, pdf2Path, comparisonPdfPath);
    console.log('[Acrobat Debug] executeAcrobatComparison completed');

    // Verify comparison PDF was created
    console.log('[Acrobat Debug] Checking if output file was created...');
    const comparisonExists = await checkFileExists(comparisonPdfPath);
    console.log('[Acrobat Debug] Output file exists:', comparisonExists);

    if (!comparisonExists) {
      const error = new Error('Comparison PDF was not generated successfully');
      error.code = 'PDF_NOT_GENERATED';
      throw error;
    }

    console.log('[Acrobat Debug] =================================');
    console.log('[Acrobat Debug] Comparison successful!');
    console.log('[Acrobat Debug] =================================');

    return comparisonPdfPath;
  } catch (error) {
    // Mark as Acrobat error if not already marked
    if (!error.code) {
      error.code = 'ACROBAT_ERROR';
    }
    throw error;
  }
}

/**
 * Executes Acrobat comparison using JavaScript API via AppleScript
 * @param {string} pdf1Path - Path to the first PDF
 * @param {string} pdf2Path - Path to the second PDF
 * @param {string} outputPath - Path where comparison PDF should be saved
 */
async function executeAcrobatComparison(pdf1Path, pdf2Path, outputPath) {
  console.log('[Acrobat Debug] Starting comparison execution');
  console.log('[Acrobat Debug] Input PDF 1:', pdf1Path);
  console.log('[Acrobat Debug] Input PDF 2:', pdf2Path);
  console.log('[Acrobat Debug] Output path:', outputPath);

  // Get absolute paths
  const absPdf1 = path.resolve(pdf1Path);
  const absPdf2 = path.resolve(pdf2Path);
  const absOutput = path.resolve(outputPath);
  const absOutputFolder = path.dirname(absOutput);

  console.log('[Acrobat Debug] Absolute PDF 1:', absPdf1);
  console.log('[Acrobat Debug] Absolute PDF 2:', absPdf2);
  console.log('[Acrobat Debug] Absolute output:', absOutput);
  console.log('[Acrobat Debug] Absolute output folder:', absOutputFolder);

  // Create AppleScript to automate Acrobat UI using cliclick for coordinate-based clicking
  const appleScript = `
-- Properly escape paths for AppleScript
set pdf1Path to POSIX file "${absPdf1.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"
set pdf2Path to POSIX file "${absPdf2.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"
set outputPath to "${absOutput.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"
set outputFolder to "${absOutputFolder.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"

-- Launch Acrobat (don't open PDF yet - need clean home screen)
tell application "Adobe Acrobat"
\tlaunch
\tactivate
\tdelay 8
end tell

tell application "System Events"
\ttell process "Acrobat"
\t\t-- Ensure Acrobat is frontmost
\t\tset frontmost to true
\t\tdelay 3
\t\t
\t\t-- Wait for window to be available (wait longer)
\t\trepeat 15 times
\t\t\tif (count of windows) > 0 then
\t\t\t\tlog "Found " & (count of windows) & " window(s)"
\t\t\t\texit repeat
\t\t\tend if
\t\t\tlog "Waiting for window... attempt " & (16 - 15) as string
\t\t\tdelay 1
\t\tend repeat
\t\t
\t\tif (count of windows) = 0 then
\t\t\tlog "ERROR: No Acrobat windows found"
\t\t\terror "Acrobat window not available"
\t\tend if
\t\t
\t\t-- Get window position and size for coordinate calculation
\t\tset win to window 1
\t\tset winPosition to position of win
\t\tset winSize to size of win
\t\t
\t\tset winX to item 1 of winPosition
\t\tset winY to item 2 of winPosition
\t\tset winWidth to item 1 of winSize
\t\tset winHeight to item 2 of winSize
\t\t
\t\tlog "Window position: " & winX & ", " & winY
\t\tlog "Window size: " & winWidth & " x " & winHeight
\t\t
\t\t-- Calculate "See all tools" button position
\t\t-- Tested and verified: 120 pixels from right edge, 140 pixels from top
\t\tset seeAllToolsX to winX + winWidth - 120
\t\tset seeAllToolsY to winY + 140
\t\t
\t\tlog "Clicking 'See all tools' at: " & seeAllToolsX & "," & seeAllToolsY
\t\t
\t\t-- Click "See all tools" button
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & seeAllToolsX & "," & seeAllToolsY
\t\tlog "Clicked 'See all tools' button"
\t\tdelay 4
\t\t
\t\tlog "Tools panel should have opened in the same window"
\t\t
\t\t-- The tools panel opens in the SAME window, changing the window title to "All tools"
\t\t-- Wait a moment for the content to load
\t\tdelay 2
\t\t
\t\t-- Check if window title changed to "All tools"
\t\tset currentWindowName to name of win
\t\tlog "Current window name: " & currentWindowName
\t\t
\t\t-- Use the same window (win) for tools panel
\t\tset toolsWinPos to position of win
\t\tset toolsWinSize to size of win
\t\t
\t\tset toolsX to item 1 of toolsWinPos
\t\tset toolsY to item 2 of toolsWinPos
\t\tset toolsWidth to item 1 of toolsWinSize
\t\tset toolsHeight to item 2 of toolsWinSize
\t\t
\t\tlog "Tools panel - Position: " & toolsX & "," & toolsY & " Size: " & toolsWidth & "x" & toolsHeight
\t\t
\t\t-- Use search box to find Compare Files instead of scrolling
\t\tlog "Using search box to find Compare Files..."
\t\t
\t\t-- Click in the search box "Find any tool" at the top
\t\t-- Search box is centered horizontally, about 150px from top
\t\tset searchX to (toolsX + (toolsWidth / 2)) as integer
\t\tset searchY to (toolsY + 150) as integer
\t\t
\t\tlog "Clicking search box at: " & searchX & "," & searchY
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & searchX & "," & searchY
\t\tdelay 1
\t\t
\t\t-- Clear search box using triple-click and typing over
\t\tlog "Selecting all text in search box with triple-click..."
\t\tdo shell script "/opt/homebrew/bin/cliclick tc:" & searchX & "," & searchY
\t\tdelay 0.5
\t\t
\t\t-- Type "compare" to filter tools (replaces selected text)
\t\tlog "Typing 'compare' in search box..."
\t\tdo shell script "/opt/homebrew/bin/cliclick t:compare"
		delay 3

		log "Using keyboard navigation to access Compare Files tool"

		-- Press Tab once
		log "Pressing Tab (1st time)..."
		key code 48
		delay 0.5

		-- Press Tab again
		log "Pressing Tab (2nd time)..."
		key code 48
		delay 0.5

		-- Press Enter to open Compare Files
		log "Pressing Enter to open Compare Files..."
		key code 36
		delay 5

		-- Now in Compare Files interface
		log "Compare Files interface should be open"

		-- Click "Select File" button for New File (right side - first button in Tab order)
		log "Clicking 'Select File' for New File (right side)..."
		-- Tab to the first "Select File" button
		key code 48
		delay 0.5
		-- Press Space to click it
		key code 49
		delay 3

		-- File picker should open - use Command+Shift+G to go to folder
		log "Opening 'Go to folder' dialog for New File..."
		key code 5 using {command down, shift down}
		delay 3

		-- Wait for the dialog to fully appear
		delay 2

		-- Clear any existing text in the path field
		log "Clearing path field..."
		key code 0 using {command down}
		delay 0.5

		-- Type only the FOLDER path (not the full file path)
		set pdf2Folder to do shell script "dirname " & quoted form of "${absPdf2}"
		set pdf2Name to do shell script "basename " & quoted form of "${absPdf2}"
		log "Typing folder path: " & pdf2Folder
		keystroke pdf2Folder
		delay 2

		-- Press Enter to navigate to the folder
		log "Pressing Enter to navigate to folder..."
		key code 36
		delay 3

		-- Now type the filename in the file picker's filename field
		log "Typing filename: " & pdf2Name
		keystroke pdf2Name
		delay 2

		-- Press Enter to select the file and click "Open" button
		log "Pressing Enter to confirm selection..."
		key code 36
		delay 2

		-- Now click "Select File" for Old File (left side - second button in Tab order)
		log "Clicking 'Select File' for Old File (left side)..."
		-- Tab to move to the second "Select File" button
		key code 48
		delay 0.5
		-- Press Space to click it
		key code 49
		delay 3

		-- File picker opens again - use Command+Shift+G
		log "Opening 'Go to folder' dialog for Old File..."
		key code 5 using {command down, shift down}
		delay 3

		-- Wait for the dialog to fully appear
		delay 2

		-- Clear any existing text in the path field
		log "Clearing path field..."
		key code 0 using {command down}
		delay 0.5

		-- Type only the FOLDER path (not the full file path)
		set pdf1Folder to do shell script "dirname " & quoted form of "${absPdf1}"
		set pdf1Name to do shell script "basename " & quoted form of "${absPdf1}"
		log "Typing folder path: " & pdf1Folder
		keystroke pdf1Folder
		delay 2

		-- Press Enter to navigate to the folder
		log "Pressing Enter to navigate to folder..."
		key code 36
		delay 3

		-- Now type the filename in the file picker's filename field
		log "Typing filename: " & pdf1Name
		keystroke pdf1Name
		delay 2

		-- Press Enter to select the file and click "Open" button
		log "Pressing Enter to confirm selection..."
		key code 36
		delay 2

		-- Now click the "Compare" button using Tab navigation
		log "Clicking Compare button..."
		-- Tab 6 times to reach Compare button
		repeat 6 times
			key code 48
			delay 0.3
		end repeat
		-- Press Enter to click Compare
		key code 36
		delay 10

		log "Comparison started, waiting for it to complete..."

		-- Wait for comparison to complete (may take a while)
		delay 30

		-- Save the comparison result
		log "Pressing Cmd+S to save..."
		key code 1 using {command down}
		delay 1

		-- Press Enter
		log "Pressing Enter..."
		key code 36
		delay 1

		-- Open Go to folder dialog
		log "Pressing Cmd+Shift+G to open Go to folder..."
		key code 5 using {command down, shift down}
		delay 1

		-- Type destination folder path
		log "Typing destination folder path..."
		keystroke "/Users/shubham/Downloads/Uolo-pdf/Report"
		delay 0.5

		-- Press Enter to navigate to folder
		log "Pressing Enter to navigate to folder..."
		key code 36
		delay 0.5

		-- Press Enter again to confirm
		log "Pressing Enter again to confirm..."
		key code 36
		delay 1


	end tell
end tell

log "Comparison completed and saved"
return "COMPLETED"
`;

  console.log('[Acrobat Debug] AppleScript prepared');
  console.log('[Acrobat Debug] AppleScript length:', appleScript.length);

  // Write AppleScript to a file to avoid command-line escaping issues with paths containing spaces
  const appleScriptPath = path.join(path.dirname(outputPath), `acrobat-applescript-${Date.now()}.applescript`);
  console.log('[Acrobat Debug] Writing AppleScript to file:', appleScriptPath);

  return new Promise(async (resolve, reject) => {
    const timeoutMs = config.acrobat?.timeoutMs || 300000; // 5 minutes default
    let timedOut = false;

    try {
      // Write AppleScript to file
      await fs.writeFile(appleScriptPath, appleScript, 'utf8');
      console.log('[Acrobat Debug] AppleScript file written successfully');
    } catch (writeError) {
      console.log('[Acrobat Debug] Failed to write AppleScript file:', writeError.message);
      reject(writeError);
      return;
    }

    console.log('[Acrobat Debug] Setting up execution with timeout:', timeoutMs / 1000, 'seconds');

    // Set timeout
    const timeout = setTimeout(() => {
      console.log('[Acrobat Debug] TIMEOUT reached!');
      timedOut = true;
      child.kill('SIGTERM');
      const error = new Error(`Acrobat comparison timed out after ${timeoutMs / 1000} seconds`);
      error.code = 'TIMEOUT';
      reject(error);
    }, timeoutMs);

    console.log('[Acrobat Debug] Spawning osascript process...');

    // Execute AppleScript file via osascript
    const child = spawn('osascript', [appleScriptPath]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      console.log('[Acrobat Debug] stdout chunk:', chunk);
      stdout += chunk;
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      console.log('[Acrobat Debug] stderr chunk:', chunk);
      stderr += chunk;
    });

    child.on('error', (error) => {
      console.log('[Acrobat Debug] Process error event:', error.message);
      clearTimeout(timeout);
      if (!timedOut) {
        error.message = `Failed to execute AppleScript: ${error.message}`;
        error.code = 'APPLESCRIPT_ERROR';
        reject(error);
      }
    });

    child.on('close', (code) => {
      console.log('[Acrobat Debug] Process closed with code:', code);
      clearTimeout(timeout);

      if (timedOut) {
        console.log('[Acrobat Debug] Ignoring close event - already timed out');
        return; // Already handled by timeout
      }

      // Log output
      if (stdout) {
        console.log('[Acrobat Output]', stdout);
      }
      if (stderr) {
        console.error('[Acrobat Error]', stderr);
      }

      console.log('[Acrobat Debug] Full stdout length:', stdout.length);
      console.log('[Acrobat Debug] Full stderr length:', stderr.length);

      // Check if comparison failed - only check stdout for actual errors
      // Don't treat stderr as error since AppleScript logs go there
      const hasError = stdout.includes('ERROR:') || stdout.includes('COMPARISON_FAILED');

      if (code !== 0 || hasError) {
        console.log('[Acrobat Debug] Failure detected - code:', code, 'hasError:', hasError);
        console.log('[Acrobat Debug] AppleScript file saved at:', appleScriptPath);

        // Provide more detailed error message
        let errorMsg = `Acrobat comparison failed with code ${code}.`;
        if (stdout) {
          errorMsg += ` Output: ${stdout}`;
        }
        if (stderr) {
          errorMsg += ` Error: ${stderr}`;
        }

        // Check for common issues
        if (stderr.includes('syntax error') || stdout.includes('syntax error')) {
          errorMsg += '\nTip: There may be an issue with the JavaScript syntax.';
        }
        if (stderr.includes('not allowed') || stdout.includes('not allowed')) {
          errorMsg += '\nTip: Check Acrobat security preferences. Go to Preferences > JavaScript and enable JavaScript.';
        }
        if (stdout.includes('comparePages') || stderr.includes('comparePages')) {
          errorMsg += '\nTip: The comparePages API might not be available in your Acrobat version.';
        }

        const error = new Error(errorMsg);
        error.code = 'ACROBAT_EXECUTION_FAILED';
        console.log('[Acrobat Debug] Rejecting with error:', errorMsg);
        reject(error);
      } else {
        console.log('[Acrobat Debug] Success! Exit code 0');
        console.log('[Acrobat Debug] Waiting 10 seconds for file to be written...');
        // Give Acrobat additional time to finish writing the comparison file
        setTimeout(async () => {
          console.log('[Acrobat Debug] Looking for saved PDF...');

          try {
            // Acrobat saves with name "[Compare Report] <filename>.pdf" in the output folder
            const pdf2Name = path.basename(absPdf2, '.pdf');

            // Try different possible filenames in the output folder
            const possibleNames = [
              `[Compare Report] ${pdf2Name}.pdf`,  // Usually uses "New File" name
              `[Compare Report] error.pdf`,         // Or just "error"
              `[Compare Report] correct.pdf`        // Or "correct"
            ];

            console.log('[Acrobat Debug] Checking output folder:', absOutputFolder);

            let savedFilePath = null;
            for (const name of possibleNames) {
              const testPath = path.join(absOutputFolder, name);
              console.log('[Acrobat Debug] Checking:', testPath);
              if (await checkFileExists(testPath)) {
                savedFilePath = testPath;
                console.log('[Acrobat Debug] Found saved file:', savedFilePath);
                break;
              }
            }

            if (savedFilePath && savedFilePath !== absOutput) {
              // Rename the file to the desired output path
              console.log('[Acrobat Debug] Renaming file to:', absOutput);
              await fs.rename(savedFilePath, absOutput);
              console.log('[Acrobat Debug] File renamed successfully');
            } else if (savedFilePath) {
              console.log('[Acrobat Debug] File already has correct name:', savedFilePath);
            } else {
              console.log('[Acrobat Debug] Could not find saved PDF in output folder');
            }

          } catch (error) {
            console.log('[Acrobat Debug] Error renaming file:', error.message);
          }

          // Clean up AppleScript file (non-blocking)
          fs.unlink(appleScriptPath).then(() => {
            console.log('[Acrobat Debug] Cleaned up AppleScript file');
          }).catch((err) => {
            console.log('[Acrobat Debug] Failed to cleanup AppleScript file:', err.message);
          });

          resolve();
        }, 10000);
      }
    });
  });
}

/**
 * Checks if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} - True if file exists
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
 * Checks if Adobe Acrobat is installed
 * @returns {Promise<boolean>} - True if Acrobat is found
 */
export async function checkAcrobatInstallation() {
  try {
    const acrobatPath = config.acrobat?.appPath || '/Applications/Adobe Acrobat DC/Adobe Acrobat.app';
    const exists = await checkFileExists(acrobatPath);
    return exists;
  } catch {
    return false;
  }
}

/**
 * Gets Acrobat installation path
 * @returns {string} - Path to Acrobat application
 */
export function getAcrobatPath() {
  return config.acrobat?.appPath || '/Applications/Adobe Acrobat DC/Adobe Acrobat.app';
}
