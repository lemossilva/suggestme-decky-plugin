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
import { FaListUl, FaTrash, FaSync, FaChevronRight, FaStore, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { PlayNextEntry } from "../types";
import { logger } from "../utils/logger";

export const PLAY_NEXT_ROUTE = '/suggestme/play-next';

const GameItem = ({
    game,
    index,
    onRemove,
    onMoveUp,
    onMoveDown,
    isRemoving,
    isFirst,
    isLast
}: {
    game: PlayNextEntry;
    index: number;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isRemoving: boolean;
    isFirst: boolean;
    isLast: boolean;
}) => {
    const [focused, setFocused] = useState(false);
    const imageAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;
    const canShowStore = !game.is_non_steam || (game.is_non_steam && game.matched_appid);
    const storeAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;

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
            {/* Queue position number - LEFT side like Steam wishlist */}
            <div style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#4488aa33',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 'bold',
                color: '#4488aa',
                flexShrink: 0
            }}>
                {index + 1}
            </div>

            <Focusable
                onActivate={() => {
                    Navigation.NavigateToLibraryTab();
                    Navigation.Navigate(`/library/app/${game.appid}`);
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
                    src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${imageAppId}/capsule_184x69.jpg`}
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
                onActivate={isFirst ? undefined : onMoveUp}
                onClick={isFirst ? undefined : onMoveUp}
                data-move-up={game.appid}
                style={{
                    padding: '10px',
                    backgroundColor: '#ffffff11',
                    borderRadius: 8,
                    cursor: isFirst ? 'default' : 'pointer',
                    border: '2px solid transparent',
                    color: '#888',
                    opacity: isFirst ? 0.3 : 1
                }}
                onFocus={(e: any) => { if (!isFirst) e.target.style.borderColor = 'white'; }}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                <FaArrowUp size={12} />
            </Focusable>

            <Focusable
                onActivate={isLast ? undefined : onMoveDown}
                onClick={isLast ? undefined : onMoveDown}
                data-move-down={game.appid}
                style={{
                    padding: '10px',
                    backgroundColor: '#ffffff11',
                    borderRadius: 8,
                    cursor: isLast ? 'default' : 'pointer',
                    border: '2px solid transparent',
                    color: '#888',
                    opacity: isLast ? 0.3 : 1
                }}
                onFocus={(e: any) => { if (!isLast) e.target.style.borderColor = 'white'; }}
                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
            >
                <FaArrowDown size={12} />
            </Focusable>

            {canShowStore && (
                <Focusable
                    onActivate={() => {
                        window.open(`steam://store/${storeAppId}`, "_blank");
                    }}
                    onClick={() => {
                        window.open(`steam://store/${storeAppId}`, "_blank");
                    }}
                    style={{
                        padding: '10px',
                        backgroundColor: '#4488aa22',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        color: '#4488aa'
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    <FaStore size={12} />
                </Focusable>
            )}

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

