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

export function useSuggestion() {
  const [currentSuggestion, setCurrentSuggestion] = useState<SuggestionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const requestSuggestion = useCallback(
    async (mode: SuggestMode, filters: SuggestFilters = DEFAULT_FILTERS): Promise<SuggestionResult | null> => {
      setIsLoading(true);
      try {
        let installedAppIds: number[] = [];
        if (filters.installed_only || filters.not_installed_only) {
          installedAppIds = getInstalledAppIds();
        }

        const result = await call<[string, SuggestFilters, number[]], SuggestionResult>(
          "get_suggestion",
          mode,
          filters,
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
      } finally {
        setIsLoading(false);
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
    isLoading,
    history,
    requestSuggestion,
    loadHistory,
    clearHistory,
    clearCurrentSuggestion,
  };
}
