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
import {
    call,
    addEventListener,
    removeEventListener,
    toaster,
} from "@decky/api";
import { useState, useEffect, useCallback, memo } from "react";
import {
    FaGamepad,
    FaCheck,
    FaSync,
    FaTrash,
    FaChevronRight,
    FaExclamationTriangle,
    FaLink,
    FaEdit,
    FaSave,
    FaTimes,
    FaStore,
} from "react-icons/fa";
import {
    Game,
    NonSteamGamesInfo,
    HeroicSyncResult,
    HeroicSyncProgress,
    HeroicSyncStatus,
    HEROIC_STORE_LABELS,
    HEROIC_STORE_COLORS,
} from "../types";
import { logger } from "../utils/logger";
import { GameImage } from "../utils/GameImage";
import { useSuggestMeConfig } from "../hooks/useSuggestMeConfig";

export const NON_STEAM_ROUTE = "/suggestme/non-steam";
export const HEROIC_ROUTE = "/suggestme/heroic-games";

type TabId = "nonsteam" | "heroic";

const NonSteamGameItem = memo(function NonSteamGameItem({
    game,
    onResync,
    onRemove,
    onUpdateSearchTerm,
    isSyncing,
}: {
    game: Game;
    onResync: () => void;
    onRemove: () => void;
    onUpdateSearchTerm: (newTerm: string) => Promise<void>;
    isSyncing: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(game.name || game.original_name);
    const [saving, setSaving] = useState(false);
    const isMatched = game.match_status === "matched";
    const isHeroic = game.source === "epic" || game.source === "gog" || game.source === "amazon";

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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                }}
            >
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>
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
                        padding: "10px",
                        backgroundColor: "#88ff8822",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        color: "#88ff88",
                        opacity: saving ? 0.5 : 1,
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                >
                    {saving ? (
                        <Spinner style={{ width: 12, height: 12 }} />
                    ) : (
                        <FaSave size={12} />
                    )}
                </Focusable>
                <Focusable
                    onActivate={handleCancelEdit}
                    onClick={handleCancelEdit}
                    style={{
                        padding: "10px",
                        backgroundColor: "#ff666622",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        color: "#ff6666",
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
            }}
        >
            <Focusable
                onActivate={isHeroic ? () => {} : () => {
                    const appid = game.matched_appid || game.appid;
                    Navigation.NavigateToLibraryTab();
                    Navigation.Navigate(`/library/app/${appid}`);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    backgroundColor: "#ffffff11",
                    borderRadius: 8,
                    border: focused ? "2px solid white" : "2px solid transparent",
                    cursor: "pointer",
                    minWidth: 0,
                }}
            >
                {game.matched_appid && (
                    <GameImage
                        appid={game.matched_appid}
                        aspect="landscape"
                        style={{ width: 46, height: 17, borderRadius: 2, flexShrink: 0 }}
                        showPlaceholder={false}
                    />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        {game.original_name || game.name}
                        {isMatched ? (
                            <FaCheck size={10} style={{ color: "#88ff88", flexShrink: 0 }} />
                        ) : (
                            <FaExclamationTriangle
                                size={10}
                                style={{ color: "#ffaa00", flexShrink: 0 }}
                            />
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: "#888" }}>
                        {isMatched ? (
                            <span style={{ color: "#88aa88" }}>
                                <FaLink size={8} style={{ marginRight: 4 }} />
                                Matched to Steam Store
                            </span>
                        ) : (
                            <span style={{ color: "#aa8888" }}>No Steam match found</span>
                        )}
                    </div>
                    {game.genres.length > 0 && (
                        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                            {game.genres.slice(0, 3).join(" • ")}
                        </div>
                    )}
                </div>
                {game.matched_appid && (
                    <FaChevronRight size={10} style={{ color: "#666", flexShrink: 0 }} />
                )}
            </Focusable>

            <Focusable
                onActivate={() => setEditing(true)}
                onClick={() => setEditing(true)}
                style={{
                    padding: "10px",
                    backgroundColor: "#ffaa0022",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "2px solid transparent",
                    color: "#ffaa00",
                }}
                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
            >
                <FaEdit size={12} />
            </Focusable>

            <Focusable
                onActivate={onResync}
                onClick={onResync}
                style={{
                    padding: "10px",
                    backgroundColor: "#4488aa22",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "2px solid transparent",
                    color: "#4488aa",
                    opacity: isSyncing ? 0.5 : 1,
                }}
                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
            >
                {isSyncing ? (
                    <Spinner style={{ width: 12, height: 12 }} />
                ) : (
                    <FaSync size={12} />
                )}
            </Focusable>

            <Focusable
                onActivate={onRemove}
                onClick={onRemove}
                style={{
                    padding: "10px",
                    backgroundColor: "#ff666622",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "2px solid transparent",
                    color: "#ff6666",
                }}
                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
            >
                <FaTrash size={12} />
            </Focusable>
        </Focusable>
    );
}, (prev, next) =>
    prev.game.original_name === next.game.original_name &&
    prev.game.match_status === next.game.match_status &&
    prev.game.matched_appid === next.game.matched_appid &&
    prev.isSyncing === next.isSyncing);

