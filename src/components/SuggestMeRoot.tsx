import { useState, useRef, useEffect, useCallback } from "react";
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Spinner,
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
};

import { FaMagic, FaCog, FaDice, FaCompass, FaBrain, FaLeaf, FaFilter, FaTimes, FaTrash, FaChevronRight, FaGamepad, FaSteam } from "react-icons/fa";
import { call } from "@decky/api";
import { useSuggestMeConfig } from "../hooks/useSuggestMeConfig";
import { useLibraryStatus } from "../hooks/useLibraryStatus";
import { useSuggestion } from "../hooks/useSuggestion";
import { SuggestionCard } from "./SuggestionCard";
import { navigateToSettings } from "./SettingsModal";
import { navigateToFilters, getFilterSummary, hasActiveFilters } from "./FiltersModal";
import { navigateToNonSteamGames } from "./NonSteamGamesModal";
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

interface Tab {
  id: TabId;
  label: string;
  icon: JSX.Element;
}

const TABS: Tab[] = [
  { id: 'luck', label: 'Luck', icon: <FaDice size={12} /> },
  { id: 'guided', label: 'Guided', icon: <FaCompass size={12} /> },
  { id: 'intelligent', label: 'Smart', icon: <FaBrain size={12} /> },
  { id: 'fresh_air', label: 'Fresh', icon: <FaLeaf size={12} /> },
];

interface TabButtonProps {
  tab: Tab;
  active: boolean;
  onClick: () => void;
}

const TabButton = ({ tab, active, onClick }: TabButtonProps) => {
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
      {tab.icon}
      <span style={{ 
        fontSize: 10, 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        maxWidth: '100%',
        marginTop: 2
      }}>{tab.label}</span>
    </Focusable>
  );
};

