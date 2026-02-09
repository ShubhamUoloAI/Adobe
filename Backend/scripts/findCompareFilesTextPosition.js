import { spawn } from 'child_process';

/**
 * Find the exact "Compare Files" text position
 */
async function findCompareFilesPosition() {
  console.log('🔍 Finding "Compare Files" text position...\n');

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
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & (winX + winWidth - 120) & "," & (winY + 140)
\t\tdelay 4
\t\t
\t\t-- Search for compare
\t\tset searchX to (winX + (winWidth / 2)) as integer
\t\tdo shell script "/opt/homebrew/bin/cliclick c:" & searchX & "," & (winY + 150)
\t\tdelay 1
\t\tdo shell script "/opt/homebrew/bin/cliclick tc:" & searchX & "," & (winY + 150)
\t\tdelay 0.5
\t\tdo shell script "/opt/homebrew/bin/cliclick t:compare"
\t\tdelay 4
\t\t
\t\tlog "Testing different Y positions for Compare Files text/tool..."
\t\t
\t\tset centerX to (winX + (winWidth / 2)) as integer
\t\tset testYOffsets to {240, 250, 260, 268, 275, 280, 290, 300}
\t\t
\t\trepeat with yOffset in testYOffsets
\t\t\tset testY to (winY + yOffset) as integer
\t\t\tlog "Trying Y offset " & yOffset & " (absolute: " & testY & ")"
\t\t\t
\t\t\t-- Click with visual indicator
\t\t\tdo shell script "/opt/homebrew/bin/cliclick -r c:" & centerX & "," & testY
\t\t\tdelay 4
\t\t\t
\t\t\t-- Check if window changed
\t\t\tset winName to name of window 1
\t\t\tlog "Window name after click: " & winName
\t\t\t
\t\t\tif winName contains "Compare" then
\t\t\t\tlog "SUCCESS! Compare Files opened at Y offset: " & yOffset
\t\t\t\texit repeat
\t\t\telse if winName is not "All tools" and winName is not "Adobe Acrobat" then
\t\t\t\tlog "Window changed to: " & winName
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

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
      console.log('\n📊 Results:');
      console.log('Exit code:', code);
      if (stderr) {
        console.log('\nLogs:');
        console.log(stderr);
      }
      resolve({ stdout, stderr, code });
    });
  });
}

findCompareFilesPosition()
  .then(() => {
    console.log('\n✅ Check Acrobat - watch for red circles!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
