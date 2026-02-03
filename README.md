# InDesign to PDF Converter

A full-stack web application that converts Adobe InDesign packages (packaged as .zip files) to PDF using desktop Adobe InDesign automation.

## Features

- **Simple Upload Interface**: Drag-and-drop or click to upload InDesign package zip files
- **Real-time Progress**: Visual feedback during upload and processing
- **Automatic Download**: Generated PDF automatically downloads to your browser
- **Error Handling**: Clear error messages for common issues
- **Automatic Cleanup**: Temporary files are automatically cleaned up after processing

## Architecture

### Frontend
- **React** with **Vite** for fast development
- **Axios** for API communication
- Drag-and-drop file upload
- Progress tracking
- Responsive design

### Backend
- **Node.js** with **Express**
- **Multer** for file upload handling
- **AdmZip** for zip extraction
- **ExtendScript** automation for InDesign Desktop
- Automatic file cleanup

## Prerequisites

Before running this application, you need:

1. **Node.js** (v18 or later)
2. **npm** (comes with Node.js)
3. **Adobe InDesign Desktop** installed and licensed
   - See [Backend/README.md](Backend/README.md) for setup instructions
   - For macOS Server setup: [Backend/MACOS-SERVER-SETUP.md](Backend/MACOS-SERVER-SETUP.md)

## Project Structure

```
Repo/
├── Backend/
│   ├── config/
│   │   └── config.js          # Configuration loader
│   ├── routes/
│   │   └── upload.js          # Upload endpoint handler
│   ├── services/
│   │   ├── zipHandler.js      # Zip extraction logic
│   │   └── indesignService.js # InDesign Server integration
│   ├── utils/
│   │   └── fileCleanup.js     # File cleanup utilities
│   ├── temp/                  # Temporary file storage (auto-created)
│   ├── server.js              # Main Express server
│   ├── .env                   # Environment variables
│   ├── package.json
│   └── INDESIGN_SETUP.md      # InDesign Server setup guide
│
└── Frontend/
    ├── src/
    │   ├── api/
    │   │   └── uploadService.js # API communication
    │   ├── components/
    │   │   ├── FileUpload.jsx   # Main upload component
    │   │   └── FileUpload.css   # Component styles
    │   ├── App.jsx              # Root component
    │   ├── main.jsx             # Entry point
    │   └── index.css            # Global styles
    ├── .env                     # Environment variables
    └── package.json
```

## Installation

### 1. Install Adobe InDesign Desktop

Download and install Adobe InDesign on your server/machine:
- Via Adobe Creative Cloud Desktop App
- Or direct download with your license

After installation, verify it's installed:
```bash
cd Backend
npm run find:indesign  # This will locate your InDesign installation
```

### 2. Install Backend Dependencies

```bash
cd Backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd Frontend
npm install
```

## Configuration

### Backend Configuration

Edit `Backend/.env` if needed:

```env
PORT=5000

# Optional: Path to InDesign executable (auto-detected if not set)
# INDESIGN_APP_PATH=/Applications/Adobe InDesign 2024/Adobe InDesign 2024.app/Contents/MacOS/Adobe InDesign 2024

TEMP_UPLOAD_PATH=./temp/uploads
TEMP_EXTRACT_PATH=./temp/extracted
MAX_FILE_SIZE_MB=100
```

### Frontend Configuration

Edit `Frontend/.env` if needed:

```env
VITE_API_URL=http://localhost:5000
```

## Running the Application

### Option 1: Run Both Servers Separately

**Terminal 1 - Start Backend:**
```bash
cd Backend
npm run dev
```

**Terminal 2 - Start Frontend:**
```bash
cd Frontend
npm run dev
```

### Option 2: Run Backend Only (for API testing)

