# Complete Testing Guide - InDesign to PDF Converter

## ✅ Setup Complete!

Your InDesign to PDF converter is fully configured and ready to test!

### What's Been Configured

- ✅ Adobe InDesign 2026 installed and verified
- ✅ Backend dependencies installed
- ✅ InDesign path configured in `.env`
- ✅ All health checks passed
- ✅ Server verified working

---

## Testing Checklist

### Phase 1: Backend API Testing

#### Test 1: Start the Backend Server

```bash
cd Backend
npm start
```

**Expected Output:**
```
✓ Adobe InDesign is available
✓ Server running on http://localhost:5000
✓ Upload endpoint: http://localhost:5000/api/upload
✓ Health check: http://localhost:5000/health
```

**✅ Pass Criteria:** Server starts without errors and shows InDesign is available

#### Test 2: Health Check Endpoint

Open a new terminal and run:
```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

**✅ Pass Criteria:** Returns 200 status with success message

#### Test 3: API Upload Endpoint (with sample zip)

**Create a test InDesign package:**

1. Create a simple InDesign document (or use an existing one)
2. In InDesign: **File → Package...** to create a package
3. Zip the package folder

**Test the upload:**
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@/path/to/your/test-package.zip" \
  --output test-output.pdf
```

**Expected Behavior:**
- InDesign will launch briefly
- PDF conversion happens
- File downloads as `test-output.pdf`

**✅ Pass Criteria:** PDF file is created and can be opened

---

### Phase 2: Frontend Testing

#### Test 4: Start the Frontend

Open a new terminal:
```bash
cd Frontend
npm run dev
```

**Expected Output:**
```
VITE v... ready in ... ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**✅ Pass Criteria:** Frontend dev server starts on port 5173

#### Test 5: Upload via Web Interface

1. **Open Browser:** Navigate to `http://localhost:5173`
2. **Upload File:** Drag & drop or click to upload a `.zip` file
3. **Click "Convert to PDF"**
4. **Wait:** Watch the progress bar
5. **Download:** PDF should auto-download when ready

**Expected Behavior:**
- Upload progress shows
- InDesign launches briefly in background
- PDF downloads automatically

**✅ Pass Criteria:** PDF downloads and opens correctly

---

### Phase 3: Error Handling Tests

#### Test 6: Invalid File Type

Try uploading a non-zip file (e.g., `.txt` file)

**Expected:** Error message: "Only .zip files are allowed"

**✅ Pass Criteria:** Graceful error handling

#### Test 7: Missing InDesign File

Create a zip without `.indd` or `.idml` file inside

**Expected:** Error message: "No InDesign file (.indd or .idml) found in the zip"

**✅ Pass Criteria:** Clear error message

#### Test 8: Large File

Try uploading a file larger than 100MB

**Expected:** Error message: "File too large"

**✅ Pass Criteria:** File size limit enforced

---

### Phase 4: Performance Testing

#### Test 9: Conversion Speed

Time how long conversion takes:

```bash
time curl -X POST http://localhost:5000/api/upload \
  -F "file=@/path/to/test-package.zip" \
  --output test.pdf
```

**Expected Time:**
- Small files (< 10MB): 10-20 seconds
- Medium files (10-50MB): 20-40 seconds
- Large files (50-100MB): 40-90 seconds

**Note:** First conversion is slower (InDesign cold start)

**✅ Pass Criteria:** Reasonable completion time

#### Test 10: Sequential Requests

Test multiple conversions in sequence:

```bash
for i in {1..3}; do
  curl -X POST http://localhost:5000/api/upload \
    -F "file=@/path/to/test-package.zip" \
    --output test-$i.pdf
  echo "Conversion $i complete"
done
```

**Expected:** All conversions complete successfully

**✅ Pass Criteria:** No errors, all PDFs created

---

### Phase 5: System Integration

#### Test 11: Verify Temp Cleanup

```bash
# Check temp directories before
ls Backend/temp/uploads/
ls Backend/temp/extracted/

# Upload a file via API

# Wait 1 minute, check again
ls Backend/temp/uploads/
ls Backend/temp/extracted/
```

**Expected:** Files are cleaned up after processing

**✅ Pass Criteria:** Temp directories are empty after conversion

#### Test 12: Log Monitoring

Start backend and watch logs:
```bash
npm start
```

Upload a file and observe:
- File upload logged
- InDesign execution logged
- PDF generation logged
- Cleanup logged

