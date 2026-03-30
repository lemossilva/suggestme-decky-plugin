import { useState, useEffect, useRef } from "react";
import {
    Focusable,
    PanelSection,
    PanelSectionRow,
    Navigation,
    ConfirmModal,
    showModal,
} from "@decky/ui";
import { FaArrowLeft, FaSteam, FaGamepad, FaCheck, FaTimes, FaClock, FaTag, FaStar, FaListUl, FaBan, FaFilter } from "react-icons/fa";
import { Game } from "../types";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { GameMetadataRow } from "../utils/gameMetadata";
import { getSizeOnDisk, getPurchaseDate } from "../hooks/useSuggestion";

export type FilterCategory =
    | "enrichment"
    | "genres"
    | "tags"
    | "community_tags"
    | "deck_status"
    | "protondb_tier"
    | "steam_reviews"
    | "metacritic"
    | "missing_field";

type QuickFilter = "all" | "unplayed" | "played" | "steam" | "non_steam";

export interface GamesListModalProps {
    title: string;
    subtitle?: string;
    games: Game[];
    highlightField?: keyof Game;
    filterCategory?: FilterCategory;
    filterValue?: string;
    onBack: () => void;
    showNonSteamToggles?: boolean;
    includeNonSteam?: boolean;
    includeUnmatched?: boolean;
    onIncludeNonSteamChange?: (val: boolean) => void;
    onIncludeUnmatchedChange?: (val: boolean) => void;
}

