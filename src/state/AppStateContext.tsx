import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { loadState, saveState, getEmptyState } from "../storage";
import { AppState } from "../types";

interface AppStateContextValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  isLoading: boolean;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getEmptyState());
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state from IndexedDB
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const loadedState = await loadState();
        setState(loadedState);
      } catch (error) {
        console.error("Failed to load initial state:", error);
        setState(getEmptyState());
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialState();
  }, []);

  // Save state changes to IndexedDB
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    const saveStateAsync = async () => {
      try {
        await saveState(state);
      } catch (error) {
        console.error("Failed to save state:", error);
      }
    };

    saveStateAsync();
  }, [state, isLoading]);

  return (
    <AppStateContext.Provider value={{ state, setState, isLoading }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
