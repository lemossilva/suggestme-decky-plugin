import { useState, useRef, useEffect, useCallback } from "react";
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Focusable,
  Navigation,
} from "@decky/ui";

declare const SteamClient: {
  Apps: {
    RunGame: (gameId: string, action: string, param1: number, param2: number) => void;
  };
};

declare const appStore: {
  GetAppOverviewByAppID: (appid: number) => { m_gameid?: string; gameid?: string } | null;
  allApps: { appid: number; local_per_client_data?: { installed?: boolean } }[];
};

function getInstalledAppIds(): number[] {
  try {
    if (typeof appStore !== 'undefined' && appStore.allApps) {
      const installed: number[] = [];
      for (const app of appStore.allApps) {
        if (app.local_per_client_data?.installed) {
          installed.push(app.appid);
        }
      }
      return installed;
    }
  } catch (e) {
    console.error("[SuggestMe] Failed to get installed apps:", e);
  }
  return [];
}

import { FaMagic, FaCog, FaDice, FaCompass, FaBrain, FaLeaf, FaFilter, FaTimes, FaTrash, FaChevronRight, FaGamepad, FaSteam, FaListUl, FaBan } from "react-icons/fa";
import { call } from "@decky/api";
import { useSuggestMeConfig } from "../hooks/useSuggestMeConfig";
import { useLibraryStatus } from "../hooks/useLibraryStatus";
import { useSuggestion } from "../hooks/useSuggestion";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { useFilterPresets } from "../hooks/useFilterPresets";
import { SuggestionCard } from "./SuggestionCard";
import { navigateToSettings } from "./SettingsModal";
import { navigateToFilters, getFilterSummary, hasActiveFilters } from "./FiltersModal";
import { navigateToNonSteamGames } from "./NonSteamGamesModal";
import { navigateToPlayNext } from "./PlayNextModal";
import { navigateToHistory } from "./HistoryModal";
import { navigateToExcludedGames } from "./ExcludedGamesModal";
import {
  SuggestMode,
  SuggestFilters,
  DEFAULT_FILTERS,
  MODE_DESCRIPTIONS,
  HistoryEntry,
  NonSteamGamesInfo,
  SuggestionResult,
} from "../types";

type TabId = SuggestMode;

const TAB_DEFINITIONS: Record<SuggestMode, { label: string; icon: JSX.Element }> = {
  luck: { label: 'Luck', icon: <FaDice size={12} /> },
  guided: { label: 'Guided', icon: <FaCompass size={12} /> },
  intelligent: { label: 'Smart', icon: <FaBrain size={12} /> },
  fresh_air: { label: 'Fresh', icon: <FaLeaf size={12} /> },
};

const normalizeFilters = (filters?: SuggestFilters): SuggestFilters => ({
  ...DEFAULT_FILTERS,
  ...(filters || {}),
});

interface TabButtonProps {
  label: string;
  icon: JSX.Element;
  active: boolean;
  onClick: () => void;
}

const TabButton = ({ label, icon, active, onClick }: TabButtonProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      onActivate={onClick}
      onClick={onClick}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 4px',
        backgroundColor: active ? '#4488aa' : (focused ? '#ffffff22' : 'transparent'),
        color: active || focused ? '#ffffff' : '#888888',
        border: focused ? '2px solid #ffffff' : '2px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
        gap: 4,
        transition: 'all 0.1s ease-in-out',
      }}
    >
      {icon}
      <span style={{
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        marginTop: 2
      }}>{label}</span>
    </Focusable>
  );
};