```bash
cd Backend
npm start
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Usage

1. **Ensure InDesign is installed** (run `npm run test:indesign` in Backend folder to verify)
2. **Start the Backend** server
3. **Start the Frontend** development server
4. **Open your browser** to http://localhost:5173
5. **Upload a zip file** containing your InDesign package:
   - Click the upload area or drag and drop a .zip file
   - The file should contain an .indd or .idml file along with any linked assets
6. **Click "Convert to PDF"**
7. **Wait for processing** - InDesign will launch briefly to convert the file
8. **PDF downloads automatically** when ready

## API Endpoints

### POST /api/upload

Uploads and converts an InDesign package to PDF.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the .zip file

**Response:**
- Success: PDF file download (application/pdf)
- Error: JSON with error message

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@/path/to/indesign-package.zip" \
  --output result.pdf
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## File Requirements

### Zip File Contents

Your zip file should contain:
- One `.indd` or `.idml` file (the InDesign document)
- All linked assets (images, fonts, etc.) if they are not embedded
- Proper folder structure if using an InDesign Package

### Example Package Structure

```
my-document.zip
├── my-document.indd
├── Links/
│   ├── image1.jpg
│   ├── image2.png
│   └── logo.svg
└── Fonts/
    └── CustomFont.otf
```

## Error Handling

The application handles various error scenarios:

- **No file uploaded**: "No file uploaded"
- **Invalid file type**: "Only .zip files are allowed"
- **File too large**: "File too large" (max 100MB by default)
- **Invalid zip**: "Invalid or corrupt zip file"
- **No InDesign file**: "No InDesign file (.indd or .idml) found in the zip"
- **InDesign Server unavailable**: "Cannot connect to InDesign Server"
- **Processing errors**: Detailed error messages from InDesign Server

## Troubleshooting

### Backend won't start

1. Check if port 5000 is already in use:
   ```bash
   # macOS/Linux
   lsof -i :5000

   # Windows
   netstat -ano | findstr :5000
   ```

2. Ensure all dependencies are installed:
   ```bash
   cd Backend && npm install
   ```

### Frontend won't start

1. Check if port 5173 is already in use
2. Clear node_modules and reinstall:
   ```bash
   cd Frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

### Adobe InDesign Not Found

1. Verify InDesign is installed:
   ```bash
   cd Backend
   npm run find:indesign
   ```

2. Check the `INDESIGN_APP_PATH` in `Backend/.env` if you have a custom installation

3. Review [Backend/README.md](Backend/README.md) or [Backend/MACOS-SERVER-SETUP.md](Backend/MACOS-SERVER-SETUP.md) for setup instructions

### PDF not generating

1. Check backend console logs for InDesign errors
2. Verify the InDesign file can be opened in InDesign Desktop manually
3. Ensure all fonts are installed on your machine/server
4. Check that linked images are included in the zip
5. On servers: Ensure a user session with display access is active (see MACOS-SERVER-SETUP.md)

### Upload fails immediately

1. Check file size (default max: 100MB)
2. Verify the file is a valid .zip file
3. Check backend console for error messages

## Development

### Backend Development

The backend uses Node's built-in watch mode for hot-reloading:

```bash
cd Backend
npm run dev
```

### Frontend Development

Vite provides hot module replacement (HMR):

```bash
cd Frontend
npm run dev
```

### Building for Production

**Frontend:**
```bash
cd Frontend
npm run build
```

The production build will be in `Frontend/dist/`.

**Backend:**
The backend doesn't require building. For production:
```bash
cd Backend
npm start
```

## Security Considerations

- The application does not include authentication by default
- Consider adding authentication for production use
- Validate and sanitize all file uploads
- Limit file sizes appropriately for your use case
- Run InDesign Server in a sandboxed environment
- Keep temporary directories clean (automatic cleanup is implemented)

## Performance Tips

1. **Increase memory** for large InDesign files
2. **Use SSD storage** for temp directories
3. **Process files sequentially** to avoid resource exhaustion
4. **Set up periodic cleanup** for orphaned temporary files (automatic)
5. **Monitor InDesign Server** resource usage

## License

This is a custom application. Ensure you have proper licensing for:
- Adobe InDesign Desktop (verify license terms permit server automation)
- Any fonts used in your documents
- Any other commercial software or assets

## Support

- **InDesign Setup**: See [Backend/README.md](Backend/README.md)
- **Server Deployment**: See [Backend/MACOS-SERVER-SETUP.md](Backend/MACOS-SERVER-SETUP.md)
- **Backend Issues**: Check backend console logs and run `npm run health`
- **Frontend Issues**: Check browser console
- **API Issues**: Test endpoints with curl or Postman

## Future Enhancements

Potential improvements for the future:
- User authentication
- Multiple file uploads
- PDF preview before download
- Upload history
- Custom PDF export settings
- Email delivery option
- Job queue for processing multiple files
- Progress updates during PDF generation
- Support for other output formats
