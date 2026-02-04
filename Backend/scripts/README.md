# Batch InDesign to PDF Converter

This script processes all InDesign zip files from a local folder and converts them to PDFs.

## Features

- 📁 Processes all `.zip` files in the source folder
- 📄 Converts InDesign files (.indd, .idml, .indb) to PDF
- 💾 Saves PDFs to output folder
- 📊 Logs errors to Excel file with incremental naming (logs.xlsx, logs1.xlsx, etc.)
- 🧹 Automatic cleanup of temporary files
- ✅ Progress tracking with success/failure counts

## Configuration

Edit the following paths in `batchConvert.js`:

```javascript
const SOURCE_FOLDER = '/Users/shubham/Downloads/UoloZip';  // Input folder with zip files
const OUTPUT_FOLDER = '/Users/shubham/Downloads/UoloPdf';  // Output folder for PDFs
```

## Usage

### 1. Install dependencies (if not already installed)

```bash
cd Backend
npm install
```

### 2. Run the batch converter

```bash
npm run batch:convert
```

Or directly with node:

```bash
node scripts/batchConvert.js
```

## Output

### Successful Conversions
- PDFs are saved to the output folder with the same name as the zip file
- Example: `document.zip` → `document.pdf`

### Error Logging
If any conversions fail, an Excel file is created in the output folder:
- First run: `logs.xlsx`
- If logs.xlsx exists: `logs1.xlsx`
- If logs1.xlsx exists: `logs2.xlsx`
- And so on...

The Excel file contains:
- **Filename**: Name of the zip file that failed
- **Error Message**: Detailed error message (missing links, font errors, etc.)

## Example Output

```
============================================================
InDesign Batch PDF Converter
============================================================
Source: /Users/shubham/Downloads/UoloZip
Output: /Users/shubham/Downloads/UoloPdf
============================================================

Found 5 zip file(s) to process

[1/5] Processing: document1.zip
------------------------------------------------------------
  ↻ Validating zip file...
  ↻ Extracting zip file...
  ✓ InDesign file found: document1.indd
  ↻ Converting to PDF...
  ✓ PDF generated: document1.pdf
  ✓ Saved to: /Users/shubham/Downloads/UoloPdf/document1.pdf
  🗑  Cleaned up temporary files
  ✅ SUCCESS

[2/5] Processing: document2.zip
------------------------------------------------------------
  ↻ Validating zip file...
  ↻ Extracting zip file...
  ✓ InDesign file found: document2.indd
  ↻ Converting to PDF...
  ❌ ERROR: Document has critical errors that prevent PDF export:

• Missing Images/Links (3):
  - image1.jpg
  - image2.png
  - logo.eps

  🗑  Cleaned up temporary files

============================================================
BATCH CONVERSION SUMMARY
============================================================
Total files: 5
✅ Successful: 4
❌ Failed: 1
============================================================

📝 Generating error log...
✓ Error log saved: /Users/shubham/Downloads/UoloPdf/logs.xlsx
  Total errors logged: 1

✅ Batch conversion completed!
```

## Error Handling

The script handles all errors gracefully:
- Invalid/corrupt zip files
- Missing InDesign files
- Missing fonts (attempts auto-download and retry)
- Missing links/images
- InDesign conversion errors
- File system errors

All errors are logged to the Excel file with detailed messages.

## Requirements

- Node.js 16+
- Adobe InDesign 2024/2026 installed
- All dependencies installed (`npm install`)

## Notes

- Fonts from "Document fonts" folders are installed permanently to `~/Library/Fonts`
- Temporary extraction files are cleaned up after each conversion
- The script processes files sequentially to avoid overwhelming the system
- Large files may take several minutes to process