export function SuggestMeRoot() {
  const { config, hasCredentials, setDefaultFilters } = useSuggestMeConfig();
  const { status, availableGenres, availableTags, availableCommunityTags } = useLibraryStatus();
  const { requestSuggestion, clearCurrentSuggestion } =
    useSuggestion();
  const { count: playNextCount, addGame: addToPlayNext, removeGame: removeFromPlayNext, isInList: isInPlayNext } = usePlayNext();
  const { excludeGame, count: excludedCount } = useExcludedGames();
  const { presets, activeIndex, getActivePreset, setActive } = useFilterPresets();

  const contentRef = useRef<HTMLDivElement>(null);
  const activePreset = getActivePreset();
  // Derive tabs from config order, fallback to default if missing
  const modeOrder = config.mode_order && config.mode_order.length > 0 
    ? config.mode_order 
    : (['luck', 'guided', 'intelligent', 'fresh_air'] as SuggestMode[]);

  const [selectedTab, setSelectedTab] = useState<TabId | null>(null);
  const activeTab = selectedTab || modeOrder[0];

  const [filters, setFilters] = useState<SuggestFilters>(normalizeFilters(config.default_filters));
  const [history, setHistory] = useState<Record<SuggestMode, HistoryEntry[]>>({
    luck: [],
    guided: [],
    intelligent: [],
    fresh_air: []
  });
  const [nonSteamInfo, setNonSteamInfo] = useState<NonSteamGamesInfo | null>(null);
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [justAddedToPlayNext, setJustAddedToPlayNext] = useState(false);
  const [confirmingExclude, setConfirmingExclude] = useState(false);
  const [candidatesCount, setCandidatesCount] = useState<{ candidates: number; excluded: number } | null>(null);
  const [suggestionsPerMode, setSuggestionsPerMode] = useState<Record<SuggestMode, SuggestionResult | null>>({
    luck: null,
    guided: null,
    intelligent: null,
    fresh_air: null
  });

  const filtersActive = hasActiveFilters(filters);
  const filterSummary = activePreset ? activePreset.label : getFilterSummary(filters);
  const currentModeSuggestion = suggestionsPerMode[activeTab];
  const steamGamesCount = status.steam_games_count || 0;

  useEffect(() => {
    if (hasCredentials) {
      loadHistory();
      fetchCandidatesCount();
    }
  }, [hasCredentials, activeTab, filters]);

  useEffect(() => {
    if (!config.default_filters) return;
    setFilters((prev) => {
      const normalized = normalizeFilters(config.default_filters);
      return JSON.stringify(prev) === JSON.stringify(normalized) ? prev : normalized;
    });
  }, [config.default_filters]);

  const loadHistory = useCallback(async () => {
    try {
      const result = await call<[], Record<SuggestMode, HistoryEntry[]>>("get_suggestion_history");
      if (result) setHistory(result);
    } catch (e) {
      console.error("[SuggestMe] Failed to load history:", e);
    }
  }, []);

  const loadNonSteamInfo = useCallback(async () => {
    try {
      const result = await call<[], NonSteamGamesInfo>("get_non_steam_games");
      if (result) setNonSteamInfo(result);
    } catch (e) {
      console.error("[SuggestMe] Failed to load non-steam info:", e);
    }
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      const frontendCollections: string[] = [];
      try {
        const store = (window as any).collectionStore;
        if (store?.userCollections) {
          const collections = store.userCollections;
          if (Array.isArray(collections)) {
            collections.forEach((col: any) => {
              const name = col?.displayName || col?.strName;
              if (name && col?.id) {
                frontendCollections.push(name);
              }
            });
          }
        }
      } catch (e) {
        console.debug("[SuggestMe] Frontend collection read failed:", e);
      }

      if (frontendCollections.length > 0) {
        setAvailableCollections(frontendCollections.sort());
      } else {
        const result = await call<[], { collections: string[] }>("get_collections");
        if (result?.collections) setAvailableCollections(result.collections);
      }
    } catch (e) {
      console.error("[SuggestMe] Failed to load collections:", e);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadNonSteamInfo();
    loadCollections();
  }, [loadHistory, loadNonSteamInfo, loadCollections]);

  const fetchCandidatesCount = useCallback(async () => {
    if (!hasCredentials || status.total_games === 0) {
      setCandidatesCount(null);
      return;
    }
    try {
      const installedAppIds = getInstalledAppIds();
      const result = await call<[object, number[]], { count: number; excluded_count: number }>("get_candidates_count", filters, installedAppIds);
      if (result) setCandidatesCount({ candidates: result.count, excluded: result.excluded_count });
    } catch (e) {
      console.error("[SuggestMe] Failed to get candidates count:", e);
    }
  }, [filters, hasCredentials, status.total_games]);

  useEffect(() => {
    fetchCandidatesCount();
  }, [fetchCandidatesCount]);

  useEffect(() => {
    const scrollToTop = () => {
      if (contentRef.current) {
        contentRef.current.scrollIntoView({ block: 'start' });
        let el: HTMLElement | null = contentRef.current.parentElement;
        while (el) {
          if (el.scrollHeight > el.clientHeight) {
            el.scrollTop = 0;
          }
          el = el.parentElement;
        }
      }
    };
    scrollToTop();
    requestAnimationFrame(scrollToTop);
    const t1 = setTimeout(scrollToTop, 50);
    return () => clearTimeout(t1);
  }, []);

  const handleOpenFilters = () => {
    navigateToFilters({
      filters,
      availableGenres,
      availableTags,
      availableCommunityTags,
      availableCollections,
      onSave: async (newFilters) => {
        const normalized = normalizeFilters(newFilters);
        setFilters(normalized);
        await setDefaultFilters(normalized);
        Navigation.OpenQuickAccessMenu();
      }
    });
  };

  const handleClearFilters = () => {
    const resetFilters = { ...DEFAULT_FILTERS };
    setFilters(resetFilters);
    setDefaultFilters(resetFilters);
  };

  const handleSuggest = async () => {
    const result = await requestSuggestion(activeTab, filters);
    if (result) {
      setSuggestionsPerMode(prev => ({ ...prev, [activeTab]: result }));
    }
    loadHistory();
  };

  const handleLaunch = () => {
    if (currentModeSuggestion?.game) {
      const appid = currentModeSuggestion.game.appid;
      Navigation.NavigateToLibraryTab();
      Navigation.Navigate(`/library/app/${appid}`);
    }
  };

  const handleReroll = async () => {
    const result = await requestSuggestion(activeTab, filters);
    if (result) {
      setSuggestionsPerMode(prev => ({ ...prev, [activeTab]: result }));
    }
    loadHistory();
  };

  const handleClearSuggestion = () => {
    setSuggestionsPerMode(prev => ({ ...prev, [activeTab]: null }));
    clearCurrentSuggestion();
  };

  const handleDeleteHistory = async (mode: SuggestMode, appid: number) => {
    try {
      await call<[string, number], boolean>("delete_history_entry", mode, appid);
      loadHistory();
    } catch (e) {
      console.error("[SuggestMe] Failed to delete history entry:", e);
    }
  };

  const handleAddToPlayNext = async () => {
    if (currentModeSuggestion?.game) {
      await addToPlayNext(currentModeSuggestion.game);
      setJustAddedToPlayNext(true);
      setTimeout(() => setJustAddedToPlayNext(false), 2000);
    }
  };

  const handleRemoveCurrentFromPlayNext = async () => {
    if (currentModeSuggestion?.game) {
      await removeFromPlayNext(currentModeSuggestion.game.appid);
    }
  };

  const handleExclude = async () => {
    if (!confirmingExclude) {
      setConfirmingExclude(true);
      setTimeout(() => setConfirmingExclude(false), 5000);
      return;
    }
    
    if (currentModeSuggestion?.game) {
      await excludeGame(currentModeSuggestion.game);
      setConfirmingExclude(false);
      handleReroll();
    }
  };

  const currentGameInPlayNext = currentModeSuggestion?.game ? isInPlayNext(currentModeSuggestion.game.appid) : false;

  const currentHistory = history[activeTab] || [];

  return (
    <div ref={contentRef}>
      {/* Header: Steam | Non-Steam | spacer | Play Next | Excluded | Settings */}
      <div style={{ padding: '4px 16px 4px 16px' }}>
        <Focusable
          flow-children="row"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 8,
            width: '100%'
          }}
        >
          {/* Steam Games Count */}
          <Focusable
            onActivate={steamGamesCount > 0 ? () => Navigation.Navigate("/library") : undefined}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 6,
              backgroundColor: steamGamesCount > 0 ? '#4488aa22' : '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: steamGamesCount > 0 ? 'pointer' : 'default',
              opacity: steamGamesCount > 0 ? 1 : 0.6,
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              if (steamGamesCount > 0) {
                e.target.style.backgroundColor = '#1a5a7a';
                e.target.style.borderColor = 'white';
              }
            }}
            onBlur={(e: any) => {
              e.target.style.backgroundColor = steamGamesCount > 0 ? '#4488aa22' : '#ffffff08';
              e.target.style.borderColor = 'transparent';
            }}
          >
            <FaSteam size={12} style={{ color: steamGamesCount > 0 ? '#4488aa' : '#666666' }} />
            <span style={{ fontSize: 10, color: steamGamesCount > 0 ? '#4488aa' : '#666666', fontWeight: 500 }}>
              {steamGamesCount > 0 ? steamGamesCount : '0'}
            </span>
          </Focusable>

          {/* Non-Steam Games Count */}
          <Focusable
            onActivate={(nonSteamInfo?.total || 0) > 0 ? navigateToNonSteamGames : undefined}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 6,
              backgroundColor: (nonSteamInfo?.total || 0) > 0 ? '#aa886622' : '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: (nonSteamInfo?.total || 0) > 0 ? 'pointer' : 'default',
              opacity: (nonSteamInfo?.total || 0) > 0 ? 1 : 0.6,
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              if ((nonSteamInfo?.total || 0) > 0) {
                e.target.style.backgroundColor = '#1a5a7a';
                e.target.style.borderColor = 'white';
              }
            }}
            onBlur={(e: any) => {
              e.target.style.backgroundColor = (nonSteamInfo?.total || 0) > 0 ? '#aa886622' : '#ffffff08';
              e.target.style.borderColor = 'transparent';
            }}
          >
            <FaGamepad size={12} style={{ color: (nonSteamInfo?.total || 0) > 0 ? '#aa8866' : '#666666' }} />
            <span style={{ fontSize: 10, color: (nonSteamInfo?.total || 0) > 0 ? '#aa8866' : '#666666', fontWeight: 500 }}>
              {nonSteamInfo?.matched || 0}
            </span>
          </Focusable>

          {/* Vertical Spacer */}
          <div style={{ width: 1, backgroundColor: '#ffffff22', margin: '4px 0' }} />

          {/* Play Next Indicator */}
          <Focusable
            onActivate={playNextCount > 0 ? navigateToPlayNext : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 6,
              backgroundColor: playNextCount > 0 ? '#88aa8822' : '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: playNextCount > 0 ? 'pointer' : 'default',
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              if (playNextCount > 0) {
                e.target.style.backgroundColor = '#1a5a7a';
                e.target.style.borderColor = 'white';
              }
            }}
            onBlur={(e: any) => {
              e.target.style.backgroundColor = playNextCount > 0 ? '#88aa8822' : '#ffffff08';
              e.target.style.borderColor = 'transparent';
            }}
          >
            <FaListUl size={12} style={{ color: playNextCount > 0 ? '#88aa88' : '#666666' }} />
            {playNextCount > 0 && (
              <span style={{ fontSize: 10, color: '#88aa88', fontWeight: 600 }}>{playNextCount}</span>
            )}
          </Focusable>

          {/* Excluded Games Button */}
          <Focusable
            onActivate={navigateToExcludedGames}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 6,
              backgroundColor: (excludedCount || 0) > 0 ? '#ff666622' : '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              e.target.style.backgroundColor = '#1a5a7a';
              e.target.style.borderColor = 'white';
            }}
            onBlur={(e: any) => {
              e.target.style.backgroundColor = (excludedCount || 0) > 0 ? '#ff666622' : '#ffffff08';
              e.target.style.borderColor = 'transparent';
            }}
          >
            <FaBan size={12} style={{ color: '#ff6666' }} />
            {(excludedCount || 0) > 0 && (
              <span style={{ fontSize: 10, color: '#ff6666', fontWeight: 600 }}>{excludedCount}</span>
            )}
          </Focusable>

          {/* Vertical Spacer */}
          <div style={{ width: 1, backgroundColor: '#ffffff22', margin: '4px 0' }} />

          {/* Settings Button (icon only) */}
          <Focusable
            onActivate={navigateToSettings}
            style={{
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: 'pointer',
              color: '#888888',
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              e.target.style.backgroundColor = '#1a5a7a';
              e.target.style.borderColor = 'white';
              e.target.style.color = 'white';
            }}
            onBlur={(e: any) => {
              e.target.style.backgroundColor = '#ffffff08';
              e.target.style.borderColor = 'transparent';
              e.target.style.color = '#888888';
            }}
          >
            <FaCog size={16} />
          </Focusable>
        </Focusable>
      </div>

      {/* Credentials warning */}
      {!hasCredentials && (
        <PanelSection>
          <PanelSectionRow>
            <Focusable
              onActivate={navigateToSettings}
              style={{
                background: '#ffaa0022',
                padding: 12,
                borderRadius: 8,
                cursor: 'pointer',
                border: '2px solid transparent'
              }}
              onFocus={(e: any) => e.target.style.borderColor = 'white'}
              onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                Set up your Steam credentials to get started.
              </div>
              <div style={{ fontSize: 11, color: '#ffaa00' }}>
                Tap to open Settings →
              </div>
            </Focusable>
          </PanelSectionRow>
        </PanelSection>
      )}

      {/* Library empty warning */}
      {hasCredentials && status.total_games === 0 && (
        <PanelSection>
          <PanelSectionRow>
            <Focusable
              onActivate={navigateToSettings}
              style={{
                background: '#4488aa22',
                padding: 12,
                borderRadius: 8,
                cursor: 'pointer',
                border: '2px solid transparent'
              }}
              onFocus={(e: any) => e.target.style.borderColor = 'white'}
              onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                Refresh your library to start getting suggestions.
              </div>
              <div style={{ fontSize: 11, color: '#4488aa' }}>
                Tap to open Settings →
              </div>
            </Focusable>
          </PanelSectionRow>
        </PanelSection>
      )}

      {/* Main content when ready */}
      {hasCredentials && status.total_games > 0 && (
        <>
          {/* Mode Tabs */}
          <div style={{ marginBottom: -16 }}>
            <PanelSection>
              <PanelSectionRow>
                <Focusable
                  flow-children="row"
                  style={{
                    display: 'flex',
                    gap: 4,
                    width: '100%',
                    padding: 4,
                    marginTop: 8,
                    backgroundColor: '#ffffff11',
                    borderRadius: 12
                  }}
                >
                  {modeOrder.map(mode => (
                    <TabButton
                      key={mode}
                      label={TAB_DEFINITIONS[mode].label}
                      icon={TAB_DEFINITIONS[mode].icon}
                      active={activeTab === mode}
                      onClick={() => setSelectedTab(mode)}
                    />
                  ))}
                </Focusable>
              </PanelSectionRow>
              <PanelSectionRow>
                <div style={{ fontSize: 11, color: '#888', textAlign: 'center', padding: '8px 0' }}>
                  {MODE_DESCRIPTIONS[activeTab]}
                </div>
              </PanelSectionRow>
              {(activeTab === 'intelligent' || activeTab === 'fresh_air') && (
                <PanelSectionRow>
                  <div style={{ fontSize: 10, color: '#666', textAlign: 'center', fontStyle: 'italic' }}>
                    Tune this algorithm in Settings &gt; Mode Tuning
                  </div>
                </PanelSectionRow>
              )}
            </PanelSection>
          </div>

          {/* Divider */}
          <div style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            margin: '0 16px'
          }} />

          {/* Quick Preset Buttons */}
          {presets.some(p => p !== null) && (
            <div style={{ padding: '0 16px', marginTop: 8 }}>
              <Focusable
                flow-children="row"
                style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
              >
                {presets.map((preset, index) => preset && (
                  <Focusable
                    key={index}
                    onActivate={async () => {
                      setFilters(preset.filters);
                      await setActive(index);
                      await setDefaultFilters(preset.filters);
                    }}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: activeIndex === index ? '#4488aa' : '#ffffff11',
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: '2px solid transparent',
                      fontSize: 11,
                      color: activeIndex === index ? '#fff' : '#aaa',
                      maxWidth: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                  >
                    {preset.label}
                  </Focusable>
                ))}
              </Focusable>
            </div>
          )}

          {/* Filters Bar */}
          <div style={{ padding: '0 16px', marginTop: 8, marginBottom: 8 }}>  
            <Focusable
              flow-children="row"
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 8,
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <Focusable
                onActivate={handleOpenFilters}
                onClick={handleOpenFilters}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  backgroundColor: filtersActive ? '#4488aa33' : '#ffffff11',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  minWidth: 0,
                  overflow: 'hidden'
                }}
                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
              >
                <FaFilter size={12} style={{ color: filtersActive ? '#4488aa' : '#888' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: filtersActive ? 600 : 400 }}>Filters</span>
                    {candidatesCount !== null && (
                      <span style={{ fontSize: 10, color: '#888', fontWeight: 400 }}>
                        ({candidatesCount.candidates}{candidatesCount.excluded > 0 ? ` - ${candidatesCount.excluded} excluded` : ''})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filterSummary}
                  </div>
                </div>
                <FaChevronRight size={10} style={{ color: '#666' }} />
              </Focusable>
              {filtersActive && (
                <Focusable
                  onActivate={handleClearFilters}
                  onClick={handleClearFilters}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'stretch',
                    padding: '0px 10px',
                    backgroundColor: '#ff666633',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    color: '#ff6666'
                  }}
                  onFocus={(e: any) => e.target.style.borderColor = 'white'}
                  onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                  <FaTimes size={12} />
                </Focusable>
              )}
            </Focusable>
          </div>

          {/* Suggestion Area - Button at top */}
          <PanelSection>
            <div style={{ padding: '8px 0', paddingTop: 0, marginTop: 0 }}>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={handleSuggest}
                  disabled={status.is_refreshing}
                >
                  <FaMagic style={{ marginRight: 8 }} />
                  Suggest a Game
                </ButtonItem>
              </PanelSectionRow>
            </div>

            {currentModeSuggestion?.error && (
              <PanelSectionRow>
                <div style={{ color: '#ff6666', fontSize: 12, textAlign: 'center', padding: 8 }}>
                  {currentModeSuggestion.error}
                </div>
              </PanelSectionRow>
            )}

            {currentModeSuggestion?.game && (
              <>
                <SuggestionCard
                  game={currentModeSuggestion.game}
                  modeUsed={currentModeSuggestion.mode_used}
                  candidatesCount={currentModeSuggestion.candidates_count}
                  excludedCount={currentModeSuggestion.excluded_count}
                  onReroll={handleReroll}
                  onLaunch={handleLaunch}
                  onClear={handleClearSuggestion}
                />
                <PanelSectionRow>
                  <Focusable
                    flow-children="row"
                    style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}
                  >
                    <Focusable
                      onActivate={currentGameInPlayNext && !justAddedToPlayNext ? handleRemoveCurrentFromPlayNext : handleAddToPlayNext}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '10px 8px',
                        backgroundColor: justAddedToPlayNext ? '#88ff8833' : (currentGameInPlayNext ? '#88aa8833' : '#ffffff11'),
                        borderRadius: 8,
                        border: '2px solid transparent',
                        cursor: 'pointer'
                      }}
                      onFocus={(e: any) => e.target.style.borderColor = 'white'}
                      onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                      <FaListUl size={12} style={{ color: justAddedToPlayNext ? '#88ff88' : (currentGameInPlayNext ? '#88aa88' : '#888'), flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: justAddedToPlayNext ? '#88ff88' : (currentGameInPlayNext ? '#88aa88' : '#aaa'), whiteSpace: 'nowrap' }}>
                        {justAddedToPlayNext ? 'Added!' : (currentGameInPlayNext ? 'Remove' : 'Play Next')}
                      </span>
                    </Focusable>
                    <Focusable
                      onActivate={handleExclude}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '10px 8px',
                        backgroundColor: confirmingExclude ? '#ff666644' : '#ff666622',
                        borderRadius: 8,
                        border: '2px solid transparent',
                        cursor: 'pointer'
                      }}
                      onFocus={(e: any) => e.target.style.borderColor = 'white'}
                      onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                      <FaBan size={12} style={{ color: '#ff6666', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#ff6666', whiteSpace: 'nowrap' }}>
                        {confirmingExclude ? 'Tap to confirm' : 'Never Show'}
                      </span>
                    </Focusable>
                  </Focusable>
                </PanelSectionRow>
              </>
            )}
          </PanelSection>

          {/* Previously Recommended Games */}
          {currentHistory.length > 0 && (
            <PanelSection title={`Previously Suggested (${currentHistory.length})`}>
              {currentHistory.slice(0, 5).map((entry) => (
                <PanelSectionRow key={`${entry.appid}-${entry.timestamp}`}>
                  <Focusable
                    flow-children="row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      boxSizing: 'border-box',
                      maxWidth: '100%'
                    }}
                  >
                    <Focusable
                      onActivate={() => {
                        Navigation.NavigateToLibraryTab();
                        Navigation.Navigate(`/library/app/${entry.appid}`);
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        backgroundColor: '#ffffff11',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        minWidth: 0
                      }}
                      onFocus={(e: any) => e.target.style.borderColor = 'white'}
                      onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                      <img
                        src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${entry.is_non_steam && entry.matched_appid ? entry.matched_appid : entry.appid}/capsule_184x69.jpg`}
                        alt=""
                        style={{ width: 46, height: 17, borderRadius: 2, objectFit: 'cover' }}
                        onError={(e: any) => e.target.style.display = 'none'}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.name}
                        </div>
                      </div>
                      <FaChevronRight size={10} style={{ color: '#666', flexShrink: 0 }} />
                    </Focusable>
                    <Focusable
                      onActivate={() => handleDeleteHistory(activeTab, entry.appid)}
                      onClick={() => handleDeleteHistory(activeTab, entry.appid)}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#ff666622',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        color: '#ff6666'
                      }}
                      onFocus={(e: any) => e.target.style.borderColor = 'white'}
                      onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                      <FaTrash size={12} />
                    </Focusable>
                  </Focusable>
                </PanelSectionRow>
              ))}
              <PanelSectionRow>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Focusable
                    onActivate={() => navigateToHistory({ initialMode: activeTab })}
                    onClick={() => navigateToHistory({ initialMode: activeTab })}
                    style={{
                      textAlign: 'center',
                      padding: '8px 24px',
                      backgroundColor: '#ffffff11',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: '2px solid transparent',
                      fontSize: 11,
                      width: '100%',
                      color: '#fff'
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                  >
                    View All History
                  </Focusable>
                </div>
              </PanelSectionRow>
            </PanelSection>
          )}
        </>
      )}
    </div>
  );
}
