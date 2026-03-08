import {
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
} from "@decky/ui";
import { routerHook, call } from "@decky/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { FaTrash, FaChevronRight, FaHistory, FaStore, FaFilter, FaListUl, FaBan } from "react-icons/fa";
import { HistoryEntry, SuggestMode, MODE_LABELS, SuggestFilters, filtersEqual, Game } from "../types";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { getFilterSummary, hasActiveFilters } from "./FiltersModal";
import { logger } from "../utils/logger";

export const HISTORY_ROUTE = '/suggestme/history';

const HistoryItem = ({ 
    entry, 
    onRemove,
    onRestoreFilters,
    onAddToPlayNext,
    onRemoveFromPlayNext,
    onExclude,
    isInPlayNext,
    isExcluded,
    dateFormat = 'US'
}: { 
    entry: HistoryEntry; 
    onRemove: () => void;
    onRestoreFilters: () => void;
    onAddToPlayNext: () => void;
    onRemoveFromPlayNext: () => void;
    onExclude: () => void;
    isInPlayNext: boolean;
    isExcluded: boolean;
    dateFormat?: 'US' | 'EU' | 'ISO';
}) => {
    const [focused, setFocused] = useState(false);
    const [confirmingExclude, setConfirmingExclude] = useState(false);
    const [justAdded, setJustAdded] = useState(false);
    const effectiveAppId = entry.appid;

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        
        switch (dateFormat) {
            case 'EU': return `${dd}/${mm}/${yyyy}`;
            case 'ISO': return `${yyyy}-${mm}-${dd}`;
            case 'US':
            default: return `${mm}/${dd}/${yyyy}`;
        }
    };

    const handlePlayNext = () => {
        if (isInPlayNext && !justAdded) {
            onRemoveFromPlayNext();
        } else if (!isInPlayNext) {
            onAddToPlayNext();
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 2000);
        }
    };

    const handleExclude = () => {
        if (isExcluded) return;
        if (!confirmingExclude) {
            setConfirmingExclude(true);
            return;
        }
        onExclude();
        setConfirmingExclude(false);
    };

    const playNextColor = justAdded ? '#88ff88' : (isInPlayNext ? '#88aa88' : '#888');
    const playNextBg = justAdded ? '#88ff8833' : (isInPlayNext ? '#88aa8833' : '#ffffff11');
    const playNextLabel = justAdded ? 'Added!' : (isInPlayNext ? 'Remove' : 'Play Next');

    const excludeColor = '#ff6666';
    const excludeBg = confirmingExclude ? '#ff666644' : (isExcluded ? '#ff666633' : '#ff666622');
    const excludeLabel = isExcluded ? 'Excluded' : (confirmingExclude ? 'Confirm?' : 'Never show');

    return (
        <div style={{ marginBottom: 8 }}>
            {/* Game info row */}
            <Focusable
                onActivate={() => {
                    Navigation.NavigateToLibraryTab();
                    Navigation.Navigate(`/library/app/${effectiveAppId}`);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    backgroundColor: focused ? '#4488aa' : '#ffffff11',
                    borderRadius: '8px 8px 0 0',
                    border: focused ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                    minWidth: 0
                }}
            >
                <img
                    src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${effectiveAppId}/capsule_184x69.jpg`}
                    alt=""
                    style={{ width: 46, height: 17, borderRadius: 2, objectFit: 'cover' }}
                    onError={(e: any) => e.target.style.display = 'none'}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                        fontSize: 12, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        {entry.name}
                        {entry.is_non_steam && (
                            <span style={{ fontSize: 9, color: '#6688aa' }}>(Non-Steam)</span>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: '#888' }}>
                        {formatDate(entry.timestamp)} • {MODE_LABELS[entry.mode as SuggestMode] || entry.mode}
                    </div>
                    {entry.filters && hasActiveFilters(entry.filters as SuggestFilters) && (
                        <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FaFilter size={8} style={{ opacity: 0.7, flexShrink: 0 }} />
                                {entry.preset_name && (
                                    <span style={{ color: '#88aa44', fontWeight: 600 }}>{entry.preset_name}:</span>
                                )}
                            </div>
                            <div style={{ 
                                marginTop: 2, 
                                marginLeft: 12, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                opacity: 0.8
                            }}>
                                {getFilterSummary(entry.filters as SuggestFilters)}
                            </div>
                        </div>
                    )}
                </div>
                <FaChevronRight size={10} style={{ color: '#666', flexShrink: 0 }} />
            </Focusable>

            {/* Action buttons row */}
            <Focusable
                flow-children="row"
                style={{
                    display: 'flex',
                    gap: 2,
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                }}
            >
                <Focusable
                    onActivate={handlePlayNext}
                    style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2,
                        padding: '6px 4px',
                        backgroundColor: playNextBg,
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        transition: 'background-color 0.15s',
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    <FaListUl size={11} style={{ color: playNextColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 8, color: playNextColor, whiteSpace: 'nowrap' }}>{playNextLabel}</span>
                </Focusable>

                <Focusable
                    onActivate={handleExclude}
                    style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2,
                        padding: '6px 4px',
                        backgroundColor: excludeBg,
                        cursor: isExcluded ? 'default' : 'pointer',
                        border: '2px solid transparent',
                        opacity: isExcluded ? 0.5 : 1,
                        transition: 'background-color 0.15s',
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    <FaBan size={11} style={{ color: excludeColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 8, color: excludeColor, whiteSpace: 'nowrap' }}>{excludeLabel}</span>
                </Focusable>

                {entry.filters && hasActiveFilters(entry.filters as SuggestFilters) && (
                    <Focusable
                        onActivate={onRestoreFilters}
                        style={{
                            flex: 1,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 2,
                            padding: '6px 4px',
                            backgroundColor: '#88aa4411',
                            cursor: 'pointer',
                            border: '2px solid transparent',
                            transition: 'background-color 0.15s',
                        }}
                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                        <FaFilter size={10} style={{ color: '#88aa44' }} />
                        <span style={{ fontSize: 8, color: '#88aa44', whiteSpace: 'nowrap' }}>Restore</span>
                    </Focusable>
                )}

                <Focusable
                    onActivate={() => {
                        Navigation.NavigateToExternalWeb(`https://store.steampowered.com/app/${effectiveAppId}`);
                    }}
                    style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2,
                        padding: '6px 4px',
                        backgroundColor: '#4488aa11',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        transition: 'background-color 0.15s',
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    <FaStore size={10} style={{ color: '#4488aa' }} />
                    <span style={{ fontSize: 8, color: '#4488aa', whiteSpace: 'nowrap' }}>Store</span>
                </Focusable>

                <Focusable
                    onActivate={onRemove}
                    style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2,
                        padding: '6px 4px',
                        backgroundColor: '#ffffff08',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        transition: 'background-color 0.15s',
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    <FaTrash size={10} style={{ color: '#666' }} />
                    <span style={{ fontSize: 8, color: '#666', whiteSpace: 'nowrap' }}>Remove</span>
                </Focusable>
            </Focusable>
        </div>
    );
};

