import { useState, useEffect, useCallback } from "react";
import {
    Focusable,
    PanelSection,
    PanelSectionRow,
    ButtonItem,
    //Spinner,
} from "@decky/ui";
import { call } from "@decky/api";
import { FaSync, FaChevronRight, FaGamepad, FaSteam, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import { Game } from "../types";
import { logger } from "../utils/logger";

interface MetadataFieldStats {
    field: string;
    label: string;
    filled: number;
    empty: number;
    total: number;
    percentage: number;
}

interface LibraryStats {
    totalGames: number;
    steamGames: number;
    nonSteamGames: number;
    matchedNonSteam: number;
    unmatchedNonSteam: number;
    fullyEnriched: number;
    partiallyEnriched: number;
    bareMinimum: number;
    fieldStats: MetadataFieldStats[];
}

interface StatisticsTabProps {
    onViewGames: (label: string, games: Game[]) => void;
}

const TRACKED_FIELDS: { field: keyof Game; label: string; checkFn: (g: Game) => boolean }[] = [
    { field: "name", label: "Name", checkFn: (g) => Boolean(g.name && g.name.trim()) },
    { field: "playtime_forever", label: "Playtime", checkFn: (g) => g.playtime_forever > 0 },
    { field: "rtime_last_played", label: "Last Played", checkFn: (g) => Boolean(g.rtime_last_played && g.rtime_last_played > 0) },
    { field: "genres", label: "Genres", checkFn: (g) => Array.isArray(g.genres) && g.genres.length > 0 },
    { field: "tags", label: "Steam Features", checkFn: (g) => Array.isArray(g.tags) && g.tags.length > 0 },
    { field: "community_tags", label: "Community Tags", checkFn: (g) => Array.isArray(g.community_tags) && g.community_tags.length > 0 },
    { field: "deck_status", label: "Deck Compatibility", checkFn: (g) => Boolean(g.deck_status && g.deck_status.trim()) },
    { field: "steam_review_score", label: "Steam Review Score", checkFn: (g) => g.steam_review_score > 0 },
    { field: "metacritic_score", label: "Metacritic Score", checkFn: (g) => g.metacritic_score > 0 },
    { field: "img_icon_url", label: "Icon Image", checkFn: (g) => Boolean(g.img_icon_url && g.img_icon_url.trim()) },
];

const getSeverityColor = (percentage: number): string => {
    if (percentage >= 80) return "#88ff88";
    if (percentage >= 40) return "#ffaa00";
    return "#ff6666";
};

const getSeverityBg = (percentage: number): string => {
    if (percentage >= 80) return "#88ff8822";
    if (percentage >= 40) return "#ffaa0022";
    return "#ff666622";
};

export function StatisticsTab({ onViewGames }: StatisticsTabProps) {
    const [games, setGames] = useState<Game[]>([]);
    const [stats, setStats] = useState<LibraryStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const computeStats = useCallback((gameList: Game[]): LibraryStats => {
        const total = gameList.length;
        const steamGames = gameList.filter(g => !g.is_non_steam);
        const nonSteamGames = gameList.filter(g => g.is_non_steam);
        const matchedNonSteam = nonSteamGames.filter(g => g.match_status === "matched");
        const unmatchedNonSteam = nonSteamGames.filter(g => g.match_status !== "matched");

        const fieldStats: MetadataFieldStats[] = TRACKED_FIELDS.map(({ field, label, checkFn }) => {
            const filled = gameList.filter(checkFn).length;
            const empty = total - filled;
            return {
                field,
                label,
                filled,
                empty,
                total,
                percentage: total > 0 ? Math.round((filled / total) * 100) : 0,
            };
        });

        const keyFields = ["genres", "tags", "deck_status", "steam_review_score"];
        const keyChecks = TRACKED_FIELDS.filter(f => keyFields.includes(f.field));
        
        let fullyEnriched = 0;
        let partiallyEnriched = 0;
        let bareMinimum = 0;

        for (const game of gameList) {
            const keyFieldsFilled = keyChecks.filter(({ checkFn }) => checkFn(game)).length;
            if (keyFieldsFilled === keyChecks.length) {
                fullyEnriched++;
            } else if (keyFieldsFilled > 0) {
                partiallyEnriched++;
            } else {
                bareMinimum++;
            }
        }

        return {
            totalGames: total,
            steamGames: steamGames.length,
            nonSteamGames: nonSteamGames.length,
            matchedNonSteam: matchedNonSteam.length,
            unmatchedNonSteam: unmatchedNonSteam.length,
            fullyEnriched,
            partiallyEnriched,
            bareMinimum,
            fieldStats,
        };
    }, []);

    const loadGames = useCallback(async () => {
        setError(null);
        try {
            const result = await call<[], { games: Game[] }>("get_library_games");
            if (result?.games) {
                setGames(result.games);
                setStats(computeStats(result.games));
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to load library games:", e);
            setError("Failed to load library data");
        }
    }, [computeStats]);

    useEffect(() => {
        loadGames();
    }, [loadGames]);

    const handleViewEmptyGames = (fieldDef: typeof TRACKED_FIELDS[0]) => {
        const emptyGames = games.filter(g => !fieldDef.checkFn(g));
        onViewGames(fieldDef.label, emptyGames);
    };

    if (error) {
        return (
            <div style={{ padding: 24, textAlign: "center" }}>
                <div style={{ color: "#ff6666", marginBottom: 12 }}>{error}</div>
                <ButtonItem layout="below" onClick={loadGames}>
                    Retry
                </ButtonItem>
            </div>
        );
    }

    if (!stats || stats.totalGames === 0) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
                <div style={{ marginBottom: 8 }}>No games in library cache.</div>
                <div style={{ fontSize: 11 }}>Sync your library in the Library tab first.</div>
            </div>
        );
    }

    return (
        <div style={{ padding: "16px 24px 80px 24px", maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 12,
                        }}
                    >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Library Overview</span>
                        <Focusable
                            onActivate={loadGames}
                            style={{
                                padding: "6px 10px",
                                backgroundColor: "#ffffff11",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                border: "2px solid transparent",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            <FaSync size={10} />
                            <span style={{ fontSize: 11 }}>Refresh</span>
                        </Focusable>
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <Focusable
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ padding: 12, backgroundColor: "#4488aa22", borderRadius: 8, textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "#4488aa" }}>{stats.totalGames}</div>
                            <div style={{ fontSize: 10, color: "#888" }}>Total Games</div>
                        </div>
                        <div style={{ padding: 12, backgroundColor: "#88ff8822", borderRadius: 8, textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "#88ff88" }}>{stats.fullyEnriched}</div>
                            <div style={{ fontSize: 10, color: "#888" }}>Fully Enriched</div>
                        </div>
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <Focusable
                        style={{
                            display: "flex",
                            gap: 8,
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ flex: 1, padding: 10, backgroundColor: "#ffffff08", borderRadius: 8, textAlign: "center" }}>
                            <FaSteam size={14} style={{ color: "#4488aa", marginBottom: 4 }} />
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{stats.steamGames}</div>
                            <div style={{ fontSize: 9, color: "#888" }}>Steam</div>
                        </div>
                        <div style={{ flex: 1, padding: 10, backgroundColor: "#ffffff08", borderRadius: 8, textAlign: "center" }}>
                            <FaGamepad size={14} style={{ color: "#aa8866", marginBottom: 4 }} />
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{stats.nonSteamGames}</div>
                            <div style={{ fontSize: 9, color: "#888" }}>Non-Steam</div>
                        </div>
                        <div style={{ flex: 1, padding: 10, backgroundColor: "#ffffff08", borderRadius: 8, textAlign: "center" }}>
                            <FaCheck size={14} style={{ color: "#88aa88", marginBottom: 4 }} />
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{stats.matchedNonSteam}</div>
                            <div style={{ fontSize: 9, color: "#888" }}>Matched</div>
                        </div>
                        <div style={{ flex: 1, padding: 10, backgroundColor: "#ffffff08", borderRadius: 8, textAlign: "center" }}>
                            <FaExclamationTriangle size={14} style={{ color: "#ffaa00", marginBottom: 4 }} />
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{stats.unmatchedNonSteam}</div>
                            <div style={{ fontSize: 9, color: "#888" }}>Unmatched</div>
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Metadata Coverage">
                {stats.fieldStats.map((field) => {
                    const color = getSeverityColor(field.percentage);
                    const bgColor = getSeverityBg(field.percentage);

                    return (
                        <PanelSectionRow key={field.field}>
                            <Focusable
                                onActivate={field.empty > 0 ? () => handleViewEmptyGames(TRACKED_FIELDS.find(f => f.field === field.field)!) : undefined}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    padding: "10px 12px",
                                    backgroundColor: "#ffffff08",
                                    borderRadius: 8,
                                    cursor: field.empty > 0 ? "pointer" : "default",
                                    border: "2px solid transparent",
                                    width: "100%",
                                }}
                                onFocus={(e: any) => field.empty > 0 && (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 12, fontWeight: 500 }}>{field.label}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                padding: "2px 6px",
                                                backgroundColor: bgColor,
                                                color: color,
                                                borderRadius: 4,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {field.percentage}%
                                        </span>
                                        {field.empty > 0 && <FaChevronRight size={10} style={{ color: "#666" }} />}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        height: 6,
                                        backgroundColor: "#ffffff11",
                                        borderRadius: 3,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${field.percentage}%`,
                                            height: "100%",
                                            backgroundColor: color,
                                            borderRadius: 3,
                                            transition: "width 0.3s ease",
                                        }}
                                    />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888" }}>
                                    <span>{field.filled} filled</span>
                                    <span>{field.empty} empty</span>
                                </div>
                            </Focusable>
                        </PanelSectionRow>
                    );
                })}
            </PanelSection>

            <PanelSection title="Enrichment Summary">
                <PanelSectionRow>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#88ff88" }} />
                            <span style={{ fontSize: 12, flex: 1 }}>Fully Enriched</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{stats.fullyEnriched}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#ffaa00" }} />
                            <span style={{ fontSize: 12, flex: 1 }}>Partially Enriched</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{stats.partiallyEnriched}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#ff6666" }} />
                            <span style={{ fontSize: 12, flex: 1 }}>Bare Minimum</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{stats.bareMinimum}</span>
                        </div>
                    </div>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
}
