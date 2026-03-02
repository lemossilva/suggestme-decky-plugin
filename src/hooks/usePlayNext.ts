import { useState, useCallback, useEffect } from "react";
import { call } from "@decky/api";
import { PlayNextEntry, Game } from "../types";

export function usePlayNext() {
  const [list, setList] = useState<PlayNextEntry[]>([]);

  const loadList = useCallback(async () => {
    try {
      const result = await call<[], { games: PlayNextEntry[]; count: number }>("get_play_next_list");
      if (result) {
        setList(result.games || []);
      }
    } catch (e) {
      console.error("[SuggestMe] Failed to load play next list:", e);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const addGame = useCallback(async (game: Game): Promise<boolean> => {
    try {
      const result = await call<[{ appid: number; name: string; is_non_steam: boolean; matched_appid?: number; playtime_forever: number }], { success: boolean; count?: number }>(
        "add_to_play_next",
        {
          appid: game.appid,
          name: game.name,
          is_non_steam: game.is_non_steam,
          matched_appid: game.matched_appid,
          playtime_forever: game.playtime_forever,
        }
      );
      if (result.success) {
        await loadList();
      }
      return result.success;
    } catch (e) {
      console.error("[SuggestMe] Failed to add to play next:", e);
      return false;
    }
  }, [loadList]);

  const removeGame = useCallback(async (appid: number): Promise<boolean> => {
    try {
      const result = await call<[number], { success: boolean }>("remove_from_play_next", appid);
      if (result.success) {
        await loadList();
      }
      return result.success;
    } catch (e) {
      console.error("[SuggestMe] Failed to remove from play next:", e);
      return false;
    }
  }, [loadList]);

  const clearList = useCallback(async (): Promise<boolean> => {
    try {
      const result = await call<[], { success: boolean }>("clear_play_next");
      if (result.success) {
        setList([]);
      }
      return result.success;
    } catch (e) {
      console.error("[SuggestMe] Failed to clear play next list:", e);
      return false;
    }
  }, []);

  const isInList = useCallback((appid: number): boolean => {
    return list.some(e => e.appid === appid);
  }, [list]);

  return {
    list,
    count: list.length,
    addGame,
    removeGame,
    clearList,
    isInList,
    reload: loadList,
  };
}
