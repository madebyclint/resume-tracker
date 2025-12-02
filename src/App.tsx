import { useState } from "react";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import DashboardPage from "./pages/DashboardPage";
import JobDescriptionsPage from "./pages/JobDescriptionsPage";
import "./App.css";

type Page = 'dashboard' | 'jobs';

function AppShell() {
  const [currentPage, setCurrentPage] = useState<Page>('jobs');
  const { state } = useAppState();

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'jobs':
        return <JobDescriptionsPage />;
      case 'dashboard':
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">Resume Tracker</div>
        <nav>
          <div
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            📊 Dashboard
          </div>
          <div
            className={`nav-item ${currentPage === 'jobs' ? 'active' : ''}`}
            onClick={() => setCurrentPage('jobs')}
            style={{ cursor: 'pointer' }}
          >
            📝 Job Descriptions
          </div>
        </nav>
      </aside>
      <main className="main">
        {renderCurrentPage()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}
