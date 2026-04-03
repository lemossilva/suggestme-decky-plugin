import { useState, useRef, useEffect, useCallback } from "react";
import { Focusable, Navigation } from "@decky/ui";
import { call } from "@decky/api";
import { FaTrophy, FaArrowLeft, FaExternalLinkAlt, FaGamepad, FaStar, FaStore, FaListUl, FaBan, FaHistory, FaStopCircle, FaUsers, FaRedo, FaTag } from "react-icons/fa";
import { Game, SuggestFilters, VersusRoundPayload } from "../types";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { navigateToHistory } from "./HistoryModal";
import { GameMetadataRow } from "../utils/gameMetadata";
import { getSizeOnDisk, getPurchaseDate } from "../hooks/useSuggestion";

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
    if (score >= 60) return "#bbcc66";
    if (score >= 50) return "#ccbb77";
    return "#cc6655";
};
import { logger } from "../utils/logger";
import { GameImage } from "../utils/GameImage";

export const VERSUS_ROUTE = "/suggestme/versus";

type VersusPhase = "loading" | "resuming" | "round" | "fetching" | "winner";

function useContainerScale(containerRef: React.RefObject<HTMLDivElement>) {
    const [scale, setScale] = useState(1);
    const measuredRef = useRef(false);

    useEffect(() => {
        if (measuredRef.current) return undefined;
        const el = containerRef.current;
        if (!el) return undefined;

        const measure = () => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 10) {
                const vmin = Math.min(rect.width, rect.height);
                setScale(Math.max(1, Math.min(vmin / 500, 3)));
                measuredRef.current = true;
            }
        };
        measure();
        if (!measuredRef.current) {
            const timer = setTimeout(measure, 50);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [containerRef]);

    return scale;
}

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
    scale?: (base: number) => number;
}

