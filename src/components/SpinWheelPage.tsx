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
import { getBannerColorsForGames } from "../utils/bannerColors";
import { GameMetadataRow } from "../utils/gameMetadata";
import { logger } from "../utils/logger";
import { GameImage } from "../utils/GameImage";

export const SPIN_WHEEL_ROUTE = "/suggestme/spin-wheel";

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

const BASE_SPIN_DURATION_MS = 5000;
const MIN_SPIN_DURATION_MS = 3000;
const MAX_SPIN_DURATION_MS = 8000;
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
    const [bannerColors, setBannerColors] = useState<Map<number, string[]>>(new Map());

    const { addGame: addToPlayNext, removeGame: removeFromPlayNext, isInList: isInPlayNext } = usePlayNext();
    const { excludeGame } = useExcludedGames();
    const { config, setSpinWheelSilent } = useSuggestMeConfig();
    const isSilent = config.spin_wheel_silent ?? false;
    const useBannerColors = config.spin_wheel_banner_colors ?? false;

    const containerRef = useRef<HTMLDivElement>(null);
    const scale = useContainerScale(containerRef);
    const s = (base: number) => Math.round(base * scale);

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

    // Handle banner colors setting changes
    useEffect(() => {
        if (!payload || payload.candidates.length === 0) return;
        
        if (useBannerColors) {
            // Fetch banner colors when enabled
            const appids = payload.candidates.map(g => g.is_non_steam && g.matched_appid ? g.matched_appid : g.appid);
            getBannerColorsForGames(appids).then(colors => {
                if (mountedRef.current) {
                    setBannerColors(colors);
                }
            });
        } else {
            // Clear banner colors when disabled (revert to defaults)
            setBannerColors(new Map());
        }
    }, [useBannerColors, payload]);

    const spinWheel = useCallback((velocityMultiplier: number = 1, clockwise: boolean = true) => {
        if (!payload || isSpinning || payload.candidates.length === 0) return;

        setIsSpinning(true);
        setShowWinner(false);
        setConfirmingExclude(false);

        const totalSlices = payload.candidates.length;
        const sliceAngle = 360 / totalSlices;

        const targetSliceIndex = payload.winner_index;

        // The slice is drawn such that its center is at (targetSliceIndex * sliceAngle + sliceAngle / 2)
        const targetAngle = 360 - (targetSliceIndex * sliceAngle + sliceAngle / 2);

        const baseRotations = MIN_ROTATIONS + Math.random() * (MAX_ROTATIONS - MIN_ROTATIONS);
        const adjustedRotations = Math.floor(baseRotations * Math.max(0.7, Math.min(1.8, velocityMultiplier)));
        
        // Ensure the final rotation lands exactly on the target angle
        const startRotation = rotation % 360;
        const targetAbsoluteRotation = targetAngle + (adjustedRotations * 360);
        
        // Calculate the exact amount to rotate from current position
        let totalRotation;
        if (clockwise) {
            totalRotation = targetAbsoluteRotation - startRotation;
            if (totalRotation < 360 * MIN_ROTATIONS) totalRotation += 360;
        } else {
            // For counter-clockwise, go negative
            const targetNegativeRotation = targetAngle - 360 - (adjustedRotations * 360);
            totalRotation = targetNegativeRotation - startRotation;
            if (totalRotation > -360 * MIN_ROTATIONS) totalRotation -= 360;
        }

        const startTime = performance.now();
        const rawDuration = BASE_SPIN_DURATION_MS * velocityMultiplier;
        const duration = Math.max(MIN_SPIN_DURATION_MS, Math.min(MAX_SPIN_DURATION_MS, rawDuration));

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
            const originalAngleAtPointer = (360 - normalizedRotation) % 360;
            const pointerSliceIndex = Math.floor(originalAngleAtPointer / sliceAngle) % totalSlices;

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

    const handleTouchEnd = async (e: React.TouchEvent) => {
        if (isSpinning || !payload || !touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dur = performance.now() - touchStartRef.current.time;

        const velocity = distance / Math.max(dur, 1);
        const clockwise = dx > 0 || (dx === 0 && dy < 0);

        if (velocity > 0.3) {
            const velocityMultiplier = Math.max(0.6, Math.min(velocity / 1.5, 2.0));
            // If showing a winner, fetch new candidates first
            if (showWinner) {
                await handleSpinAgain();
            }
            // Wait a bit for state to update, then spin
            setTimeout(() => spinWheel(velocityMultiplier, clockwise), 100);
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
            const appid = payload.winner.appid;
            Navigation.NavigateToLibraryTab();
            Navigation.Navigate(`/library/app/${appid}`);
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
                    color: "#888", fontSize: s(12),
                }}>
                    No candidates
                </div>
            );
        }

        const totalSlices = payload.candidates.length;
        const sliceAngle = 360 / totalSlices;
        const showLabels = totalSlices <= MAX_LABELS && size >= 200;

        const gradientStops: string[] = [];
        for (let i = 0; i < totalSlices; i++) {
            const game = payload.candidates[i];
            const effectiveAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;
            const bannerColor = bannerColors.get(effectiveAppId)?.[0];
            const color = bannerColor || SLICE_COLORS[i % SLICE_COLORS.length];
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
                    const startRadius = size * 0.11; // Start right after the center circle (radius is 0.08)
                    const availableWidth = (size * 0.5) - startRadius - s(8); // Available space to the edge
                    
                    return (
                        <div key={game.appid} style={{
                            position: "absolute", left: "50%", top: "50%",
                            transformOrigin: "0 0",
                            transform: `rotate(${angle - 90}deg) translate(${startRadius}px, -50%)`,
                            fontSize: s(9), fontWeight: 600, color: "#fff",
                            textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
                            pointerEvents: "none",
                            width: availableWidth,
                            textAlign: "left",
                            lineHeight: 1.1,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}>
                            {game.name}
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

    const renderPointerAndWheel = (size: number) => {
        const pointerW = Math.round(size * 0.035);
        const pointerH = Math.round(size * 0.06);
        return (
            <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                    position: "absolute", top: -pointerW, left: "50%",
                    transform: "translateX(-50%)", width: 0, height: 0,
                    borderLeft: `${pointerW}px solid transparent`,
                    borderRight: `${pointerW}px solid transparent`,
                    borderTop: `${pointerH}px solid #ffaa00`, zIndex: 10,
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }} />
                {renderWheel(size)}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%', height: '100%', backgroundColor: '#0e141b',
                padding: `${s(48)}px ${s(36)}px ${s(28)}px ${s(36)}px`,
                boxSizing: 'border-box',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            {/* Header: Back + History in a row */}
            <Focusable
                flow-children="row"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s(12), width: '100%' }}
            >
                <Focusable
                    onActivate={handleBack}
                    style={{
                        display: 'flex', alignItems: 'center', gap: s(6),
                        padding: `${s(6)}px ${s(10)}px`,
                        backgroundColor: '#ffffff11',
                        borderRadius: s(6), cursor: 'pointer', border: '2px solid transparent',
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = 'white')}
                    onBlur={(e: any) => (e.target.style.borderColor = 'transparent')}
                >
                    <FaArrowLeft size={s(10)} />
                    <span style={{ fontSize: s(11) }}>Back</span>
                </Focusable>
                <span style={{ fontSize: s(14), fontWeight: 600, color: "#fff" }}>Spin the Wheel</span>
                <Focusable
                    onActivate={() => navigateToHistory()}
                    style={{
                        display: 'flex', alignItems: 'center', gap: s(6),
                        padding: `${s(6)}px ${s(10)}px`,
                        backgroundColor: '#ffffff11',
                        borderRadius: s(6), cursor: 'pointer', border: '2px solid transparent',
                    }}
                    onFocus={(e: any) => (e.target.style.borderColor = 'white')}
                    onBlur={(e: any) => (e.target.style.borderColor = 'transparent')}
                >
                    <FaHistory size={s(10)} />
                    <span style={{ fontSize: s(11) }}>History</span>
                </Focusable>
            </Focusable>

            {isLoading && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: '#888', fontSize: s(14) }}>Loading candidates...</div>
                </div>
            )}

            {error && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: '#ff6666', fontSize: s(14) }}>{error}</div>
                </div>
            )}

            {/* PHASE 1: Before spin - centered large wheel + right panel */}
            {!isLoading && !error && !showWinner && (
                <div style={{
                    flex: 1, display: "flex", gap: s(32),
                    alignItems: "center", justifyContent: "center",
                }}>
                    {renderPointerAndWheel(s(300))}

                    <div style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: s(16), maxWidth: s(200),
                    }}>
                        <FaDice size={s(36)} style={{ color: "#555", opacity: 0.6 }} />
                        <div style={{ color: "#888", fontSize: s(13), textAlign: "center", lineHeight: 1.5 }}>
                            Spin the wheel to get a suggestion!
                        </div>
                        <div style={{ color: "#666", fontSize: s(10), textAlign: "center" }}>
                            Swipe the wheel or press Spin
                        </div>
                        <Focusable
                            onActivate={() => spinWheel(1)}
                            style={{
                                width: s(140), justifyContent: "center",
                                padding: `${s(12)}px ${s(16)}px`,
                                backgroundColor: isSpinning ? "#666" : "#4488aa",
                                borderRadius: s(8), cursor: isSpinning ? "default" : "pointer",
                                border: "2px solid transparent",
                                display: "flex", alignItems: "center", gap: s(8),
                                opacity: isSpinning ? 0.6 : 1, marginTop: s(4),
                            }}
                            onFocus={(e: any) => !isSpinning && (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaPlay size={s(14)} style={{ color: "#fff" }} />
                            <span style={{ color: "#fff", fontSize: s(14), fontWeight: 600 }}>
                                {isSpinning ? "Spinning..." : "Spin!"}
                            </span>
                        </Focusable>
                        <div style={{ fontSize: s(10), color: "#555" }}>
                            {initialCandidatesCount} games in the pool
                        </div>
                        <Focusable
                            onActivate={() => setSpinWheelSilent(!isSilent)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: s(6), marginTop: s(8), padding: `${s(5)}px ${s(10)}px`,
                                backgroundColor: isSilent ? '#ffffff08' : '#aa884422',
                                borderRadius: s(5), cursor: 'pointer', border: '2px solid transparent',
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = 'white'}
                            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                        >
                            {isSilent ? <FaVolumeMute size={s(10)} style={{ color: '#666' }} /> : <FaVolumeUp size={s(10)} style={{ color: '#aa8844' }} />}
                            <span style={{ fontSize: s(9), color: isSilent ? '#666' : '#aa8844' }}>
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
                        flex: 1, display: "flex", gap: s(20),
                        alignItems: "center",
                        marginTop: -s(4),
                        width: '100%',
                    }}
                >
                    {/* Left: smaller wheel + spin again - centered in available left space */}
                    <div style={{ 
                        flex: 1, display: "flex", flexDirection: "column", 
                        alignItems: "center", justifyContent: "center", 
                        gap: s(8) 
                    }}>
                        {renderPointerAndWheel(s(180))}
                        <Focusable
                            onActivate={handleSpinAgain}
                            style={{
                                padding: `${s(8)}px ${s(32)}px`,
                                backgroundColor: "#4488aa", borderRadius: s(6),
                                cursor: "pointer", border: "2px solid transparent",
                                display: "flex", alignItems: "center", gap: s(6),
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaRedo size={s(10)} style={{ color: "#fff" }} />
                            <span style={{ color: "#fff", fontSize: s(11), fontWeight: 600 }}>Spin Again</span>
                        </Focusable>
                        <div style={{ fontSize: s(9), color: "#555" }}>
                            {initialCandidatesCount} games
                        </div>
                    </div>

                    {/* Right: large game card with buttons below */}
                    {(() => {
                        const game = payload.winner;
                        return (
                            <div style={{
                                display: "flex", flexDirection: "column", gap: s(10),
                                background: "#1a1f2e", borderRadius: s(10), padding: s(12),
                                overflow: "hidden", 
                                width: "100%", 
                                maxWidth: s(480), 
                                marginLeft: "auto",
                            }}>
                                {/* Header image - maintain perfect aspect ratio */}
                                <div style={{
                                    width: "100%",
                                    aspectRatio: "460 / 215",
                                    borderRadius: s(8),
                                    overflow: "hidden",
                                }}>
                                    <GameImage
                                        appid={game.appid}
                                        isNonSteam={game.is_non_steam}
                                        matchedAppid={game.matched_appid}
                                        aspect="landscape"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                        }}
                                        showPlaceholder={true}
                                        placeholderIcon={game.is_non_steam ? "gamepad" : "steam"}
                                    />
                                </div>

                                {/* Game info row */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: s(12) }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: s(16), fontWeight: "bold", color: "white", marginBottom: s(6) }}>
                                            {game.name}
                                            {game.is_non_steam && (
                                                <span style={{ marginLeft: s(8), fontSize: s(10), color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", gap: s(6), flexWrap: "wrap", marginBottom: s(6) }}>
                                            {game.genres.slice(0, 4).map((genre) => (
                                                <span key={genre} style={{
                                                    background: "var(--gpColor-Blue)", color: "white",
                                                    padding: `${s(2)}px ${s(8)}px`, borderRadius: s(4), fontSize: s(10),
                                                }}>
                                                    {genre}
                                                </span>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", gap: s(16), fontSize: s(11), color: "#aaa" }}>
                                            <span><FaGamepad style={{ marginRight: s(4) }} />{formatPlaytime(game.playtime_forever)}</span>
                                            <span>Last: {formatLastPlayed(game.rtime_last_played)}</span>
                                        </div>
                                        <GameMetadataRow game={game} scale={s} />
                                    </div>
                                    {(game.steam_review_description || game.metacritic_score > 0) && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: s(4), alignItems: "flex-end", fontSize: s(11), color: "#aaa" }}>
                                            {game.steam_review_description && (
                                                <span style={{ display: "flex", alignItems: "center", gap: s(4) }}>
                                                    <FaStar style={{ color: "#ffcc00" }} />
                                                    {game.steam_review_description}
                                                </span>
                                            )}
                                            {game.metacritic_score > 0 && (
                                                <span style={{
                                                    background: game.metacritic_score >= 75 ? "#66cc33" : game.metacritic_score >= 50 ? "#ffcc33" : "#ff6666",
                                                    color: "#000", padding: `${s(2)}px ${s(6)}px`, borderRadius: s(3),
                                                    fontWeight: "bold", fontSize: s(10),
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
                                    style={{ display: "flex", gap: s(8), marginTop: s(4) }}
                                >
                                    <Focusable
                                        onActivate={handleLaunchGame}
                                        style={{
                                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                            gap: s(6), padding: `${s(10)}px ${s(8)}px`,
                                            backgroundColor: "#4488aa", borderRadius: s(6),
                                            border: "2px solid transparent", cursor: "pointer",
                                        }}
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                    >
                                        <FaExternalLinkAlt size={s(11)} style={{ color: "#fff", flexShrink: 0 }} />
                                        <span style={{ fontSize: s(11), color: "#fff", whiteSpace: "nowrap" }}>View Game</span>
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
                                                gap: s(6), padding: `${s(10)}px ${s(8)}px`,
                                                backgroundColor: "#1a6e9a", borderRadius: s(6),
                                                border: "2px solid transparent", cursor: "pointer",
                                            }}
                                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                        >
                                            <FaStore size={s(11)} style={{ color: "#fff", flexShrink: 0 }} />
                                            <span style={{ fontSize: s(11), color: "#fff", whiteSpace: "nowrap" }}>Store Page</span>
                                        </Focusable>
                                    )}

                                    <Focusable
                                        onActivate={currentGameInPlayNext && !justAddedToPlayNext ? handleRemoveFromPlayNext : handleAddToPlayNext}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: s(6), padding: `${s(10)}px ${s(8)}px`,
                                            backgroundColor: justAddedToPlayNext ? '#88ff8833' : (currentGameInPlayNext ? '#88aa8833' : '#ffffff11'),
                                            borderRadius: s(6), border: '2px solid transparent', cursor: 'pointer',
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <FaListUl size={s(11)} style={{ color: justAddedToPlayNext ? '#88ff88' : (currentGameInPlayNext ? '#88aa88' : '#888'), flexShrink: 0 }} />
                                        <span style={{ fontSize: s(11), color: justAddedToPlayNext ? '#88ff88' : (currentGameInPlayNext ? '#88aa88' : '#aaa'), whiteSpace: 'nowrap' }}>
                                            {justAddedToPlayNext ? 'Added!' : (currentGameInPlayNext ? 'Remove' : 'Play Next')}
                                        </span>
                                    </Focusable>

                                    <Focusable
                                        onActivate={handleExcludeGame}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: s(6), padding: `${s(10)}px ${s(8)}px`,
                                            backgroundColor: confirmingExclude ? '#ff666644' : '#ff666622',
                                            borderRadius: s(6), border: '2px solid transparent', cursor: 'pointer',
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <FaBan size={s(11)} style={{ color: '#ff6666', flexShrink: 0 }} />
                                        <span style={{ fontSize: s(11), color: '#ff6666', whiteSpace: 'nowrap' }}>
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
