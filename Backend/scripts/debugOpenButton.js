import { spawn } from 'child_process';

/**
 * Debug script to find the exact Open button position with visual feedback
 */
async function debugOpenButton() {
  console.log('🔍 Finding Open button position with visual feedback...\n');

  const appleScript = `
tell application "Adobe Acrobat"
\tlaunch
\tactivate
\tdelay 8
end tell

tell application "System Events"
\ttell process "Acrobat"
\t\tset frontmost to true
\t\tdelay 3
\t\t
\t\trepeat 15 times
\t\t\tif (count of windows) > 0 then exit repeat
\t\t\tdelay 1
\t\tend repeat
\t\t
\t\tset win to window 1
\t\tset winPos to position of win
\t\tset winSize to size of win
\t\tset winX to item 1 of winPos
\t\tset winY to item 2 of winPos
\t\tset winWidth to item 1 of winSize
\t\t
\t\tlog "Window: " & winX & "," & winY & " Size: " & winWidth & "x" & (item 2 of winSize)
\t\t
\t\t-- Click See all tools
\t\tset seeAllX to winX + winWidth - 120
\t\tset seeAllY to winY + 140
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & seeAllX & "," & seeAllY
\t\tdelay 4
\t\t
\t\t-- Click search box
\t\tset searchX to (winX + (winWidth / 2)) as integer
\t\tset searchY to (winY + 150) as integer
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & searchX & "," & searchY
\t\tdelay 1
\t\t
\t\t-- Type compare
\t\tkeystroke "compare"
\t\tdelay 3
\t\t
\t\tlog "Search complete, now trying different Y positions for Open button"
\t\t
\t\t-- Try multiple Y positions with visual feedback (-r shows red circle)
\t\tset testYPositions to {280, 300, 320, 340, 360, 380, 400}
\t\tset centerX to (winX + (winWidth / 2)) as integer
\t\t
\t\trepeat with yOffset in testYPositions
\t\t\tset testY to (winY + yOffset) as integer
\t\t\tlog "Trying click at: " & centerX & "," & testY
\t\t\t
\t\t\t-- Click with visual feedback
\t\t\tdo shell script "/opt/homebrew/bin/cliclick -r c:" & centerX & "," & testY
\t\t\tdelay 2
\t\t\t
\t\t\t-- Check if a new window or dialog appeared
\t\t\tset windowCount to count of windows
\t\t\tlog "Window count: " & windowCount
\t\t\t
\t\t\tif windowCount > 1 then
\t\t\t\tlog "SUCCESS! Compare Files opened at Y=" & testY
\t\t\t\texit repeat
\t\t\tend if
\t\tend repeat
\t\t
\tend tell
end tell

return "DEBUG_COMPLETE"
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
        reject(new Error(`Debug failed with code ${code}`));
      }
    });
  });
}

// Run debug
debugOpenButton()
  .then(() => {
    console.log('\n✅ Debug complete! Watch Acrobat for red circles showing click positions.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error.message);
    process.exit(1);
  });
