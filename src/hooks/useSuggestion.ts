import { useState, useCallback } from "react";
import { call } from "@decky/api";
import { SuggestionResult, SuggestMode, SuggestFilters, HistoryEntry, DEFAULT_FILTERS } from "../types";
import { logger } from "../utils/logger";

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
  GetAppOverviewByAppID: (appid: number) => {
    local_per_client_data?: { installed?: boolean };
    size_on_disk?: number;
    rt_purchased_time?: number;
  } | null;
};

export function getInstalledAppIds(): number[] {
  try {
    const store = (window as any).appStore;
    if (store?.allApps) {
      const installed: number[] = [];
      for (const app of store.allApps) {
        const appid = app.appid || app.nAppID;
        if (!appid) continue;
        const overview = store.GetAppOverviewByAppID(appid);
        if (overview?.local_per_client_data?.installed) {
          installed.push(appid);
        }
      }
      return installed;
    }
  } catch (e) {
    logger.warn("[SuggestMe] Failed to get installed apps:", e);
  }
  return [];
}

export function getCollectionAppIds(collectionNames: string[]): number[] {
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
    logger.warn("[SuggestMe] Failed to get collection appids:", e);
  }
  return [...new Set(appids)];
}

export function getSizeOnDisk(appid: number): number | undefined {
  try {
    const store = (window as any).appStore;
    if (store?.GetAppOverviewByAppID) {
      const overview = store.GetAppOverviewByAppID(appid);
      const sizeStr = overview?.size_on_disk;
      if (sizeStr && typeof sizeStr === 'string') {
        const sizeBytes = parseInt(sizeStr, 10);
        if (sizeBytes > 0) {
          return sizeBytes;
        }
      }
    }
  } catch (e) {
    logger.warn("[SuggestMe] Failed to get size on disk for appid", appid, e);
  }
  return undefined;
}

export function getSizeOnDiskMap(): Record<number, number> {
  const sizeMap: Record<number, number> = {};
  try {
    const store = (window as any).appStore;
    if (store?.allApps) {
      for (const app of store.allApps) {
        const appid = app.appid || app.nAppID;
        if (!appid) continue;
        const size = getSizeOnDisk(appid);
        if (size) {
          sizeMap[appid] = size;
        }
      }
    }
  } catch (e) {
    logger.warn("[SuggestMe] Failed to get size on disk map:", e);
  }
  return sizeMap;
}

export function getPurchaseDate(appid: number): number | undefined {
  try {
    const store = (window as any).appStore;
    if (store?.GetAppOverviewByAppID) {
      const overview = store.GetAppOverviewByAppID(appid);
      if (overview?.rt_purchased_time && overview.rt_purchased_time > 0) {
        return overview.rt_purchased_time;
      }
    }
  } catch (e) {
    logger.warn("[SuggestMe] Failed to get purchase date for appid", appid, e);
  }
  return undefined;
}

export function getPurchaseDateMap(): Record<number, number> {
  const purchaseMap: Record<number, number> = {};
  try {
    const store = (window as any).appStore;
    if (store?.allApps) {
      for (const app of store.allApps) {
        const appid = app.appid || app.nAppID;
        if (!appid) continue;
        const purchaseDate = getPurchaseDate(appid);
        if (purchaseDate) {
          purchaseMap[appid] = purchaseDate;
        }
      }
    }
  } catch (e) {
    logger.warn("[SuggestMe] Failed to get purchase date map:", e);
  }
  return purchaseMap;
}

export function getReleaseDateMap(): Record<number, number> {
  const releaseMap: Record<number, number> = {};
  try {
    const store = (window as any).appStore;
    if (store?.allApps) {
      for (const app of store.allApps) {
        const appid = app.appid || app.nAppID;
        if (!appid) continue;
        const overview = store.GetAppOverviewByAppID(appid);
        // Use rt_original_release_date from Steam (seconds since epoch)
        const releaseDate = overview?.rt_original_release_date || overview?.rt_steam_release_date;
        if (releaseDate && releaseDate > 0) {
          releaseMap[appid] = releaseDate;
        }
      }
    }
  } catch (e) {
    logger.warn("[SuggestMe] Failed to get release date map:", e);
  }
  return releaseMap;
}

export function useSuggestion() {
  const [currentSuggestion, setCurrentSuggestion] = useState<SuggestionResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const requestSuggestion = useCallback(
    async (mode: SuggestMode, filters: SuggestFilters = DEFAULT_FILTERS, presetName?: string): Promise<SuggestionResult | null> => {
      try {
        let installedAppIds: number[] = [];
        if (filters.installed_only || filters.not_installed_only) {
          installedAppIds = getInstalledAppIds();
        }

        const enhancedFilters = { ...filters };
        
        if (filters.include_collections?.length) {
          enhancedFilters.include_collection_appids = getCollectionAppIds(filters.include_collections);
        }
        if (filters.exclude_collections?.length) {
          enhancedFilters.exclude_collection_appids = getCollectionAppIds(filters.exclude_collections);
        }

        if (filters.min_size_mb !== undefined || filters.max_size_mb !== undefined) {
          enhancedFilters.size_on_disk_map = getSizeOnDiskMap();
        }

        if (filters.purchase_date_after !== undefined || filters.purchase_date_before !== undefined) {
          enhancedFilters.purchase_date_map = getPurchaseDateMap();
        }

        if (filters.release_date_after !== undefined || filters.release_date_before !== undefined) {
          enhancedFilters.release_date_map = getReleaseDateMap();
        }

        const result = await call<[string, any, number[], string?], SuggestionResult>(
          "get_suggestion",
          mode,
          enhancedFilters,
          installedAppIds,
          presetName
        );
        setCurrentSuggestion(result);
        return result;
      } catch (error) {
        logger.error("[SuggestMe] Failed to get suggestion:", error);
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
      logger.error("[SuggestMe] Failed to load history:", error);
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
      logger.error("[SuggestMe] Failed to clear history:", error);
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
