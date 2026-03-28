import { useState, useEffect, useCallback } from "react";
import { call, addEventListener, removeEventListener, toaster } from "@decky/api";
import { LibraryStatus, RefreshProgress } from "../types";
import { logger } from "../utils/logger";

export function useLibraryStatus() {
  const [status, setStatus] = useState<LibraryStatus>({
    last_refresh: undefined,
    total_games: 0,
    steam_games_count: 0,
    non_steam_games_count: 0,
    is_refreshing: false,
    error: undefined,
  });
  const [progress, setProgress] = useState<RefreshProgress | null>(null);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableCommunityTags, setAvailableCommunityTags] = useState<string[]>([]);

  const loadStatus = useCallback(async () => {
    try {
      const result = await call<[], LibraryStatus>("get_library_status");
      setStatus(result);
    } catch (error) {
      logger.error("[SuggestMe] Failed to load library status:", error);
    }
  }, []);

  const loadGenresAndTags = useCallback(async () => {
    try {
      const [genres, tags, communityTags] = await Promise.all([
        call<[], string[]>("get_available_genres"),
        call<[], string[]>("get_available_tags"),
        call<[], string[]>("get_available_community_tags"),
      ]);
      setAvailableGenres(genres);
      setAvailableTags(tags);
      setAvailableCommunityTags(communityTags);
    } catch (error) {
      logger.error("[SuggestMe] Failed to load genres/tags:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadStatus().then(() => {
      if (cancelled) return;
      loadGenresAndTags();
    });

    const statusListener = addEventListener<[Partial<LibraryStatus>]>(
      "suggestme_library_status_changed",
      (data) => {
        if (cancelled) return;
        setStatus((prev) => ({ ...prev, ...data }));
        if (!data.is_refreshing && data.total_games) {
          loadGenresAndTags();
        }
      }
    );

    const progressListener = addEventListener<[RefreshProgress]>(
      "suggestme_refresh_progress",
      (data) => {
        if (cancelled) return;
        setProgress(data);
      }
    );

    const nonSteamProgressListener = addEventListener<[{ current: number; total: number; name: string }]>(
      "suggestme_non_steam_progress",
      () => {
        // No-op listener to suppress "no listeners" warning
      }
    );

    const autoSyncListener = addEventListener<[{ new_games: number; total_games: number; silent: boolean }]>(
      "suggestme_auto_sync_complete",
      (data) => {
        if (cancelled) return;
        if (data.new_games > 0 && !data.silent) {
          toaster.toast({
            title: "SuggestMe • New Games Found",
            body: `${data.new_games} new game${data.new_games > 1 ? 's' : ''} added to your library`,
            duration: 4000,
          });
          loadStatus();
          loadGenresAndTags();
        }
      }
    );

    return () => {
      cancelled = true;
      removeEventListener("suggestme_library_status_changed", statusListener);
      removeEventListener("suggestme_refresh_progress", progressListener);
      removeEventListener("suggestme_non_steam_progress", nonSteamProgressListener);
      removeEventListener("suggestme_auto_sync_complete", autoSyncListener);
    };
  }, [loadStatus, loadGenresAndTags]);

  const refreshLibrary = useCallback(async (): Promise<boolean> => {
    setProgress(null);
    try {
      const result = await call<
        [],
        { success: boolean; error?: string; total_games?: number; last_refresh?: number }
      >("refresh_library");
      if (result.success) {
        setStatus((prev) => ({
          ...prev,
          total_games: result.total_games || prev.total_games,
          last_refresh: result.last_refresh,
          is_refreshing: false,
          error: undefined,
        }));
        await loadGenresAndTags();
        toaster.toast({
          title: "SuggestMe • Library Synced",
          body: `${result.total_games} games loaded successfully`,
          duration: 3000,
        });
      } else {
        toaster.toast({
          title: "SuggestMe • Sync Failed",
          body: result.error || "Unknown error",
          duration: 5000,
        });
      }
      return result.success;
    } catch (error) {
      logger.error("[SuggestMe] Failed to refresh library:", error);
      toaster.toast({
        title: "SuggestMe • Sync Failed",
        body: "Failed to refresh library",
        duration: 5000,
      });
      return false;
    } finally {
      setProgress(null);
    }
  }, [loadGenresAndTags]);

  const formatLastRefresh = useCallback((): string => {
    if (!status.last_refresh) return "Never";
    const date = new Date(status.last_refresh * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, [status.last_refresh]);

  return {
    status,
    progress,
    availableGenres,
    availableTags,
    availableCommunityTags,
    refreshLibrary,
    formatLastRefresh,
    reload: loadStatus,
  };
}
