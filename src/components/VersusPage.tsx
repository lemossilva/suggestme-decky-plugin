import { useState, useRef, useEffect, useCallback } from "react";
import { Focusable, Navigation } from "@decky/ui";
import { call } from "@decky/api";
import { FaTrophy, FaArrowLeft, FaExternalLinkAlt, FaGamepad, FaStar, FaStore, FaListUl, FaBan, FaHistory, FaStopCircle, FaRedo, FaUsers, FaTag } from "react-icons/fa";
import { Game, SuggestFilters, VersusRoundPayload } from "../types";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { navigateToHistory } from "./HistoryModal";
import { GameMetadataRow } from "../utils/gameMetadata";
import { logger } from "../utils/logger";
import { GameImage } from "../utils/GameImage";

export const VERSUS_ROUTE = "/suggestme/versus";

type VersusPhase = "loading" | "resuming" | "round" | "fetching" | "winner";

let cachedFilters: SuggestFilters | null = null;
let cachedInstalledAppIds: number[] = [];
let cachedPresetName: string | undefined = undefined;
let onCompleteCallback: ((winner: Game | null) => void) | null = null;

export function setVersusParams(
    filters: SuggestFilters,
    installedAppIds: number[],
    presetName: string | undefined,
    onComplete: (winner: Game | null) => void
) {
    cachedFilters = filters;
    cachedInstalledAppIds = installedAppIds;
    cachedPresetName = presetName;
    onCompleteCallback = onComplete;
}

export function navigateToVersus(
    filters: SuggestFilters,
    installedAppIds: number[],
    presetName: string | undefined,
    onComplete: (winner: Game | null) => void
) {
    setVersusParams(filters, installedAppIds, presetName, onComplete);
    Navigation.Navigate(VERSUS_ROUTE);
}

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
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
};

interface GameCardProps {
    game: Game;
    label: string;
    labelColor: string;
    onPick: () => void;
    disabled: boolean;
}

