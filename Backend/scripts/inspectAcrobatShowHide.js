import { spawn } from 'child_process';

/**
 * Inspects View > Show/Hide menu to find Tools access
 */
async function inspectShowHide() {
  console.log('🔍 Inspecting View > Show/Hide menu...\n');

  const appleScript = `
tell application "Adobe Acrobat"
\tlaunch
\tactivate
\tdelay 3
\t
\t-- Open a sample PDF to have a document window
\ttry
\t\topen POSIX file "/Users/shubham/Desktop/Repositories/Repo/1_U26EN0301_TM.pdf"
\t\tdelay 2
\tend try
end tell

tell application "System Events"
\ttell process "Acrobat"
\t\tset frontmost to true
\t\tdelay 1
\t\t
\t\tlog "=== CHECKING VIEW MENU ==="
\t\t
\t\t-- Access View menu
\t\ttry
\t\t\tclick menu "View" of menu bar 1
\t\t\tdelay 0.5
\t\t\t
\t\t\t-- Check Show/Hide submenu
\t\t\tset showHideMenu to menu "Show/Hide" of menu "View" of menu bar 1
\t\t\tset showHideItems to name of every menu item of showHideMenu
\t\t\tlog "Show/Hide menu items: " & showHideItems
\t\t\t
\t\t\t-- Check for Tools Pane or similar
\t\t\trepeat with itemName in showHideItems
\t\t\t\tif itemName contains "Tool" then
\t\t\t\t\tlog "Found Tools-related item: " & itemName
\t\t\t\tend if
\t\t\tend repeat
\t\t\t
\t\t\t-- Close menu
\t\t\tkeystroke escape
\t\t\t
\t\ton error errMsg
\t\t\tlog "Error accessing Show/Hide: " & errMsg
\t\tend try
\t\t
\t\tlog "=== CHECKING FILE MENU ==="
\t\t
\t\t-- Check File menu for comparison options
\t\ttry
\t\t\tclick menu "File" of menu bar 1
\t\t\tdelay 0.5
\t\t\t
\t\t\tset fileMenuItems to name of every menu item of menu "File" of menu bar 1
\t\t\tlog "File menu items: " & fileMenuItems
\t\t\t
\t\t\t-- Look for Compare or similar
\t\t\trepeat with itemName in fileMenuItems
\t\t\t\tif itemName contains "Compare" or itemName contains "compare" then
\t\t\t\t\tlog "Found Compare-related item: " & itemName
\t\t\t\tend if
\t\t\tend repeat
\t\t\t
\t\t\t-- Close menu
\t\t\tkeystroke escape
\t\t\t
\t\ton error errMsg
\t\t\tlog "Error accessing File menu: " & errMsg
\t\tend try
\t\t
\t\tlog "=== CHECKING ALL WINDOWS ==="
\t\t
\t\t-- List all UI elements to find Tools access
\t\ttry
\t\t\tset allWindows to every window
\t\t\trepeat with win in allWindows
\t\t\t\tlog "Window: " & (name of win)
\t\t\t\t
\t\t\t\t-- Try to find buttons with "Tool" in name
\t\t\t\ttry
\t\t\t\t\tset buttons to every button of win
\t\t\t\t\trepeat with btn in buttons
\t\t\t\t\t\ttry
\t\t\t\t\t\t\tset btnDesc to description of btn
\t\t\t\t\t\t\tif btnDesc contains "Tool" or btnDesc contains "tool" then
\t\t\t\t\t\t\t\tlog "Found button: " & btnDesc
\t\t\t\t\t\t\tend if
\t\t\t\t\t\ton error
\t\t\t\t\t\t\t-- Button has no description
\t\t\t\t\t\tend try
\t\t\t\t\tend repeat
\t\t\t\ton error
\t\t\t\t\t-- No buttons or error accessing
\t\t\t\tend try
\t\t\tend repeat
\t\ton error errMsg
\t\t\tlog "Error inspecting windows: " & errMsg
\t\tend try
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
      console.log('\nStdout:');
      console.log(stdout);
      if (stderr) {
        console.log('\nStderr (logs):');
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
inspectShowHide()
  .then(() => {
    console.log('\n✅ Inspection complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Inspection failed:', error.message);
    process.exit(1);
  });
