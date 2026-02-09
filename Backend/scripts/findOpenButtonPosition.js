import { spawn } from 'child_process';

/**
 * Find the exact Open button position by trying multiple coordinates
 */
async function findOpenButtonPosition() {
  console.log('🔍 Finding exact Open button position...\n');

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
\t\t-- Click See all tools
\t\tset seeAllX to winX + winWidth - 120
\t\tset seeAllY to winY + 140
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & seeAllX & "," & seeAllY
\t\tdelay 4
\t\t
\t\t-- Click and clear search box
\t\tset searchX to (winX + (winWidth / 2)) as integer
\t\tset searchY to (winY + 150) as integer
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & searchX & "," & searchY
\t\tdelay 1
\t\tdo shell script "/opt/homebrew/bin/cliclick tc:" & searchX & "," & searchY
\t\tdelay 0.5
\t\t
\t\t-- Type compare
\t\tdo shell script "/opt/homebrew/bin/cliclick t:compare"
\t\tdelay 4
\t\t
\t\tlog "Testing different Open button positions..."
\t\t
\t\t-- Try different Y positions for the Open button
\t\tset centerX to (winX + (winWidth / 2)) as integer
\t\tset testYOffsets to {280, 300, 315, 320, 325, 330, 340, 350}
\t\t
\t\trepeat with yOffset in testYOffsets
\t\t\tset testY to (winY + yOffset) as integer
\t\t\tlog "Trying Open button at: " & centerX & "," & testY
\t\t\t
\t\t\t-- Click with visual red circle
\t\t\tdo shell script "/opt/homebrew/bin/cliclick -r c:" & centerX & "," & testY
\t\t\tdelay 3
\t\t\t
\t\t\t-- Check if window changed (Compare interface opened)
\t\t\tset currentWindowName to name of window 1
\t\t\tlog "Current window name: " & currentWindowName
\t\t\t
\t\t\tif currentWindowName is not "All tools" and currentWindowName is not "Adobe Acrobat" then
\t\t\t\tlog "SUCCESS! Compare Files opened at Y offset: " & yOffset
\t\t\t\tlog "Absolute position: " & centerX & "," & testY
\t\t\t\texit repeat
\t\t\tend if
\t\t\t
\t\t\tdelay 1
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
        console.log('\nStderr (detailed logs):');
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
findOpenButtonPosition()
  .then(() => {
    console.log('\n✅ Debug complete! Watch for red circles and check which position opened Compare Files.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error.message);
    process.exit(1);
  });
