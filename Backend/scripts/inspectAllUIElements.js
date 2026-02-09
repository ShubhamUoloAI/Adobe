import { spawn } from 'child_process';

/**
 * Comprehensive UI dump to find the "See all tools" button
 */
async function inspectAllUIElements() {
  console.log('🔍 Dumping all Acrobat UI elements...\n');

  const appleScript = `
tell application "Adobe Acrobat"
\tlaunch
\tactivate
\tdelay 5
end tell

tell application "System Events"
\ttell process "Acrobat"
\t\tset frontmost to true
\t\tdelay 2
\t\t
\t\tlog "=== ALL WINDOWS ==="
\t\tset windowCount to count of windows
\t\tlog "Total windows: " & windowCount
\t\t
\t\trepeat with i from 1 to windowCount
\t\t\tset win to window i
\t\t\tlog "Window " & i & ": " & (name of win)
\t\t\t
\t\t\t-- Get all UI elements in this window
\t\t\ttry
\t\t\t\tlog "  === GROUPS IN WINDOW " & i & " ==="
\t\t\t\tset groupCount to count of groups of win
\t\t\t\tlog "  Total groups: " & groupCount
\t\t\t\t
\t\t\t\t-- Check first few groups for buttons
\t\t\t\trepeat with g from 1 to (groupCount)
\t\t\t\t\tif g > 10 then exit repeat -- Limit to first 10 groups
\t\t\t\t\t
\t\t\t\t\ttry
\t\t\t\t\t\tset grp to group g of win
\t\t\t\t\t\t
\t\t\t\t\t\t-- Try to get buttons in this group
\t\t\t\t\t\ttry
\t\t\t\t\t\t\tset btnsInGroup to every button of grp
\t\t\t\t\t\t\tlog "    Group " & g & " has " & (count of btnsInGroup) & " buttons"
\t\t\t\t\t\t\t
\t\t\t\t\t\t\t-- List button names
\t\t\t\t\t\t\trepeat with btn in btnsInGroup
\t\t\t\t\t\t\t\ttry
\t\t\t\t\t\t\t\t\tset btnInfo to "name: " & (name of btn)
\t\t\t\t\t\t\t\t\ttry
\t\t\t\t\t\t\t\t\t\tset btnInfo to btnInfo & ", description: " & (description of btn)
\t\t\t\t\t\t\t\t\tend try
\t\t\t\t\t\t\t\t\ttry
\t\t\t\t\t\t\t\t\t\tset btnInfo to btnInfo & ", role: " & (role of btn)
\t\t\t\t\t\t\t\t\tend try
\t\t\t\t\t\t\t\t\tlog "      Button: " & btnInfo
\t\t\t\t\t\t\t\ton error
\t\t\t\t\t\t\t\t\tlog "      Button: (no accessible properties)"
\t\t\t\t\t\t\t\tend try
\t\t\t\t\t\t\tend repeat
\t\t\t\t\t\ton error
\t\t\t\t\t\t\t-- No buttons in this group
\t\t\t\t\t\tend try
\t\t\t\t\ton error
\t\t\t\t\t\t-- Could not access group
\t\t\t\t\tend try
\t\t\t\tend repeat
\t\t\t\t
\t\t\ton error
\t\t\t\tlog "  Could not access groups"
\t\t\tend try
\t\t\t
\t\t\t-- Also check buttons directly in window
\t\t\ttry
\t\t\t\tlog "  === DIRECT BUTTONS IN WINDOW " & i & " ==="
\t\t\t\tset btns to every button of win
\t\t\t\tlog "  Total buttons: " & (count of btns)
\t\t\t\t
\t\t\t\trepeat with btn in btns
\t\t\t\t\ttry
\t\t\t\t\t\tset btnInfo to "name: " & (name of btn)
\t\t\t\t\t\ttry
\t\t\t\t\t\t\tset btnInfo to btnInfo & ", description: " & (description of btn)
\t\t\t\t\t\tend try
\t\t\t\t\t\tlog "    Button: " & btnInfo
\t\t\t\t\ton error
\t\t\t\t\t\tlog "    Button: (no accessible properties)"
\t\t\t\t\tend try
\t\t\t\tend repeat
\t\t\ton error errMsg
\t\t\t\tlog "  Could not access buttons: " & errMsg
\t\t\tend try
\t\t\t
\t\t\t-- Check UI elements
\t\t\ttry
\t\t\t\tlog "  === UI ELEMENTS IN WINDOW " & i & " ==="
\t\t\t\tset uiElems to every UI element of win
\t\t\t\tlog "  Total UI elements: " & (count of uiElems)
\t\t\ton error
\t\t\t\tlog "  Could not count UI elements"
\t\t\tend try
\t\t\t
\t\tend repeat
\t\t
\t\treturn "INSPECTION_COMPLETE"
\tend tell
end tell
`;

  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', appleScript]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      console.log('\n📊 Results:');
      console.log('Exit code:', code);
      if (stdout) {
        console.log('\nStdout:');
        console.log(stdout);
      }
      if (stderr) {
        console.log('\nStderr (detailed logs):');
        console.log(stderr);
      }

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Inspection failed with code ${code}`));
      }
    });
  });
}

// Run inspection
inspectAllUIElements()
  .then(() => {
    console.log('\n✅ Inspection complete! Check the logs above for UI structure.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Inspection failed:', error.message);
    process.exit(1);
  });
