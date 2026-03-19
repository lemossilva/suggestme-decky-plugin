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
import { hasActiveFilters } from "./FiltersModal";
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
    const effectiveAppId = entry.is_non_steam && entry.matched_appid ? entry.matched_appid : entry.appid;
    const canShowStore = !entry.is_non_steam || (entry.is_non_steam && entry.matched_appid);

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

    const excludeColor = '#ff6666';
    const excludeBg = confirmingExclude ? '#ff666644' : (isExcluded ? '#ff666633' : '#ff666622');

    const ActionButton = ({ onActivate, icon, label, bg, color, disabled, isLast }: {
        onActivate: (() => void) | undefined;
        icon: React.ReactNode;
        label: string;
        bg: string;
        color: string;
        disabled?: boolean;
        isLast?: boolean;
    }) => (
        <Focusable
            onActivate={disabled ? undefined : onActivate}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 6px',
                backgroundColor: bg,
                cursor: disabled ? 'default' : 'pointer',
                border: '2px solid transparent',
                opacity: disabled ? 0.3 : 1,
                borderRadius: isLast ? '0 6px 6px 0' : 0,
                minWidth: 32,
            }}
            onFocus={(e: any) => { if (!disabled) e.target.style.borderColor = 'white'; }}
            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
        >
            {icon}
            <span style={{ fontSize: 7, color, marginTop: 2, whiteSpace: 'nowrap' }}>{label}</span>
        </Focusable>
    );

    const hasFilters = entry.filters && hasActiveFilters(entry.filters as SuggestFilters);

    return (
        <Focusable
            flow-children="row"
            style={{
                display: 'flex',
                alignItems: 'stretch',
                marginBottom: 6,
                backgroundColor: '#ffffff11',
                borderRadius: 8,
                overflow: 'hidden',
            }}
        >
            {/* Left: Thumbnail + Game Info (clickable to navigate) */}
            <Focusable
                onActivate={() => {
                    Navigation.NavigateToLibraryTab();
                    Navigation.Navigate(`/library/app/${entry.appid}`);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    flex: 1,
                    minWidth: 0,
                    maxWidth: 'calc(100% - 180px)',
                    backgroundColor: focused ? '#4488aa' : 'transparent',
                    border: focused ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                    borderRadius: '6px 0 0 6px',
                }}
            >
                <img
                    src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${effectiveAppId}/capsule_184x69.jpg`}
                    alt=""
                    style={{ 
                        width: 40, 
                        height: 15, 
                        borderRadius: 2, 
                        objectFit: 'cover',
                        flexShrink: 0,
                        backgroundColor: '#333'
                    }}
                    onError={(e: any) => {
                        e.target.style.display = 'none';
                    }}
                />
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ 
                        fontSize: 10, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                    }}>
                        {entry.name}
                        {entry.is_non_steam && <span style={{ fontSize: 7, color: '#6688aa', marginLeft: 3 }}>(NS)</span>}
                    </div>
                    <div style={{ fontSize: 8, color: '#888', marginTop: 1 }}>
                        {formatDate(entry.timestamp)} • {MODE_LABELS[entry.mode as SuggestMode] || entry.mode}
                        {hasFilters && entry.preset_name && (
                            <span style={{ color: '#88aa44', marginLeft: 4 }}>
                                <FaFilter size={6} style={{ marginRight: 2 }} />
                                {entry.preset_name}
                            </span>
                        )}
                    </div>
                </div>
                <FaChevronRight size={8} style={{ color: '#555', flexShrink: 0 }} />
            </Focusable>

            {/* Right: Action buttons with labels */}
            <div style={{ display: 'flex', alignItems: 'stretch', borderLeft: '1px solid #ffffff11', flexShrink: 0 }}>
                <ActionButton
                    onActivate={handlePlayNext}
                    icon={<FaListUl size={10} style={{ color: playNextColor }} />}
                    label={isInPlayNext ? (justAdded ? "Added" : "Remove") : "Queue"}
                    bg={playNextBg}
                    color={playNextColor}
                />
                <ActionButton
                    onActivate={handleExclude}
                    icon={<FaBan size={10} style={{ color: excludeColor }} />}
                    label={isExcluded ? "Excluded" : (confirmingExclude ? "Confirm?" : "Exclude")}
                    bg={excludeBg}
                    color={excludeColor}
                    disabled={isExcluded}
                />
                <ActionButton
                    onActivate={onRestoreFilters}
                    icon={<FaFilter size={9} style={{ color: hasFilters ? '#88aa44' : '#666' }} />}
                    label="Filters"
                    bg={hasFilters ? '#88aa4411' : '#ffffff08'}
                    color={hasFilters ? '#88aa44' : '#666'}
                    disabled={!hasFilters}
                />
                <ActionButton
                    onActivate={() => window.open(`steam://store/${effectiveAppId}`, "_blank")}
                    icon={<FaStore size={9} style={{ color: canShowStore ? '#4488aa' : '#666' }} />}
                    label="Store"
                    bg={canShowStore ? '#4488aa11' : '#ffffff08'}
                    color={canShowStore ? '#4488aa' : '#666'}
                    disabled={!canShowStore}
                />
                <ActionButton
                    onActivate={onRemove}
                    icon={<FaTrash size={9} style={{ color: '#888' }} />}
                    label="Delete"
                    bg="#ffffff08"
                    color="#888"
                    isLast
                />
            </div>
        </Focusable>
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
