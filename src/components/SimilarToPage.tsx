import { useState, useRef, useEffect, useCallback } from "react";
import { Focusable, Navigation, TextField } from "@decky/ui";
import { call } from "@decky/api";
import { FaSearch, FaArrowLeft, FaExternalLinkAlt, FaGamepad, FaStar, FaStore, FaListUl, FaBan, FaHistory, FaRedo, FaMagic, FaFilter } from "react-icons/fa";
import { Game, SuggestFilters, SuggestionResult } from "../types";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { navigateToHistory } from "./HistoryModal";
import { logger } from "../utils/logger";

export const SIMILAR_TO_ROUTE = "/suggestme/similar-to";

let cachedFilters: SuggestFilters | null = null;
let cachedInstalledAppIds: number[] = [];
let cachedPresetName: string | undefined = undefined;
let cachedFilterPool: boolean = false;
let onCompleteCallback: ((game: Game | null) => void) | null = null;

export function navigateToSimilarTo(
    filters: SuggestFilters,
    installedAppIds: number[],
    presetName: string | undefined,
    onComplete: (game: Game | null) => void,
    filterPool: boolean = false
) {
    cachedFilters = filters;
    cachedInstalledAppIds = installedAppIds;
    cachedPresetName = presetName;
    cachedFilterPool = filterPool;
    onCompleteCallback = onComplete;
    Navigation.Navigate(SIMILAR_TO_ROUTE);
}

