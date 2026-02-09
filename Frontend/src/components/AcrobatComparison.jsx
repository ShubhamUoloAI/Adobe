import { useState } from 'react';
import { compareWithAcrobat, downloadPDF, formatAcrobatError } from '../api/acrobatComparisonService';
import './AcrobatComparison.css';

export default function AcrobatComparison() {
  const [files, setFiles] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFilesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    // Filter only PDF files
    const pdfFiles = selectedFiles.filter(file =>
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length !== selectedFiles.length) {
      setError('Only PDF files are allowed');
      return;
    }

    if (pdfFiles.length > 2) {
      setError('Please select exactly 2 PDF files');
      setFiles(pdfFiles.slice(0, 2));
    } else {
      setFiles(pdfFiles);
      setError(null);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setError(null);
  };

  const handleCompare = async () => {
    if (files.length !== 2) {
      setError('Please upload exactly 2 PDF files to compare');
      return;
    }

    setIsComparing(true);
    setError(null);
    setUploadProgress(0);
    setSuccess(false);

    try {
      const pdfBlob = await compareWithAcrobat(files[0], files[1], (progress) => {
        setUploadProgress(progress);
      });

      // Auto-download the comparison PDF
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `acrobat-comparison-${timestamp}.pdf`;
      downloadPDF(pdfBlob, filename);

      setSuccess(true);
      console.log('Comparison completed and downloaded');
    } catch (err) {
      console.error('Comparison error:', err);
      setError(formatAcrobatError(err));
    } finally {
      setIsComparing(false);
      setUploadProgress(0);
    }
  };

  const handleNewComparison = () => {
    setFiles([]);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="acrobat-comparison-container">
      <div className="comparison-header">
        <h1>Acrobat PDF Comparison</h1>
        <p className="subtitle">
          Upload exactly 2 PDF files to compare using Adobe Acrobat DC
        </p>
      </div>

      <div className="upload-section">
        <div className="file-upload-area">
          <input
            type="file"
            id="pdf-upload"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFilesChange}
            disabled={isComparing}
            style={{ display: 'none' }}
          />
          <label htmlFor="pdf-upload" className="upload-label">
            <svg className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="upload-text">
              {files.length === 0
                ? 'Click to select 2 PDF files'
                : `${files.length} of 2 files selected`}
            </span>
            <span className="upload-hint">Maximum 50MB per file</span>
          </label>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            <h3>Selected Files ({files.length}/2)</h3>
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <svg className="file-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                </div>
                {!isComparing && (
                  <button
                    className="remove-button"
                    onClick={() => handleRemoveFile(index)}
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="error-message">
            <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <svg className="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Comparison completed! The PDF report has been downloaded.
          </div>
        )}

        {isComparing && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                {uploadProgress > 5 && <span className="progress-text">{uploadProgress}%</span>}
              </div>
            </div>
            <p className="progress-message">
              {uploadProgress < 100
                ? 'Uploading files...'
                : 'Comparing PDFs with Adobe Acrobat... This may take a moment.'}
            </p>
          </div>
        )}

        <div className="button-group">
          <button
            className="btn-compare"
            onClick={handleCompare}
            disabled={files.length !== 2 || isComparing}
          >
            {isComparing ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24">
                  <circle
                    className="spinner-circle"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                </svg>
                Comparing...
              </>
            ) : (
              <>
                Compare with Acrobat
                {files.length === 2 && ' ✓'}
              </>
            )}
          </button>

          {(files.length > 0 || success) && !isComparing && (
            <button className="btn-reset" onClick={handleNewComparison}>
              New Comparison
            </button>
          )}
        </div>

        <div className="info-box">
          <h4>How it works:</h4>
          <ol>
            <li>Select exactly 2 PDF files to compare</li>
            <li>Click "Compare with Acrobat" to start the comparison</li>
            <li>Adobe Acrobat DC will analyze both files with all available features</li>
            <li>A detailed comparison report PDF will be automatically downloaded</li>
          </ol>
          <p className="note">
            <strong>Note:</strong> Adobe Acrobat DC must be installed on the server for this feature to work.
          </p>
        </div>
      </div>
    </div>
  );
}