export function SuggestMeRoot() {
  const { config, hasCredentials, isLoading: configLoading, setDefaultFilters } = useSuggestMeConfig();
  const { status, availableGenres, availableTags, availableCommunityTags } = useLibraryStatus();
  const { isLoading: suggestionLoading, requestSuggestion, clearCurrentSuggestion } =
    useSuggestion();

  const contentRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>(config.default_mode || "luck");
  const [filters, setFilters] = useState<SuggestFilters>(config.default_filters || DEFAULT_FILTERS);
  const [history, setHistory] = useState<Record<SuggestMode, HistoryEntry[]>>({
    luck: [],
    guided: [],
    intelligent: [],
    fresh_air: []
  });
  const [nonSteamInfo, setNonSteamInfo] = useState<NonSteamGamesInfo | null>(null);
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [suggestionsPerMode, setSuggestionsPerMode] = useState<Record<SuggestMode, SuggestionResult | null>>({
    luck: null,
    guided: null,
    intelligent: null,
    fresh_air: null
  });

  const filtersActive = hasActiveFilters(filters);
  const filterSummary = getFilterSummary(filters);
  const currentModeSuggestion = suggestionsPerMode[activeTab];
  const steamGamesCount = status.steam_games_count || 0;

  useEffect(() => {
    if (!configLoading && config.default_filters) {
      setFilters(config.default_filters);
    }
  }, [configLoading, config.default_filters]);

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
        setFilters(newFilters);
        await setDefaultFilters(newFilters);
        Navigation.OpenQuickAccessMenu();
      }
    });
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDefaultFilters(DEFAULT_FILTERS);
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

  const handleClearModeHistory = async () => {
    try {
      await call<[string], { success: boolean }>("clear_mode_history", activeTab);
      loadHistory();
    } catch (e) {
      console.error("[SuggestMe] Failed to clear mode history:", e);
    }
  };

  const currentHistory = history[activeTab] || [];

  if (configLoading) {
    return (
      <PanelSection>
        <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
          <Spinner />
        </div>
      </PanelSection>
    );
  }

  return (
    <div ref={contentRef}>
      {/* Header: Steam Count | Non-Steam Count | Settings */}
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
            onActivate={navigateToSettings}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 6,
              backgroundColor: steamGamesCount > 0 ? '#4488aa22' : '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: 'pointer',
              opacity: steamGamesCount > 0 ? 1 : 0.6,
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              e.target.style.backgroundColor = '#1a5a7a';
              e.target.style.borderColor = 'white';
            }}
            onBlur={(e: any) => {
              e.target.style.backgroundColor = steamGamesCount > 0 ? '#4488aa22' : '#ffffff08';
              e.target.style.borderColor = 'transparent';
            }}
          >
            <FaSteam size={14} style={{ color: steamGamesCount > 0 ? '#4488aa' : '#666666' }} />
            <span style={{ fontSize: 11, color: steamGamesCount > 0 ? '#4488aa' : '#666666', fontWeight: 500 }}>
              {steamGamesCount > 0 ? `${steamGamesCount} Steam` : 'No Games'}
            </span>
          </Focusable>

          {/* Non-Steam Games Count */}
          <Focusable
            onActivate={navigateToNonSteamGames}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 6,
              backgroundColor: (nonSteamInfo?.total || 0) > 0 
                ? (nonSteamInfo?.unmatched || 0) > 0 ? '#aa884422' : '#6688aa22'
                : '#ffffff08',
              borderRadius: 10,
              border: '2px solid transparent',
              cursor: 'pointer',
              opacity: (nonSteamInfo?.total || 0) > 0 ? 1 : 0.6,
              transition: 'all 0.1s ease-in-out'
            }}
            onFocus={(e: any) => {
              e.target.style.backgroundColor = '#1a5a7a';
              e.target.style.borderColor = 'white';
            }}
            onBlur={(e: any) => {
              const hasNonSteam = (nonSteamInfo?.total || 0) > 0;
              const hasUnmatched = (nonSteamInfo?.unmatched || 0) > 0;
              e.target.style.backgroundColor = hasNonSteam 
                ? (hasUnmatched ? '#aa884422' : '#6688aa22')
                : '#ffffff08';
              e.target.style.borderColor = 'transparent';
            }}
          >
            <FaGamepad size={14} style={{ 
              color: (nonSteamInfo?.total || 0) > 0 
                ? ((nonSteamInfo?.unmatched || 0) > 0 ? '#aa8844' : '#6688aa')
                : '#666666' 
            }} />
            <span style={{ 
              fontSize: 11, 
              color: (nonSteamInfo?.total || 0) > 0 
                ? ((nonSteamInfo?.unmatched || 0) > 0 ? '#aa8844' : '#6688aa')
                : '#666666',
              fontWeight: 500 
            }}>
              {(nonSteamInfo?.matched || 0) > 0 ? `${nonSteamInfo?.matched} Non-Steam` : 'Non-Steam'}
            </span>
          </Focusable>

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
          <PanelSection>
            <PanelSectionRow>
              <Focusable
                flow-children="row"
                style={{
                  display: 'flex',
                  gap: 4,
                  width: '100%',
                  padding: 4,
                  backgroundColor: '#ffffff11',
                  borderRadius: 12
                }}
              >
                {TABS.map(tab => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', padding: '4px 0' }}>
                {MODE_DESCRIPTIONS[activeTab]}
              </div>
            </PanelSectionRow>
          </PanelSection>

          {/* Filters Bar */}
          <div style={{ padding: '0 16px', marginBottom: 8 }}>
            <Focusable
              flow-children="row"
              style={{
                display: 'flex',
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
                    <div style={{ fontSize: 12, fontWeight: filtersActive ? 600 : 400 }}>Filters</div>
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
                      padding: '6px 10px',
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
            <div style={{ padding: '8px 0' }}>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={handleSuggest}
                  disabled={suggestionLoading || status.is_refreshing}
                >
                  {suggestionLoading ? (
                    <>
                      <Spinner style={{ marginRight: 8, width: 16, height: 16 }} />
                      Finding a game...
                    </>
                  ) : (
                    <>
                      <FaMagic style={{ marginRight: 8 }} />
                      Suggest a Game
                    </>
                  )}
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
              <SuggestionCard
                game={currentModeSuggestion.game}
                modeUsed={currentModeSuggestion.mode_used}
                candidatesCount={currentModeSuggestion.candidates_count}
                onReroll={handleReroll}
                onLaunch={handleLaunch}
                onClear={handleClearSuggestion}
                isLoading={suggestionLoading}
              />
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
                <Focusable
                  onActivate={handleClearModeHistory}
                  onClick={handleClearModeHistory}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: '8px',
                    backgroundColor: '#ff666611',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    fontSize: 11,
                    color: '#ff6666'
                  }}
                  onFocus={(e: any) => e.target.style.borderColor = 'white'}
                  onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                  <FaTrash size={10} style={{ marginRight: 6 }} />
                  Clear All History
                </Focusable>
              </PanelSectionRow>
            </PanelSection>
          )}
        </>
      )}
    </div>
  );
}
