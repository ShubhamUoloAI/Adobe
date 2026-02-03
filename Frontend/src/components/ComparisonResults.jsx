import { useState } from 'react';
import './PdfComparison.css';

export default function ComparisonResults({ results, onNewComparison }) {
  const [expandedComparisons, setExpandedComparisons] = useState(new Set());

  const toggleComparison = (index) => {
    const newExpanded = new Set(expandedComparisons);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedComparisons(newExpanded);
  };

  const getSimilarityColor = (similarity) => {
    if (similarity === 100) return '#10b981'; // green
    if (similarity >= 90) return '#3b82f6'; // blue
    if (similarity >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getSimilarityLabel = (similarity) => {
    if (similarity === 100) return 'Identical';
    if (similarity >= 90) return 'Very Similar';
    if (similarity >= 70) return 'Similar';
    return 'Different';
  };

  const hasDifferences = (differences) => {
    return (
      differences.additions?.length > 0 ||
      differences.deletions?.length > 0 ||
      differences.modifications?.length > 0
    );
  };

  return (
    <div className="comparison-results">
      {/* Overall Summary */}
      <div className="summary-card">
        <div className="summary-header">
          <h2>Comparison Complete</h2>
          {results.allIdentical && (
            <span className="badge badge-success">All Identical</span>
          )}
        </div>
        <p className="summary-text">{results.summary}</p>
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Files Compared</span>
            <span className="stat-value">{results.totalFiles}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Comparisons</span>
            <span className="stat-value">{results.pairwiseComparisons?.length || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Processing Time</span>
            <span className="stat-value">{results.processingTime}</span>
          </div>
        </div>
      </div>

      {/* Identical Groups */}
      {results.identicalGroups && results.identicalGroups.length > 0 && (
        <div className="identical-groups">
          <h3>Identical Document Groups</h3>
          {results.identicalGroups.map((group, index) => (
            <div key={index} className="group-card">
              <div className="group-header">
                <span className="group-badge">Group {index + 1}</span>
                <span className="group-count">{group.length} files</span>
              </div>
              <ul className="group-files">
                {group.map((filename, i) => (
                  <li key={i}>{filename}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Pairwise Comparisons */}
      {results.pairwiseComparisons && results.pairwiseComparisons.length > 0 && (
        <div className="pairwise-comparisons">
          <h3>Detailed Comparisons</h3>
          {results.pairwiseComparisons.map((comparison, index) => (
            <div key={index} className="comparison-card">
              <div
                className="comparison-header"
                onClick={() => toggleComparison(index)}
                style={{ cursor: hasDifferences(comparison.differences) ? 'pointer' : 'default' }}
              >
                <div className="comparison-files">
                  <span className="file-badge">{comparison.file1}</span>
                  <svg className="arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="file-badge">{comparison.file2}</span>
                </div>
                <div className="comparison-score">
                  <div
                    className="similarity-badge"
                    style={{ backgroundColor: getSimilarityColor(comparison.similarity) }}
                  >
                    {comparison.similarity}% {getSimilarityLabel(comparison.similarity)}
                  </div>
                  {hasDifferences(comparison.differences) && (
                    <svg
                      className={`expand-icon ${expandedComparisons.has(index) ? 'expanded' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>

              <p className="comparison-summary">{comparison.summary}</p>

              {expandedComparisons.has(index) && hasDifferences(comparison.differences) && (
                <div className="differences-section">
                  {comparison.differences.additions?.length > 0 && (
                    <div className="diff-group">
                      <h4 className="diff-title addition">Additions in {comparison.file2}</h4>
                      <ul className="diff-list">
                        {comparison.differences.additions.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {comparison.differences.deletions?.length > 0 && (
                    <div className="diff-group">
                      <h4 className="diff-title deletion">Deletions from {comparison.file1}</h4>
                      <ul className="diff-list">
                        {comparison.differences.deletions.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {comparison.differences.modifications?.length > 0 && (
                    <div className="diff-group">
                      <h4 className="diff-title modification">Modifications</h4>
                      <ul className="diff-list">
                        {comparison.differences.modifications.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="results-actions">
        <button className="btn-primary" onClick={onNewComparison}>
          Start New Comparison
        </button>
      </div>
    </div>
  );
}
