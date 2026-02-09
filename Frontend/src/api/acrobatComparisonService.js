import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Compare exactly 2 PDF files using Adobe Acrobat
 * @param {File} file1 - First PDF file
 * @param {File} file2 - Second PDF file
 * @param {Function} onUploadProgress - Progress callback function
 * @returns {Promise<Blob>} - PDF blob of the comparison report
 */
export const compareWithAcrobat = async (file1, file2, onUploadProgress) => {
  try {
    const formData = new FormData();

    // Append exactly 2 PDF files
    formData.append('pdfs', file1);
    formData.append('pdfs', file2);

    const response = await axios.post(`${API_URL}/api/acrobat-compare`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob', // Important: expect PDF blob response
      timeout: 600000, // 10 minutes timeout for large PDFs
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(percentCompleted);
        }
      },
    });

    return response.data; // Returns PDF blob
  } catch (error) {
    // Handle error response
    if (error.response) {
      // For blob responses with errors, we need to parse the blob
      if (error.response.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Acrobat comparison failed');
        } catch {
          throw new Error('Acrobat comparison failed');
        }
      } else {
        const errorData = error.response.data;
        throw new Error(errorData.message || errorData.error || 'Acrobat comparison failed');
      }
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

/**
 * Check Acrobat comparison service status
 * @returns {Promise} - Service status
 */
export const checkAcrobatStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/acrobat-compare/status`);
    return response.data;
  } catch (error) {
    console.error('Error checking Acrobat status:', error);
    throw error;
  }
};

/**
 * Download blob as PDF file
 * @param {Blob} blob - PDF blob
 * @param {string} filename - Filename for download
 */
export const downloadPDF = (blob, filename = 'comparison-report.pdf') => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @returns {string} - Formatted error message
 */
export const formatAcrobatError = (error) => {
  if (error.message.includes('Acrobat not found') || error.message.includes('not installed')) {
    return 'Adobe Acrobat DC is not installed. Please install Adobe Acrobat DC to use this feature.';
  }
  if (error.message.includes('timeout')) {
    return 'Comparison timed out. The PDFs may be too large or complex. Please try with smaller files.';
  }
  if (error.message.includes('Exactly 2 PDF files')) {
    return 'Please upload exactly 2 PDF files for comparison.';
  }
  if (error.message.includes('File too large')) {
    return error.message;
  }
  return error.message || 'An error occurred during Acrobat PDF comparison';
};
