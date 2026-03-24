import { useState, useEffect } from "react";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import DashboardPage from "./pages/DashboardPage";
import JobDescriptionsPage from "./pages/JobDescriptionsPage";
import ResumeFormatterPage from "./pages/ResumeFormatterPage";
import AdminPage from "./pages/AdminPage";
import AccountModal from "./components/AccountModal";
import { DataMigrationTool } from "./components/DataMigrationTool";
import LoginScreen from "./components/LoginScreen";
import { AuthUser, verifyToken, getCurrentUser, logout } from "./utils/authService";
import { analytics } from "./utils/analyticsService";
import "./App.css";

type Page = 'dashboard' | 'jobs' | 'resume-formatter' | 'admin';

function AppShell({ user, onLogout, onUserUpdated }: { user: AuthUser; onLogout: () => void; onUserUpdated: (u: AuthUser) => void }) {
  const [currentPage, setCurrentPage] = useState<Page>('jobs');
  const [showAccount, setShowAccount] = useState(false);
  const [showNotice, setShowNotice] = useState(
    () => !localStorage.getItem('analyticsNoticeDismissed')
  );
  const { devMode, setDevMode } = useAppState();

  // Track page views when the user navigates
  useEffect(() => {
    analytics.track('page_view', currentPage);
  }, [currentPage]);

  // Sync analytics enabled/disabled with dev mode
  useEffect(() => {
    analytics.setEnabled(!devMode);
  }, [devMode]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  const handleDismissNotice = () => {
    localStorage.setItem('analyticsNoticeDismissed', 'true');
    setShowNotice(false);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'jobs':
        return <JobDescriptionsPage />;
      case 'resume-formatter':
        return <ResumeFormatterPage />;
      case 'admin':
        return <AdminPage currentUser={user} />;
      case 'dashboard':
        return <JobDescriptionsPage />;
      default:
        return <JobDescriptionsPage />;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">Resume Tracker</div>
        <nav>
          <div
            className={`nav-item ${currentPage === 'jobs' ? 'active' : ''}`}
            onClick={() => handleNavigate('jobs')}
            style={{ cursor: 'pointer' }}
          >
            🗂️ Job Descriptions
          </div>
          <div
            className={`nav-item ${currentPage === 'resume-formatter' ? 'active' : ''}`}
            onClick={() => handleNavigate('resume-formatter')}
            style={{ cursor: 'pointer' }}
          >
            📄 Resume Formatter
          </div>
          {user.isAdmin && (
            <div
              className={`nav-item ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavigate('admin')}
              style={{ cursor: 'pointer' }}
            >
              ⚙️ Admin
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <button className="sidebar-user-name" onClick={() => setShowAccount(true)} title="Edit profile">{user.name}</button>
            <button className="sidebar-logout-btn" onClick={onLogout}>Sign out</button>
          </div>
          {user.isAdmin && (
            <>
              <label className={`dev-mode-toggle ${devMode ? 'dev-mode-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={devMode}
                  onChange={e => setDevMode(e.target.checked)}
                />
                <span className="dev-mode-label">
                  {devMode ? '🧪 DEV mode' : '🔒 PROD mode'}
                </span>
              </label>
              {devMode && (
                <div className="dev-mode-badge">DB writes disabled</div>
              )}
            </>
          )}
        </div>
      </aside>
      <main className="main">
        {renderCurrentPage()}
      </main>
      {devMode && <DataMigrationTool />}
      {showNotice && (
        <div className="analytics-notice">
          <span>We collect anonymous usage data to improve the app during alpha.</span>
          <button className="analytics-notice-dismiss" onClick={handleDismissNotice}>Got it</button>
        </div>
      )}
      {showAccount && (
        <AccountModal
          user={user}
          onClose={() => setShowAccount(false)}
          onUserUpdated={u => { onUserUpdated(u); setShowAccount(false); }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check for saved session on mount
    verifyToken().then(u => {
      if (u) setUser(u);
      else {
        // Fall back to localStorage cache (avoids flicker on slow networks)
        const cached = getCurrentUser();
        if (cached) setUser(cached);
      }
      setChecking(false);
    });
  }, []);

  const handleLogout = () => {
    analytics.track('session', 'end');
    analytics.flush();
    logout();
    setUser(null);
  };

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={(u) => { setUser(u); analytics.track('session', 'start'); }} />;
  }

  return (
    <AppStateProvider>
      <AppShell user={user} onLogout={handleLogout} onUserUpdated={setUser} />
    </AppStateProvider>
  );
}