function GameCard({ game, label, labelColor, onPick, disabled }: GameCardProps) {
    return (
        <Focusable
            onActivate={disabled ? undefined : onPick}
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: "#1a1f2e",
                borderRadius: 10,
                overflow: "hidden",
                minWidth: 0,
                border: "2px solid transparent",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
            }}
            onFocus={(e: any) => !disabled && (e.currentTarget.style.borderColor = labelColor)}
            onBlur={(e: any) => (e.currentTarget.style.borderColor = "transparent")}
        >
            <div style={{
                position: "relative",
                width: "100%",
                aspectRatio: "460 / 215",
            }}>
                <GameImage
                    appid={game.appid}
                    isNonSteam={game.is_non_steam}
                    matchedAppid={game.matched_appid}
                    aspect="landscape"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                    showPlaceholder={true}
                    placeholderIcon={game.is_non_steam ? "gamepad" : "steam"}
                />
                <div style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    padding: "3px 10px",
                    backgroundColor: labelColor,
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                }}>
                    {label}
                </div>
            </div>

            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: "bold", color: "white", lineHeight: 1.2 }}>
                    {game.name}
                    {game.is_non_steam && (
                        <span style={{ marginLeft: 6, fontSize: 9, color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
                    )}
                </div>

                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {game.genres.slice(0, 3).map((genre) => (
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
                    <span><FaGamepad style={{ marginRight: 3 }} />{formatPlaytime(game.playtime_forever)}</span>
                    <span>Last: {formatLastPlayed(game.rtime_last_played)}</span>
                </div>

                {(game.steam_review_description || game.metacritic_score > 0) && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10, color: "#aaa" }}>
                        {game.steam_review_description && (
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <FaStar style={{ color: "#ffcc00" }} />
                                {game.steam_review_description}
                            </span>
                        )}
                        {game.metacritic_score > 0 && (
                            <span style={{
                                background: game.metacritic_score >= 75 ? "#66cc33" : game.metacritic_score >= 50 ? "#ffcc33" : "#ff6666",
                                color: "#000",
                                padding: "1px 5px",
                                borderRadius: 2,
                                fontWeight: "bold",
                                fontSize: 9,
                            }}>
                                {game.metacritic_score}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div style={{
                padding: "6px 10px 10px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
            }}>
                <FaTrophy size={12} style={{ color: "#fff" }} />
                <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Pick This One</span>
            </div>
        </Focusable>
    );
}

export function VersusPage() {
    const [phase, setPhase] = useState<VersusPhase>("loading");
    const [champion, setChampion] = useState<Game | null>(null);
    const [challenger, setChallenger] = useState<Game | null>(null);
    const [rounds, setRounds] = useState(0);
    const [poolSize, setPoolSize] = useState(0);
    const [seenAppIds, setSeenAppIds] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [poolExhausted, setPoolExhausted] = useState(false);
    const [winnerScale, setWinnerScale] = useState(0.5);
    const [winnerOpacity, setWinnerOpacity] = useState(0);

    const { addGame: addToPlayNext, isInList: isInPlayNext } = usePlayNext();
    const { excludeGame } = useExcludedGames();
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const persistState = useCallback((champ: Game, chall: Game | null, r: number, seen: number[], pool: number) => {
        if (!cachedFilters) return;
        call("save_versus_state", {
            champion: champ,
            challenger: chall,
            rounds: r,
            seen_appids: seen,
            pool_size: pool,
            filters: cachedFilters,
            installed_appids: cachedInstalledAppIds,
            preset_name: cachedPresetName,
        }).catch(e => logger.error("[SuggestMe] Failed to persist versus state:", e));
    }, []);

    const clearPersistedState = useCallback(() => {
        call("clear_versus_state").catch(() => {});
    }, []);

    const loadInitialPair = useCallback(async () => {
        if (!cachedFilters) {
            setError("No filters configured");
            return;
        }
        setPhase("loading");
        setError(null);
        setRounds(0);
        setSeenAppIds([]);
        setPoolExhausted(false);

        try {
            const result = await call<[object, number[], number[]], VersusRoundPayload>(
                "get_versus_pair",
                cachedFilters,
                cachedInstalledAppIds,
                []
            );
            if (!mountedRef.current) return;

            if (result?.error) {
                setError(result.error);
                return;
            }
            if (result?.champion && result?.challenger) {
                const seen = [result.champion.appid, result.challenger.appid];
                setChampion(result.champion);
                setChallenger(result.challenger);
                setPoolSize(result.pool_size);
                setSeenAppIds(seen);
                setPhase("round");
                persistState(result.champion, result.challenger, 0, seen, result.pool_size);
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to load versus pair:", e);
            if (mountedRef.current) setError("Failed to start versus battle");
        }
    }, [persistState]);

    const tryResumeSavedState = useCallback(async () => {
        try {
            const result = await call<[], { has_state: boolean; state: any }>("load_versus_state");
            if (!mountedRef.current) return;
            if (result?.has_state && result.state) {
                const s = result.state;
                if (s.champion && s.challenger) {
                    setChampion(s.champion);
                    setChallenger(s.challenger);
                    setRounds(s.rounds || 0);
                    setSeenAppIds(s.seen_appids || []);
                    setPoolSize(s.pool_size || 0);
                    if (s.filters) cachedFilters = s.filters;
                    if (s.installed_appids) cachedInstalledAppIds = s.installed_appids;
                    if (s.preset_name) cachedPresetName = s.preset_name;
                    setPhase("round");
                    return;
                }
            }
        } catch (e) {
            logger.debug("[SuggestMe] No saved versus state:", e);
        }
        if (mountedRef.current) loadInitialPair();
    }, [loadInitialPair]);

    useEffect(() => {
        tryResumeSavedState();
    }, [tryResumeSavedState]);

    const fetchNextChallenger = useCallback(async (winner: Game, newSeen: number[]) => {
        if (!cachedFilters) return;
        setPhase("fetching");

        try {
            const result = await call<[object, number[], number[]], { challenger: Game | null; remaining: number; pool_exhausted: boolean }>(
                "get_next_challenger",
                cachedFilters,
                cachedInstalledAppIds,
                newSeen
            );
            if (!mountedRef.current) return;

            if (result?.pool_exhausted || !result?.challenger) {
                setPoolExhausted(true);
                showWinner(winner, true);
                return;
            }

            const updatedSeen = [...newSeen, result.challenger!.appid];
            setChampion(winner);
            setChallenger(result.challenger);
            setSeenAppIds(updatedSeen);
            setPoolSize(result.remaining);
            setPhase("round");
            persistState(winner, result.challenger, rounds + 1, updatedSeen, result.remaining);
        } catch (e) {
            logger.error("[SuggestMe] Failed to fetch next challenger:", e);
            showWinner(winner, false);
        }
    }, [rounds, persistState]);

    const showWinner = useCallback((winner: Game, exhausted: boolean) => {
        setChampion(winner);
        setPoolExhausted(exhausted);
        setWinnerScale(0.5);
        setWinnerOpacity(0);
        setPhase("winner");
        clearPersistedState();

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setWinnerScale(1);
                setWinnerOpacity(1);
            });
        });

        call<[object, number, boolean, object | null, string | undefined], { success: boolean }>(
            "record_versus_winner",
            winner,
            rounds,
            exhausted,
            cachedFilters,
            cachedPresetName
        ).catch(e => logger.error("[SuggestMe] Failed to record versus winner:", e));
    }, [rounds, clearPersistedState]);

    const handlePick = useCallback((picked: Game) => {
        const newRounds = rounds + 1;
        setRounds(newRounds);
        const newSeen = [...seenAppIds];
        fetchNextChallenger(picked, newSeen);
    }, [rounds, seenAppIds, fetchNextChallenger]);

    const handleStopAndPick = useCallback(() => {
        if (champion) {
            showWinner(champion, false);
        }
    }, [champion, showWinner]);

    const handleExcludeInRound = useCallback(async (game: Game, isChampion: boolean) => {
        await excludeGame(game);
        if (isChampion && challenger) {
            const newSeen = [...seenAppIds];
            setRounds(prev => prev + 1);
            fetchNextChallenger(challenger, newSeen);
        } else if (!isChampion && champion) {
            const newSeen = [...seenAppIds];
            fetchNextChallenger(champion, newSeen);
        }
    }, [champion, challenger, seenAppIds, excludeGame, fetchNextChallenger]);

    const handleBack = () => {
        if (phase === "winner" && champion && onCompleteCallback) {
            onCompleteCallback(champion);
        } else if (onCompleteCallback) {
            onCompleteCallback(null);
        }
        Navigation.NavigateBack();
    };

    const handleLaunchGame = () => {
        if (champion) {
            Navigation.NavigateToLibraryTab();
            Navigation.Navigate(`/library/app/${champion.appid}`);
        }
    };

    const handlePlayAgain = () => {
        clearPersistedState();
        loadInitialPair();
    };

    return (
        <div style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#0e141b",
            padding: "48px 36px 48px 36px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
        }}>
            {/* Header */}
            <Focusable
                flow-children="row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                        {phase === "winner" ? "Winner!" : `Versus — Round ${rounds + 1}`}
                    </span>
                    {phase === "round" && poolSize > 0 && (
                        <span style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <FaUsers size={9} />
                            {poolSize} opponent{poolSize !== 1 ? "s" : ""} remaining
                        </span>
                    )}
                </div>
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

            {/* Loading */}
            {(phase === "loading" || phase === "resuming") && !error && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: "#888", fontSize: 14 }}>
                        {phase === "resuming" ? "Resuming battle..." : "Loading candidates..."}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: "#ff6666", fontSize: 14, textAlign: "center" }}>{error}</div>
                </div>
            )}

            {/* Fetching next */}
            {phase === "fetching" && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: "#888", fontSize: 14 }}>Drawing next challenger...</div>
                </div>
            )}

            {/* Round phase — side-by-side cards */}
            {phase === "round" && champion && challenger && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    <Focusable
                        flow-children="row"
                        style={{ flex: 1, display: "flex", gap: 16, alignItems: "stretch" }}
                    >
                        <GameCard
                            game={champion}
                            label="Champion"
                            labelColor="#aa8844"
                            onPick={() => handlePick(champion)}
                            disabled={false}
                        />

                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 4px",
                        }}>
                            <span style={{
                                fontSize: 18,
                                fontWeight: 900,
                                color: "#555",
                                textTransform: "uppercase",
                                letterSpacing: 2,
                            }}>
                                VS
                            </span>
                        </div>

                        <GameCard
                            game={challenger}
                            label="Challenger"
                            labelColor="#4488aa"
                            onPick={() => handlePick(challenger)}
                            disabled={false}
                        />
                    </Focusable>

                    {/* Bottom actions row — color-coded to match cards */}
                    <Focusable
                        flow-children="row"
                        style={{ display: "flex", gap: 6, alignItems: "stretch" }}
                    >
                        <Focusable
                            onActivate={() => addToPlayNext(champion)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, padding: "6px 4px",
                                backgroundColor: isInPlayNext(champion.appid) ? "#88aa8833" : "#ffffff11",
                                borderRadius: 6, border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #aa8844",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #aa8844"; }}
                        >
                            <FaListUl size={9} style={{ color: isInPlayNext(champion.appid) ? "#88aa88" : "#888" }} />
                            <span style={{ fontSize: 9, color: isInPlayNext(champion.appid) ? "#88aa88" : "#aaa" }}>
                                {isInPlayNext(champion.appid) ? "Queued" : "Queue"}
                            </span>
                        </Focusable>

                        <Focusable
                            onActivate={() => handleExcludeInRound(champion, true)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, padding: "6px 4px",
                                backgroundColor: "#ff666622", borderRadius: 6,
                                border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #aa8844",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #aa8844"; }}
                        >
                            <FaBan size={9} style={{ color: "#ff6666" }} />
                            <span style={{ fontSize: 9, color: "#ff6666" }}>Exclude</span>
                        </Focusable>

                        <Focusable
                            onActivate={handleStopAndPick}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, padding: "6px 4px",
                                backgroundColor: "#aa884433", borderRadius: 6,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaStopCircle size={9} style={{ color: "#aa8844" }} />
                            <span style={{ fontSize: 9, color: "#aa8844" }}>Stop</span>
                        </Focusable>

                        <Focusable
                            onActivate={() => handleExcludeInRound(challenger, false)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, padding: "6px 4px",
                                backgroundColor: "#ff666622", borderRadius: 6,
                                border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #4488aa",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #4488aa"; }}
                        >
                            <FaBan size={9} style={{ color: "#ff6666" }} />
                            <span style={{ fontSize: 9, color: "#ff6666" }}>Exclude</span>
                        </Focusable>

                        <Focusable
                            onActivate={() => addToPlayNext(challenger)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, padding: "6px 4px",
                                backgroundColor: isInPlayNext(challenger.appid) ? "#88aa8833" : "#ffffff11",
                                borderRadius: 6, border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #4488aa",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #4488aa"; }}
                        >
                            <FaListUl size={9} style={{ color: isInPlayNext(challenger.appid) ? "#88aa88" : "#888" }} />
                            <span style={{ fontSize: 9, color: isInPlayNext(challenger.appid) ? "#88aa88" : "#aaa" }}>
                                {isInPlayNext(challenger.appid) ? "Queued" : "Queue"}
                            </span>
                        </Focusable>
                    </Focusable>
                </div>
            )}

            {/* Winner phase — celebratory screen */}
            {phase === "winner" && champion && (
                <div style={{
                    flex: 1,
                    display: "flex",
                    gap: 16,
                    transform: `scale(${winnerScale})`,
                    opacity: winnerOpacity,
                    transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out",
                    overflow: "hidden",
                }}>
                    {/* Left: winner card with full metadata */}
                    <div style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        background: "#1a1f2e",
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "2px solid #aa8844",
                        minWidth: 0,
                    }}>
                        <div style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "460 / 215",
                            flexShrink: 0,
                        }}>
                            <GameImage
                                appid={champion.appid}
                                isNonSteam={champion.is_non_steam}
                                matchedAppid={champion.matched_appid}
                                aspect="landscape"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                                showPlaceholder={true}
                                placeholderIcon={champion.is_non_steam ? "gamepad" : "steam"}
                            />
                            <div style={{
                                position: "absolute",
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: "linear-gradient(transparent 50%, rgba(26, 31, 46, 0.9) 100%)",
                            }} />
                            <div style={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 10px",
                                backgroundColor: "#aa8844",
                                borderRadius: 4,
                            }}>
                                <FaTrophy size={10} style={{ color: "#fff" }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>WINNER</span>
                            </div>
                        </div>

                        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: "bold", color: "white" }}>
                                {champion.name}
                                {champion.is_non_steam && (
                                    <span style={{ marginLeft: 6, fontSize: 9, color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#aaa" }}>
                                <span><FaGamepad style={{ marginRight: 3 }} />{formatPlaytime(champion.playtime_forever)}</span>
                                <span>Last: {formatLastPlayed(champion.rtime_last_played)}</span>
                            </div>

                            {champion.genres.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {champion.genres.map((genre) => (
                                        <span key={genre} style={{
                                            fontSize: 9, padding: "2px 6px",
                                            backgroundColor: "#4488aa33", color: "#88ccff",
                                            borderRadius: 4,
                                        }}>
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {champion.community_tags && champion.community_tags.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                    <FaTag size={8} style={{ color: "#666" }} />
                                    {champion.community_tags.slice(0, 5).map((tag) => (
                                        <span key={tag} style={{
                                            fontSize: 9, padding: "2px 6px",
                                            backgroundColor: "#aa886622", color: "#ddaa77",
                                            borderRadius: 4,
                                        }}>
                                            {tag}
                                        </span>
                                    ))}
                                    {champion.community_tags.length > 5 && (
                                        <span style={{ fontSize: 9, color: "#666" }}>+{champion.community_tags.length - 5}</span>
                                    )}
                                </div>
                            )}

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {champion.deck_status && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: champion.deck_status.toLowerCase() === "verified" ? "#88ff8822" : champion.deck_status.toLowerCase() === "playable" ? "#ffaa0022" : "#ff666622",
                                        color: champion.deck_status.toLowerCase() === "verified" ? "#88ff88" : champion.deck_status.toLowerCase() === "playable" ? "#ffaa00" : "#ff6666",
                                    }}>
                                        Deck: {champion.deck_status}
                                    </span>
                                )}
                                {champion.steam_review_description && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: "#ffcc0022", color: "#ffcc00",
                                        display: "flex", alignItems: "center", gap: 3,
                                    }}>
                                        <FaStar size={8} />
                                        {champion.steam_review_description}
                                    </span>
                                )}
                                {champion.metacritic_score > 0 && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: champion.metacritic_score >= 75 ? "#66cc3322" : champion.metacritic_score >= 50 ? "#ffcc3322" : "#ff666622",
                                        color: champion.metacritic_score >= 75 ? "#66cc33" : champion.metacritic_score >= 50 ? "#ffcc33" : "#ff6666",
                                    }}>
                                        MC: {champion.metacritic_score}
                                    </span>
                                )}
                            </div>

                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 10px",
                                backgroundColor: "#aa884422",
                                borderRadius: 6,
                                fontSize: 10,
                                color: "#aa8844",
                                fontWeight: 600,
                            }}>
                                <FaTrophy size={10} />
                                {poolExhausted
                                    ? `Defeated all ${rounds} challengers — pool exhausted!`
                                    : `Defeated ${rounds} challenger${rounds !== 1 ? "s" : ""}`
                                }
                            </div>

                            <GameMetadataRow game={champion} />
                        </div>
                    </div>

                    {/* Right: action buttons */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        minWidth: 140,
                        justifyContent: "center",
                    }}>
                        <Focusable
                            onActivate={handleLaunchGame}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 12px",
                                backgroundColor: "#4488aa", borderRadius: 8,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaExternalLinkAlt size={12} style={{ color: "#fff" }} />
                            <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>View Game</span>
                        </Focusable>

                        {((!champion.is_non_steam) || (champion.is_non_steam && champion.matched_appid)) && (
                            <Focusable
                                onActivate={() => {
                                    const storeAppId = champion.is_non_steam && champion.matched_appid
                                        ? champion.matched_appid : champion.appid;
                                    window.open(`steam://store/${storeAppId}`, "_blank");
                                }}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 8, padding: "10px 12px",
                                    backgroundColor: "#1a6e9a", borderRadius: 8,
                                    border: "2px solid transparent", cursor: "pointer",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <FaStore size={12} style={{ color: "#fff" }} />
                                <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Store Page</span>
                            </Focusable>
                        )}

                        <Focusable
                            onActivate={() => addToPlayNext(champion)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 12px",
                                backgroundColor: isInPlayNext(champion.appid) ? "#88aa8833" : "#ffffff11",
                                borderRadius: 8,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaListUl size={12} style={{ color: isInPlayNext(champion.appid) ? "#88aa88" : "#aaa" }} />
                            <span style={{ fontSize: 12, color: isInPlayNext(champion.appid) ? "#88aa88" : "#aaa", fontWeight: 600 }}>
                                {isInPlayNext(champion.appid) ? "In Play Next" : "Play Next"}
                            </span>
                        </Focusable>

                        <Focusable
                            onActivate={handlePlayAgain}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 12px",
                                backgroundColor: "#aa884433",
                                borderRadius: 8,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaRedo size={12} style={{ color: "#aa8844" }} />
                            <span style={{ fontSize: 12, color: "#aa8844", fontWeight: 600 }}>New Battle</span>
                        </Focusable>
                    </div>
                </div>
            )}
        </div>
    );
}

export function VersusPageWrapper() {
    return <VersusPage />;
}
