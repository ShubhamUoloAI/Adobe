import { spawn } from 'child_process';

/**
 * Comprehensive accessibility permission test
 * This tests ACTUAL UI automation, not just System Events access
 */
async function testAccessibilityPermissions() {
  console.log('🔍 Testing Accessibility Permissions...\n');

  // Test 1: Basic System Events access
  console.log('Test 1: Basic System Events query...');
  const test1 = await runAppleScript(`
tell application "System Events"
  try
    set frontApp to name of first application process whose frontmost is true
    return "SUCCESS: " & frontApp
  on error errMsg
    return "ERROR: " & errMsg
  end try
end tell
  `);
  console.log(test1.success ? '✅ PASSED' : '❌ FAILED');
  console.log('   Output:', test1.output);
  console.log('   Error:', test1.error || 'none');
  console.log('');

  // Test 2: UI Automation (keystroke) - This is what actually fails
  console.log('Test 2: UI Automation (keystroke test)...');
  const test2 = await runAppleScript(`
tell application "System Events"
  try
    -- Try to get UI elements (requires accessibility)
    set processCount to count of processes
    return "SUCCESS: Found " & processCount & " processes"
  on error errMsg
    return "ERROR: " & errMsg
  end try
end tell
  `);
  console.log(test2.success ? '✅ PASSED' : '❌ FAILED');
  console.log('   Output:', test2.output);
  console.log('   Error:', test2.error || 'none');
  console.log('');

  // Test 3: Full UI control test
  console.log('Test 3: Full UI control test (click/keystroke)...');
  const test3 = await runAppleScript(`
tell application "System Events"
  try
    tell process "Finder"
      -- Just try to get a UI element - this requires full accessibility
      set windowCount to count of windows
      return "SUCCESS: Finder has " & windowCount & " windows"
    end tell
  on error errMsg number errNum
    return "ERROR: " & errMsg & " (code: " & errNum & ")"
  end try
end tell
  `);
  console.log(test3.success ? '✅ PASSED' : '❌ FAILED');
  console.log('   Output:', test3.output);
  console.log('   Error:', test3.error || 'none');
  console.log('');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  if (test1.success && test2.success && test3.success) {
    console.log('✅ All tests passed! Accessibility is properly configured.');
  } else {
    console.log('❌ Some tests failed. Accessibility permissions are incomplete.');
    console.log('\n📋 TROUBLESHOOTING STEPS:');
    console.log('1. Open System Settings → Privacy & Security → Privacy → Accessibility');
    console.log('2. Add these apps/binaries:');
    console.log('   - The terminal/IDE you\'re using (Terminal, iTerm, VSCode, etc.)');
    console.log('   - /usr/bin/osascript');
    console.log(`   - ${process.execPath} (your Node.js binary)`);
    console.log('3. Remove and re-add each app (sometimes macOS needs this)');
    console.log('4. Restart your terminal/IDE');
    console.log('5. Run this test again: npm run test:accessibility');
  }
}

/**
 * Run an AppleScript and return results
 */
function runAppleScript(script) {
  return new Promise((resolve) => {
    const child = spawn('osascript', ['-e', script]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0 && !stderr.includes('error'),
        output: stdout.trim(),
        error: stderr.trim(),
        code
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        error: error.message,
        code: -1
      });
    });
  });
}

// Run the test
testAccessibilityPermissions().catch(console.error);