const formatPlaytime = (minutes: number): string => {
    if (minutes === 0) return "Unplayed";
    const hours = Math.floor(minutes / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h`;
};

export function SimilarToPage() {
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [referenceGames, setReferenceGames] = useState<Game[]>([]);
    const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
    const [suggesting, setSuggesting] = useState(false);
    const [confirmingExclude, setConfirmingExclude] = useState(false);
    const [justAddedToPlayNext, setJustAddedToPlayNext] = useState(false);

    const { addGame: addToPlayNext, isInList: isInPlayNext } = usePlayNext();
    const { excludeGame } = useExcludedGames();
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        const loadGames = async () => {
            try {
                let result: { games: Game[] };
                if (cachedFilterPool && cachedFilters) {
                    result = await call<[object, number[]], { games: Game[] }>(
                        "get_filtered_library_games",
                        cachedFilters,
                        cachedInstalledAppIds
                    );
                } else {
                    result = await call<[], { games: Game[] }>("get_library_games");
                }
                if (!mountedRef.current) return;
                if (result?.games) {
                    const eligible = result.games.filter(g =>
                        !g.is_non_steam || g.match_status === "matched"
                    );
                    eligible.sort((a, b) => a.name.localeCompare(b.name));
                    setAllGames(eligible);
                }
            } catch (e) {
                logger.error("[SuggestMe] Failed to load games for similar-to:", e);
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        };
        loadGames();
    }, []);

    const selectedAppIds = new Set(referenceGames.map(g => g.appid));
    const availableGames = allGames.filter(g => !selectedAppIds.has(g.appid));
    const filtered = query.trim()
        ? availableGames.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
        : availableGames;

    const handleAddReference = (game: Game) => {
        setReferenceGames(prev => [...prev, game]);
        setSuggestion(null);
        setQuery("");
    };

    const handleRemoveReference = (appid: number) => {
        setReferenceGames(prev => prev.filter(g => g.appid !== appid));
        setSuggestion(null);
    };

    const handleClearReferences = () => {
        setReferenceGames([]);
        setSuggestion(null);
    };

    const handleSuggest = useCallback(async () => {
        if (referenceGames.length === 0 || !cachedFilters) return;
        setSuggesting(true);
        try {
            const appids = referenceGames.map(g => g.appid);
            const result = await call<[number[], object, number[], string?], SuggestionResult>(
                "get_similar_to_suggestion",
                appids,
                cachedFilters,
                cachedInstalledAppIds,
                cachedPresetName
            );
            if (!mountedRef.current) return;
            if (result) setSuggestion(result);
        } catch (e) {
            logger.error("[SuggestMe] Failed to get similar_to suggestion:", e);
        } finally {
            if (mountedRef.current) setSuggesting(false);
        }
    }, [referenceGames]);

    const handleBack = () => {
        if (suggestion?.game && onCompleteCallback) {
            onCompleteCallback(suggestion.game);
        } else if (onCompleteCallback) {
            onCompleteCallback(null);
        }
        Navigation.NavigateBack();
    };

    const hasReferences = referenceGames.length > 0;

    const handleLaunch = () => {
        if (suggestion?.game) {
            Navigation.NavigateToLibraryTab();
            Navigation.Navigate(`/library/app/${suggestion.game.appid}`);
        }
    };

    const handleAddToPlayNext = async () => {
        if (suggestion?.game) {
            await addToPlayNext(suggestion.game);
            setJustAddedToPlayNext(true);
            setTimeout(() => setJustAddedToPlayNext(false), 2000);
        }
    };

    const handleExclude = async () => {
        if (!confirmingExclude) {
            setConfirmingExclude(true);
            setTimeout(() => setConfirmingExclude(false), 5000);
            return;
        }
        if (suggestion?.game) {
            await excludeGame(suggestion.game);
            setConfirmingExclude(false);
            handleSuggest();
        }
    };

    const suggestedGame = suggestion?.game;
    const suggestedEffectiveAppId = suggestedGame
        ? (suggestedGame.is_non_steam && suggestedGame.matched_appid ? suggestedGame.matched_appid : suggestedGame.appid)
        : 0;
    const gameInPlayNext = suggestedGame ? isInPlayNext(suggestedGame.appid) : false;

    return (
        <div style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#0e141b",
            padding: "48px 36px 48px 36px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
        }}>
            {/* Header */}
            <Focusable
                flow-children="row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, width: "100%" }}
            >
                <Focusable
                    onActivate={handleBack}
                    style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 10px",
                        backgroundColor: "#ffffff11",
                        borderRadius: 6, cursor: "pointer", border: "2px solid transparent",
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                >
                    <FaArrowLeft size={10} />
                    <span style={{ fontSize: 11 }}>Back</span>
                </Focusable>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                    Similar To
                </span>
                <Focusable
                    onActivate={() => navigateToHistory()}
                    style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 10px",
                        backgroundColor: "#ffffff11",
                        borderRadius: 6, cursor: "pointer", border: "2px solid transparent",
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                >
                    <FaHistory size={10} />
                    <span style={{ fontSize: 11 }}>History</span>
                </Focusable>
            </Focusable>

            <div style={{ flex: 1, display: "flex", gap: 20, overflow: "hidden", width: "100%" }}>
                {/* Left panel: game picker */}
                <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minWidth: 0,
                    overflow: "hidden",
                }}>
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>
                        {hasReferences ? `${referenceGames.length} reference${referenceGames.length > 1 ? 's' : ''} selected` : 'Pick reference games'}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FaSearch size={11} style={{ color: "#666", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <TextField
                                label=""
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                bShowClearAction={true}
                            />
                        </div>
                    </div>

                    {hasReferences && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {referenceGames.map(refGame => {
                                const refAppId = refGame.is_non_steam && refGame.matched_appid ? refGame.matched_appid : refGame.appid;
                                return (
                                    <Focusable
                                        key={refGame.appid}
                                        onActivate={() => handleRemoveReference(refGame.appid)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "4px 8px",
                                            backgroundColor: "#4488aa22",
                                            borderRadius: 6,
                                            border: "2px solid #4488aa44",
                                            cursor: "pointer",
                                        }}
                                        onFocus={(e: any) => (e.currentTarget.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.currentTarget.style.borderColor = "#4488aa44")}
                                    >
                                        <img
                                            src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${refAppId}/capsule_184x69.jpg`}
                                            alt=""
                                            style={{ width: 40, height: 15, borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
                                            onError={(e: any) => (e.target.style.display = "none")}
                                        />
                                        <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {refGame.name}
                                        </div>
                                        <span style={{ fontSize: 8, color: "#ff6666", flexShrink: 0 }}>✕</span>
                                    </Focusable>
                                );
                            })}
                            {referenceGames.length > 1 && (
                                <div style={{ fontSize: 9, color: "#aa8844", fontStyle: "italic", padding: "2px 4px" }}>
                                    Results will match elements common to all selected games.
                                </div>
                            )}
                            <Focusable
                                onActivate={handleClearReferences}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 4, padding: "3px 8px",
                                    backgroundColor: "#ff666611", borderRadius: 4,
                                    border: "2px solid transparent", cursor: "pointer",
                                    fontSize: 9, color: "#ff6666",
                                }}
                                onFocus={(e: any) => (e.currentTarget.style.borderColor = "white")}
                                onBlur={(e: any) => (e.currentTarget.style.borderColor = "transparent")}
                            >
                                Clear all
                            </Focusable>
                        </div>
                    )}

                    {/* Find button - in left panel for natural up/down navigation */}
                    {hasReferences && !suggestedGame && (
                        <Focusable
                            onActivate={suggesting ? undefined : handleSuggest}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 16px",
                                backgroundColor: suggesting ? "#333" : "#4488aa",
                                borderRadius: 8, cursor: suggesting ? "default" : "pointer",
                                border: "2px solid transparent",
                                opacity: suggesting ? 0.6 : 1,
                            }}
                            onFocus={(e: any) => !suggesting && (e.currentTarget.style.borderColor = "white")}
                            onBlur={(e: any) => (e.currentTarget.style.borderColor = "transparent")}
                        >
                            <FaMagic size={14} style={{ color: "#fff" }} />
                            <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                                {suggesting ? "Finding..." : "Find Similar Games"}
                            </span>
                        </Focusable>
                    )}

                    {loading && (
                        <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
                            Loading library...
                        </div>
                    )}

                    {!loading && (
                        <div style={{
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                        }}>
                            <div style={{ fontSize: 10, color: "#555", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                <span>
                                    {query.trim()
                                        ? `${filtered.length} match${filtered.length !== 1 ? "es" : ""}`
                                        : `${availableGames.length} games — type to search`
                                    }
                                </span>
                                {cachedFilterPool && (
                                    <span style={{ display: "flex", alignItems: "center", gap: 3, color: "#4488aa", fontSize: 9 }}>
                                        <FaFilter size={7} /> filtered
                                    </span>
                                )}
                            </div>
                            {filtered.map(game => {
                                const effectiveAppId = game.is_non_steam && game.matched_appid
                                    ? game.matched_appid : game.appid;
                                const capsuleUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${effectiveAppId}/capsule_184x69.jpg`;

                                return (
                                    <Focusable
                                        key={game.appid}
                                        onActivate={() => handleAddReference(game)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "6px 8px",
                                            backgroundColor: "#ffffff08",
                                            borderRadius: 6,
                                            cursor: "pointer",
                                            border: "2px solid transparent",
                                        }}
                                        onFocus={(e: any) => {
                                            e.currentTarget.style.borderColor = "#4488aa";
                                            e.currentTarget.style.backgroundColor = "#4488aa33";
                                        }}
                                        onBlur={(e: any) => {
                                            e.currentTarget.style.borderColor = "transparent";
                                            e.currentTarget.style.backgroundColor = "#ffffff08";
                                        }}
                                    >
                                        <img
                                            src={capsuleUrl}
                                            alt=""
                                            style={{ width: 50, height: 18, borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
                                            onError={(e: any) => (e.target.style.display = "none")}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 11, color: "#fff",
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                                {game.name}
                                            </div>
                                            <div style={{ display: "flex", gap: 6, fontSize: 9, color: "#666", marginTop: 1 }}>
                                                {game.genres.slice(0, 2).map(g => (
                                                    <span key={g} style={{ backgroundColor: "#ffffff11", padding: "0 3px", borderRadius: 2 }}>{g}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 9, color: "#666", flexShrink: 0 }}>
                                            <FaGamepad style={{ marginRight: 2 }} />
                                            {formatPlaytime(game.playtime_forever)}
                                        </span>
                                    </Focusable>
                                );
                            })}
                        </div>
                    )}

                </div>

                {/* Right panel: suggestion result */}
                {suggestedGame && (
                    <div style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        minWidth: 0,
                    }}>
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            background: "#1a1f2e",
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "2px solid #4488aa44",
                        }}>
                            <div style={{
                                position: "relative",
                                width: "100%",
                                aspectRatio: "460 / 215",
                                backgroundImage: `url(https://steamcdn-a.akamaihd.net/steam/apps/${suggestedEffectiveAppId}/header.jpg)`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                            }}>
                                <div style={{
                                    position: "absolute",
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: "linear-gradient(transparent 50%, rgba(26, 31, 46, 0.9) 100%)",
                                }} />
                                <div style={{
                                    position: "absolute", top: 8, left: 8,
                                    padding: "3px 10px",
                                    backgroundColor: "#4488aa",
                                    borderRadius: 4, fontSize: 10, fontWeight: 700, color: "#fff",
                                }}>
                                    SUGGESTION
                                </div>
                            </div>

                            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ fontSize: 16, fontWeight: "bold", color: "white" }}>
                                    {suggestedGame.name}
                                </div>

                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {suggestedGame.genres.slice(0, 4).map((genre) => (
                                        <span key={genre} style={{
                                            background: "var(--gpColor-Blue)",
                                            color: "white",
                                            padding: "1px 6px",
                                            borderRadius: 3,
                                            fontSize: 9,
                                        }}>
                                            {genre}
                                        </span>
                                    ))}
                                </div>

                                <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#aaa" }}>
                                    <span><FaGamepad style={{ marginRight: 3 }} />{formatPlaytime(suggestedGame.playtime_forever)}</span>
                                    {suggestedGame.steam_review_description && (
                                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                            <FaStar style={{ color: "#ffcc00" }} />
                                            {suggestedGame.steam_review_description}
                                        </span>
                                    )}
                                </div>

                                {suggestion?.reason && (
                                    <div style={{
                                        padding: "6px 10px",
                                        backgroundColor: "#4488aa22",
                                        borderRadius: 6,
                                        fontSize: 10,
                                        color: "#4488aa",
                                        fontStyle: "italic",
                                    }}>
                                        {suggestion.reason}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <Focusable
                            flow-children="row"
                            style={{ display: "flex", gap: 8 }}
                        >
                            <Focusable
                                onActivate={handleLaunch}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 6, padding: "6px 8px",
                                    backgroundColor: "#4488aa", borderRadius: 8,
                                    border: "2px solid transparent", cursor: "pointer",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <FaExternalLinkAlt size={11} style={{ color: "#fff" }} />
                                <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>View</span>
                            </Focusable>

                            {((!suggestedGame.is_non_steam) || (suggestedGame.is_non_steam && suggestedGame.matched_appid)) && (
                                <Focusable
                                    onActivate={() => {
                                        const storeAppId = suggestedGame.is_non_steam && suggestedGame.matched_appid
                                            ? suggestedGame.matched_appid : suggestedGame.appid;
                                        window.open(`steam://store/${storeAppId}`, "_blank");
                                    }}
                                    style={{
                                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                        gap: 6, padding: "6px 8px",
                                        backgroundColor: "#1a6e9a", borderRadius: 8,
                                        border: "2px solid transparent", cursor: "pointer",
                                    }}
                                    onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                    onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                >
                                    <FaStore size={11} style={{ color: "#fff" }} />
                                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>Store</span>
                                </Focusable>
                            )}
                        </Focusable>

                        <Focusable
                            flow-children="row"
                            style={{ display: "flex", gap: 8 }}
                        >
                            <Focusable
                                onActivate={handleAddToPlayNext}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 6, padding: "6px 8px",
                                    backgroundColor: justAddedToPlayNext ? "#88ff8833" : (gameInPlayNext ? "#88aa8833" : "#ffffff11"),
                                    borderRadius: 8, border: "2px solid transparent", cursor: "pointer",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <FaListUl size={11} style={{ color: justAddedToPlayNext ? "#88ff88" : (gameInPlayNext ? "#88aa88" : "#888") }} />
                                <span style={{ fontSize: 11, color: justAddedToPlayNext ? "#88ff88" : (gameInPlayNext ? "#88aa88" : "#aaa"), fontWeight: 600 }}>
                                    {justAddedToPlayNext ? "Added!" : (gameInPlayNext ? "In List" : "Play Next")}
                                </span>
                            </Focusable>

                            <Focusable
                                onActivate={handleExclude}
                                style={{
                                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 6, padding: "6px 8px",
                                    backgroundColor: confirmingExclude ? "#ff666644" : "#ff666622",
                                    borderRadius: 8, border: "2px solid transparent", cursor: "pointer",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <FaBan size={11} style={{ color: "#ff6666" }} />
                                <span style={{ fontSize: 11, color: "#ff6666", fontWeight: 600 }}>
                                    {confirmingExclude ? "Confirm" : "Exclude"}
                                </span>
                            </Focusable>
                        </Focusable>

                        <Focusable
                            onActivate={suggesting ? undefined : handleSuggest}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "6px 16px",
                                backgroundColor: "#aa884433", borderRadius: 8,
                                border: "2px solid transparent", cursor: suggesting ? "default" : "pointer",
                                opacity: suggesting ? 0.6 : 1,
                            }}
                            onFocus={(e: any) => !suggesting && (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaRedo size={12} style={{ color: "#aa8844" }} />
                            <span style={{ fontSize: 12, color: "#aa8844", fontWeight: 600 }}>
                                {suggesting ? "Finding..." : "Find Another"}
                            </span>
                        </Focusable>

                        {suggestion?.error && (
                            <div style={{ color: "#ff6666", fontSize: 11, textAlign: "center", padding: 4 }}>
                                {suggestion.error}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function SimilarToPageWrapper() {
    return <SimilarToPage />;
}
