import { AppStateProvider } from "./state/AppStateContext";
import DashboardPage from "./pages/DashboardPage";
import "./App.css";

function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">Resume Tracker</div>
        <nav>
          <div className="nav-item active">
            Dashboard
          </div>
        </nav>
      </aside>
      <main className="main">
        <DashboardPage />
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
