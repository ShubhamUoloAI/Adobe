import axios from 'axios';

// Use relative URL - Vite proxy will forward to backend
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Cleans up AppleScript/InDesign error prefixes from error messages
 * @param {string} message - The error message to clean
 * @returns {string} - The cleaned error message
 */
function cleanErrorMessage(message) {
  if (!message) return message;

  return message
    // Remove temp file path and line numbers (e.g., "/var/folders/.../script.scpt:165:205:")
    .replace(/^.*\.scpt:\d+:\d+:\s*/gm, '')
    // Remove "execution error: Adobe InDesign XXXX got an error:"
    .replace(/execution error:\s*Adobe InDesign \d+\s+got an error:\s*/gi, '')
    // Remove "Uncaught JavaScript exception:"
    .replace(/Uncaught JavaScript exception:\s*/gi, '')
    // Remove error codes at the end like "(54)" or "(-1234)"
    .replace(/\s*\([-0-9]+\)\s*$/gm, '')
    // Clean up extra whitespace and newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Uploads a zip file and downloads the generated PDF
 * @param {File} file - The zip file to upload
 * @param {Function} onUploadProgress - Progress callback
 * @returns {Promise<Blob>} - The PDF blob
 */
export async function uploadAndConvertToPDF(file, onUploadProgress) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_URL}/api/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
      timeout: 30 * 60 * 1000, // 30 minutes timeout for large files (up to 3GB)
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(percentCompleted);
        }
      },
    });

    return response.data;
  } catch (error) {
    // Handle error response
    if (error.response) {
      // Server responded with error
      if (error.response.data instanceof Blob) {
        // Parse blob error message
        const text = await error.response.data.text();
        const errorData = JSON.parse(text);
        const errorMessage = errorData.message || errorData.error || 'Server error';
        throw new Error(cleanErrorMessage(errorMessage));
      } else {
        const errorMessage = error.response.data.message || error.response.data.error || 'Server error';
        throw new Error(cleanErrorMessage(errorMessage));
      }
    } else if (error.request) {
      // Request made but no response
      throw new Error('Cannot connect to server. Please ensure the backend is running.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An error occurred');
    }
  }
}

/**
 * Triggers a file download in the browser
 * @param {Blob} blob - The file blob
 * @param {string} filename - The filename to save as
 */
export function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
