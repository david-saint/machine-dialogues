import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { BiasAnalysisPage } from './components/analysis/BiasAnalysisPage';
import { LandingPage } from './components/landing/LandingPage';
import { TranscriptViewer } from './components/viewer/TranscriptViewer';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { Toast } from './components/shared/Toast';
import './styles/global.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/analysis" element={<BiasAnalysisPage />} />
            <Route path="/transcript/:id" element={<TranscriptViewer />} />
          </Routes>
          <Toast />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
