import { useState, useEffect, useCallback } from "react";
import { call } from "@decky/api";
import { SuggestMeConfig, SuggestFilters, SuggestMode, DEFAULT_FILTERS } from "../types";

export function useSuggestMeConfig() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [config, setConfig] = useState<SuggestMeConfig>({
    steam_api_key: "",
    steam_id: "",
    history_limit: 50,
    mode_order: ["luck", "guided", "intelligent", "fresh_air"],
    default_mode: "luck",
    default_filters: DEFAULT_FILTERS,
    hide_credentials: true,
  });

  const loadConfig = useCallback(async () => {
    try {
      const currentConfig = await call<[], SuggestMeConfig>("get_config");
      setConfig(currentConfig);
    } catch (error) {
      console.error("[SuggestMe] Failed to load config:", error);
    } finally {
      setIsLoaded(true);
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
          return true;
        }
        return false;
      } catch (error) {
        console.error("[SuggestMe] Failed to save credentials:", error);
        return false;
      }
    },
    []
  );

  const setHistoryLimit = useCallback(async (limit: number): Promise<boolean> => {
    try {
      const result = await call<[number], { success: boolean }>("save_history_limit", limit);
      if (result.success) {
        setConfig((prev) => ({ ...prev, history_limit: limit }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("[SuggestMe] Failed to save history limit:", error);
      return false;
    }
  }, []);

  const setModeOrder = useCallback(async (order: SuggestMode[]): Promise<boolean> => {
    try {
      const result = await call<[SuggestMode[]], { success: boolean }>("save_mode_order", order);
      if (result.success) {
        setConfig((prev) => ({ ...prev, mode_order: order }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("[SuggestMe] Failed to save mode order:", error);
      return false;
    }
  }, []);

  const setDefaultMode = useCallback(async (mode: SuggestMode): Promise<boolean> => {
    try {
      const result = await call<[string], { success: boolean }>("save_default_mode", mode);
      if (result.success) {
        setConfig((prev) => ({ ...prev, default_mode: mode }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("[SuggestMe] Failed to save default mode:", error);
      return false;
    }
  }, []);

  const setHideCredentials = useCallback(async (hide: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>("save_hide_credentials", hide);
      if (result.success) {
        setConfig((prev) => ({ ...prev, hide_credentials: hide }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("[SuggestMe] Failed to save hide credentials:", error);
      return false;
    }
  }, []);

  const setRawgApiKey = useCallback(async (apiKey: string): Promise<boolean> => {
    try {
      const result = await call<[string], { success: boolean }>("save_rawg_api_key", apiKey);
      if (result.success) {
        setConfig((prev) => ({ ...prev, rawg_api_key: apiKey }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("[SuggestMe] Failed to save RAWG API key:", error);
      return false;
    }
  }, []);

  const setDefaultFilters = useCallback(
    async (filters: SuggestFilters): Promise<boolean> => {
      try {
        const result = await call<[SuggestFilters], { success: boolean }>(
          "save_default_filters",
          filters
        );
        if (result.success) {
          setConfig((prev) => ({ ...prev, default_filters: filters }));
          return true;
        }
        return false;
      } catch (error) {
        console.error("[SuggestMe] Failed to save default filters:", error);
        return false;
      }
    },
    []
  );

  const setDateFormat = useCallback(async (format: 'US' | 'EU' | 'ISO'): Promise<boolean> => {
    try {
      const result = await call<[string], { success: boolean }>(
        "save_date_format",
        format
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          date_format: format,
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("[SuggestMe] Failed to save date format:", error);
      return false;
    }
  }, []);

  const hasCredentials = Boolean(config.steam_api_key && config.steam_id);

  return {
    isLoaded,
    config,
    hasCredentials,
    setSteamCredentials,
    setHistoryLimit,
    setModeOrder,
    setDefaultMode,
    setDefaultFilters,
    setHideCredentials,
    setRawgApiKey,
    setDateFormat,
    reload: loadConfig,
  };
}
