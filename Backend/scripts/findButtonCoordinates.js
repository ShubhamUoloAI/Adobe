import { spawn } from 'child_process';

/**
 * Test different coordinates to find the "See all tools" button
 */
async function findButtonCoordinates() {
  console.log('🔍 Finding "See all tools" button coordinates...\n');

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
\t\t-- Get window info
\t\tset win to window 1
\t\tset winPosition to position of win
\t\tset winSize to size of win
\t\t
\t\tset winX to item 1 of winPosition
\t\tset winY to item 2 of winPosition
\t\tset winWidth to item 1 of winSize
\t\tset winHeight to item 2 of winSize
\t\t
\t\tlog "Window: " & winX & "," & winY & " size: " & winWidth & "x" & winHeight
\t\t
\t\t-- Try different positions for "See all tools" button
\t\t-- The button appears to be in the top-right area
\t\t
\t\tset testPositions to {¬
\t\t\t{-150, 153}, ¬
\t\t\t{-120, 153}, ¬
\t\t\t{-100, 153}, ¬
\t\t\t{-80, 153}, ¬
\t\t\t{-150, 140}, ¬
\t\t\t{-120, 140}, ¬
\t\t\t{-100, 140}}
\t\t
\t\trepeat with pos in testPositions
\t\t\tset offsetX to item 1 of pos
\t\t\tset offsetY to item 2 of pos
\t\t\t
\t\t\tset clickX to winX + winWidth + offsetX
\t\t\tset clickY to winY + offsetY
\t\t\t
\t\t\tlog "Trying position: " & clickX & "," & clickY & " (offset: " & offsetX & "," & offsetY & ")"
\t\t\t
\t\t\t-- Use cliclick with visual feedback (shows a red circle)
\t\t\tdo shell script "/opt/homebrew/bin/cliclick -r c:" & clickX & "," & clickY
\t\t\tdelay 0.5
\t\t\t
\t\t\t-- Check if a new window appeared (tools panel)
\t\t\tset windowCount to count of windows
\t\t\tlog "Window count after click: " & windowCount
\t\t\t
\t\t\tif windowCount > 1 then
\t\t\t\tlog "SUCCESS! Tools panel opened at: " & clickX & "," & clickY
\t\t\t\texit repeat
\t\t\tend if
\t\t\t
\t\t\tdelay 0.5
\t\tend repeat
\t\t
\tend tell
end tell

return "TEST_COMPLETE"
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
        reject(new Error(`Test failed with code ${code}`));
      }
    });
  });
}

// Run test
findButtonCoordinates()
  .then(() => {
    console.log('\n✅ Test complete! Check Acrobat to see if tools panel opened.');
    console.log('Watch for the red circles showing where clicks happened.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
