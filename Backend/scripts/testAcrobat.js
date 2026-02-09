import { comparePDFsWithAcrobat } from '../services/acrobatService.js';

async function testAcrobatComparison() {
  console.log('========================================');
  console.log('Testing Acrobat PDF Comparison');
  console.log('========================================\n');

  // Update these paths to your actual PDF files
  const pdf1 = '/Users/shubham/Downloads/Uolo-pdf/untitled folder/correct.pdf';
  const pdf2 = '/Users/shubham/Downloads/Uolo-pdf/untitled folder/error.pdf';
  const outputDir = '/Users/shubham/Downloads/Uolo-pdf/Report';

  console.log('PDF 1:', pdf1);
  console.log('PDF 2:', pdf2);
  console.log('Output Dir:', outputDir);
  console.log('');

  try {
    console.log('Starting comparison...\n');
    const resultPath = await comparePDFsWithAcrobat(pdf1, pdf2, outputDir);

    console.log('\n========================================');
    console.log('SUCCESS!');
    console.log('========================================');
    console.log('Comparison PDF created at:', resultPath);
    console.log('\nYou can open it with:');
    console.log(`open "${resultPath}"`);

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('ERROR!');
    console.error('========================================');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('\nFull error:', error);

    process.exit(1);
  }
}

testAcrobatComparison();
