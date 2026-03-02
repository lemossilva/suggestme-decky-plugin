import {
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
} from "@decky/ui";
import { routerHook, call } from "@decky/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { FaTrash, FaChevronRight, FaHistory } from "react-icons/fa";
import { HistoryEntry, SuggestMode, MODE_LABELS } from "../types";

export const HISTORY_ROUTE = '/suggestme/history';

const HistoryItem = ({ 
    entry, 
    onRemove,
}: { 
    entry: HistoryEntry; 
    onRemove: () => void;
}) => {
    const [focused, setFocused] = useState(false);
    const effectiveAppId = entry.is_non_steam && entry.matched_appid ? entry.matched_appid : entry.appid;

    return (
        <Focusable
            flow-children="row"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8
            }}
        >
            <Focusable
                onActivate={() => {
                    Navigation.NavigateToLibraryTab();
                    Navigation.Navigate(`/library/app/${effectiveAppId}`);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    backgroundColor: focused ? '#4488aa' : '#ffffff11',
                    borderRadius: 8,
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
                        {new Date(entry.timestamp * 1000).toLocaleDateString()} • {MODE_LABELS[entry.mode as SuggestMode] || entry.mode}
                    </div>
                </div>
                <FaChevronRight size={10} style={{ color: '#666', flexShrink: 0 }} />
            </Focusable>

            <Focusable
                onActivate={onRemove}
                onClick={onRemove}
                style={{
                    padding: '10px',
                    backgroundColor: '#ff666622',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    color: '#ff6666',
                }}
                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                <FaTrash size={12} />
            </Focusable>
        </Focusable>
    );
};

export const HistoryPage = () => {
    const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
    const [activeTab, setActiveTab] = useState<SuggestMode | 'all'>('all');
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadList = useCallback(async () => {
        try {
            const limit = 100;
            const result = await call<[number], HistoryEntry[]>("get_history", limit);
            setHistoryItems(result || []);
        } catch (e) {
            console.error("[SuggestMe] Failed to load history:", e);
        }
    }, []);

    useEffect(() => {
        loadList();
    }, [loadList]);

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
            console.error("[SuggestMe] Failed to remove game from history:", e);
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
            console.error("[SuggestMe] Failed to clear history:", e);
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
            boxSizing: 'border-box'
        }}>
            <Focusable 
                onActivate={() => {}}
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