export const HistoryPage = () => {
    const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
    const [activeTab, setActiveTab] = useState<SuggestMode | 'all'>('all');
    const [dateFormat, setDateFormat] = useState<'US' | 'EU' | 'ISO'>('US');
    const scrollRef = useRef<HTMLDivElement>(null);

    const { addGame: addToPlayNext, removeGame: removeFromPlayNext, isInList: isInPlayNext } = usePlayNext();
    const { excludeGame, isExcluded } = useExcludedGames();

    const loadConfig = useCallback(async () => {
        try {
            const result = await call<[], any>("get_config");
            if (result && result.date_format) {
                setDateFormat(result.date_format);
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to load config:", e);
        }
    }, []);

    const loadList = useCallback(async () => {
        try {
            const limit = 100;
            const result = await call<[number], HistoryEntry[]>("get_history", limit);
            setHistoryItems(result || []);
        } catch (e) {
            logger.error("[SuggestMe] Failed to load history:", e);
        }
    }, []);

    useEffect(() => {
        loadConfig();
        loadList();
    }, [loadConfig, loadList]);

    // Parse URL to get initial mode if passed
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const initialMode = urlParams.get('mode') as SuggestMode;
        if (initialMode && ['luck', 'guided', 'intelligent', 'fresh_air'].includes(initialMode)) {
            setActiveTab(initialMode);
        }
    }, []);

    const filteredItems = activeTab === 'all' 
        ? historyItems 
        : historyItems.filter(item => item.mode === activeTab);

    const handleRemove = async (mode: string, appid: number) => {
        try {
            await call<[string, number], boolean>("delete_history_entry", mode, appid);
            await loadList();
        } catch (e) {
            logger.error("[SuggestMe] Failed to remove game from history:", e);
        }
    };

    const handleClearAll = async () => {
        try {
            if (activeTab === 'all') {
                await call<[], { success: boolean }>("clear_history");
            } else {
                await call<[string], { success: boolean }>("clear_mode_history", activeTab);
            }
            await loadList();
        } catch (e) {
            logger.error("[SuggestMe] Failed to clear history:", e);
        }
    };

    const handleRestoreFilters = async (filters: SuggestFilters | undefined) => {
        if (!filters) return;
        try {
            await call<[SuggestFilters], { success: boolean }>("save_default_filters", filters);
            
            // Check if this filter combination matches any existing preset
            const presetsResult = await call<[], any>("get_filter_presets");
            if (presetsResult && presetsResult.presets) {
                let matchingIndex = -1;
                for (let i = 0; i < presetsResult.presets.length; i++) {
                    const preset = presetsResult.presets[i];
                    if (preset && filtersEqual(filters, preset.filters)) {
                        matchingIndex = i;
                        break;
                    }
                }
                
                if (matchingIndex !== -1) {
                    await call<[number], { success: boolean }>("set_active_preset", matchingIndex);
                } else {
                    await call<[null], { success: boolean }>("set_active_preset", null);
                }
            }

            Navigation.OpenQuickAccessMenu();
        } catch (e) {
            logger.error("[SuggestMe] Failed to restore filters:", e);
        }
    };

    return (
        <div ref={scrollRef} style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: '#0e141b',
            padding: '16px 24px 80px 24px',
            maxHeight: 'calc(100vh - 60px)',
            overflowY: 'auto',
            //boxSizing: 'border-box'
        }}>
            <Focusable 
                onActivate={() => {}}
                onFocus={(e: any) => (e.target.style.borderColor = "transparent")}
                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                style={{ height: 80, width: '100%' }}
            >{null}</Focusable>
            <PanelSection title="Suggestion History">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                        Games that have been suggested to you in the past.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <Focusable
                        onActivate={handleClearAll}
                        onClick={handleClearAll}
                        style={{
                            textAlign: 'center',
                            padding: '10px',
                            backgroundColor: filteredItems.length === 0 ? '#ffffff11' : '#ff666622',
                            borderRadius: 8,
                            cursor: filteredItems.length === 0 ? 'default' : 'pointer',
                            border: '2px solid transparent',
                            color: filteredItems.length === 0 ? '#888' : '#ff6666',
                            opacity: filteredItems.length === 0 ? 0.5 : 1
                        }}
                        onFocus={(e: any) => filteredItems.length > 0 && (e.target.style.borderColor = 'white')}
                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <FaTrash size={12} />
                            <span>Clear {activeTab === 'all' ? 'All' : MODE_LABELS[activeTab]} History</span>
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {/* Mode Tabs */}
            <PanelSectionRow>
                <Focusable
                    flow-children="row"
                    style={{
                        display: 'flex',
                        gap: 8,
                        marginBottom: 16,
                        overflowX: 'auto',
                        paddingBottom: 4
                    }}
                >
                    {(['all', 'luck', 'guided', 'intelligent', 'fresh_air'] as const).map((mode) => (
                        <Focusable
                            key={mode}
                            onActivate={() => setActiveTab(mode)}
                            onClick={() => setActiveTab(mode)}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: activeTab === mode ? '#4488aa' : '#ffffff11',
                                color: activeTab === mode ? '#ffffff' : '#aaaaaa',
                                borderRadius: 8,
                                fontSize: 12,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                border: '2px solid transparent'
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = 'white'}
                            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                        >
                            {mode === 'all' ? 'All Modes' : MODE_LABELS[mode as SuggestMode]}
                        </Focusable>
                    ))}
                </Focusable>
            </PanelSectionRow>

            {filteredItems.length > 0 && (
                <PanelSection title={`Previously Suggested (${filteredItems.length})`}>
                    {filteredItems.map(item => (
                        <HistoryItem
                            key={`${item.mode}-${item.appid}-${item.timestamp}`}
                            entry={item}
                            onRemove={() => handleRemove(item.mode, item.appid)}
                            onRestoreFilters={() => handleRestoreFilters(item.filters as SuggestFilters)}
                            onAddToPlayNext={() => addToPlayNext({
                                appid: item.appid,
                                name: item.name,
                                is_non_steam: item.is_non_steam || false,
                                matched_appid: item.matched_appid,
                                playtime_forever: 0,
                            } as Game)}
                            onRemoveFromPlayNext={() => removeFromPlayNext(item.appid)}
                            onExclude={() => excludeGame({
                                appid: item.appid,
                                name: item.name,
                                is_non_steam: item.is_non_steam || false,
                                matched_appid: item.matched_appid,
                                playtime_forever: 0,
                                deck_status: '',
                            } as Game)}
                            isInPlayNext={isInPlayNext(item.appid)}
                            isExcluded={isExcluded(item.appid)}
                            dateFormat={dateFormat}
                        />
                    ))}
                </PanelSection>
            )}

            {filteredItems.length === 0 && (
                <PanelSection>
                    <PanelSectionRow>
                        <Focusable 
                            onActivate={() => {}}
                            style={{
                                padding: '24px',
                                textAlign: 'center',
                                backgroundColor: '#ffffff05',
                                borderRadius: 8,
                                color: '#888',
                                fontSize: 13,
                                fontStyle: 'italic',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 12
                            }}
                        >
                            <FaHistory size={24} style={{ opacity: 0.5 }} />
                            <div>No history yet for {activeTab === 'all' ? 'any mode' : MODE_LABELS[activeTab]}.</div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>
                                Games you get suggested {activeTab === 'all' ? '' : 'in this mode '}will appear here.
                            </div>
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}

            {historyItems.length > 5 && (
                <PanelSection>
                    <PanelSectionRow>
                        <Focusable
                            onActivate={() => { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            onClick={() => { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            style={{
                                textAlign: 'center',
                                padding: '10px',
                                backgroundColor: '#ffffff11',
                                borderRadius: 8,
                                cursor: 'pointer',
                                border: '2px solid transparent',
                                fontSize: 12,
                                color: '#888'
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = 'white'}
                            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                        >
                            ↑ Back to Top
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}
        </div>
    );
};

export function registerHistoryRoute() {
    routerHook.addRoute(HISTORY_ROUTE, () => <HistoryPage />);
}

export function unregisterHistoryRoute() {
    routerHook.removeRoute(HISTORY_ROUTE);
}

export const navigateToHistory = (props?: { initialMode?: SuggestMode }) => {
    Navigation.CloseSideMenus();
    setTimeout(() => {
        let route = HISTORY_ROUTE;
        if (props?.initialMode) {
            route += `?mode=${props.initialMode}`;
        }
        Navigation.Navigate(route);
    }, 100);
};
