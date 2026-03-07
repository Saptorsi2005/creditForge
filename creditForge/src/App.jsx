import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import NewApplication from './pages/NewApplication';
import CompanyAnalysis from './pages/CompanyAnalysis';
import AIResearch from './pages/AIResearch';
import RiskScoring from './pages/RiskScoring';
import CAMReport from './pages/CAMReport';
import RecommendationEngine from './pages/RecommendationEngine';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="new-application"
              element={
                <ProtectedRoute requiredPermission="create">
                  <NewApplication />
                </ProtectedRoute>
              }
            />

            {/* Per-application analysis routes — :id comes from the application UUID */}
            <Route path="applications/:id/company-analysis" element={<CompanyAnalysis />} />
            <Route path="applications/:id/ai-research" element={<AIResearch />} />
            <Route path="applications/:id/risk-scoring" element={<RiskScoring />} />
            <Route path="applications/:id/recommendation-engine" element={<RecommendationEngine />} />
            <Route path="applications/:id/cam-report" element={<CAMReport />} />

            {/* Legacy flat routes redirect to dashboard */}
            <Route path="company-analysis" element={<Navigate to="/dashboard" replace />} />
            <Route path="ai-research" element={<Navigate to="/dashboard" replace />} />
            <Route path="risk-scoring" element={<Navigate to="/dashboard" replace />} />
            <Route path="cam-report" element={<Navigate to="/dashboard" replace />} />

            <Route
              path="settings"
              element={
                <ProtectedRoute requiredPermission="settings">
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
