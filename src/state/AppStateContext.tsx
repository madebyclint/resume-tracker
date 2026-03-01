import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
// Try API storage first, fallback to IndexedDB
import { loadState as loadStateApi, storage as apiStorage } from "../storageApi";
import { loadState as loadStateIndexedDB, getEmptyState } from "../storage";
import { AppState, JobDescription } from "../types";

interface AppStateContextValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  isLoading: boolean;
  syncWithStorage: () => Promise<void>;
  storageType: 'api' | 'indexeddb' | 'none';
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  persistJobDescription: (job: JobDescription) => Promise<void>;
  deleteJobFromStorage: (id: string) => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getEmptyState());
  const [isLoading, setIsLoading] = useState(true);
  const [storageType, setStorageType] = useState<'api' | 'indexeddb' | 'none'>('none');
  const [devMode, setDevModeState] = useState<boolean>(() => {
    return localStorage.getItem('devMode') === 'true';
  });

  const setDevMode = (v: boolean) => {
    setDevModeState(v);
    localStorage.setItem('devMode', String(v));
  };

  /** Save a job to the DB — no-op in DEV mode, writes to API in PROD mode */
  const persistJobDescription = useCallback(async (job: JobDescription): Promise<void> => {
    if (devMode) return;
    try {
      await apiStorage.saveJobDescription(job);
    } catch (error) {
      console.error('Failed to persist job to API:', error);
    }
  }, [devMode]);

  /** Delete a job from the DB — no-op in DEV mode, deletes from API in PROD mode */
  const deleteJobFromStorage = useCallback(async (id: string): Promise<void> => {
    if (devMode) return;
    try {
      await apiStorage.deleteJobDescription(id);
    } catch (error) {
      console.error('Failed to delete job from API:', error);
    }
  }, [devMode]);

  // Smart storage loading - try API first, fallback to IndexedDB
  const loadStateWithFallback = useCallback(async (): Promise<AppState> => {
    // Check if API storage is configured
    const apiUrl = import.meta.env.VITE_API_URL;
    
    if (apiUrl) {
      try {
        console.log('Attempting to load state from API...');
        const apiState = await loadStateApi();
        setStorageType('api');
        console.log('Successfully loaded state from API');
        return apiState;
      } catch (error) {
        console.warn('Failed to load from API, trying IndexedDB...', error);
      }
    }

    // Fallback to IndexedDB
    try {
      console.log('Attempting to load state from IndexedDB...');
      const indexedDBState = await loadStateIndexedDB();
      setStorageType('indexeddb');
      console.log('Successfully loaded state from IndexedDB');
      return indexedDBState;
    } catch (error) {
      console.error('Failed to load from IndexedDB:', error);
      setStorageType('none');
      return getEmptyState();
    }
  }, []);

  // Load initial state with fallback logic
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const loadedState = await loadStateWithFallback();
        setState(loadedState);
      } catch (error) {
        console.error("Failed to load initial state:", error);
        setState(getEmptyState());
        setStorageType('none');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialState();
  }, [loadStateWithFallback]);

  const syncWithStorage = useCallback(async () => {
    try {
      const loadedState = await loadStateWithFallback();
      setState(loadedState);
    } catch (error) {
      console.error("Failed to sync with storage:", error);
    }
  }, [loadStateWithFallback]);

  return (
    <AppStateContext.Provider value={{ state, setState, isLoading, syncWithStorage, storageType, devMode, setDevMode, persistJobDescription, deleteJobFromStorage }}>
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
