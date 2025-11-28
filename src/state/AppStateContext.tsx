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
  syncWithStorage: () => Promise<void>;
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

  // Note: Individual resume saves are handled in FileUploadSection
  // We don't auto-save the entire state on every change to avoid clearing IndexedDB

  const syncWithStorage = useCallback(async () => {
    try {
      const loadedState = await loadState();
      setState(loadedState);
    } catch (error) {
      console.error("Failed to sync with storage:", error);
    }
  }, []);

  return (
    <AppStateContext.Provider value={{ state, setState, isLoading, syncWithStorage }}>
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
