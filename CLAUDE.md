# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack InDesign to PDF converter with two main features:
1. **InDesign Conversion**: Converts InDesign packages (.zip with .indd/.idml/.indb files) to PDF using Adobe InDesign Desktop automation
2. **PDF Comparison**: Compares multiple PDFs using OpenAI's API to identify differences

## Common Commands

### Backend (Node.js/Express)
```bash
cd Backend

# Development
npm run dev              # Start with hot reload (8GB memory allocation)
npm start                # Production mode

# InDesign Setup & Testing
npm run find:indesign    # Locate InDesign installation
npm run test:indesign    # Verify InDesign is accessible
npm run health           # Check server health

# Utilities
npm run batch:convert    # Batch convert multiple InDesign files
```

### Frontend (React/Vite)
```bash
cd Frontend

npm run dev              # Start dev server (port 5173)
npm run build            # Production build
npm run lint             # ESLint
npm run preview          # Preview production build
```

### Testing Endpoints
```bash
# Health check
curl http://localhost:5000/health

# Convert InDesign to PDF
curl -X POST http://localhost:5000/api/upload \
  -F "file=@package.zip" \
  --output result.pdf

# Check PDF comparison status
curl http://localhost:5000/api/compare-pdfs/status
```

## Architecture Overview

### Request Flow: InDesign Conversion

1. **Upload** → Frontend uploads ZIP via [routes/upload.js](Backend/routes/upload.js)
2. **Extract** → [zipHandler.js](Backend/services/zipHandler.js) extracts ZIP and searches for .indd/.idml/.indb files
3. **Font Installation** → Automatically installs fonts from "Document fonts" folder to `~/Library/Fonts` (macOS)
4. **ExtendScript Generation** → [indesignService.js](Backend/services/indesignService.js) creates dynamic .jsx file with:
   - Preflight validation (checks for missing links/images)
   - Font availability checks
   - PDF export configuration
5. **InDesign Automation** → Spawns InDesign via AppleScript (macOS) or direct execution (Windows)
6. **Error Handling** → If fonts are missing, [fontDownloader.js](Backend/services/fontDownloader.js) downloads from Google Fonts and retries once
7. **Cleanup** → [fileCleanup.js](Backend/utils/fileCleanup.js) removes temp files (fonts remain permanently installed)

### Request Flow: PDF Comparison

1. **Upload** → Multiple PDFs uploaded via [routes/compare.js](Backend/routes/compare.js)
2. **OpenAI Processing** → [openaiService.js](Backend/services/openaiService.js):
   - For 2 PDFs: Direct comparison
   - For 3+ PDFs: Pairwise comparisons with grouping
3. **Response** → Returns similarity scores, additions, deletions, modifications
4. **Cleanup** → Deletes OpenAI assistant, thread, and temp files

### Key Architectural Patterns

**ExtendScript Automation**
- Dynamic .jsx files are generated per request with embedded font lists
- ExtendScript handles preflight checks before PDF export
- Supports InDesign Books (.indb) with multiple documents
- 5-minute timeout per conversion process

**Font Management**
- Fonts from "Document fonts" folder are permanently installed to `~/Library/Fonts`
- Font cache is cleared using `atsutil` (macOS) to ensure InDesign recognizes new fonts
- Missing fonts trigger automatic download from Google Fonts (if mapped) with one retry
- Fonts are NOT cleaned up to prevent re-downloading on subsequent conversions

**File Cleanup Strategy**
- Uploaded ZIPs: Deleted after processing
- Extracted folders: Deleted after processing
- Generated PDFs: Deleted after client download
- Fonts: Kept permanently
- Periodic cleanup: Every 6 hours for files older than 24 hours

**Error Handling**
- Preflight errors (missing links/images) are critical and block export
- Font errors trigger automatic download + retry
- AppleScript wrapper noise is stripped from error messages
- Detailed error logging with preflight results

### Configuration

**Backend Environment Variables** ([Backend/.env](Backend/.env)):
```
PORT=5000
INDESIGN_APP_PATH=           # Auto-detected if not set
TEMP_UPLOAD_PATH=./temp/uploads
TEMP_EXTRACT_PATH=./temp/extracted
MAX_FILE_SIZE_MB=100

# PDF Comparison
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
MAX_PDF_COUNT=10
MAX_PDF_SIZE_MB=50
COMPARISON_TIMEOUT_MS=300000
```

**Frontend Proxy** ([Frontend/vite.config.js](Frontend/vite.config.js)):
- `/api/*` → `http://localhost:5000/api/*`
- `/health` → `http://localhost:5000/health`

### Critical Files to Understand

| File | Purpose |
|------|---------|
| [Backend/server.js](Backend/server.js) | Express server setup, routes, periodic cleanup |
| [Backend/services/indesignService.js](Backend/services/indesignService.js) | InDesign automation via ExtendScript |
| [Backend/services/zipHandler.js](Backend/services/zipHandler.js) | ZIP extraction, font discovery and installation |
| [Backend/services/fontDownloader.js](Backend/services/fontDownloader.js) | Google Fonts download with variant mapping |
| [Backend/services/openaiService.js](Backend/services/openaiService.js) | PDF comparison logic (pairwise for 3+ files) |
| [Backend/utils/fileCleanup.js](Backend/utils/fileCleanup.js) | File lifecycle management |
| [Frontend/src/components/FileUpload.jsx](Frontend/src/components/FileUpload.jsx) | InDesign conversion UI |
| [Frontend/src/components/PdfComparison.jsx](Frontend/src/components/PdfComparison.jsx) | PDF comparison UI |

### Platform-Specific Notes

**macOS:**
- InDesign is executed via `osascript` (AppleScript wrapper)
- Fonts are installed to `~/Library/Fonts`
- Font cache cleared with `atsutil databases -remove`
- Any running InDesign instance is killed before font installation

**Windows:**
- InDesign.exe is called directly
- Font installation path differs (implementation may vary)
- AppleScript-specific code paths are skipped

### Performance Considerations

- Backend has 8GB memory allocation (`--max-old-space-size=8192`)
- 30-minute request timeout for large files
- 5-minute timeout per InDesign conversion process
- OpenAI comparison: Each non-identical PDF pair = 1 API call
- Font downloads are permanent to avoid re-downloading

### Common Issues

**"Adobe InDesign Not Found"**
- Run `npm run find:indesign` to locate installation
- Set `INDESIGN_APP_PATH` in Backend/.env if auto-detection fails

**Font Errors**
- Check "Document fonts" folder exists in ZIP
- Verify fonts are valid formats: TTF, OTF, TTC, DFONT, SUIT
- Font downloader only supports mapped Google Fonts (see [fontDownloader.js](Backend/services/fontDownloader.js))

**Preflight Failures**
- Missing/corrupt links/images are critical and block export
- Missing fonts are non-critical (will be substituted)
- Check InDesign preflight panel for detailed errors

**OpenAI Comparison Issues**
- Verify `OPENAI_API_KEY` is set in Backend/.env
- Check `/api/compare-pdfs/status` endpoint
- Max 10 PDFs, 50MB each, 5-minute timeout
