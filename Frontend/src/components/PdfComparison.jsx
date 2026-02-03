import { useState } from 'react';
import PdfFileUploader from './PdfFileUploader';
import ComparisonResults from './ComparisonResults';
import { comparePDFs, formatComparisonError } from '../api/comparisonService';
import './PdfComparison.css';

export default function PdfComparison() {
  const [files, setFiles] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFilesChange = (newFiles) => {
    setFiles(newFiles);
    setError(null);
  };

  const handleCompare = async () => {
    if (files.length < 2) {
      setError('Please upload at least 2 PDF files to compare');
      return;
    }

    setIsComparing(true);
    setError(null);
    setUploadProgress(0);
    setResults(null);

    try {
      const response = await comparePDFs(files, (progress) => {
        setUploadProgress(progress);
      });

      setResults(response.results);
      console.log('Comparison results:', response);
    } catch (err) {
      console.error('Comparison error:', err);
      setError(formatComparisonError(err));
    } finally {
      setIsComparing(false);
      setUploadProgress(0);
    }
  };

  const handleNewComparison = () => {
    setFiles([]);
    setResults(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="pdf-comparison-container">
      <div className="comparison-header">
        <h1>PDF Comparison Tool</h1>
        <p className="subtitle">
          Upload multiple PDF files to compare their content and identify differences
        </p>
      </div>

      {!results ? (
        <div className="upload-section">
          <PdfFileUploader onFilesChange={handleFilesChange} maxFiles={10} />

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
                  : 'Processing and comparing PDFs using AI... This may take a minute.'}
              </p>
            </div>
          )}

          <button
            className="btn-compare"
            onClick={handleCompare}
            disabled={files.length < 2 || isComparing}
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
                Compare PDFs
                {files.length >= 2 && ` (${files.length} files)`}
              </>
            )}
          </button>
        </div>
      ) : (
        <ComparisonResults results={results} onNewComparison={handleNewComparison} />
      )}
    </div>
  );
}
