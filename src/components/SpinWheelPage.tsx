import { useState, useRef, useEffect, useCallback } from "react";
import { Focusable, Navigation } from "@decky/ui";
import { call } from "@decky/api";
import { FaDice, FaPlay, FaRedo, FaExternalLinkAlt, FaGamepad, FaStar, FaStore, FaArrowLeft, FaBan, FaHistory, FaListUl, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { Game, SuggestFilters, SpinWheelPayload } from "../types";
import { playWheelClick, cleanupAudio } from "../utils/sounds";
import { usePlayNext } from "../hooks/usePlayNext";
import { useExcludedGames } from "../hooks/useExcludedGames";
import { useSuggestMeConfig } from "../hooks/useSuggestMeConfig";
import { navigateToHistory } from "./HistoryModal";
import { logger } from "../utils/logger";

export const SPIN_WHEEL_ROUTE = "/suggestme/spin-wheel";

const WHEEL_SIZE_LARGE = 300;
const WHEEL_SIZE_SMALL = 200;
const SPIN_DURATION_MS = 5000;
const MIN_ROTATIONS = 6;
const MAX_ROTATIONS = 10;
const MAX_LABELS = 10;

const SLICE_COLORS = [
    "#4488aa", "#aa8866", "#88aa88", "#aa6688",
    "#6688aa", "#88aa66", "#aa8844", "#668888",
    "#886688", "#448866", "#884466", "#668844",
];

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

let cachedFilters: SuggestFilters | null = null;
let cachedInstalledAppIds: number[] = [];
let cachedPresetName: string | undefined = undefined;
let onCompleteCallback: ((winner: Game | null) => void) | null = null;

export function setSpinWheelParams(
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

export function SpinWheelPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSpinning, setIsSpinning] = useState(false);
    const [payload, setPayload] = useState<SpinWheelPayload | null>(null);
    const [rotation, setRotation] = useState(0);
    const [showWinner, setShowWinner] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmingExclude, setConfirmingExclude] = useState(false);
    const [justAddedToPlayNext, setJustAddedToPlayNext] = useState(false);
    const [initialCandidatesCount, setInitialCandidatesCount] = useState<number>(0);

    const { addGame: addToPlayNext, removeGame: removeFromPlayNext, isInList: isInPlayNext } = usePlayNext();
    const { excludeGame } = useExcludedGames();
    const { config, setSpinWheelSilent } = useSuggestMeConfig();
    const isSilent = config.spin_wheel_silent ?? false;

    const wheelRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const lastSliceIndexRef = useRef<number>(-1);
    const mountedRef = useRef(true);
    const silentRef = useRef(isSilent);

    const loadCandidates = useCallback(async (isInitial: boolean = false) => {
        if (!cachedFilters) {
            setError("No filters configured");
            setIsLoading(false);
            return;
        }
        if (isInitial) setIsLoading(true);
        setError(null);
        try {
            const result = await call<[object, number[], string | undefined], SpinWheelPayload>(
                "get_luck_spin_candidates",
                cachedFilters,
                cachedInstalledAppIds,
                cachedPresetName
            );
            if (!mountedRef.current) return;
            if (result?.error) {
                setError(result.error);
            } else if (result) {
                setPayload(result);
                if (isInitial) {
                    setInitialCandidatesCount(result.candidates_count ?? result.candidates.length);
                }
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to load spin candidates:", e);
            if (mountedRef.current) setError("Failed to load candidates");
        } finally {
            if (mountedRef.current && isInitial) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        loadCandidates(true);
        return () => {
            mountedRef.current = false;
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            cleanupAudio();
        };
    }, [loadCandidates]);

    const spinWheel = useCallback((velocityMultiplier: number = 1) => {
        if (!payload || isSpinning || payload.candidates.length === 0) return;

        setIsSpinning(true);
        setShowWinner(false);
        setConfirmingExclude(false);

        const totalSlices = payload.candidates.length;
        const sliceAngle = 360 / totalSlices;

        const targetSliceIndex = payload.winner_index;
        const targetAngle = 360 - (targetSliceIndex * sliceAngle + sliceAngle / 2);

        const baseRotations = MIN_ROTATIONS + Math.random() * (MAX_ROTATIONS - MIN_ROTATIONS);
        const adjustedRotations = baseRotations * Math.max(0.7, Math.min(1.5, velocityMultiplier));
        const totalRotation = adjustedRotations * 360 + targetAngle;

        const startRotation = rotation % 360;
        const startTime = performance.now();
        const duration = SPIN_DURATION_MS * Math.max(0.8, Math.min(1.2, velocityMultiplier));

        silentRef.current = isSilent;
        lastSliceIndexRef.current = -1;

        const animate = (currentTime: number) => {
            if (!mountedRef.current) return;

            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutCubic(progress);

            const currentRotation = startRotation + totalRotation * easedProgress;
            setRotation(currentRotation);

            const normalizedRotation = ((currentRotation % 360) + 360) % 360;
            const pointerSliceIndex = Math.floor(normalizedRotation / sliceAngle) % totalSlices;

            if (pointerSliceIndex !== lastSliceIndexRef.current) {
                if (!silentRef.current) {
                    const vol = (1 - easedProgress) * 0.3 + 0.1;
                    playWheelClick(vol);
                }
                lastSliceIndexRef.current = pointerSliceIndex;
            }

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setIsSpinning(false);
                setShowWinner(true);
            }
        };

        animationRef.current = requestAnimationFrame(animate);
    }, [payload, isSpinning, rotation, isSilent]);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isSpinning || !payload) return;
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: performance.now(),
        };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (isSpinning || !payload || !touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dur = performance.now() - touchStartRef.current.time;

        const velocity = distance / Math.max(dur, 1);

        if (velocity > 0.3) {
            spinWheel(Math.min(velocity / 2, 2));
        }

        touchStartRef.current = null;
    };

    const handleSpinAgain = async () => {
        setShowWinner(false);
        setRotation(0);
        setConfirmingExclude(false);
        setJustAddedToPlayNext(false);
        await loadCandidates(false);
    };

    const handleLaunchGame = () => {
        if (payload?.winner) {
            const effectiveAppId = payload.winner.is_non_steam && payload.winner.matched_appid
                ? payload.winner.matched_appid
                : payload.winner.appid;
            Navigation.NavigateToLibraryTab();
            Navigation.Navigate(`/library/app/${effectiveAppId}`);
        }
    };

    const handleBack = () => {
        if (onCompleteCallback && payload?.winner && showWinner) {
            onCompleteCallback(payload.winner);
        } else if (onCompleteCallback) {
            onCompleteCallback(null);
        }
        Navigation.NavigateBack();
    };

    const handleAddToPlayNext = async () => {
        if (payload?.winner) {
            await addToPlayNext(payload.winner);
            setJustAddedToPlayNext(true);
            setTimeout(() => setJustAddedToPlayNext(false), 2000);
        }
    };

    const handleRemoveFromPlayNext = async () => {
        if (payload?.winner) {
            await removeFromPlayNext(payload.winner.appid);
        }
    };

    const handleExcludeGame = async () => {
        if (!confirmingExclude) {
            setConfirmingExclude(true);
            return;
        }
        if (payload?.winner) {
            await excludeGame(payload.winner);
            setConfirmingExclude(false);
            handleSpinAgain();
        }
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
        const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
        return `${Math.floor(diffDays / 365)}y ago`;
    };

    const currentGameInPlayNext = payload?.winner ? isInPlayNext(payload.winner.appid) : false;

    const renderWheel = (size: number) => {
        if (!payload || payload.candidates.length === 0) {
            return (
                <div style={{
                    width: size, height: size, borderRadius: "50%",
                    backgroundColor: "#333", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#888", fontSize: 12,
                }}>
                    No candidates
                </div>
            );
        }

        const totalSlices = payload.candidates.length;
        const sliceAngle = 360 / totalSlices;
        const showLabels = totalSlices <= MAX_LABELS && size >= WHEEL_SIZE_LARGE;

        const gradientStops: string[] = [];
        for (let i = 0; i < totalSlices; i++) {
            const color = SLICE_COLORS[i % SLICE_COLORS.length];
            gradientStops.push(`${color} ${i * sliceAngle}deg ${(i + 1) * sliceAngle}deg`);
        }

        const centerSize = Math.round(size * 0.16);

        return (
            <div
                ref={wheelRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{
                    width: size, height: size, borderRadius: "50%",
                    background: `conic-gradient(${gradientStops.join(", ")})`,
                    transform: `rotate(${rotation}deg)`,
                    transition: isSpinning ? "none" : "transform 0.1s ease-out",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
                    border: "3px solid #fff",
                    cursor: isSpinning ? "default" : "grab",
                    position: "relative", flexShrink: 0,
                }}
            >
                {showLabels && payload.candidates.map((game, i) => {
                    const angle = i * sliceAngle + sliceAngle / 2;
                    const labelRadius = size * 0.33;
                    const rad = (angle - 90) * (Math.PI / 180);
                    const x = Math.cos(rad) * labelRadius;
                    const y = Math.sin(rad) * labelRadius;
                    const truncatedName = game.name.length > 10
                        ? game.name.substring(0, 8) + "..."
                        : game.name;
                    return (
                        <div key={game.appid} style={{
                            position: "absolute", left: "50%", top: "50%",
                            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle}deg)`,
                            fontSize: 8, fontWeight: 600, color: "#fff",
                            textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                            whiteSpace: "nowrap", pointerEvents: "none",
                            maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                            {truncatedName}
                        </div>
                    );
                })}
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: centerSize, height: centerSize, borderRadius: "50%",
                    backgroundColor: "#1a1a2e", border: "2px solid #fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <FaDice size={Math.round(centerSize * 0.45)} style={{ color: "#fff" }} />
                </div>
            </div>
        );
    };

    const renderPointerAndWheel = (size: number) => (
        <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
                position: "absolute", top: -10, left: "50%",
                transform: "translateX(-50%)", width: 0, height: 0,
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: "18px solid #ffaa00", zIndex: 10,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }} />
            {renderWheel(size)}
        </div>
    );

    return (
        <div style={{
            width: '100%', height: '100%', backgroundColor: '#0e141b',
            padding: '40px 24px 24px 24px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header: Back + History in a row */}
            <Focusable
                flow-children="row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
            >
                <Focusable
                    onActivate={handleBack}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', backgroundColor: '#ffffff11',
                        borderRadius: 6, cursor: 'pointer', border: '2px solid transparent',
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = 'white')}
                    onBlur={(e: any) => (e.target.style.borderColor = 'transparent')}
                >
                    <FaArrowLeft size={10} />
                    <span style={{ fontSize: 11 }}>Back</span>
                </Focusable>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Spin the Wheel</span>
                <Focusable
                    onActivate={() => navigateToHistory()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', backgroundColor: '#ffffff11',
                        borderRadius: 6, cursor: 'pointer', border: '2px solid transparent',
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = 'white')}
                    onBlur={(e: any) => (e.target.style.borderColor = 'transparent')}
                >
                    <FaHistory size={10} />
                    <span style={{ fontSize: 11 }}>History</span>
                </Focusable>
            </Focusable>

            {isLoading && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: '#888', fontSize: 14 }}>Loading candidates...</div>
                </div>
            )}

            {error && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: '#ff6666', fontSize: 14 }}>{error}</div>
                </div>
            )}

            {/* PHASE 1: Before spin - centered large wheel + right panel */}
            {!isLoading && !error && !showWinner && (
                <div style={{
                    flex: 1, display: "flex", gap: 32,
                    alignItems: "center", justifyContent: "center",
                }}>
                    {renderPointerAndWheel(WHEEL_SIZE_LARGE)}

                    <div style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: 16, maxWidth: 200,
                    }}>
                        <FaDice size={36} style={{ color: "#555", opacity: 0.6 }} />
                        <div style={{ color: "#888", fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>
                            Spin the wheel to get a suggestion!
                        </div>
                        <div style={{ color: "#666", fontSize: 10, textAlign: "center" }}>
                            Flick the wheel or tap Spin
                        </div>
                        <Focusable
                            onActivate={() => spinWheel(1)}
                            style={{
                                width: 140, justifyContent: "center",
                                padding: "12px 16px",
                                backgroundColor: isSpinning ? "#666" : "#4488aa",
                                borderRadius: 8, cursor: isSpinning ? "default" : "pointer",
                                border: "2px solid transparent",
                                display: "flex", alignItems: "center", gap: 8,
                                opacity: isSpinning ? 0.6 : 1, marginTop: 4,
                            }}
                            onFocus={(e: any) => !isSpinning && (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaPlay size={14} style={{ color: "#fff" }} />
                            <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                                {isSpinning ? "Spinning..." : "Spin!"}
                            </span>
                        </Focusable>
                        <div style={{ fontSize: 10, color: "#555" }}>
                            {initialCandidatesCount} games in the pool
                        </div>
                        <Focusable
                            onActivate={() => setSpinWheelSilent(!isSilent)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 6, marginTop: 8, padding: '5px 10px',
                                backgroundColor: isSilent ? '#ffffff08' : '#aa884422',
                                borderRadius: 5, cursor: 'pointer', border: '2px solid transparent',
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = 'white'}
                            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                        >
                            {isSilent ? <FaVolumeMute size={10} style={{ color: '#666' }} /> : <FaVolumeUp size={10} style={{ color: '#aa8844' }} />}
                            <span style={{ fontSize: 9, color: isSilent ? '#666' : '#aa8844' }}>
                                Sound {isSilent ? 'OFF' : 'ON'}
                            </span>
                        </Focusable>
                    </div>
                </div>
            )}

            {/* PHASE 2: After spin - wheel left, large game card + buttons right */}
            {showWinner && payload?.winner && (
                <Focusable
                    flow-children="row"
                    style={{
                        flex: 1, display: "flex", gap: 20,
                        alignItems: "flex-start",
                    }}
                >
                    {/* Left: smaller wheel + spin again */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {renderPointerAndWheel(WHEEL_SIZE_SMALL)}
                        <Focusable
                            onActivate={handleSpinAgain}
                            style={{
                                padding: "8px 20px",
                                backgroundColor: "#4488aa", borderRadius: 6,
                                cursor: "pointer", border: "2px solid transparent",
                                display: "flex", alignItems: "center", gap: 6,
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaRedo size={10} style={{ color: "#fff" }} />
                            <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>Spin Again</span>
                        </Focusable>
                        <div style={{ fontSize: 9, color: "#555" }}>
                            {initialCandidatesCount} games
                        </div>
                    </div>

                    {/* Right: large game card with buttons below */}
                    {(() => {
                        const game = payload.winner;
                        const effectiveAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;
                        const headerUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${effectiveAppId}/header.jpg`;
                        return (
                            <div style={{
                                flex: 1, display: "flex", flexDirection: "column", gap: 10,
                                background: "#1a1f2e", borderRadius: 10, padding: 12,
                                overflow: "hidden", maxWidth: 520,
                            }}>
                                {/* Header image*/}
                                <div style={{
                                    width: "100%",
                                    aspectRatio: "460 / 215",
                                    backgroundImage: `url(${headerUrl})`,
                                    backgroundSize: "cover", backgroundPosition: "center",
                                    borderRadius: 8,
                                }} />

                                {/* Game info row */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 16, fontWeight: "bold", color: "white", marginBottom: 6 }}>
                                            {game.name}
                                            {game.is_non_steam && (
                                                <span style={{ marginLeft: 8, fontSize: 10, color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                                            {game.genres.slice(0, 4).map((genre) => (
                                                <span key={genre} style={{
                                                    background: "var(--gpColor-Blue)", color: "white",
                                                    padding: "2px 8px", borderRadius: 4, fontSize: 10,
                                                }}>
                                                    {genre}
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#aaa" }}>
                                            <span><FaGamepad style={{ marginRight: 4 }} />{formatPlaytime(game.playtime_forever)}</span>
                                            <span>Last: {formatLastPlayed(game.rtime_last_played)}</span>
                                        </div>
                                    </div>
                                    {(game.steam_review_description || game.metacritic_score > 0) && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", fontSize: 11, color: "#aaa" }}>
                                            {game.steam_review_description && (
                                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                    <FaStar style={{ color: "#ffcc00" }} />
                                                    {game.steam_review_description}
                                                </span>
                                            )}
                                            {game.metacritic_score > 0 && (
                                                <span style={{
                                                    background: game.metacritic_score >= 75 ? "#66cc33" : game.metacritic_score >= 50 ? "#ffcc33" : "#ff6666",
                                                    color: "#000", padding: "2px 6px", borderRadius: 3,
                                                    fontWeight: "bold", fontSize: 10,
                                                }}>
                                                    {game.metacritic_score}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <Focusable
                                    flow-children="row"
                                    style={{ display: "flex", gap: 8, marginTop: 4 }}
                                >
                                    <Focusable
                                        onActivate={handleLaunchGame}
                                        style={{
                                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                            gap: 6, padding: "10px 8px",
                                            backgroundColor: "#4488aa", borderRadius: 6,
                                            border: "2px solid transparent", cursor: "pointer",
                                        }}
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                    >
                                        <FaExternalLinkAlt size={11} style={{ color: "#fff", flexShrink: 0 }} />
                                        <span style={{ fontSize: 11, color: "#fff", whiteSpace: "nowrap" }}>View Game</span>
                                    </Focusable>

                                    {((!payload.winner.is_non_steam) || (payload.winner.is_non_steam && payload.winner.matched_appid)) && (
                                        <Focusable
                                            onActivate={() => {
                                                const storeAppId = payload.winner!.is_non_steam && payload.winner!.matched_appid
                                                    ? payload.winner!.matched_appid
                                                    : payload.winner!.appid;
                                                window.open(`steam://store/${storeAppId}`, "_blank");
                                            }}
                                            style={{
                                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                                gap: 6, padding: "10px 8px",
                                                backgroundColor: "#ffffff11", borderRadius: 6,
                                                border: "2px solid transparent", cursor: "pointer",
                                            }}
                                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                        >
                                            <FaStore size={11} style={{ color: "#aaa", flexShrink: 0 }} />
                                            <span style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>Store Page</span>
                                        </Focusable>
                                    )}

                                    <Focusable
                                        onActivate={currentGameInPlayNext && !justAddedToPlayNext ? handleRemoveFromPlayNext : handleAddToPlayNext}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: 6, padding: '10px 8px',
                                            backgroundColor: justAddedToPlayNext ? '#88ff8833' : (currentGameInPlayNext ? '#88aa8833' : '#ffffff11'),
                                            borderRadius: 6, border: '2px solid transparent', cursor: 'pointer',
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <FaListUl size={11} style={{ color: justAddedToPlayNext ? '#88ff88' : (currentGameInPlayNext ? '#88aa88' : '#888'), flexShrink: 0 }} />
                                        <span style={{ fontSize: 11, color: justAddedToPlayNext ? '#88ff88' : (currentGameInPlayNext ? '#88aa88' : '#aaa'), whiteSpace: 'nowrap' }}>
                                            {justAddedToPlayNext ? 'Added!' : (currentGameInPlayNext ? 'Remove' : 'Play Next')}
                                        </span>
                                    </Focusable>

                                    <Focusable
                                        onActivate={handleExcludeGame}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: 6, padding: '10px 8px',
                                            backgroundColor: confirmingExclude ? '#ff666644' : '#ff666622',
                                            borderRadius: 6, border: '2px solid transparent', cursor: 'pointer',
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <FaBan size={11} style={{ color: '#ff6666', flexShrink: 0 }} />
                                        <span style={{ fontSize: 11, color: '#ff6666', whiteSpace: 'nowrap' }}>
                                            {confirmingExclude ? 'Confirm' : 'Never Show'}
                                        </span>
                                    </Focusable>
                                </Focusable>
                            </div>
                        );
                    })()}
                </Focusable>
            )}
        </div>
    );
}

export function navigateToSpinWheel(
    filters: SuggestFilters,
    installedAppIds: number[],
    presetName: string | undefined,
    onComplete: (winner: Game | null) => void
) {
    setSpinWheelParams(filters, installedAppIds, presetName, onComplete);
    //Navigation.CloseSideMenus();
    Navigation.Navigate(SPIN_WHEEL_ROUTE);
}
