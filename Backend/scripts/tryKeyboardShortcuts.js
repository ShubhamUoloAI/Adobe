import { spawn } from 'child_process';

/**
 * Try keyboard shortcuts to access Tools
 */
async function tryKeyboardShortcuts() {
  console.log('🔍 Trying keyboard shortcuts to access Tools...\n');

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
\t\tlog "Trying Cmd+Shift+O (common for Tools/Organize)"
\t\tkeystroke "o" using {command down, shift down}
\t\tdelay 2
\t\t
\t\tlog "Trying Cmd+E (common for Edit)"
\t\tkeystroke "e" using {command down}
\t\tdelay 2
\t\t
\t\tlog "Trying Cmd+Shift+T (common for Tools)"
\t\tkeystroke "t" using {command down, shift down}
\t\tdelay 2
\t\t
\t\tlog "Trying to click at approximate position of 'See all tools' button"
\t\tlog "Button appears to be in top-right area around (1260, 153) based on screenshot"
\t\t
\t\t-- Get window position
\t\ttry
\t\t\tset win to window 1
\t\t\tset winPosition to position of win
\t\t\tset winSize to size of win
\t\t\tlog "Window position: " & winPosition
\t\t\tlog "Window size: " & winSize
\t\t\t
\t\t\t-- Calculate approximate button position
\t\t\t-- Based on screenshot, button is roughly 1260 pixels from left, 153 from top
\t\t\t-- But this is in screen coordinates
\t\t\tset winX to item 1 of winPosition
\t\t\tset winY to item 2 of winPosition
\t\t\t
\t\t\t-- Try clicking at different positions where "See all tools" might be
\t\t\tlog "Attempting click at approximate 'See all tools' position..."
\t\t\t
\t\t\t-- Top-right area, relative to window
\t\t\tset clickX to winX + 1200
\t\t\tset clickY to winY + 100
\t\t\t
\t\t\tdo shell script "echo Clicking at position: " & clickX & ", " & clickY
\t\t\t
\t\t\t-- Use cliclick if available (needs to be installed)
\t\t\t-- tell application "System Events" to click at {clickX, clickY}
\t\t\t
\t\ton error errMsg
\t\t\tlog "Position detection failed: " & errMsg
\t\tend try
\t\t
\t\tlog "Checking windows after shortcuts..."
\t\tset windowNames to name of every window
\t\tlog "Windows: " & windowNames
\t\t
\t\treturn "SHORTCUTS_TESTED"
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
        console.log('\nStderr (logs):');
        console.log(stderr);
      }

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Shortcut test failed with code ${code}`));
      }
    });
  });
}

// Run test
tryKeyboardShortcuts()
  .then(() => {
    console.log('\n✅ Shortcut test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