const HeroicGameItem = memo(function HeroicGameItem({
    game,
    onResync,
    onRemove,
    isSyncing,
}: {
    game: Game;
    onResync?: (newTerm: string) => void;
    onRemove?: () => void;
    isSyncing?: boolean;
}) {
    const isMatched = game.match_status === "matched";
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(game.name || game.original_name);
    const [saving, setSaving] = useState(false);

    const handleSaveEdit = async () => {
        if (!editValue.trim() || editValue === game.name) {
            setEditing(false);
            return;
        }
        setSaving(true);
        await onResync?.(editValue.trim());
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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                }}
            >
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>
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
                        padding: "10px",
                        backgroundColor: "#88ff8822",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        color: "#88ff88",
                        opacity: saving ? 0.5 : 1,
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                >
                    {saving ? (
                        <Spinner style={{ width: 12, height: 12 }} />
                    ) : (
                        <FaSave size={12} />
                    )}
                </Focusable>
                <Focusable
                    onActivate={handleCancelEdit}
                    onClick={handleCancelEdit}
                    style={{
                        padding: "10px",
                        backgroundColor: "#ff666622",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        color: "#ff6666",
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                opacity: game.is_installed ? 1 : 0.7,
            }}
        >
            <Focusable
                onActivate={() => {
                    if (game.matched_appid) {
                        window.open(`steam://store/${game.matched_appid}`, "_blank");
                    }
                }}
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    backgroundColor: "#ffffff11",
                    borderRadius: 8,
                    border: "2px solid transparent",
                    cursor: game.matched_appid ? "pointer" : "default",
                    minWidth: 0,
                }}
                onFocus={(e: any) => {
                    if (game.matched_appid) e.target.style.borderColor = "white";
                }}
                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
            >
                {game.matched_appid ? (
                    <GameImage
                        appid={game.matched_appid}
                        aspect="landscape"
                        style={{ width: 46, height: 17, borderRadius: 2, flexShrink: 0 }}
                        showPlaceholder={false}
                    />
                ) : (
                    <GameImage
                        appid={game.appid}
                        isNonSteam={true}
                        imgIconUrl={game.img_icon_url}
                        aspect="landscape"
                        style={{ width: 46, height: 17, borderRadius: 2, flexShrink: 0 }}
                        showPlaceholder={true}
                        placeholderIcon="gamepad"
                    />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        {game.name}
                        {isMatched ? (
                            <FaCheck
                                size={10}
                                style={{ color: "#88ff88", flexShrink: 0 }}
                            />
                        ) : (
                            <FaExclamationTriangle
                                size={10}
                                style={{ color: "#ffaa00", flexShrink: 0 }}
                            />
                        )}
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            color: "#888",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <span
                            style={{
                                color: HEROIC_STORE_COLORS[game.source] || "#888",
                                fontWeight: 500,
                            }}
                        >
                            {HEROIC_STORE_LABELS[game.source] || game.source}
                        </span>
                        {isMatched ? (
                            <>
                                <span style={{ color: "#666" }}>•</span>
                                <span style={{ color: "#88aa88" }}>
                                    <FaLink size={8} style={{ marginRight: 2 }} />
                                    Matched
                                </span>
                            </>
                        ) : (
                            <>
                                <span style={{ color: "#666" }}>•</span>
                                <span style={{ color: "#aa8888" }}>No match</span>
                            </>
                        )}
                        {!game.is_installed && (
                            <>
                                <span style={{ color: "#666" }}>•</span>
                                <span style={{ color: "#ff8866" }}>Not installed</span>
                            </>
                        )}
                    </div>
                    {game.genres.length > 0 && (
                        <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                            {game.genres.slice(0, 3).join(" • ")}
                        </div>
                    )}
                </div>
                {game.matched_appid && (
                    <FaChevronRight size={10} style={{ color: "#666", flexShrink: 0 }} />
                )}
            </Focusable>

            <Focusable
                onActivate={() => setEditing(true)}
                onClick={() => setEditing(true)}
                style={{
                    padding: "10px",
                    backgroundColor: "#ffaa0022",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "2px solid transparent",
                    color: "#ffaa00",
                }}
                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
            >
                <FaEdit size={12} />
            </Focusable>

            {onResync && (
                <Focusable
                    onActivate={() => onResync(game.name || game.original_name)}
                    onClick={() => onResync(game.name || game.original_name)}
                    style={{
                        padding: "10px",
                        backgroundColor: "#4488aa22",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        color: "#4488aa",
                        opacity: isSyncing ? 0.5 : 1,
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                >
                    {isSyncing ? (
                        <Spinner style={{ width: 12, height: 12 }} />
                    ) : (
                        <FaSync size={12} />
                    )}
                </Focusable>
            )}

            {onRemove && (
                <Focusable
                    onActivate={onRemove}
                    onClick={onRemove}
                    style={{
                        padding: "10px",
                        backgroundColor: "#ff666622",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        color: "#ff6666",
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                >
                    <FaTrash size={12} />
                </Focusable>
            )}
        </Focusable>
    );
}, (prev, next) =>
    prev.game.original_name === next.game.original_name &&
    prev.game.match_status === next.game.match_status &&
    prev.game.matched_appid === next.game.matched_appid &&
    prev.isSyncing === next.isSyncing);

export const ExternalGamesPage = ({
    initialTab = "nonsteam" as TabId,
}: {
    initialTab?: TabId;
}) => {
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);
    const { config } = useSuggestMeConfig();
    const heroicEnabled = config.heroic_import_enabled ?? false;

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#0e141b",
                overflow: "hidden",
            }}
        >
            <Focusable
                onActivate={() => {}}
                style={{ height: 48, width: "100%", flexShrink: 0 }}
            >
                {null}
            </Focusable>
            <div style={{ padding: "8px 24px 0 24px" }}>
                <Focusable
                    flow-children="row"
                    style={{
                        display: "flex",
                        gap: 4,
                        width: "100%",
                        backgroundColor: "#ffffff11",
                        borderRadius: 10,
                        padding: 4,
                    }}
                >
                    <Focusable
                        onActivate={() => setActiveTab("nonsteam")}
                        onClick={() => setActiveTab("nonsteam")}
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "8px",
                            borderRadius: 8,
                            backgroundColor:
                                activeTab === "nonsteam" ? "#4488aa" : "transparent",
                            color: activeTab === "nonsteam" ? "#fff" : "#888",
                            cursor: "pointer",
                            border:
                                activeTab === "nonsteam"
                                    ? "2px solid #4488aa"
                                    : "2px solid transparent",
                            transition: "all 0.1s ease",
                        }}
                        onFocus={(e: any) => {
                            if (activeTab !== "nonsteam")
                                e.target.style.borderColor = "white";
                        }}
                        onBlur={(e: any) => {
                            if (activeTab !== "nonsteam")
                                e.target.style.borderColor = "transparent";
                        }}
                    >
                        <FaGamepad size={12} />
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: activeTab === "nonsteam" ? 600 : 400,
                            }}
                        >
                            Non-Steam
                        </span>
                    </Focusable>
                    {heroicEnabled && (
                    <Focusable
                        onActivate={() => setActiveTab("heroic")}
                        onClick={() => setActiveTab("heroic")}
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "8px",
                            borderRadius: 8,
                            backgroundColor:
                                activeTab === "heroic" ? "#ddaa77" : "transparent",
                            color: activeTab === "heroic" ? "#fff" : "#888",
                            cursor: "pointer",
                            border:
                                activeTab === "heroic"
                                    ? "2px solid #ddaa77"
                                    : "2px solid transparent",
                            transition: "all 0.1s ease",
                        }}
                        onFocus={(e: any) => {
                            if (activeTab !== "heroic") e.target.style.borderColor = "white";
                        }}
                        onBlur={(e: any) => {
                            if (activeTab !== "heroic")
                                e.target.style.borderColor = "transparent";
                        }}
                    >
                        <FaStore size={12} />
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: activeTab === "heroic" ? 600 : 400,
                            }}
                        >
                            Heroic
                        </span>
                    </Focusable>
                    )}
                </Focusable>
            </div>
            <div
                style={{
                    padding: "12px 24px 80px 24px",
                    maxHeight: "calc(100vh - 120px)",
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
            >
                {activeTab === "nonsteam" ? <NonSteamTab /> : <HeroicTab />}
            </div>
        </div>
    );
};