const getGameIconUrl = (game: Game): string | null => {
    const effectiveAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;
    if (!effectiveAppId) return null;
    if (game.is_non_steam) {
        return `https://cdn.cloudflare.steamstatic.com/steam/apps/${effectiveAppId}/capsule_sm_120.jpg`;
    }
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${effectiveAppId}/${game.img_icon_url}.jpg`;
};

const getIconDimensions = (game: Game) => {
    if (game.is_non_steam) {
        return { width: 86, height: 32 };
    }
    return { width: 32, height: 32 };
};

const DECK_STATUS_COLORS: Record<string, string> = {
    verified: "#88ff88",
    playable: "#ffcc00",
    unsupported: "#ff6666",
    unknown: "#888888",
};

const PROTONDB_COLORS: Record<string, string> = {
    platinum: "#b4c7dc",
    gold: "#cfb53b",
    silver: "#a8a8a8",
    bronze: "#cd7f32",
    borked: "#ff4444",
    unknown: "#666666",
};

const getReviewColor = (score: number): string => {
    if (score >= 9) return "#66ccff";
    if (score >= 7) return "#88ff88";
    if (score >= 5) return "#ffcc66";
    if (score >= 3) return "#ffaa66";
    return "#ff6666";
};

const getMetacriticColor = (score: number): string => {
    if (score >= 90) return "#66cc33";
    if (score >= 80) return "#88cc44";
    if (score >= 70) return "#aacc55";
    if (score >= 60) return "#cccc66";
    if (score >= 50) return "#cc9944";
    return "#cc6644";
};

const formatPlaytime = (minutes: number): string => {
    if (minutes === 0) return "Never played";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

const formatLastPlayed = (timestamp?: number): string => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
};

export function GamesListModal({
    title,
    subtitle,
    games,
    highlightField,
    onBack,
    showNonSteamToggles,
    includeNonSteam,
    includeUnmatched,
    onIncludeNonSteamChange,
    onIncludeUnmatchedChange,
}: GamesListModalProps) {
    const [sortBy, setSortBy] = useState<"name" | "playtime" | "recent">("name");
    const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
    const [justAddedGames, setJustAddedGames] = useState<Set<number>>(new Set());
    const [iconErrors, setIconErrors] = useState<Set<number>>(new Set());
    const backButtonRef = useRef<HTMLDivElement>(null);

    const { addGame: addToPlayNext, isInList: isInPlayNext, removeGame: removeFromPlayNext } = usePlayNext();
    const { excludeGame, isExcluded } = useExcludedGames();

    useEffect(() => {
        const timer = setTimeout(() => {
            if (backButtonRef.current) {
                backButtonRef.current.focus();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const baseFilteredGames = showNonSteamToggles
        ? games
        : games.filter(g => !g.is_non_steam || g.match_status === "matched");

    const quickFilteredGames = baseFilteredGames.filter(g => {
        if (quickFilter === "unplayed") return g.playtime_forever === 0;
        if (quickFilter === "played") return g.playtime_forever > 0;
        if (quickFilter === "steam") return !g.is_non_steam;
        if (quickFilter === "non_steam") return g.is_non_steam;
        return true;
    });

    const sortedGames = [...quickFilteredGames].sort((a, b) => {
        if (sortBy === "playtime") {
            return b.playtime_forever - a.playtime_forever;
        }
        if (sortBy === "recent") {
            return (b.rtime_last_played || 0) - (a.rtime_last_played || 0);
        }
        return a.name.localeCompare(b.name);
    });

    const handleNavigateToGame = (game: Game) => {
        const appid = game.appid;
        Navigation.NavigateToLibraryTab();
        Navigation.Navigate(`/library/app/${appid}`);
    };

    const handleAddToPlayNext = async (game: Game) => {
        await addToPlayNext(game);
        setJustAddedGames(prev => new Set(prev).add(game.appid));
        setTimeout(() => {
            setJustAddedGames(prev => {
                const next = new Set(prev);
                next.delete(game.appid);
                return next;
            });
        }, 2000);
    };

    const handleRemoveFromPlayNext = async (appid: number) => {
        await removeFromPlayNext(appid);
    };

    const handleExcludeGame = async (game: Game) => {
        await excludeGame(game);
    };

    const handleMassAddToPlayNext = () => {
        showModal(
            <ConfirmModal
                strTitle="Add All to Play Next"
                strDescription={`Add ${sortedGames.length} games to your Play Next list?`}
                strOKButtonText="Add All"
                strCancelButtonText="Cancel"
                onOK={async () => {
                    for (const game of sortedGames) {
                        if (!isInPlayNext(game.appid)) {
                            await addToPlayNext(game);
                        }
                    }
                }}
            />
        );
    };

    const handleMassExclude = () => {
        showModal(
            <ConfirmModal
                strTitle="Exclude All Games"
                strDescription={`Exclude ${sortedGames.length} games from suggestions? This cannot be easily undone.`}
                strOKButtonText="Exclude All"
                strCancelButtonText="Cancel"
                onOK={async () => {
                    for (const game of sortedGames) {
                        if (!isExcluded(game.appid)) {
                            await excludeGame(game);
                        }
                    }
                }}
            />
        );
    };

    const handleIconError = (appid: number) => {
        setIconErrors(prev => new Set(prev).add(appid));
    };

    const isFieldHighlighted = (field: keyof Game): boolean => {
        return highlightField === field;
    };

    const getHighlightStyle = (field: keyof Game) => {
        if (!isFieldHighlighted(field)) return {};
        return {
            backgroundColor: "#4488aa33",
            borderRadius: 4,
            padding: "2px 6px",
            border: "1px solid #4488aa66",
        };
    };

    const unplayedCount = baseFilteredGames.filter(g => g.playtime_forever === 0).length;
    const playedCount = baseFilteredGames.filter(g => g.playtime_forever > 0).length;
    const steamCount = baseFilteredGames.filter(g => !g.is_non_steam).length;
    const nonSteamCount = baseFilteredGames.filter(g => g.is_non_steam).length;

    return (
        <div style={{ padding: "16px 16px 80px 16px", maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        ref={backButtonRef}
                        onActivate={onBack}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            backgroundColor: "#ffffff11",
                            borderRadius: 8,
                            cursor: "pointer",
                            border: "2px solid transparent",
                            marginBottom: 12,
                        }}
                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                    >
                        <FaArrowLeft size={12} />
                        <span style={{ fontSize: 12 }}>Back</span>
                    </Focusable>
                </PanelSectionRow>

                {showNonSteamToggles && (
                    <>
                        <PanelSectionRow>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                                <span style={{ fontSize: 11 }}>Include Non-Steam</span>
                                <Focusable
                                    onActivate={() => onIncludeNonSteamChange?.(!includeNonSteam)}
                                    style={{
                                        padding: "4px 10px",
                                        backgroundColor: includeNonSteam ? "#4488aa" : "#ffffff11",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        cursor: "pointer",
                                        border: "2px solid transparent",
                                    }}
                                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                >
                                    {includeNonSteam ? "ON" : "OFF"}
                                </Focusable>
                            </div>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", opacity: includeNonSteam ? 1 : 0.4 }}>
                                <span style={{ fontSize: 11 }}>Include Unmatched</span>
                                <Focusable
                                    onActivate={includeNonSteam ? () => onIncludeUnmatchedChange?.(!includeUnmatched) : undefined}
                                    style={{
                                        padding: "4px 10px",
                                        backgroundColor: includeUnmatched && includeNonSteam ? "#4488aa" : "#ffffff11",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        cursor: includeNonSteam ? "pointer" : "default",
                                        border: "2px solid transparent",
                                    }}
                                    onFocus={(e: any) => (e.target.style.borderColor = includeNonSteam ? "white" : "transparent")}
                                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                >
                                    {includeUnmatched ? "ON" : "OFF"}
                                </Focusable>
                            </div>
                        </PanelSectionRow>
                    </>
                )}

                <PanelSectionRow>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            {title}
                        </div>
                        {subtitle && (
                            <div style={{ fontSize: 11, color: "#888" }}>
                                {subtitle}
                            </div>
                        )}
                        <div style={{ fontSize: 11, color: "#4488aa", marginTop: 4 }}>
                            {sortedGames.length} game{sortedGames.length !== 1 ? "s" : ""}
                            {quickFilter !== "all" && ` (filtered from ${baseFilteredGames.length})`}
                        </div>
                    </div>
                </PanelSectionRow>

                {/* Quick Filters */}
                <PanelSectionRow>
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: "#666", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                            <FaFilter size={8} /> Quick Filters
                        </div>
                        <Focusable
                            flow-children="row"
                            style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                            {([
                                { key: "all", label: "All", count: baseFilteredGames.length },
                                { key: "unplayed", label: "Unplayed", count: unplayedCount },
                                { key: "played", label: "Played", count: playedCount },
                                { key: "steam", label: "Steam", count: steamCount },
                                { key: "non_steam", label: "Non-Steam", count: nonSteamCount },
                            ] as const).map(({ key, label, count }) => (
                                count > 0 && (
                                    <Focusable
                                        key={key}
                                        onActivate={() => setQuickFilter(key)}
                                        style={{
                                            padding: "4px 8px",
                                            backgroundColor: quickFilter === key ? "#4488aa" : "#ffffff11",
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            fontSize: 10,
                                            border: "2px solid transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                        }}
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                    >
                                        {label}
                                        <span style={{ color: quickFilter === key ? "#fff" : "#666", fontSize: 9 }}>({count})</span>
                                    </Focusable>
                                )
                            ))}
                        </Focusable>
                    </div>
                </PanelSectionRow>

                {/* Sort Options */}
                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
                    >
                        {(["name", "playtime", "recent"] as const).map((sort) => (
                            <Focusable
                                key={sort}
                                onActivate={() => setSortBy(sort)}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: sortBy === sort ? "#4488aa" : "#ffffff11",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 11,
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                {sort === "name" ? "Name" : sort === "playtime" ? "Playtime" : "Recent"}
                            </Focusable>
                        ))}
                    </Focusable>
                </PanelSectionRow>

                {/* Mass Actions */}
                {sortedGames.length > 0 && (
                    <PanelSectionRow>
                        <Focusable
                            flow-children="row"
                            style={{ display: "flex", gap: 8, marginBottom: 8 }}
                        >
                            <Focusable
                                onActivate={handleMassAddToPlayNext}
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "8px",
                                    backgroundColor: "#88aa8822",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <FaListUl size={10} style={{ color: "#88aa88" }} />
                                <span style={{ fontSize: 10, color: "#88aa88" }}>Add All ({sortedGames.length})</span>
                            </Focusable>
                            <Focusable
                                onActivate={handleMassExclude}
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "8px",
                                    backgroundColor: "#ff666622",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    border: "2px solid transparent",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <FaBan size={10} style={{ color: "#ff6666" }} />
                                <span style={{ fontSize: 10, color: "#ff6666" }}>Exclude All</span>
                            </Focusable>
                        </Focusable>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection>
                {sortedGames.length === 0 ? (
                    <PanelSectionRow>
                        <div style={{ textAlign: "center", color: "#888", padding: 16 }}>
                            No games found
                        </div>
                    </PanelSectionRow>
                ) : (
                    sortedGames.map((game) => {
                        const iconUrl = getGameIconUrl(game);
                        const showFallbackIcon = !iconUrl || iconErrors.has(game.appid);
                        const { width: iconWidth, height: iconHeight } = getIconDimensions(game);
                        const gameInPlayNext = isInPlayNext(game.appid);
                        const gameJustAdded = justAddedGames.has(game.appid);
                        const gameExcluded = isExcluded(game.appid);

                        return (
                            <PanelSectionRow key={`${game.appid}-${game.is_non_steam}`}>
                                <Focusable
                                    flow-children="column"
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        padding: "8px",
                                        backgroundColor: gameExcluded ? "#ff666611" : "#ffffff08",
                                        borderRadius: 8,
                                        border: "2px solid transparent",
                                        opacity: gameExcluded ? 0.6 : 1,
                                    }}
                                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                >
                                    {/* Library Page button - first focusable child */}
                                    <Focusable
                                        onActivate={() => handleNavigateToGame(game)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "4px",
                                            borderRadius: 6,
                                            border: "2px solid transparent",
                                            cursor: "pointer",
                                        }}
                                        onFocus={(e: any) => (e.target.style.borderColor = "#4488aa")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                    >
                                        {showFallbackIcon ? (
                                            <div
                                                style={{
                                                    width: iconWidth,
                                                    height: iconHeight,
                                                    borderRadius: game.is_non_steam ? 2 : 4,
                                                    backgroundColor: game.is_non_steam ? "#aa886622" : "#4488aa22",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {game.is_non_steam ? (
                                                    <FaGamepad size={14} style={{ color: "#aa8866" }} />
                                                ) : (
                                                    <FaSteam size={14} style={{ color: "#4488aa" }} />
                                                )}
                                            </div>
                                        ) : (
                                            <img
                                                src={iconUrl}
                                                alt=""
                                                style={{
                                                    width: iconWidth,
                                                    height: iconHeight,
                                                    borderRadius: game.is_non_steam ? 2 : 4,
                                                    objectFit: game.is_non_steam ? "contain" : "cover",
                                                    objectPosition: "center",
                                                    flexShrink: 0,
                                                }}
                                                onError={() => handleIconError(game.appid)}
                                            />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    ...getHighlightStyle("name"),
                                                }}
                                            >
                                                {game.name}
                                            </div>
                                            <div style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
                                                {game.is_non_steam ? (
                                                    <>
                                                        <span>Non-Steam</span>
                                                        {game.match_status === "matched" && (
                                                            <>
                                                                <span style={{ color: "#666" }}>•</span>
                                                                <span style={{ color: "#88aa88", display: "flex", alignItems: "center", gap: 3 }}>
                                                                    <FaCheck size={8} /> Matched
                                                                </span>
                                                            </>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span>Steam • ID: {game.appid}</span>
                                                )}
                                                {gameExcluded && (
                                                    <>
                                                        <span style={{ color: "#666" }}>•</span>
                                                        <span style={{ color: "#ff6666" }}>Excluded</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Focusable>

                                    {/* Playtime row */}
                                    <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#aaa", ...getHighlightStyle("playtime_forever") }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <FaClock size={9} />
                                            {formatPlaytime(game.playtime_forever)}
                                        </span>
                                        <span style={{ color: "#666" }}>•</span>
                                        <span style={{ ...getHighlightStyle("rtime_last_played") }}>
                                            Last: {formatLastPlayed(game.rtime_last_played)}
                                        </span>
                                    </div>

                                    <GameMetadataRow game={{
                                        size_on_disk: getSizeOnDisk(game.appid) ?? game.size_on_disk,
                                        rtime_purchased: getPurchaseDate(game.appid) ?? game.rtime_purchased,
                                        release_date: game.release_date
                                    }} />

                                    {/* Genres */}
                                    {game.genres && game.genres.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, ...getHighlightStyle("genres") }}>
                                            {game.genres.slice(0, 4).map((genre, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        fontSize: 9,
                                                        padding: "2px 6px",
                                                        backgroundColor: "#4488aa33",
                                                        color: "#88ccff",
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    {genre}
                                                </span>
                                            ))}
                                            {game.genres.length > 4 && (
                                                <span style={{ fontSize: 9, color: "#666" }}>+{game.genres.length - 4}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Tags (Steam features) */}
                                    {game.tags && game.tags.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, ...getHighlightStyle("tags") }}>
                                            <FaTag size={8} style={{ color: "#666", marginTop: 2 }} />
                                            {game.tags.slice(0, 3).map((tag, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        fontSize: 9,
                                                        padding: "2px 6px",
                                                        backgroundColor: "#ffffff11",
                                                        color: "#999",
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {game.tags.length > 3 && (
                                                <span style={{ fontSize: 9, color: "#666" }}>+{game.tags.length - 3}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Community tags */}
                                    {game.community_tags && game.community_tags.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, ...getHighlightStyle("community_tags") }}>
                                            {game.community_tags.slice(0, 4).map((tag, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        fontSize: 9,
                                                        padding: "2px 6px",
                                                        backgroundColor: "#aa886622",
                                                        color: "#ddaa77",
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {game.community_tags.length > 4 && (
                                                <span style={{ fontSize: 9, color: "#666" }}>+{game.community_tags.length - 4}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Compatibility & Reviews row */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                                        {/* Deck status */}
                                        {game.deck_status && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    padding: "3px 8px",
                                                    backgroundColor: `${DECK_STATUS_COLORS[game.deck_status.toLowerCase()] || "#888"}22`,
                                                    color: DECK_STATUS_COLORS[game.deck_status.toLowerCase()] || "#888",
                                                    borderRadius: 4,
                                                    fontWeight: 500,
                                                    ...getHighlightStyle("deck_status"),
                                                }}
                                            >
                                                Deck: {game.deck_status}
                                            </span>
                                        )}

                                        {/* ProtonDB */}
                                        {game.protondb_tier && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    padding: "3px 8px",
                                                    backgroundColor: `${PROTONDB_COLORS[game.protondb_tier.toLowerCase()] || "#888"}22`,
                                                    color: PROTONDB_COLORS[game.protondb_tier.toLowerCase()] || "#888",
                                                    borderRadius: 4,
                                                    fontWeight: 500,
                                                    ...getHighlightStyle("protondb_tier"),
                                                }}
                                            >
                                                ProtonDB: {game.protondb_tier}
                                            </span>
                                        )}

                                        {/* Steam review */}
                                        {game.steam_review_score > 0 && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    padding: "3px 8px",
                                                    backgroundColor: `${getReviewColor(game.steam_review_score)}22`,
                                                    color: getReviewColor(game.steam_review_score),
                                                    borderRadius: 4,
                                                    fontWeight: 500,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                    ...getHighlightStyle("steam_review_score"),
                                                }}
                                            >
                                                <FaStar size={8} />
                                                {game.steam_review_description || `${game.steam_review_score}/10`}
                                            </span>
                                        )}

                                        {/* Metacritic */}
                                        {game.metacritic_score > 0 && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    padding: "3px 8px",
                                                    backgroundColor: `${getMetacriticColor(game.metacritic_score)}22`,
                                                    color: getMetacriticColor(game.metacritic_score),
                                                    borderRadius: 4,
                                                    fontWeight: 500,
                                                    ...getHighlightStyle("metacritic_score"),
                                                }}
                                            >
                                                MC: {game.metacritic_score}
                                            </span>
                                        )}

                                        {/* No metadata indicators */}
                                        {!game.deck_status && !game.protondb_tier && game.steam_review_score === 0 && game.metacritic_score === 0 && (
                                            <span style={{ fontSize: 9, color: "#666", display: "flex", alignItems: "center", gap: 4 }}>
                                                <FaTimes size={8} />
                                                No compatibility/review data
                                            </span>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <Focusable
                                        flow-children="row"
                                        style={{ display: "flex", gap: 6 }}
                                    >
                                        <Focusable
                                            onActivate={() => gameInPlayNext && !gameJustAdded ? handleRemoveFromPlayNext(game.appid) : handleAddToPlayNext(game)}
                                            style={{
                                                flex: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 4,
                                                padding: "6px",
                                                backgroundColor: gameJustAdded ? "#88ff8833" : (gameInPlayNext ? "#88aa8833" : "#ffffff11"),
                                                borderRadius: 6,
                                                border: "2px solid transparent",
                                                cursor: "pointer",
                                            }}
                                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                        >
                                            <FaListUl size={10} style={{ color: gameJustAdded ? "#88ff88" : (gameInPlayNext ? "#88aa88" : "#888") }} />
                                            <span style={{ fontSize: 9, color: gameJustAdded ? "#88ff88" : (gameInPlayNext ? "#88aa88" : "#aaa") }}>
                                                {gameJustAdded ? "Added!" : (gameInPlayNext ? "Remove" : "Play Next")}
                                            </span>
                                        </Focusable>
                                        {!gameExcluded && (
                                            <Focusable
                                                onActivate={() => handleExcludeGame(game)}
                                                style={{
                                                    flex: 1,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 4,
                                                    padding: "6px",
                                                    backgroundColor: "#ff666622",
                                                    borderRadius: 6,
                                                    border: "2px solid transparent",
                                                    cursor: "pointer",
                                                }}
                                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                            >
                                                <FaBan size={10} style={{ color: "#ff6666" }} />
                                                <span style={{ fontSize: 9, color: "#ff6666" }}>Exclude</span>
                                            </Focusable>
                                        )}
                                    </Focusable>
                                </Focusable>
                            </PanelSectionRow>
                        );
                    })
                )}
            </PanelSection>
        </div>
    );
}