export const PlayNextPage = () => {
    const [games, setGames] = useState<PlayNextEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingAppid, setRemovingAppid] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [clearing, setClearing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadList = useCallback(async () => {
        try {
            const result = await call<[], { games: PlayNextEntry[]; count: number }>("get_play_next_list");
            setGames(result.games || []);
        } catch (e) {
            logger.error("[SuggestMe] Failed to load play next list:", e);
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
            await call<[number], { success: boolean }>("remove_from_play_next", appid);
            await loadList();
        } catch (e) {
            logger.error("[SuggestMe] Failed to remove game:", e);
        } finally {
            setRemovingAppid(null);
        }
    };

    const handleReorder = async (appid: number, direction: 'up' | 'down') => {
        try {
            const currentIndex = games.findIndex(g => g.appid === appid);
            const result = await call<[number, string], { success: boolean; games?: PlayNextEntry[] }>("reorder_play_next", appid, direction);
            if (result.success && result.games) {
                setGames(result.games);
                
                // Focus management: focus the same button type at the new position
                const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
                const isAtTop = newIndex === 0;
                const isAtBottom = newIndex === result.games.length - 1;
                
                // Use setTimeout to allow React to re-render before focusing
                setTimeout(() => {
                    const targetAppid = result.games![newIndex]?.appid;
                    if (!targetAppid) return;
                    
                    // If we moved up and are now at top, focus down button instead
                    // If we moved down and are now at bottom, focus up button instead
                    let selector: string;
                    if (direction === 'up' && isAtTop) {
                        selector = `[data-move-down="${targetAppid}"]`;
                    } else if (direction === 'down' && isAtBottom) {
                        selector = `[data-move-up="${targetAppid}"]`;
                    } else {
                        selector = direction === 'up' 
                            ? `[data-move-up="${targetAppid}"]`
                            : `[data-move-down="${targetAppid}"]`;
                    }
                    
                    const element = document.querySelector(selector) as HTMLElement;
                    if (element) {
                        element.focus();
                    }
                }, 50);
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to reorder game:", e);
        }
    };

    const handleClearAll = async () => {
        setClearing(true);
        try {
            await call<[], { success: boolean }>("clear_play_next");
            setGames([]);
            toaster.toast({
                title: "SuggestMe • Play Next",
                body: "List cleared",
                duration: 2000,
            });
        } catch (e) {
            logger.error("[SuggestMe] Failed to clear list:", e);
        } finally {
            setClearing(false);
        }
    };

    const handleSyncToCollection = async () => {
        setSyncing(true);
        try {
            const collectionName = "Play Next";
            const appids = games.map(g => g.appid);

            if (appids.length === 0) {
                toaster.toast({
                    title: "SuggestMe • Sync Failed",
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
                    title: "SuggestMe • Sync Failed",
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
                    title: "SuggestMe • Sync Failed",
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
                    title: "SuggestMe • Play Next",
                    body: msg,
                    duration: 3000,
                });
            } else {
                toaster.toast({
                    title: "SuggestMe • Sync Failed",
                    body: "Could not create collection",
                    duration: 3000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to sync to collection:", e);
            toaster.toast({
                title: "SuggestMe • Sync Failed",
                body: "An error occurred",
                duration: 3000,
            });
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return null;
    }

    return (
        <div ref={scrollRef} onFocus={(e: any) => (e.target.style.borderColor = "transparent")}
            onBlur={(e: any) => (e.target.style.borderColor = "transparent")} style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#0e141b',
                padding: '16px 24px 80px 24px',
                maxHeight: 'calc(100vh - 60px)',
                overflowY: 'auto',
                boxSizing: 'border-box'
            }}>
            <Focusable
                onActivate={() => { }}
                style={{ height: 80, width: '100%' }}
            >{null}</Focusable>
            <PanelSection title="Play Next">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                        Games you've queued to play next. Add games from suggestions using the "Play Next" button.
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
                        Creates a "Play Next" collection in your Steam Library.
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
                                Clear Entire List
                            </>
                        )}
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            {games.length > 0 && (
                <PanelSection title={`Queue (${games.length})`}>
                    {games.map((game, index) => (
                        <GameItem
                            key={game.appid}
                            game={game}
                            index={index}
                            onRemove={() => handleRemove(game.appid)}
                            onMoveUp={() => handleReorder(game.appid, 'up')}
                            onMoveDown={() => handleReorder(game.appid, 'down')}
                            isRemoving={removingAppid === game.appid}
                            isFirst={index === 0}
                            isLast={index === games.length - 1}
                        />
                    ))}
                </PanelSection>
            )}

            {games.length === 0 && (
                <PanelSection>
                    <PanelSectionRow>
                        <Focusable
                            onActivate={() => { }}
                            style={{
                                textAlign: 'center',
                                padding: '24px',
                                color: '#888'
                            }}
                        >
                            <FaListUl size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <div style={{ fontSize: 13 }}>No games in queue</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                Add games from suggestions using "Play Next"
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

export function registerPlayNextRoute() {
    routerHook.addRoute(PLAY_NEXT_ROUTE, () => <PlayNextPage />);
}

export function unregisterPlayNextRoute() {
    routerHook.removeRoute(PLAY_NEXT_ROUTE);
}

export function navigateToPlayNext() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(PLAY_NEXT_ROUTE);
}