const NonSteamTab = () => {
    const [info, setInfo] = useState<NonSteamGamesInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncingGame, setSyncingGame] = useState<string | null>(null);
    const [progress, setProgress] = useState<{
        current: number;
        total: number;
        name: string;
    } | null>(null);
    const [sortBy, setSortBy] = useState<"name-asc" | "name-desc">("name-asc");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "matched" | "unmatched"
    >("all");

    const loadInfo = useCallback(async () => {
        try {
            const result = await call<[], NonSteamGamesInfo>("get_non_steam_games");
            setInfo(result);
        } catch (e) {
            logger.error("[SuggestMe] Failed to load non-steam games:", e);
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
            const result = await call<
                [],
                { success: boolean; count: number; detected: number }
            >("sync_non_steam_games");
            await loadInfo();
            if (result && result.count === 0) {
                toaster.toast({
                    title: "SuggestMe • Non-Steam Games",
                    body: "No new games found. Your library is up to date.",
                    duration: 3000,
                });
            } else if (result && result.count > 0) {
                toaster.toast({
                    title: "SuggestMe • Non-Steam Games",
                    body: `${result.count} new games added`,
                    duration: 3000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to sync non-steam games:", e);
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
            logger.error("[SuggestMe] Failed to resync game:", e);
        } finally {
            setSyncingGame(null);
        }
    };

    const handleRemove = async (originalName: string) => {
        try {
            await call<[string], any>("remove_non_steam_game", originalName);
            await loadInfo();
        } catch (e) {
            logger.error("[SuggestMe] Failed to remove game:", e);
        }
    };

    const handleUpdateSearchTerm = async (
        originalName: string,
        newTerm: string,
    ) => {
        setSyncingGame(originalName);
        try {
            const result = await call<
                [string, string],
                { success: boolean; error?: string }
            >("update_non_steam_search_term", originalName, newTerm);
            if (result.success) {
                toaster.toast({
                    title: "SuggestMe • Game Updated",
                    body: `Successfully matched "${originalName}" to Steam`,
                    duration: 3000,
                });
                await loadInfo();
            } else {
                toaster.toast({
                    title: "SuggestMe • Match Failed",
                    body: result.error || "Could not find a match",
                    duration: 3000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to update search term:", e);
        } finally {
            setSyncingGame(null);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 32, color: "#888" }}>
                <Spinner style={{ width: 24, height: 24 }} />
                <div style={{ marginTop: 8, fontSize: 12 }}>
                    Loading non-Steam games...
                </div>
            </div>
        );
    }

    const sortFn = (a: Game, b: Game) => {
        const aName = a.original_name || a.name;
        const bName = b.original_name || b.name;
        return sortBy === "name-desc"
            ? bName.localeCompare(aName)
            : aName.localeCompare(bName);
    };
    const allGames = (info?.games || []).sort(sortFn);
    const matchedGames =
        statusFilter !== "unmatched"
            ? allGames.filter((g) => g.match_status === "matched")
            : [];
    const unmatchedGames =
        statusFilter !== "matched"
            ? allGames.filter((g) => g.match_status !== "matched")
            : [];

    return (
        <>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        onActivate={() => {}}
                        onFocus={(e: any) => {
                            e.target.style.backgroundColor = "#4488aa33";
                            e.target.style.border = "2px solid white";
                        }}
                        onBlur={(e: any) => {
                            e.target.style.backgroundColor = "#ffffff08";
                            e.target.style.border = "2px solid transparent";
                        }}
                        style={{
                            display: "flex",
                            justifyContent: "space-around",
                            padding: "12px",
                            backgroundColor: "#ffffff08",
                            borderRadius: 12,
                            marginBottom: 16,
                            border: "2px solid transparent",
                            transition: "all 0.1s ease-in-out",
                            width: "100%",
                        }}
                    >
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: "#4488aa" }}>
                                {info?.total || 0}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>Total</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: "#88ff88" }}>
                                {info?.matched || 0}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>Matched</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 600, color: "#ffaa00" }}>
                                {info?.unmatched || 0}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>Unmatched</div>
                        </div>
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                        Non-Steam games are matched to their Steam Store counterparts to
                        fetch metadata (genres, tags). Matched games can be filtered and
                        suggested just like regular Steam games.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem layout="below" onClick={handleSyncAll} disabled={syncing}>
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
                        <div style={{ width: "100%", padding: "8px 0" }}>
                            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                                Processing: {progress.name}
                            </div>
                            <ProgressBar
                                nProgress={(progress.current / progress.total) * 100}
                            />
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        {(["name-asc", "name-desc"] as const).map((s) => (
                            <Focusable
                                key={s}
                                onActivate={() => setSortBy(s)}
                                style={{
                                    padding: "4px 8px",
                                    backgroundColor: sortBy === s ? "#4488aa" : "#ffffff11",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 10,
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) =>
                                    (e.target.style.borderColor = "transparent")
                                }
                            >
                                {s === "name-asc" ? "A → Z" : "Z → A"}
                            </Focusable>
                        ))}
                        <div style={{ width: 8 }} />
                        {(["all", "matched", "unmatched"] as const).map((f) => (
                            <Focusable
                                key={f}
                                onActivate={() => setStatusFilter(f)}
                                style={{
                                    padding: "4px 8px",
                                    backgroundColor: statusFilter === f ? "#4488aa" : "#ffffff11",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 10,
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) =>
                                    (e.target.style.borderColor = "transparent")
                                }
                            >
                                {f === "all"
                                    ? "All"
                                    : f === "matched"
                                        ? "Matched"
                                        : "Unmatched"}
                            </Focusable>
                        ))}
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {matchedGames.length > 0 && (
                <PanelSection title={`Matched (${matchedGames.length})`}>
                    {matchedGames.map((game) => (
                        <NonSteamGameItem
                            key={`${game.original_name}-${game.match_status}`}
                            game={game}
                            onResync={() => handleResync(game.original_name)}
                            onRemove={() => handleRemove(game.original_name)}
                            onUpdateSearchTerm={(newTerm) =>
                                handleUpdateSearchTerm(game.original_name, newTerm)
                            }
                            isSyncing={syncingGame === game.original_name}
                        />
                    ))}
                </PanelSection>
            )}

            {unmatchedGames.length > 0 && (
                <PanelSection title={`Unmatched (${unmatchedGames.length})`}>
                    <PanelSectionRow>
                        <div style={{ fontSize: 11, color: "#aa8888", marginBottom: 8 }}>
                            These games couldn't be matched to Steam. They won't have
                            genre/tag data for filtering.
                        </div>
                    </PanelSectionRow>
                    {unmatchedGames.map((game) => (
                        <NonSteamGameItem
                            key={`${game.original_name}-${game.match_status}`}
                            game={game}
                            onResync={() => handleResync(game.original_name)}
                            onRemove={() => handleRemove(game.original_name)}
                            onUpdateSearchTerm={(newTerm) =>
                                handleUpdateSearchTerm(game.original_name, newTerm)
                            }
                            isSyncing={syncingGame === game.original_name}
                        />
                    ))}
                </PanelSection>
            )}

            {info?.total === 0 && (
                <PanelSection>
                    <PanelSectionRow>
                        <Focusable
                            style={{
                                textAlign: "center",
                                padding: "24px",
                                color: "#888",
                            }}
                        >
                            <FaGamepad size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <div style={{ fontSize: 13 }}>No non-Steam games detected</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                Add games via Steam's "Add a Non-Steam Game" feature
                            </div>
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            )}
        </>
    );
};

