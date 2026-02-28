import { useState, useEffect, useCallback } from "react";
import { call } from "@decky/api";
import { SuggestMeConfig, SuggestFilters, SuggestMode, DEFAULT_FILTERS } from "../types";

export function useSuggestMeConfig() {
  const [config, setConfig] = useState<SuggestMeConfig>({
    steam_api_key: "",
    steam_id: "",
    default_mode: "luck",
    default_filters: DEFAULT_FILTERS,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const result = await call<[], SuggestMeConfig>("get_config");
      setConfig(result);
    } catch (error) {
      console.error("[SuggestMe] Failed to load config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadConfig().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  const setSteamCredentials = useCallback(
    async (apiKey: string, steamId: string): Promise<boolean> => {
      setIsSaving(true);
      try {
        const result = await call<[string, string], { success: boolean }>(
          "set_steam_credentials",
          apiKey,
          steamId
        );
        if (result.success) {
          setConfig((prev) => ({
            ...prev,
            steam_api_key: apiKey,
            steam_id: steamId,
          }));
        }
        return result.success;
      } catch (error) {
        console.error("[SuggestMe] Failed to save credentials:", error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const setDefaultMode = useCallback(async (mode: SuggestMode): Promise<boolean> => {
    setIsSaving(true);
    try {
      const result = await call<[string], { success: boolean }>("save_default_mode", mode);
      if (result.success) {
        setConfig((prev) => ({ ...prev, default_mode: mode }));
      }
      return result.success;
    } catch (error) {
      console.error("[SuggestMe] Failed to save default mode:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const setDefaultFilters = useCallback(
    async (filters: SuggestFilters): Promise<boolean> => {
      setIsSaving(true);
      try {
        const result = await call<[SuggestFilters], { success: boolean }>(
          "save_default_filters",
          filters
        );
        if (result.success) {
          setConfig((prev) => ({ ...prev, default_filters: filters }));
        }
        return result.success;
      } catch (error) {
        console.error("[SuggestMe] Failed to save default filters:", error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const hasCredentials = Boolean(config.steam_api_key && config.steam_id);

  return {
    config,
    isLoading,
    isSaving,
    hasCredentials,
    setSteamCredentials,
    setDefaultMode,
    setDefaultFilters,
    reload: loadConfig,
  };
}