function GameCard({ game, label, labelColor, onPick, disabled, scale }: GameCardProps) {
    const s = scale || ((n: number) => n);
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
                    top: s(8),
                    left: s(8),
                    padding: `${s(3)}px ${s(10)}px`,
                    backgroundColor: labelColor,
                    borderRadius: s(4),
                    fontSize: s(10),
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                }}>
                    {label}
                </div>
            </div>

            <div style={{ padding: s(10), display: "flex", flexDirection: "column", gap: s(6), flex: 1 }}>
                <div style={{ fontSize: s(14), fontWeight: "bold", color: "white", lineHeight: 1.2 }}>
                    {game.name}
                    {game.is_non_steam && (
                        <span style={{ marginLeft: s(6), fontSize: s(9), color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
                    )}
                </div>

                {/* Playtime row */}
                <div style={{ display: "flex", gap: s(12), fontSize: s(10), color: "#aaa" }}>
                    <span><FaGamepad style={{ marginRight: s(3) }} />{formatPlaytime(game.playtime_forever)}</span>
                    <span>Last: {formatLastPlayed(game.rtime_last_played)}</span>
                </div>

                {/* GameMetadataRow */}
                <GameMetadataRow game={{
                    size_on_disk: getSizeOnDisk(game.appid) ?? game.size_on_disk,
                    rtime_purchased: getPurchaseDate(game.appid) ?? game.rtime_purchased,
                    release_date: game.release_date
                }} scale={s} />

                {/* Genres */}
                {game.genres && game.genres.length > 0 && (
                    <div style={{ display: "flex", gap: s(4), flexWrap: "wrap" }}>
                        {game.genres.slice(0, 4).map((genre) => (
                            <span key={genre} style={{
                                background: "var(--gpColor-Blue)",
                                color: "white",
                                padding: `${s(1)}px ${s(6)}px`,
                                borderRadius: s(3),
                                fontSize: s(9),
                            }}>
                                {genre}
                            </span>
                        ))}
                        {game.genres.length > 4 && (
                            <span style={{ fontSize: s(9), color: "#666" }}>+{game.genres.length - 4}</span>
                        )}
                    </div>
                )}

                {/* Community tags */}
                {game.community_tags && game.community_tags.length > 0 && (
                    <div style={{ display: "flex", gap: s(4), flexWrap: "wrap" }}>
                        {game.community_tags.slice(0, 4).map((tag, i) => (
                            <span key={i} style={{
                                fontSize: s(9),
                                padding: `${s(2)}px ${s(6)}px`,
                                backgroundColor: "#aa886622",
                                color: "#ddaa77",
                                borderRadius: s(4),
                            }}>
                                {tag}
                            </span>
                        ))}
                        {game.community_tags.length > 4 && (
                            <span style={{ fontSize: s(9), color: "#666" }}>+{game.community_tags.length - 4}</span>
                        )}
                    </div>
                )}

                {/* Compatibility & Reviews row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: s(8), marginTop: s(4) }}>
                    {/* Deck status */}
                    {game.deck_status && (
                        <span style={{
                            fontSize: s(9),
                            padding: `${s(3)}px ${s(8)}px`,
                            backgroundColor: `${DECK_STATUS_COLORS[game.deck_status.toLowerCase()] || "#888"}22`,
                            color: DECK_STATUS_COLORS[game.deck_status.toLowerCase()] || "#888",
                            borderRadius: s(4),
                            fontWeight: 500,
                        }}>
                            Deck: {game.deck_status}
                        </span>
                    )}

                    {/* ProtonDB */}
                    {game.protondb_tier && (
                        <span style={{
                            fontSize: s(9),
                            padding: `${s(3)}px ${s(8)}px`,
                            backgroundColor: `${PROTONDB_COLORS[game.protondb_tier.toLowerCase()] || "#888"}22`,
                            color: PROTONDB_COLORS[game.protondb_tier.toLowerCase()] || "#888",
                            borderRadius: s(4),
                            fontWeight: 500,
                        }}>
                            ProtonDB: {game.protondb_tier}
                        </span>
                    )}

                    {/* Steam review */}
                    {game.steam_review_score > 0 && (
                        <span style={{
                            fontSize: s(9),
                            padding: `${s(3)}px ${s(8)}px`,
                            backgroundColor: `${getReviewColor(game.steam_review_score)}22`,
                            color: getReviewColor(game.steam_review_score),
                            borderRadius: s(4),
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            gap: s(4),
                        }}>
                            <FaStar size={s(8)} />
                            {game.steam_review_description || `${game.steam_review_score}/10`}
                        </span>
                    )}

                    {/* Metacritic */}
                    {game.metacritic_score > 0 && (
                        <span style={{
                            fontSize: s(9),
                            padding: `${s(3)}px ${s(8)}px`,
                            backgroundColor: `${getMetacriticColor(game.metacritic_score)}22`,
                            color: getMetacriticColor(game.metacritic_score),
                            borderRadius: s(4),
                            fontWeight: 500,
                        }}>
                            MC: {game.metacritic_score}
                        </span>
                    )}
                </div>
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
    const [winnerScaleAnim, setWinnerScaleAnim] = useState(0.5);
    const [winnerOpacity, setWinnerOpacity] = useState(0);

    const { addGame: addToPlayNext, isInList: isInPlayNext, removeGame: removeFromPlayNext } = usePlayNext();
    const { excludeGame } = useExcludedGames();
    const mountedRef = useRef(true);
    const [confirmingExclude, setConfirmingExclude] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const scale = useContainerScale(containerRef);
    const s = (base: number) => Math.round(base * scale);

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
        call("clear_versus_state").catch(() => { });
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
        setWinnerScaleAnim(0.5);
        setWinnerOpacity(0);
        setPhase("winner");
        clearPersistedState();

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setWinnerScaleAnim(1);
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

    const handleExcludeGame = useCallback(async () => {
        if (!champion) return;
        if (confirmingExclude) {
            await excludeGame(champion);
            setConfirmingExclude(false);
            handleBack();
        } else {
            setConfirmingExclude(true);
            setTimeout(() => setConfirmingExclude(false), 3000);
        }
    }, [champion, confirmingExclude, excludeGame]);

    const handlePlayAgain = () => {
        clearPersistedState();
        loadInitialPair();
    };

    return (
        <div ref={containerRef} style={{
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
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "0 0 auto" }}>
                    <Focusable
                        flow-children="row"
                        style={{ display: "flex", gap: 16, alignItems: "stretch", flex: "0 0 auto" }}
                    >
                        <GameCard
                            game={champion}
                            label="Champion"
                            labelColor="#aa8844"
                            onPick={() => handlePick(champion)}
                            disabled={false}
                            scale={s}
                        />

                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 4px",
                        }}>
                            <span style={{
                                fontSize: s(18),
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
                            scale={s}
                        />
                    </Focusable>

                    {/* Bottom actions row — color-coded to match cards */}
                    <Focusable
                        flow-children="row"
                        style={{ display: "flex", gap: s(6), alignItems: "stretch" }}
                    >
                        <Focusable
                            onActivate={() => addToPlayNext(champion)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: s(4), padding: `${s(6)}px ${s(4)}px`,
                                backgroundColor: isInPlayNext(champion.appid) ? "#88aa8833" : "#ffffff11",
                                borderRadius: s(6), border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #aa8844",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #aa8844"; }}
                        >
                            <FaListUl size={s(9)} style={{ color: isInPlayNext(champion.appid) ? "#88aa88" : "#888" }} />
                            <span style={{ fontSize: s(9), color: isInPlayNext(champion.appid) ? "#88aa88" : "#aaa" }}>
                                {isInPlayNext(champion.appid) ? "Queued" : "Queue"}
                            </span>
                        </Focusable>

                        <Focusable
                            onActivate={() => handleExcludeInRound(champion, true)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: s(4), padding: `${s(6)}px ${s(4)}px`,
                                backgroundColor: "#ff666622", borderRadius: s(6),
                                border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #aa8844",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #aa8844"; }}
                        >
                            <FaBan size={s(9)} style={{ color: "#ff6666" }} />
                            <span style={{ fontSize: s(9), color: "#ff6666" }}>Exclude</span>
                        </Focusable>

                        <Focusable
                            onActivate={handleStopAndPick}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: s(4), padding: `${s(6)}px ${s(4)}px`,
                                backgroundColor: "#aa884433", borderRadius: s(6),
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaStopCircle size={s(9)} style={{ color: "#aa8844" }} />
                            <span style={{ fontSize: s(9), color: "#aa8844" }}>Stop</span>
                        </Focusable>

                        <Focusable
                            onActivate={() => handleExcludeInRound(challenger, false)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: s(4), padding: `${s(6)}px ${s(4)}px`,
                                backgroundColor: "#ff666622", borderRadius: s(6),
                                border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #4488aa",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #4488aa"; }}
                        >
                            <FaBan size={s(9)} style={{ color: "#ff6666" }} />
                            <span style={{ fontSize: s(9), color: "#ff6666" }}>Exclude</span>
                        </Focusable>

                        <Focusable
                            onActivate={() => addToPlayNext(challenger)}
                            style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: s(4), padding: `${s(6)}px ${s(4)}px`,
                                backgroundColor: isInPlayNext(challenger.appid) ? "#88aa8833" : "#ffffff11",
                                borderRadius: s(6), border: "2px solid transparent", cursor: "pointer",
                                borderLeft: "3px solid #4488aa",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => { e.target.style.borderColor = "transparent"; e.target.style.borderLeft = "3px solid #4488aa"; }}
                        >
                            <FaListUl size={s(9)} style={{ color: isInPlayNext(challenger.appid) ? "#88aa88" : "#888" }} />
                            <span style={{ fontSize: s(9), color: isInPlayNext(challenger.appid) ? "#88aa88" : "#aaa" }}>
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
                    transform: `scale(${winnerScaleAnim})`,
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
                        {/* Header image with WINNER badge overlay */}
                        <div style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "460 / 215",
                            maxHeight: 215,
                            flexShrink: 0,
                        }}>
                            <GameImage
                                appid={champion.appid}
                                isNonSteam={champion.is_non_steam}
                                matchedAppid={champion.matched_appid}
                                aspect="landscape"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                                top: 8, left: 8,
                                display: "flex", alignItems: "center", gap: 4,
                                padding: "3px 10px",
                                backgroundColor: "#aa8844", borderRadius: 4,
                            }}>
                                <FaTrophy size={10} style={{ color: "#fff" }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>WINNER</span>
                            </div>
                        </div>

                        {/* Scrollable metadata body */}
                        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
                            {/* Name */}
                            <div style={{ fontSize: 16, fontWeight: "bold", color: "white" }}>
                                {champion.name}
                                {champion.is_non_steam && (
                                    <span style={{ marginLeft: 6, fontSize: 9, color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
                                )}
                            </div>

                            {/* Playtime */}
                            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#aaa" }}>
                                <span><FaGamepad style={{ marginRight: 3 }} />{formatPlaytime(champion.playtime_forever)}</span>
                                <span>Last: {formatLastPlayed(champion.rtime_last_played)}</span>
                            </div>

                            {/* GameMetadataRow (new) */}
                            <GameMetadataRow game={{
                                size_on_disk: getSizeOnDisk(champion.appid) ?? champion.size_on_disk,
                                rtime_purchased: getPurchaseDate(champion.appid) ?? champion.rtime_purchased,
                                release_date: champion.release_date,
                            }} scale={(n: number) => n} />

                            {/* Genres */}
                            {champion.genres.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {champion.genres.map((genre) => (
                                        <span key={genre} style={{
                                            fontSize: 9, padding: "2px 6px",
                                            backgroundColor: "#4488aa33", color: "#88ccff",
                                            borderRadius: 4,
                                        }}>{genre}</span>
                                    ))}
                                </div>
                            )}

                            {/* Community tags (new) */}
                            {champion.community_tags && champion.community_tags.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                    <FaTag size={8} style={{ color: "#666" }} />
                                    {champion.community_tags.slice(0, 5).map((tag) => (
                                        <span key={tag} style={{
                                            fontSize: 9, padding: "2px 6px",
                                            backgroundColor: "#aa886622", color: "#ddaa77",
                                            borderRadius: 4,
                                        }}>{tag}</span>
                                    ))}
                                    {champion.community_tags.length > 5 && (
                                        <span style={{ fontSize: 9, color: "#666" }}>+{champion.community_tags.length - 5}</span>
                                    )}
                                </div>
                            )}

                            {/* Compatibility & reviews (new) */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {champion.deck_status && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: `${DECK_STATUS_COLORS[champion.deck_status.toLowerCase()] || "#888"}22`,
                                        color: DECK_STATUS_COLORS[champion.deck_status.toLowerCase()] || "#888",
                                    }}>Deck: {champion.deck_status}</span>
                                )}
                                {champion.protondb_tier && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: `${PROTONDB_COLORS[champion.protondb_tier.toLowerCase()] || "#888"}22`,
                                        color: PROTONDB_COLORS[champion.protondb_tier.toLowerCase()] || "#888",
                                    }}>ProtonDB: {champion.protondb_tier}</span>
                                )}
                                {champion.steam_review_score > 0 && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: `${getReviewColor(champion.steam_review_score)}22`,
                                        color: getReviewColor(champion.steam_review_score),
                                        display: "flex", alignItems: "center", gap: 3,
                                    }}>
                                        <FaStar size={8} />
                                        {champion.steam_review_description || `${champion.steam_review_score}/10`}
                                    </span>
                                )}
                                {champion.metacritic_score > 0 && (
                                    <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 500,
                                        backgroundColor: `${getMetacriticColor(champion.metacritic_score)}22`,
                                        color: getMetacriticColor(champion.metacritic_score),
                                    }}>MC: {champion.metacritic_score}</span>
                                )}
                            </div>

                            {/* Versus stats */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "5px 10px", backgroundColor: "#aa884422",
                                borderRadius: 6, fontSize: 10, color: "#aa8844", fontWeight: 600,
                            }}>
                                <FaTrophy size={10} />
                                {poolExhausted
                                    ? `Defeated all ${rounds} challengers — pool exhausted!`
                                    : `Defeated ${rounds} challenger${rounds !== 1 ? "s" : ""}`
                                }
                            </div>
                        </div>
                    </div>

                    {/* Right: action buttons */}
                    <Focusable
                        flow-children="column"
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            minWidth: 140,
                            justifyContent: "center",
                        }}
                    >
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
                            onActivate={isInPlayNext(champion.appid) ? () => removeFromPlayNext(champion.appid) : () => addToPlayNext(champion)}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 12px",
                                backgroundColor: isInPlayNext(champion.appid) ? "#88aa8833" : "#ffffff11",
                                borderRadius: 8,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = "white"}
                            onBlur={(e: any) => e.target.style.borderColor = "transparent"}
                        >
                            <FaListUl size={12} style={{ color: isInPlayNext(champion.appid) ? "#88aa88" : "#aaa" }} />
                            <span style={{ fontSize: 12, color: isInPlayNext(champion.appid) ? "#88aa88" : "#aaa", fontWeight: 600 }}>
                                {isInPlayNext(champion.appid) ? "In Play Next" : "Play Next"}
                            </span>
                        </Focusable>

                        <Focusable
                            onActivate={handleExcludeGame}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 12px",
                                backgroundColor: confirmingExclude ? "#ff666644" : "#ff666622",
                                borderRadius: 8,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = "white"}
                            onBlur={(e: any) => e.target.style.borderColor = "transparent"}
                        >
                            <FaBan size={12} style={{ color: "#ff6666" }} />
                            <span style={{ fontSize: 12, color: "#ff6666", fontWeight: 600 }}>
                                {confirmingExclude ? "Confirm" : "Never Show"}
                            </span>
                        </Focusable>

                        <Focusable
                            onActivate={handlePlayAgain}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 8, padding: "10px 12px",
                                backgroundColor: "#aa884433", borderRadius: 8,
                                border: "2px solid transparent", cursor: "pointer",
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = "white"}
                            onBlur={(e: any) => e.target.style.borderColor = "transparent"}
                        >
                            <FaRedo size={12} style={{ color: "#aa8844" }} />
                            <span style={{ fontSize: 12, color: "#aa8844", fontWeight: 600 }}>New Battle</span>
                        </Focusable>
                    </Focusable>
                </div>
            )}
        </div>
    );
}

export function VersusPageWrapper() {
    return <VersusPage />;
}
