import {
    ButtonItem,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    ProgressBar,
    Spinner,
    TextField,
} from "@decky/ui";
import { routerHook, call, toaster } from "@decky/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { FaGamepad, FaCheck, FaSync, FaTrash, FaChevronRight, FaExclamationTriangle, FaLink, FaEdit, FaSave, FaTimes } from "react-icons/fa";
import { Game, NonSteamGamesInfo } from "../types";

export const NON_STEAM_ROUTE = '/suggestme/non-steam';

interface NonSteamProgress {
    current: number;
    total: number;
    name: string;
}

const GameItem = ({ 
    game, 
    onResync, 
    onRemove,
    onUpdateSearchTerm,
    isSyncing 
}: { 
    game: Game; 
    onResync: () => void; 
    onRemove: () => void;
    onUpdateSearchTerm: (newTerm: string) => Promise<void>;
    isSyncing: boolean;
}) => {
    const [focused, setFocused] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(game.name || game.original_name);
    const [saving, setSaving] = useState(false);
    const isMatched = game.match_status === 'matched';

    const handleSaveEdit = async () => {
        if (!editValue.trim() || editValue === game.original_name) {
            setEditing(false);
            return;
        }
        setSaving(true);
        await onUpdateSearchTerm(editValue.trim());
        setSaving(false);
        setEditing(false);
    };

    const handleCancelEdit = () => {
        setEditValue(game.name || game.original_name);
        setEditing(false);
    };

    if (editing) {
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
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>
                        Search term for: {game.original_name}
                    </div>
                    <TextField
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        disabled={saving}
                    />
                </div>
                <Focusable
                    onActivate={handleSaveEdit}
                    onClick={handleSaveEdit}
                    style={{
                        padding: '10px',
                        backgroundColor: '#88ff8822',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        color: '#88ff88',
                        opacity: saving ? 0.5 : 1
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    {saving ? <Spinner style={{ width: 12, height: 12 }} /> : <FaSave size={12} />}
                </Focusable>
                <Focusable
                    onActivate={handleCancelEdit}
                    onClick={handleCancelEdit}
                    style={{
                        padding: '10px',
                        backgroundColor: '#ff666622',
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
            </Focusable>
        );
    }
    
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
                    if (game.matched_appid) {
                        Navigation.NavigateToLibraryTab();
                        Navigation.Navigate(`/library/app/${game.matched_appid}`);
                    }
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
                    cursor: game.matched_appid ? 'pointer' : 'default',
                    minWidth: 0
                }}
            >
                {game.matched_appid && (
                    <img
                        src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.matched_appid}/capsule_184x69.jpg`}
                        alt=""
                        style={{ width: 46, height: 17, borderRadius: 2, objectFit: 'cover' }}
                        onError={(e: any) => e.target.style.display = 'none'}
                    />
                )}
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
                        {game.original_name || game.name}
                        {isMatched ? (
                            <FaCheck size={10} style={{ color: '#88ff88', flexShrink: 0 }} />
                        ) : (
                            <FaExclamationTriangle size={10} style={{ color: '#ffaa00', flexShrink: 0 }} />
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: '#888' }}>
                        {isMatched ? (
                            <span style={{ color: '#88aa88' }}>
                                <FaLink size={8} style={{ marginRight: 4 }} />
                                Matched to Steam Store
                            </span>
                        ) : (
                            <span style={{ color: '#aa8888' }}>No Steam match found</span>
                        )}
                    </div>
                    {game.genres.length > 0 && (
                        <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
                            {game.genres.slice(0, 3).join(' • ')}
                        </div>
                    )}
                </div>
                {game.matched_appid && (
                    <FaChevronRight size={10} style={{ color: '#666', flexShrink: 0 }} />
                )}
            </Focusable>

            <Focusable
                onActivate={() => setEditing(true)}
                onClick={() => setEditing(true)}
                style={{
                    padding: '10px',
                    backgroundColor: '#ffaa0022',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    color: '#ffaa00'
                }}
                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                <FaEdit size={12} />
            </Focusable>
            
            <Focusable
                onActivate={onResync}
                onClick={onResync}
                style={{
                    padding: '10px',
                    backgroundColor: '#4488aa22',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    color: '#4488aa',
                    opacity: isSyncing ? 0.5 : 1
                }}
                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                {isSyncing ? <Spinner style={{ width: 12, height: 12 }} /> : <FaSync size={12} />}
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
                    color: '#ff6666'
                }}
                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                <FaTrash size={12} />
            </Focusable>
        </Focusable>
    );
};

export const NonSteamGamesPage = () => {
    const [info, setInfo] = useState<NonSteamGamesInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncingGame, setSyncingGame] = useState<string | null>(null);
    const [progress, setProgress] = useState<NonSteamProgress | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadInfo = useCallback(async () => {
        try {
            const result = await call<[], NonSteamGamesInfo>("get_non_steam_games");
            setInfo(result);
        } catch (e) {
            console.error("[SuggestMe] Failed to load non-steam games:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInfo();
    }, [loadInfo]);

    const handleSyncAll = async () => {
        setSyncing(true);
        setProgress(null);
        try {
            const result = await call<[], { success: boolean; count: number; detected: number }>("sync_non_steam_games");
            await loadInfo();
            if (result && result.count === 0) {
                toaster.toast({
                    title: "Non-Steam Games",
                    body: "No new games found. Your library is up to date.",
                    duration: 3000,
                });
            } else if (result && result.count > 0) {
                toaster.toast({
                    title: "Non-Steam Games",
                    body: `${result.count} new games added`,
                    duration: 3000,
                });
            }
        } catch (e) {
            console.error("[SuggestMe] Failed to sync non-steam games:", e);
        } finally {
            setSyncing(false);
            setProgress(null);
        }
    };

    const handleResync = async (originalName: string) => {
        setSyncingGame(originalName);
        try {
            await call<[string], any>("resync_non_steam_game", originalName);
            await loadInfo();
        } catch (e) {
            console.error("[SuggestMe] Failed to resync game:", e);
        } finally {
            setSyncingGame(null);
        }
    };

    const handleRemove = async (originalName: string) => {
        try {
            await call<[string], any>("remove_non_steam_game", originalName);
            await loadInfo();
        } catch (e) {
            console.error("[SuggestMe] Failed to remove game:", e);
        }
    };

    const handleUpdateSearchTerm = async (originalName: string, newTerm: string) => {
        setSyncingGame(originalName);
        try {
            const result = await call<[string, string], { success: boolean; error?: string }>(
                "update_non_steam_search_term", 
                originalName, 
                newTerm
            );
            if (result.success) {
                toaster.toast({
                    title: "Game Updated",
                    body: `Successfully matched "${originalName}" to Steam`,
                    duration: 3000,
                });
                await loadInfo();
            } else {
                toaster.toast({
                    title: "Match Failed",
                    body: result.error || "Could not find a match",
                    duration: 3000,
                });
            }
        } catch (e) {
            console.error("[SuggestMe] Failed to update search term:", e);
        } finally {
            setSyncingGame(null);
        }
    };

    if (loading) {
        return null;
    }

    const matchedGames = (info?.games.filter(g => g.match_status === 'matched') || []).sort((a, b) => (a.original_name || a.name).localeCompare(b.original_name || b.name));
    const unmatchedGames = (info?.games.filter(g => g.match_status !== 'matched') || []).sort((a, b) => (a.original_name || a.name).localeCompare(b.original_name || b.name));

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
            <PanelSection title="Non-Steam Games">
                <PanelSectionRow>
                    <Focusable 
                        onActivate={() => {}}
                        onFocus={(e: any) => {
                            e.target.style.backgroundColor = '#4488aa33';
                            e.target.style.border = '2px solid white';
                        }}
                        onBlur={(e: any) => {
                            e.target.style.backgroundColor = '#ffffff08';
                            e.target.style.border = '2px solid transparent';
                        }}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-around',
                            padding: '12px',
                            backgroundColor: '#ffffff08',
                            borderRadius: 12,
                            marginBottom: 16,
                            border: '2px solid transparent',
                            transition: 'all 0.1s ease-in-out',
                            width: '100%'
                        }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: '#4488aa' }}>
                                {info?.total || 0}
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: '#88ff88' }}>
                                {info?.matched || 0}
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>Matched</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: '#ffaa00' }}>
                                {info?.unmatched || 0}
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>Unmatched</div>
                        </div>
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                        Non-Steam games are matched to their Steam Store counterparts to fetch metadata (genres, tags). 
                        Matched games can be filtered and suggested just like regular Steam games.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleSyncAll}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <>
                                <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                                Scanning for new games...
                            </>
                        ) : (
                            <>
                                <FaSync style={{ marginRight: 8 }} />
                                Scan for Non-Steam Games
                            </>
                        )}
                    </ButtonItem>
                </PanelSectionRow>

                {syncing && progress && (
                    <PanelSectionRow>
                        <div style={{ width: '100%', padding: '8px 0' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                                Processing: {progress.name}
                            </div>
                            <ProgressBar nProgress={(progress.current / progress.total) * 100} />
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            {matchedGames.length > 0 && (
                <PanelSection title={`Matched (${matchedGames.length})`}>
                    {matchedGames.map(game => (
                        <GameItem
                            key={`${game.original_name}-${game.match_status}`}
                            game={game}
                            onResync={() => handleResync(game.original_name)}
                            onRemove={() => handleRemove(game.original_name)}
                            onUpdateSearchTerm={(newTerm) => handleUpdateSearchTerm(game.original_name, newTerm)}
                            isSyncing={syncingGame === game.original_name}
                        />
                    ))}
                </PanelSection>
            )}

            {unmatchedGames.length > 0 && (
                <PanelSection title={`Unmatched (${unmatchedGames.length})`}>
                    <PanelSectionRow>
                        <div style={{ fontSize: 11, color: '#aa8888', marginBottom: 8 }}>
                            These games couldn't be matched to Steam. They won't have genre/tag data for filtering.
                        </div>
                    </PanelSectionRow>
                    {unmatchedGames.map(game => (
                        <GameItem
                            key={`${game.original_name}-${game.match_status}`}
                            game={game}
                            onResync={() => handleResync(game.original_name)}
                            onRemove={() => handleRemove(game.original_name)}
                            onUpdateSearchTerm={(newTerm) => handleUpdateSearchTerm(game.original_name, newTerm)}
                            isSyncing={syncingGame === game.original_name}
                        />
                    ))}
                </PanelSection>
            )}

            {info?.total === 0 && (
                <PanelSection>
                    <PanelSectionRow>
                        <Focusable style={{
                            textAlign: 'center',
                            padding: '24px',
                            color: '#888'
                        }}>
                            <FaGamepad size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <div style={{ fontSize: 13 }}>No non-Steam games detected</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                Add games via Steam's "Add a Non-Steam Game" feature
                            </div>
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}

            {(matchedGames.length > 3 || unmatchedGames.length > 3) && (
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

export function registerNonSteamRoute() {
    routerHook.addRoute(NON_STEAM_ROUTE, () => <NonSteamGamesPage />);
}

export function unregisterNonSteamRoute() {
    routerHook.removeRoute(NON_STEAM_ROUTE);
}

export function navigateToNonSteamGames() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(NON_STEAM_ROUTE);
}
