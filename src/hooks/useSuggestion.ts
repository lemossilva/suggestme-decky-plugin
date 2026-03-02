import { useState, useCallback } from "react";
import { call } from "@decky/api";
import { SuggestionResult, SuggestMode, SuggestFilters, HistoryEntry, DEFAULT_FILTERS } from "../types";

declare const SteamClient: {
  InstallFolder: {
    GetInstallFolders: () => Promise<any[]>;
  };
  Apps: {
    GetAllShortcuts: () => Promise<any[]>;
  };
};

declare const appStore: {
  allApps: Array<{ appid: number }>;
  GetAppOverviewByAppID: (appid: number) => { local_per_client_data?: { installed?: boolean } } | null;
};

function getInstalledAppIds(): number[] {
  try {
    if (typeof appStore !== 'undefined' && appStore.allApps) {
      const installed: number[] = [];
      for (const app of appStore.allApps) {
        const overview = appStore.GetAppOverviewByAppID(app.appid);
        if (overview?.local_per_client_data?.installed) {
          installed.push(app.appid);
        }
      }
      return installed;
    }
  } catch (e) {
    console.warn("[SuggestMe] Failed to get installed apps:", e);
  }
  return [];
}

function getCollectionAppIds(collectionNames: string[]): number[] {
  if (!collectionNames || collectionNames.length === 0) return [];
  const appids: number[] = [];
  try {
    const store = (window as any).collectionStore;
    if (store?.userCollections) {
      for (const col of store.userCollections) {
        const name = col?.displayName || col?.strName;
        if (name && collectionNames.includes(name) && col.allApps) {
          for (const app of col.allApps) {
            if (app.appid || app.nAppID) {
              appids.push(app.appid || app.nAppID);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[SuggestMe] Failed to get collection appids:", e);
  }
  return [...new Set(appids)];
}

export function useSuggestion() {
  const [currentSuggestion, setCurrentSuggestion] = useState<SuggestionResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const requestSuggestion = useCallback(
    async (mode: SuggestMode, filters: SuggestFilters = DEFAULT_FILTERS): Promise<SuggestionResult | null> => {
      try {
        let installedAppIds: number[] = [];
        if (filters.installed_only || filters.not_installed_only) {
          installedAppIds = getInstalledAppIds();
        }

        // Resolve collection names to appids here in the frontend to avoid VDF parsing issues in the backend
        const enhancedFilters = { ...filters };
        if (filters.include_collections?.length) {
          enhancedFilters.include_collection_appids = getCollectionAppIds(filters.include_collections);
        }
        if (filters.exclude_collections?.length) {
          enhancedFilters.exclude_collection_appids = getCollectionAppIds(filters.exclude_collections);
        }

        const result = await call<[string, any, number[]], SuggestionResult>(
          "get_suggestion",
          mode,
          enhancedFilters,
          installedAppIds
        );
        setCurrentSuggestion(result);
        return result;
      } catch (error) {
        console.error("[SuggestMe] Failed to get suggestion:", error);
        const errorResult: SuggestionResult = {
          game: null,
          candidates_count: 0,
          mode_used: mode,
          error: "Failed to get suggestion",
        };
        setCurrentSuggestion(errorResult);
        return errorResult;
      }
    },
    []
  );

  const loadHistory = useCallback(async (limit: number = 20) => {
    try {
      const result = await call<[number], HistoryEntry[]>("get_history", limit);
      setHistory(result);
    } catch (error) {
      console.error("[SuggestMe] Failed to load history:", error);
    }
  }, []);

  const clearHistory = useCallback(async (): Promise<boolean> => {
    try {
      const result = await call<[], { success: boolean }>("clear_history");
      if (result.success) {
        setHistory([]);
      }
      return result.success;
    } catch (error) {
      console.error("[SuggestMe] Failed to clear history:", error);
      return false;
    }
  }, []);

  const clearCurrentSuggestion = useCallback(() => {
    setCurrentSuggestion(null);
  }, []);

  return {
    currentSuggestion,
    history,
    requestSuggestion,
    loadHistory,
    clearHistory,
    clearCurrentSuggestion,
  };
}