const HeroicTab = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState<HeroicSyncProgress | null>(null);
    const [syncResult, setSyncResult] = useState<HeroicSyncResult | null>(null);
    const [syncingGame, setSyncingGame] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "source">(
        "name-asc",
    );
    const [statusFilter, setStatusFilter] = useState<
        "all" | "matched" | "unmatched"
    >("all");

    const loadGames = async () => {
        setLoading(true);
        try {
            const result = await call<[], { games: Game[] }>("get_library_games");
            const heroicGames = (result?.games || []).filter(
                (g) => g.source !== "steam",
            );
            setGames(heroicGames);
        } catch (e) {
            logger.error("[SuggestMe] Failed to load heroic games:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            try {
                const status = await call<[], HeroicSyncStatus>(
                    "get_heroic_sync_status",
                );
                if (status?.syncing) {
                    setSyncing(true);
                    if (status.progress) {
                        setProgress(status.progress);
                    }
                }
            } catch (_e) {}
            await loadGames();
        };
        init();
    }, []);

    useEffect(() => {
        let listener: any;
        listener = addEventListener<[HeroicSyncProgress]>(
            "suggestme_heroic_sync_progress",
            (payload) => setProgress(payload),
        );
        return () => {
            if (listener)
                removeEventListener("suggestme_heroic_sync_progress", listener);
        };
    }, []);

    useEffect(() => {
        let listener: any;
        listener = addEventListener<[{ success: boolean }]>(
            "suggestme_heroic_sync_complete",
            async () => {
                setSyncing(false);
                setProgress(null);
                await loadGames();
            },
        );
        return () => {
            if (listener)
                removeEventListener("suggestme_heroic_sync_complete", listener);
        };
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setProgress(null);
        setSyncResult(null);
        try {
            const result = await call<[], HeroicSyncResult>("sync_heroic_library");
            setSyncResult(result);
            const dupMsg =
                (result?.duplicates_skipped ?? 0) > 0
                    ? ` • ${result!.duplicates_skipped} dupes skipped`
                    : "";
            toaster.toast({
                title: "SuggestMe • Heroic Sync",
                body: `${result?.matched || 0} matched, ${result?.discarded || 0} discarded${dupMsg}`,
                duration: 4000,
            });
            await loadGames();
        } catch (_e) {
            setSyncResult({ success: false, error: "Sync failed" });
        }
        setSyncing(false);
        setProgress(null);
    };

    const handleHeroicResync = async (originalName: string, newTerm: string) => {
        setSyncingGame(originalName);
        try {
            const result = await call<[string, string], { success: boolean; matched: boolean; appid?: number; error?: string }>(
                "resync_heroic_game", originalName, newTerm
            );
            if (result?.success && result.matched) {
                toaster.toast({ title: "SuggestMe • Game Matched", body: `Matched "${originalName}" to Steam`, duration: 3000 });
            } else if (result?.success) {
                toaster.toast({ title: "SuggestMe • No Match", body: `No match found for "${newTerm}"`, duration: 3000 });
            }
            await loadGames();
        } catch (_e) {
            logger.error("[SuggestMe] Failed to resync heroic game:", _e);
        }
        setSyncingGame(null);
    };

    const handleRemoveHeroic = async (originalName: string) => {
        try {
            const result = await call<[string], { success: boolean; error?: string }>(
                "remove_heroic_game", originalName
            );
            if (result?.success) {
                await loadGames();
            }
        } catch (_e) {
            logger.error("[SuggestMe] Failed to remove heroic game:", _e);
        }
    };

    const sortFn = (a: Game, b: Game) => {
        if (sortBy === "source") {
            const order = ["epic", "gog", "amazon"];
            return order.indexOf(a.source) - order.indexOf(b.source);
        }
        const cmp = a.name.localeCompare(b.name);
        return sortBy === "name-desc" ? -cmp : cmp;
    };
    const filtered =
        statusFilter === "matched"
            ? games.filter((g) => g.match_status === "matched")
            : statusFilter === "unmatched"
                ? games.filter((g) => g.match_status !== "matched")
                : games;
    const sorted = [...filtered].sort(sortFn);
    const matchedGames = sorted.filter((g) => g.match_status === "matched");
    const unmatchedGames = sorted.filter((g) => g.match_status !== "matched");

    const phaseLabel =
        progress?.phase === "metadata_recovery"
            ? `Recovering metadata (${progress.current}/${progress.total})`
            : progress?.phase === "metadata"
                ? `Fetching metadata (${progress.current}/${progress.total})`
                : progress?.phase === "matching"
                    ? `Matching: ${progress.name} (${progress.current}/${progress.total})`
                    : progress?.name || "Processing...";

    if (loading && !syncing) {
        return (
            <div style={{ textAlign: "center", padding: 32, color: "#888" }}>
                <Spinner style={{ width: 24, height: 24 }} />
                <div style={{ marginTop: 8, fontSize: 12 }}>
                    Loading Heroic games...
                </div>
            </div>
        );
    }

    return (
        <>
            <PanelSection>
                {games.length > 0 && (
                    <PanelSectionRow>
                        <Focusable
                            flow-children="row"
                            style={{
                                display: "flex",
                                justifyContent: "space-around",
                                padding: "12px",
                                backgroundColor: "#ffffff08",
                                borderRadius: 12,
                                marginBottom: 12,
                                border: "2px solid transparent",
                                transition: "all 0.1s ease-in-out",
                                width: "100%",
                            }}
                            onFocus={(e: any) => {
                                e.target.style.backgroundColor = "#ddaa7733";
                                e.target.style.border = "2px solid white";
                            }}
                            onBlur={(e: any) => {
                                e.target.style.backgroundColor = "#ffffff08";
                                e.target.style.border = "2px solid transparent";
                            }}
                        >
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 600 }}>
                                    {games.length}
                                </div>
                                <div style={{ fontSize: 9, color: "#666" }}>Total</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 600, color: "#88ff88" }}>
                                    <FaCheck size={10} style={{ marginRight: 2 }} />
                                    {matchedGames.length}
                                </div>
                                <div style={{ fontSize: 9, color: "#666" }}>Matched</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 600, color: "#ffaa00" }}>
                                    {unmatchedGames.length}
                                </div>
                                <div style={{ fontSize: 9, color: "#666" }}>Unmatched</div>
                            </div>
                        </Focusable>
                        <Focusable
                            flow-children="row"
                            style={{
                                display: "flex",
                                justifyContent: "space-around",
                                padding: "8px 12px",
                                backgroundColor: "#ffffff06",
                                borderRadius: 8,
                                marginBottom: 12,
                                width: "100%",
                            }}
                            onFocus={(e: any) => (e.target.style.backgroundColor = "#ddaa7733")}
                            onBlur={(e: any) => (e.target.style.backgroundColor = "#ffffff06")}
                        >
                            {(["epic", "gog", "amazon"] as const).map((store) => {
                                const count = games.filter((g) => g.source === store).length;
                                const matchedCount = games.filter((g) => g.source === store && g.match_status === "matched").length;
                                return (
                                    <div key={store} style={{ textAlign: "center" }}>
                                        <div style={{
                                            fontSize: 16,
                                            fontWeight: 600,
                                            color: HEROIC_STORE_COLORS[store] || "#888",
                                            opacity: count > 0 ? 1 : 0.3,
                                        }}>
                                            {matchedCount}
                                        </div>
                                        <div style={{ fontSize: 8, color: HEROIC_STORE_COLORS[store] || "#888", opacity: 0.7 }}>
                                            {HEROIC_STORE_LABELS[store]}
                                        </div>
                                    </div>
                                );
                            })}
                        </Focusable>
                    </PanelSectionRow>
                )}

                <PanelSectionRow>
                    <ButtonItem layout="below" onClick={handleSync} disabled={syncing}>
                        {syncing ? (
                            <>
                                <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                                Syncing Heroic Library...
                            </>
                        ) : (
                            <>
                                <FaSync style={{ marginRight: 8 }} />
                                Sync Heroic Library
                            </>
                        )}
                    </ButtonItem>
                </PanelSectionRow>

                {syncing && progress && progress.total > 0 && (
                    <PanelSectionRow>
                        <div style={{ width: "100%", padding: "8px 0" }}>
                            <div style={{ fontSize: 11, color: "#ddaa77", marginBottom: 4 }}>
                                {phaseLabel}
                            </div>
                            <ProgressBar
                                nProgress={(progress.current / progress.total) * 100}
                            />
                        </div>
                    </PanelSectionRow>
                )}

                {syncing && (!progress || progress.total === 0) && (
                    <PanelSectionRow>
                        <div
                            style={{
                                textAlign: "center",
                                fontSize: 11,
                                color: "#aaa",
                                padding: "8px",
                            }}
                        >
                            <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                            Starting sync...
                        </div>
                    </PanelSectionRow>
                )}

                {syncResult && (
                    <PanelSectionRow>
                        <div
                            style={{
                                fontSize: 11,
                                color: "#88ff88",
                                textAlign: "center",
                                padding: "8px",
                                backgroundColor: "#88ff8811",
                                borderRadius: 6,
                            }}
                        >
                            Scanned {syncResult.scanned ?? 0} • Matched{" "}
                            {syncResult.matched ?? 0} • Discarded {syncResult.discarded ?? 0}
                            {(syncResult.duplicates_skipped ?? 0) > 0 &&
                                ` • ${syncResult.duplicates_skipped} dupes`}
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        {(["name-asc", "name-desc", "source"] as const).map((s) => (
                            <Focusable
                                key={s}
                                onActivate={() => setSortBy(s)}
                                style={{
                                    padding: "4px 8px",
                                    backgroundColor: sortBy === s ? "#ddaa77" : "#ffffff11",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 10,
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) =>
                                    (e.target.style.borderColor = "transparent")
                                }
                            >
                                {s === "name-asc"
                                    ? "A → Z"
                                    : s === "name-desc"
                                        ? "Z → A"
                                        : "Store"}
                            </Focusable>
                        ))}
                        <div style={{ width: 8 }} />
                        {(["all", "matched", "unmatched"] as const).map((f) => (
                            <Focusable
                                key={f}
                                onActivate={() => setStatusFilter(f)}
                                style={{
                                    padding: "4px 8px",
                                    backgroundColor: statusFilter === f ? "#ddaa77" : "#ffffff11",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 10,
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) =>
                                    (e.target.style.borderColor = "transparent")
                                }
                            >
                                {f === "all"
                                    ? "All"
                                    : f === "matched"
                                        ? "Matched"
                                        : "Unmatched"}
                            </Focusable>
                        ))}
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection>
                {games.length === 0 && !loading ? (
                    <PanelSectionRow>
                        <div
                            style={{ textAlign: "center", padding: "24px", color: "#888" }}
                        >
                            <FaStore size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <div style={{ fontSize: 13 }}>No Heroic games imported yet</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                Enable Heroic Import in Settings and sync.
                            </div>
                        </div>
                    </PanelSectionRow>
                ) : (
                    <>
                        {matchedGames.length > 0 && (
                            <PanelSection title={`Matched (${matchedGames.length})`}>
                                {matchedGames.map((game) => (
                                    <PanelSectionRow key={game.appid}>
                                        <HeroicGameItem
                                            game={game}
                                            onResync={(newTerm) => handleHeroicResync(game.original_name, newTerm)}
                                            onRemove={() => handleRemoveHeroic(game.original_name)}
                                            isSyncing={syncingGame === game.original_name}
                                        />
                                    </PanelSectionRow>
                                ))}
                            </PanelSection>
                        )}
                        {unmatchedGames.length > 0 && (
                            <PanelSection title={`Unmatched (${unmatchedGames.length})`}>
                                {unmatchedGames.map((game) => (
                                    <PanelSectionRow key={game.appid}>
                                        <HeroicGameItem
                                            game={game}
                                            onResync={(newTerm) => handleHeroicResync(game.original_name, newTerm)}
                                            onRemove={() => handleRemoveHeroic(game.original_name)}
                                            isSyncing={syncingGame === game.original_name}
                                        />
                                    </PanelSectionRow>
                                ))}
                            </PanelSection>
                        )}
                    </>
                )}
            </PanelSection>
        </>
    );
};

export function navigateToNonSteamGames() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(NON_STEAM_ROUTE);
}

export function navigateToHeroicGames() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(HEROIC_ROUTE);
}
