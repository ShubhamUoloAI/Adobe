import { useState } from 'react'
import FileUpload from './components/FileUpload'
import PdfComparison from './components/PdfComparison'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('converter')

  return (
    <div className="app">
      <nav className="app-nav">
        <button
          className={`nav-tab ${activeTab === 'converter' ? 'active' : ''}`}
          onClick={() => setActiveTab('converter')}
        >
          InDesign to PDF
        </button>
        <button
          className={`nav-tab ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          PDF Comparison
        </button>
      </nav>

      <div className="app-content">
        {activeTab === 'converter' ? <FileUpload /> : <PdfComparison />}
      </div>
    </div>
  )
}

export default App
