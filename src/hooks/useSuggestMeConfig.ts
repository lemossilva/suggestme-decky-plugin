import { useState, useEffect, useCallback } from "react";
import { call } from "@decky/api";
import { SuggestMeConfig, SuggestFilters, SuggestMode, DEFAULT_FILTERS, Credentials } from "../types";
import { logger } from "../utils/logger";

export function useSuggestMeConfig() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [config, setConfig] = useState<SuggestMeConfig>({
    has_steam_api_key: false,
    has_steam_id: false,
    history_limit: 50,
    mode_order: ["luck", "guided", "intelligent", "fresh_air"],
    default_mode: "luck",
    default_filters: DEFAULT_FILTERS,
    hide_credentials: true,
    has_rawg_api_key: false,
    spin_wheel_banner_colors: false,
  });

  const loadConfig = useCallback(async () => {
    try {
      const currentConfig = await call<[], SuggestMeConfig>("get_config");
      setConfig(currentConfig);
    } catch (error) {
      logger.error("[SuggestMe] Failed to load config:", error);
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

  const getCredentials = useCallback(async (): Promise<Credentials> => {
    try {
      return await call<[], Credentials>("get_credentials");
    } catch (error) {
      logger.error("[SuggestMe] Failed to get credentials:", error);
      return { steam_api_key: "", steam_id: "", rawg_api_key: "" };
    }
  }, []);

  const setSteamCredentials = useCallback(
    async (apiKey: string, steamId: string): Promise<boolean> => {
      try {
        const result = await call<[string, string], { success: boolean }>(
          "save_steam_credentials",
          apiKey,
          steamId
        );
        if (result.success) {
          setConfig((prev) => ({
            ...prev,
            has_steam_api_key: Boolean(apiKey),
            has_steam_id: Boolean(steamId),
          }));
          return true;
        }
        return false;
      } catch (error) {
        logger.error("[SuggestMe] Failed to save credentials:", error);
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
      logger.error("[SuggestMe] Failed to save history limit:", error);
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
      logger.error("[SuggestMe] Failed to save mode order:", error);
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
      logger.error("[SuggestMe] Failed to save default mode:", error);
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
      logger.error("[SuggestMe] Failed to save hide credentials:", error);
      return false;
    }
  }, []);

  const setRawgApiKey = useCallback(async (apiKey: string): Promise<boolean> => {
    try {
      const result = await call<[string], { success: boolean }>("save_rawg_api_key", apiKey);
      if (result.success) {
        setConfig((prev) => ({ ...prev, has_rawg_api_key: Boolean(apiKey) }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save RAWG API key:", error);
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
        logger.error("[SuggestMe] Failed to save default filters:", error);
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
      logger.error("[SuggestMe] Failed to save date format:", error);
      return false;
    }
  }, []);

  const setLuckSpinWheelEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_luck_spin_wheel_enabled",
        enabled
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          luck_spin_wheel_enabled: enabled,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save spin wheel setting:", error);
      return false;
    }
  }, []);

  const setSpinWheelSilent = useCallback(async (silent: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_spin_wheel_silent",
        silent
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          spin_wheel_silent: silent,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save spin wheel silent setting:", error);
      return false;
    }
  }, []);

  const setSimilarToFilterPool = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_similar_to_filter_pool",
        enabled
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          similar_to_filter_pool: enabled,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save similar_to filter pool setting:", error);
      return false;
    }
  }, []);

  const setExcludePlayNextFromSuggestions = useCallback(async (exclude: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_exclude_play_next_from_suggestions",
        exclude
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          exclude_play_next_from_suggestions: exclude,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save exclude play next setting:", error);
      return false;
    }
  }, []);

  const setAutoSyncPlayNextCollection = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_auto_sync_play_next_collection",
        enabled
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          auto_sync_play_next_collection: enabled,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save auto sync play next setting:", error);
      return false;
    }
  }, []);

  const setAutoSyncExcludedCollection = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_auto_sync_excluded_collection",
        enabled
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          auto_sync_excluded_collection: enabled,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save auto sync excluded setting:", error);
      return false;
    }
  }, []);

  const setAutoSyncNewGames = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_auto_sync_new_games",
        enabled
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          auto_sync_new_games: enabled,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save auto sync new games setting:", error);
      return false;
    }
  }, []);

  const setSpinWheelBannerColors = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      const result = await call<[boolean], { success: boolean }>(
        "save_spin_wheel_banner_colors",
        enabled
      );
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          spin_wheel_banner_colors: enabled,
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[SuggestMe] Failed to save spin wheel banner colors setting:", error);
      return false;
    }
  }, []);

  const hasCredentials = Boolean(config.has_steam_api_key && config.has_steam_id);

  return {
    isLoaded,
    config,
    hasCredentials,
    getCredentials,
    setSteamCredentials,
    setHistoryLimit,
    setModeOrder,
    setDefaultMode,
    setDefaultFilters,
    setHideCredentials,
    setRawgApiKey,
    setDateFormat,
    setLuckSpinWheelEnabled,
    setSpinWheelSilent,
    setSimilarToFilterPool,
    setExcludePlayNextFromSuggestions,
    setAutoSyncPlayNextCollection,
    setAutoSyncExcludedCollection,
    setAutoSyncNewGames,
    setSpinWheelBannerColors,
    reload: loadConfig,
  };
}
