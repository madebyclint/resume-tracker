import { useState } from "react";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import DashboardPage from "./pages/DashboardPage";
import ChunkLibraryPage from "./pages/ChunkLibraryPage";
import "./App.css";

type Page = 'dashboard' | 'chunks';

function AppShell() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { state } = useAppState();

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'chunks':
        return <ChunkLibraryPage resumes={state.resumes} />;
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
            className={`nav-item ${currentPage === 'chunks' ? 'active' : ''}`}
            onClick={() => setCurrentPage('chunks')}
            style={{ cursor: 'pointer' }}
          >
            🧩 Chunk Library
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
