import {
    ButtonItem,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    Spinner,
} from "@decky/ui";
import { routerHook, call, toaster } from "@decky/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { FaBan, FaTrash, FaSync, FaChevronRight } from "react-icons/fa";
import { ExcludedGame } from "../types";

export const EXCLUDED_GAMES_ROUTE = '/suggestme/excluded';

const GameItem = ({ 
    game, 
    onRemove,
    isRemoving
}: { 
    game: ExcludedGame; 
    onRemove: () => void;
    isRemoving: boolean;
}) => {
    const [focused, setFocused] = useState(false);
    const effectiveAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;

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
                        {game.name}
                        {game.is_non_steam && (
                            <span style={{ fontSize: 9, color: '#6688aa' }}>(Non-Steam)</span>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: '#888' }}>
                        {game.playtime_forever > 0 
                            ? `${Math.floor(game.playtime_forever / 60)}h played`
                            : 'Never played'}
                    </div>
                </div>
                <FaChevronRight size={10} style={{ color: '#666', flexShrink: 0 }} />
            </Focusable>

            <Focusable
                onActivate={onRemove}
                onClick={onRemove}
                style={{
                    padding: '10px',
                    backgroundColor: '#88ff8822',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    color: '#88ff88',
                    opacity: isRemoving ? 0.5 : 1
                }}
                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                {isRemoving ? <Spinner style={{ width: 12, height: 12 }} /> : <FaTrash size={12} />}
            </Focusable>
        </Focusable>
    );
};

export const ExcludedGamesPage = () => {
    const [games, setGames] = useState<ExcludedGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingAppid, setRemovingAppid] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [clearing, setClearing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadList = useCallback(async () => {
        try {
            const result = await call<[], { games: ExcludedGame[]; count: number }>("get_excluded_games");
            setGames(result.games || []);
        } catch (e) {
            console.error("[SuggestMe] Failed to load excluded games:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const handleRemove = async (appid: number) => {
        setRemovingAppid(appid);
        try {
            await call<[number], { success: boolean }>("remove_from_excluded", appid);
            await loadList();
            toaster.toast({
                title: "Excluded Games",
                body: "Game restored to suggestions",
                duration: 2000,
            });
        } catch (e) {
            console.error("[SuggestMe] Failed to remove game:", e);
        } finally {
            setRemovingAppid(null);
        }
    };

    const handleClearAll = async () => {
        setClearing(true);
        try {
            await call<[], { success: boolean }>("clear_excluded_games");
            setGames([]);
            toaster.toast({
                title: "Excluded Games",
                body: "All games restored to suggestions",
                duration: 2000,
            });
        } catch (e) {
            console.error("[SuggestMe] Failed to clear list:", e);
        } finally {
            setClearing(false);
        }
    };

    const handleSyncToCollection = async () => {
        setSyncing(true);
        try {
            const collectionName = "SuggestMe Excluded";
            const appids = games.map(g => g.appid);
            
            if (appids.length === 0) {
                toaster.toast({
                    title: "Sync Failed",
                    body: "No games to sync",
                    duration: 2000,
                });
                setSyncing(false);
                return;
            }

            const collectionStore = (window as any).collectionStore;
            const appStore = (window as any).appStore;
            
            if (!collectionStore || !appStore) {
                toaster.toast({
                    title: "Sync Failed",
                    body: "Steam stores not available",
                    duration: 3000,
                });
                setSyncing(false);
                return;
            }

            const overviews = appids
                .map(id => appStore.GetAppOverviewByAppID(id))
                .filter((app: any) => app != null);

            if (overviews.length === 0) {
                toaster.toast({
                    title: "Sync Failed",
                    body: "No valid apps found",
                    duration: 3000,
                });
                setSyncing(false);
                return;
            }

            let collection = collectionStore.userCollections?.find(
                (c: any) => (c.displayName || c.strName) === collectionName
            );

            if (!collection) {
                collection = collectionStore.NewUnsavedCollection(collectionName, undefined, []);
                if (collection) {
                    await collection.Save();
                }
            }

            if (collection && collection.AsDragDropCollection) {
                const currentCollectionAppIds: number[] = Array.from(collection.apps?.keys?.() || []);
                const listAppIds = new Set(appids);
                
                const toRemove = currentCollectionAppIds.filter(id => !listAppIds.has(id));
                if (toRemove.length > 0) {
                    const removeOverviews = toRemove
                        .map(id => appStore.GetAppOverviewByAppID(id))
                        .filter((app: any) => app != null);
                    if (removeOverviews.length > 0) {
                        collection.AsDragDropCollection().RemoveApps(removeOverviews);
                    }
                }

                collection.AsDragDropCollection().AddApps(overviews);
                await collection.Save();
                
                const removed = toRemove.length;
                const added = overviews.length;
                let msg = `Collection synced with ${added} game${added !== 1 ? 's' : ''}`;
                if (removed > 0) {
                    msg += `, ${removed} removed`;
                }
                toaster.toast({
                    title: "Excluded Games",
                    body: msg,
                    duration: 3000,
                });
            } else {
                toaster.toast({
                    title: "Sync Failed",
                    body: "Could not create collection",
                    duration: 3000,
                });
            }
        } catch (e) {
            console.error("[SuggestMe] Failed to sync to collection:", e);
            toaster.toast({
                title: "Sync Failed",
                body: "An error occurred",
                duration: 3000,
            });
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#0e141b'
            }}>
                <Spinner />
            </div>
        );
    }

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
            <PanelSection title="Excluded Games">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                        Games you've excluded from suggestions. They won't appear in any suggestion mode.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleSyncToCollection}
                        disabled={syncing || games.length === 0}
                    >
                        {syncing ? (
                            <>
                                <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <FaSync style={{ marginRight: 8 }} />
                                Sync to Steam Collection
                            </>
                        )}
                    </ButtonItem>
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#666', padding: '4px 0' }}>
                        Creates a "SuggestMe Excluded" collection in your Steam Library.
                        Find it at: <span style={{ color: '#8bb9e0' }}>Library → Collections</span>
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleClearAll}
                        disabled={clearing || games.length === 0}
                    >
                        {clearing ? (
                            <>
                                <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                                Clearing...
                            </>
                        ) : (
                            <>
                                <FaTrash style={{ marginRight: 8 }} />
                                Restore All Games
                            </>
                        )}
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            {games.length > 0 && (
                <PanelSection title={`Excluded (${games.length})`}>
                    {games.map(game => (
                        <GameItem
                            key={game.appid}
                            game={game}
                            onRemove={() => handleRemove(game.appid)}
                            isRemoving={removingAppid === game.appid}
                        />
                    ))}
                </PanelSection>
            )}

            {games.length === 0 && (
                <PanelSection>
                    <PanelSectionRow>
                        <Focusable 
                            onActivate={() => {}}
                            style={{
                                textAlign: 'center',
                                padding: '24px',
                                color: '#888'
                            }}
                        >
                            <FaBan size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <div style={{ fontSize: 13 }}>No excluded games</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                Exclude games from suggestions using "Never Show"
                            </div>
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}

            {games.length > 3 && (
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

export function registerExcludedGamesRoute() {
    routerHook.addRoute(EXCLUDED_GAMES_ROUTE, () => <ExcludedGamesPage />);
}

export function unregisterExcludedGamesRoute() {
    routerHook.removeRoute(EXCLUDED_GAMES_ROUTE);
}

export function navigateToExcludedGames() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(EXCLUDED_GAMES_ROUTE);
}
