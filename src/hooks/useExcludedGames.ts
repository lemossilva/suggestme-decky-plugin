import { useState, useCallback, useEffect } from "react";
import { call } from "@decky/api";
import { ExcludedGame, Game } from "../types";
import { logger } from "../utils/logger";
import { syncAppidsToCollection } from "../utils/collectionSync";

export function useExcludedGames() {
  const [list, setList] = useState<ExcludedGame[]>([]);

  const loadList = useCallback(async () => {
    try {
      const result = await call<[], { games: ExcludedGame[]; count: number }>("get_excluded_games");
      if (result?.games) setList(result.games);
    } catch (e) {
      logger.error("[SuggestMe] Failed to load excluded games:", e);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const excludeGame = useCallback(async (game: Game): Promise<boolean> => {
    try {
      const result = await call<[{
        appid: number;
        name: string;
        is_non_steam: boolean;
        matched_appid?: number;
        playtime_forever: number;
        deck_status: string;
      }], { success: boolean; count?: number; auto_sync?: boolean; sync_data?: { appids: number[] } }>(
        "add_to_excluded",
        {
          appid: game.appid,
          name: game.name,
          is_non_steam: game.is_non_steam,
          matched_appid: game.matched_appid,
          playtime_forever: game.playtime_forever,
          deck_status: game.deck_status,
        }
      );
      if (result.success) {
        await loadList();
        if (result.auto_sync && result.sync_data?.appids) {
          syncAppidsToCollection(result.sync_data.appids, "SuggestMe Excluded");
        }
      }
      return result.success;
    } catch (e) {
      logger.error("[SuggestMe] Failed to exclude game:", e);
      return false;
    }
  }, [loadList]);

  const unexcludeGame = useCallback(async (appid: number): Promise<boolean> => {
    try {
      const result = await call<[number], { success: boolean; auto_sync?: boolean; sync_data?: { appids: number[] } }>("remove_from_excluded", appid);
      if (result.success) {
        await loadList();
        if (result.auto_sync && result.sync_data?.appids) {
          syncAppidsToCollection(result.sync_data.appids, "SuggestMe Excluded");
        }
      }
      return result.success;
    } catch (e) {
      logger.error("[SuggestMe] Failed to unexclude game:", e);
      return false;
    }
  }, [loadList]);

  const clearAll = useCallback(async (): Promise<boolean> => {
    try {
      const result = await call<[], { success: boolean }>("clear_excluded_games");
      if (result.success) {
        setList([]);
      }
      return result.success;
    } catch (e) {
      logger.error("[SuggestMe] Failed to clear excluded games:", e);
      return false;
    }
  }, []);

  const isExcluded = useCallback((appid: number): boolean => {
    return list.some(e => e.appid === appid);
  }, [list]);

  return {
    list,
    count: list.length,
    excludeGame,
    unexcludeGame,
    clearAll,
    isExcluded,
    reload: loadList,
  };
}
