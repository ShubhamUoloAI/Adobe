import { spawn } from 'child_process';

/**
 * Inspects Adobe Acrobat UI structure to help with automation
 */
async function inspectAcrobatUI() {
  console.log('🔍 Inspecting Adobe Acrobat UI structure...\n');

  const appleScript = `
tell application "Adobe Acrobat"
\tlaunch
\tactivate
\tdelay 3
end tell

tell application "System Events"
\ttell process "Acrobat"
\t\tset frontmost to true
\t\tdelay 1
\t\t
\t\tlog "=== MENU BAR STRUCTURE ==="
\t\t
\t\t-- List all menus
\t\tset menuNames to name of every menu of menu bar 1
\t\tlog "Available menus: " & menuNames
\t\t
\t\t-- Check Tools menu specifically
\t\ttry
\t\t\tset toolsMenuItems to name of every menu item of menu "Tools" of menu bar 1
\t\t\tlog "Tools menu items: " & toolsMenuItems
\t\ton error errMsg
\t\t\tlog "Could not access Tools menu: " & errMsg
\t\tend try
\t\t
\t\t-- Check View menu
\t\ttry
\t\t\tset viewMenuItems to name of every menu item of menu "View" of menu bar 1
\t\t\tlog "View menu items: " & viewMenuItems
\t\ton error errMsg
\t\t\tlog "Could not access View menu: " & errMsg
\t\tend try
\t\t
\t\tlog "=== WINDOW STRUCTURE ==="
\t\t
\t\t-- List all windows
\t\tset windowCount to count of windows
\t\tlog "Number of windows: " & windowCount
\t\t
\t\tif windowCount > 0 then
\t\t\tset windowNames to name of every window
\t\t\tlog "Window names: " & windowNames
\t\t\t
\t\t\t-- Inspect first window
\t\t\ttry
\t\t\t\tset firstWindow to window 1
\t\t\t\tlog "First window name: " & (name of firstWindow)
\t\t\t\t
\t\t\t\t-- Try to list buttons in first window
\t\t\t\ttry
\t\t\t\t\tset buttonNames to name of every button of firstWindow
\t\t\t\t\tlog "Buttons in first window: " & buttonNames
\t\t\t\ton error
\t\t\t\t\tlog "No buttons found in first window"
\t\t\t\tend try
\t\t\t\t
\t\t\ton error errMsg
\t\t\t\tlog "Could not inspect first window: " & errMsg
\t\t\tend try
\t\tend if
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
inspectAcrobatUI()
  .then(() => {
    console.log('\n✅ Inspection complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Inspection failed:', error.message);
    process.exit(1);
  });
