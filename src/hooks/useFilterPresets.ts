import { useState, useCallback, useEffect } from "react";
import { call } from "@decky/api";
import { FilterPreset, FilterPresetsState, SuggestFilters } from "../types";
import { logger } from "../utils/logger";

export function useFilterPresets() {
  const [presets, setPresets] = useState<(FilterPreset | null)[]>([null, null, null, null, null]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const loadPresets = useCallback(async () => {
    try {
      const result = await call<[], FilterPresetsState>("get_filter_presets");
      if (result) {
        setPresets(result.presets || [null, null, null, null, null]);
        setActiveIndex(result.active_index);
      }
    } catch (e) {
      logger.error("[SuggestMe] Failed to load filter presets:", e);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const savePreset = useCallback(async (
    slotIndex: number,
    label: string,
    filters: SuggestFilters
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await call<[number, string, SuggestFilters], { success: boolean; error?: string }>(
        "save_filter_preset",
        slotIndex,
        label,
        filters
      );
      if (result.success) {
        await loadPresets();
      }
      return result;
    } catch (e) {
      logger.error("[SuggestMe] Failed to save preset:", e);
      return { success: false, error: "Failed to save preset" };
    }
  }, [loadPresets]);

  const renamePreset = useCallback(async (
    slotIndex: number,
    newLabel: string
  ): Promise<boolean> => {
    try {
      const result = await call<[number, string], { success: boolean }>(
        "rename_filter_preset",
        slotIndex,
        newLabel
      );
      if (result.success) {
        await loadPresets();
      }
      return result.success;
    } catch (e) {
      logger.error("[SuggestMe] Failed to rename preset:", e);
      return false;
    }
  }, [loadPresets]);

  const deletePreset = useCallback(async (slotIndex: number): Promise<boolean> => {
    try {
      const result = await call<[number], { success: boolean }>(
        "delete_filter_preset",
        slotIndex
      );
      if (result.success) {
        await loadPresets();
      }
      return result.success;
    } catch (e) {
      logger.error("[SuggestMe] Failed to delete preset:", e);
      return false;
    }
  }, [loadPresets]);

  const setActive = useCallback(async (slotIndex: number | null): Promise<boolean> => {
    try {
      const result = await call<[number | null], { success: boolean }>(
        "set_active_preset",
        slotIndex
      );
      if (result.success) {
        setActiveIndex(slotIndex);
      }
      return result.success;
    } catch (e) {
      logger.error("[SuggestMe] Failed to set active preset:", e);
      return false;
    }
  }, []);

  const getActivePreset = useCallback((): FilterPreset | null => {
    if (activeIndex !== null && activeIndex >= 0 && activeIndex < presets.length) {
      return presets[activeIndex];
    }
    return null;
  }, [presets, activeIndex]);

  return {
    presets,
    activeIndex,
    savePreset,
    renamePreset,
    deletePreset,
    setActive,
    getActivePreset,
    reload: loadPresets,
  };
}
