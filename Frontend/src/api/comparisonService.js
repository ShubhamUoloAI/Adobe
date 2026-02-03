import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Compare multiple PDF files
 * @param {FileList|Array} files - Array of PDF files to compare
 * @param {Function} onUploadProgress - Progress callback function
 * @returns {Promise} - API response with comparison results
 */
export const comparePDFs = async (files, onUploadProgress) => {
  try {
    const formData = new FormData();

    // Append all PDF files
    Array.from(files).forEach((file) => {
      formData.append('pdfs', file);
    });

    const response = await axios.post(`${API_URL}/api/compare-pdfs`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes timeout
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
      const errorData = error.response.data;
      throw new Error(errorData.message || errorData.error || 'PDF comparison failed');
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
 * Check PDF comparison service status
 * @returns {Promise} - Service status
 */
export const checkComparisonStatus = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/compare-pdfs/status`);
    return response.data;
  } catch (error) {
    console.error('Error checking comparison status:', error);
    throw error;
  }
};

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @returns {string} - Formatted error message
 */
export const formatComparisonError = (error) => {
  if (error.message.includes('OpenAI API key')) {
    return 'OpenAI API is not configured. Please contact the administrator.';
  }
  if (error.message.includes('quota')) {
    return 'API quota exceeded. Please try again later.';
  }
  if (error.message.includes('At least 2 PDF files')) {
    return 'Please upload at least 2 PDF files for comparison.';
  }
  if (error.message.includes('Maximum')) {
    return error.message;
  }
  return error.message || 'An error occurred during PDF comparison';
};