**✅ Pass Criteria:** Clear log trail of operations

---

## Troubleshooting Common Issues

### Issue 1: "Adobe InDesign not found"

**Solution:**
```bash
npm run find:indesign  # Verify installation
node test-indesign.js   # Test connection
```

### Issue 2: InDesign launches but conversion fails

**Possible causes:**
- Missing fonts (install required fonts)
- Missing linked images (ensure they're in the zip)
- Corrupt InDesign file (test opening manually first)

**Solution:**
```bash
# Check InDesign can open the file manually
open -a "Adobe InDesign 2026" /path/to/file.indd
```

### Issue 3: Server crashes during conversion

**Check:**
- Available memory (InDesign needs 2-4GB)
- Disk space (temp files can be large)
- File permissions

**Solution:**
```bash
npm run health  # Check system resources
```

### Issue 4: Frontend can't connect to backend

**Verify:**
```bash
# Check backend is running
curl http://localhost:5000/health

# Check frontend .env
cat Frontend/.env
# Should show: VITE_API_URL=http://localhost:5000
```

### Issue 5: CORS errors

**Verify** backend has CORS enabled (already configured in server.js)

If custom frontend URL, update CORS in `Backend/server.js`

---

## Sample Test Files

Create these test scenarios:

### Test Case A: Simple Document
- Single page InDesign file
- No linked images
- Standard fonts only
- **Expected:** Fast conversion (< 15 seconds)

### Test Case B: Complex Document
- Multiple pages (10+)
- Linked images
- Custom fonts
- **Expected:** Slower conversion (30-60 seconds)

### Test Case C: Package with Links
- Full InDesign package
- Links folder with images
- Fonts folder
- **Expected:** All assets embedded in PDF

---

## Production Readiness Checklist

Before deploying to production:

- [ ] InDesign license is valid for server use
- [ ] All fonts needed for documents are installed
- [ ] Adequate RAM available (8GB+ recommended)
- [ ] SSD storage for temp directories
- [ ] Monitor setup for automated health checks
- [ ] Error logging configured
- [ ] Backup strategy for failed conversions
- [ ] Rate limiting implemented (if public-facing)
- [ ] Authentication added (if needed)
- [ ] SSL/HTTPS configured (for production)

---

## Performance Optimization Tips

1. **Keep InDesign Warm:** First conversion is slow due to InDesign startup
2. **Sequential Processing:** Process one file at a time (desktop InDesign limitation)
3. **Monitor Memory:** InDesign can use 2-4GB per conversion
4. **Clean Temp Files:** Old files can accumulate (auto-cleanup runs every 6 hours)
5. **Use SSD:** Faster I/O helps with large files

---

## Next Steps After Testing

### If All Tests Pass ✅

Your system is ready! You can:

1. **Deploy to production** (see MACOS-SERVER-SETUP.md for server config)
2. **Add custom features** (authentication, notifications, etc.)
3. **Integrate with other systems** (via REST API)

### If Tests Fail ❌

1. Check the specific test's troubleshooting section
2. Run `npm run health` to diagnose system issues
3. Check backend console logs for errors
4. Verify InDesign can open test files manually

---

## Quick Reference Commands

```bash
# Backend
cd Backend
npm start                   # Start server
npm run dev                 # Start with auto-reload
npm run test:indesign       # Test InDesign connection
npm run health              # Full health check
npm run find:indesign       # Find InDesign path

# Frontend
cd Frontend
npm run dev                 # Start dev server
npm run build               # Build for production
npm run preview             # Preview production build

# Testing
curl http://localhost:5000/health                    # Health check
curl -X POST http://localhost:5000/api/upload \     # Upload test
  -F "file=@test.zip" --output result.pdf
```

---

## Support

- **Backend Issues:** Check console logs and run `npm run health`
- **Frontend Issues:** Check browser console (F12)
- **InDesign Issues:** Test opening files manually in InDesign
- **API Testing:** Use Postman or curl for detailed error messages

---

## Success Indicators

Your system is working correctly if:

- ✅ Backend starts with "Adobe InDesign is available"
- ✅ Health check returns HTTP 200
- ✅ Test upload creates valid PDF
- ✅ Frontend shows upload interface
- ✅ End-to-end conversion works via browser
- ✅ Temp files are cleaned up
- ✅ Multiple conversions work sequentially
- ✅ Error messages are clear and helpful

**Congratulations! Your InDesign to PDF converter is fully operational! 🎉**
