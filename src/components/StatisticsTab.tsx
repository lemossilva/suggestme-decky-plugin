import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Focusable,
    PanelSection,
    PanelSectionRow,
    ButtonItem,
} from "@decky/ui";
import { call } from "@decky/api";
import { FaSync, FaChevronRight, FaGamepad, FaSteam, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import { Game, LibraryBreakdown } from "../types";
import { logger } from "../utils/logger";
import { GamesListModal, FilterCategory } from "./GamesListModal";

type DistributionMode = "genres" | "community_tags" | "tags";

interface GamesListView {
    title: string;
    subtitle?: string;
    games: Game[];
    highlightField?: keyof Game;
    filterCategory?: FilterCategory;
    filterValue?: string;
}

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
    onViewGames: (label: string, games: Game[], highlightField?: keyof Game) => void;
}

const TRACKED_FIELDS: { field: keyof Game; label: string; checkFn: (g: Game) => boolean }[] = [
    { field: "name", label: "Name", checkFn: (g) => Boolean(g.name && g.name.trim()) },
    { field: "playtime_forever", label: "Playtime", checkFn: (g) => g.playtime_forever > 0 },
    { field: "rtime_last_played", label: "Last Played", checkFn: (g) => Boolean(g.rtime_last_played && g.rtime_last_played > 0) },
    { field: "release_date", label: "Release Date", checkFn: (g) => Boolean(g.release_date && g.release_date > 0) },
    { field: "genres", label: "Genres", checkFn: (g) => Array.isArray(g.genres) && g.genres.length > 0 },
    { field: "tags", label: "Steam Features", checkFn: (g) => Array.isArray(g.tags) && g.tags.length > 0 },
    { field: "community_tags", label: "Community Tags", checkFn: (g) => Array.isArray(g.community_tags) && g.community_tags.length > 0 },
    { field: "deck_status", label: "Deck Compatibility", checkFn: (g) => Boolean(g.deck_status && g.deck_status.trim()) },
    { field: "protondb_tier", label: "ProtonDB Tier", checkFn: (g) => Boolean(g.protondb_tier && g.protondb_tier.trim()) },
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

const isCoverageEligible = (game: Game) => !(game.is_non_steam && game.match_status !== "matched");

export function StatisticsTab({ onViewGames }: StatisticsTabProps) {
    const [games, setGames] = useState<Game[]>([]);
    const [stats, setStats] = useState<LibraryStats | null>(null);
    const [breakdown, setBreakdown] = useState<LibraryBreakdown | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showProtonDB, setShowProtonDB] = useState(false);
    const [showMetacritic, setShowMetacritic] = useState(false);
    const [distributionMode, setDistributionMode] = useState<DistributionMode>("genres");
    const [gamesListView, setGamesListView] = useState<GamesListView | null>(null);

    const computeStats = useCallback((gameList: Game[]): LibraryStats => {
        const total = gameList.length;
        const coverageEligibleGames = gameList.filter(isCoverageEligible);
        const coverageTotal = coverageEligibleGames.length;
        const steamGames = gameList.filter(g => !g.is_non_steam);
        const nonSteamGames = gameList.filter(g => g.is_non_steam);
        const matchedNonSteam = nonSteamGames.filter(g => g.match_status === "matched");
        const unmatchedNonSteam = nonSteamGames.filter(g => g.match_status !== "matched");

        const fieldStats: MetadataFieldStats[] = TRACKED_FIELDS.map(({ field, label, checkFn }) => {
            const filled = coverageEligibleGames.filter(checkFn).length;
            const empty = coverageTotal - filled;
            return {
                field,
                label,
                filled,
                empty,
                total: coverageTotal,
                percentage: coverageTotal > 0 ? Math.round((filled / coverageTotal) * 100) : 0,
            };
        });

        const keyFields = ["genres", "tags", "deck_status", "steam_review_score"];
        const keyChecks = TRACKED_FIELDS.filter(f => keyFields.includes(f.field));

        let fullyEnriched = 0;
        let partiallyEnriched = 0;
        let bareMinimum = 0;

        for (const game of coverageEligibleGames) {
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

    const loadBreakdown = useCallback(async () => {
        try {
            const result = await call<[], LibraryBreakdown>("get_library_breakdown");
            setBreakdown(result);
        } catch (e) {
            logger.error("[SuggestMe] Failed to load library breakdown:", e);
        }
    }, []);

    useEffect(() => {
        loadGames();
        loadBreakdown();
    }, [loadGames, loadBreakdown]);

    const coverageGames = useMemo(() => games.filter(isCoverageEligible), [games]);

    const handleViewEmptyGames = (fieldDef: typeof TRACKED_FIELDS[0]) => {
        const emptyGames = coverageGames.filter(g => !fieldDef.checkFn(g));
        onViewGames(fieldDef.label, emptyGames, fieldDef.field);
    };

    const blurActiveElement = () => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };

    const handleViewEnrichment = (category: "fully" | "partially" | "bare") => {
        blurActiveElement();
        const keyFields = ["genres", "tags", "deck_status", "steam_review_score"];
        const keyChecks = TRACKED_FIELDS.filter(f => keyFields.includes(f.field));

        const filteredGames = coverageGames.filter(game => {
            const keyFieldsFilled = keyChecks.filter(({ checkFn }) => checkFn(game)).length;
            if (category === "fully") return keyFieldsFilled === keyChecks.length;
            if (category === "partially") return keyFieldsFilled > 0 && keyFieldsFilled < keyChecks.length;
            return keyFieldsFilled === 0;
        });

        const titles = {
            fully: "Fully Enriched Games",
            partially: "Partially Enriched Games",
            bare: "Bare Minimum Games",
        };
        const subtitles = {
            fully: "Games with all key metadata fields filled",
            partially: "Games with some metadata fields filled",
            bare: "Games with no key metadata fields",
        };

        setGamesListView({
            title: titles[category],
            subtitle: subtitles[category],
            games: filteredGames,
            filterCategory: "enrichment",
        });
    };

    const handleViewDistributionItem = (value: string, mode: DistributionMode) => {
        blurActiveElement();
        const field = mode === "genres" ? "genres" : mode === "community_tags" ? "community_tags" : "tags";
        const filteredGames = games.filter(g => {
            const arr = g[field] as string[];
            return Array.isArray(arr) && arr.some(v => v.toLowerCase() === value.toLowerCase());
        });

        const modeLabels = {
            genres: "Genre",
            community_tags: "Community Tag",
            tags: "Feature",
        };

        setGamesListView({
            title: `${modeLabels[mode]}: ${value}`,
            subtitle: `Games with this ${modeLabels[mode].toLowerCase()}`,
            games: filteredGames,
            highlightField: field,
            filterCategory: mode,
            filterValue: value,
        });
    };

    const handleViewDeckStatus = (status: string, isProtonDB: boolean) => {
        blurActiveElement();
        const field = isProtonDB ? "protondb_tier" : "deck_status";
        const filteredGames = games.filter(g => {
            const val = g[field] as string;
            if (!val) return status.toLowerCase() === "unknown";
            return val.toLowerCase() === status.toLowerCase();
        });

        setGamesListView({
            title: `${isProtonDB ? "ProtonDB" : "Deck"}: ${status}`,
            subtitle: `Games with ${isProtonDB ? "ProtonDB" : "Deck"} status: ${status}`,
            games: filteredGames,
            highlightField: field,
            filterCategory: isProtonDB ? "protondb_tier" : "deck_status",
            filterValue: status,
        });
    };

    const handleViewReviews = (reviewKey: string, isMetacritic: boolean) => {
        blurActiveElement();
        let filteredGames: Game[];
        
        if (isMetacritic) {
            filteredGames = games.filter(g => {
                const score = g.metacritic_score;
                if (reviewKey === "90+") return score >= 90;
                if (reviewKey === "80-89") return score >= 80 && score < 90;
                if (reviewKey === "70-79") return score >= 70 && score < 80;
                if (reviewKey === "60-69") return score >= 60 && score < 70;
                if (reviewKey === "50-59") return score >= 50 && score < 60;
                if (reviewKey === "Below 50") return score > 0 && score < 50;
                if (reviewKey === "No Score") return score === 0;
                return false;
            });
        } else {
            filteredGames = games.filter(g => {
                const desc = g.steam_review_description?.trim() || "";
                if (reviewKey === "No Reviews") return !desc || desc === "";
                return desc === reviewKey;
            });
        }

        setGamesListView({
            title: `${isMetacritic ? "Metacritic" : "Steam"}: ${reviewKey}`,
            subtitle: `Games with ${isMetacritic ? "Metacritic" : "Steam"} review: ${reviewKey}`,
            games: filteredGames,
            highlightField: isMetacritic ? "metacritic_score" : "steam_review_score",
            filterCategory: isMetacritic ? "metacritic" : "steam_reviews",
            filterValue: reviewKey,
        });
    };

    const getDistributionData = (): Record<string, number> => {
        if (!breakdown) return {};
        if (distributionMode === "genres") return breakdown.genres;
        if (distributionMode === "community_tags") {
            const tagCounts: Record<string, number> = {};
            for (const game of games) {
                if (game.community_tags) {
                    for (const tag of game.community_tags) {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    }
                }
            }
            const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
            return Object.fromEntries(sorted);
        }
        if (distributionMode === "tags") {
            const featureCounts: Record<string, number> = {};
            for (const game of games) {
                if (game.tags) {
                    for (const tag of game.tags) {
                        featureCounts[tag] = (featureCounts[tag] || 0) + 1;
                    }
                }
            }
            const sorted = Object.entries(featureCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
            return Object.fromEntries(sorted);
        }
        return {};
    };


    if (gamesListView) {
        return (
            <GamesListModal
                title={gamesListView.title}
                subtitle={gamesListView.subtitle}
                games={gamesListView.games}
                highlightField={gamesListView.highlightField}
                filterCategory={gamesListView.filterCategory}
                filterValue={gamesListView.filterValue}
                onBack={() => setGamesListView(null)}
            />
        );
    }

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
        <div style={{ padding: "16px 28px 80px 28px", maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
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
                <PanelSectionRow key="fully-enriched">
                    <Focusable 
                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")} 
                        onActivate={() => handleViewEnrichment("fully")} 
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", cursor: "pointer", border: "2px solid transparent", borderRadius: 6 }}
                    >
                        <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#88ff88" }} />
                        <span style={{ fontSize: 12, flex: 1 }}>Fully Enriched</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{stats.fullyEnriched}</span>
                        <FaChevronRight size={10} style={{ color: "#666" }} />
                    </Focusable>
                </PanelSectionRow>
                <PanelSectionRow key="partially-enriched">
                    <Focusable 
                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")} 
                        onActivate={() => handleViewEnrichment("partially")} 
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", cursor: "pointer", border: "2px solid transparent", borderRadius: 6 }}
                    >
                        <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#ffaa00" }} />
                        <span style={{ fontSize: 12, flex: 1 }}>Partially Enriched</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{stats.partiallyEnriched}</span>
                        <FaChevronRight size={10} style={{ color: "#666" }} />
                    </Focusable>
                </PanelSectionRow>
                <PanelSectionRow key="bare-minimum">
                    <Focusable 
                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")} 
                        onActivate={() => handleViewEnrichment("bare")} 
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", cursor: "pointer", border: "2px solid transparent", borderRadius: 6 }}
                    >
                        <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#ff6666" }} />
                        <span style={{ fontSize: 12, flex: 1 }}>Bare Minimum</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{stats.bareMinimum}</span>
                        <FaChevronRight size={10} style={{ color: "#666" }} />
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            {breakdown && breakdown.total > 0 && (
                <>
                    <PanelSection title={distributionMode === "genres" ? "Genre Distribution" : distributionMode === "community_tags" ? "Community Tags" : "Steam Features"}>
                        <PanelSectionRow>
                            <Focusable
                                flow-children="row"
                                style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}
                            >
                                {(["genres", "community_tags", "tags"] as const).map((mode) => (
                                    <Focusable
                                        key={mode}
                                        onActivate={() => setDistributionMode(mode)}
                                        style={{
                                            padding: "6px 10px",
                                            backgroundColor: distributionMode === mode ? "#4488aa" : "#ffffff11",
                                            borderRadius: 6,
                                            cursor: "pointer",
                                            fontSize: 10,
                                            border: "2px solid transparent",
                                        }}
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                    >
                                        {mode === "genres" ? "Genres" : mode === "community_tags" ? "Tags" : "Features"}
                                    </Focusable>
                                ))}
                            </Focusable>
                        </PanelSectionRow>
                        {Object.entries(getDistributionData()).map(([item, count]) => {
                            const distributionData = getDistributionData();
                            const maxCount = Math.max(...Object.values(distributionData));
                            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                                <PanelSectionRow key={item}>
                                    <Focusable
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                                        onActivate={() => handleViewDistributionItem(item, distributionMode)}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 3,
                                            width: "100%",
                                            padding: "8px",
                                            cursor: "pointer",
                                            border: "2px solid transparent",
                                            borderRadius: 6,
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                            <span style={{ color: "#ddd" }}>{item}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ color: "#888" }}>{count}</span>
                                                <FaChevronRight size={10} style={{ color: "#666" }} />
                                            </div>
                                        </div>
                                        <div style={{ height: 8, backgroundColor: "#ffffff11", borderRadius: 4, overflow: "hidden" }}>
                                            <div
                                                style={{
                                                    width: `${percentage}%`,
                                                    height: "100%",
                                                    backgroundColor: distributionMode === "genres" ? "#4488aa" : distributionMode === "community_tags" ? "#aa8866" : "#66aa88",
                                                    borderRadius: 4,
                                                }}
                                            />
                                        </div>
                                    </Focusable>
                                </PanelSectionRow>
                            );
                        })}
                    </PanelSection>

                    <PanelSection title={showProtonDB ? "ProtonDB Ratings" : "Deck Compatibility"}>
                        <PanelSectionRow>
                            <Focusable
                                onActivate={() => setShowProtonDB(!showProtonDB)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "8px 12px",
                                    backgroundColor: "#ffffff11",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    border: "2px solid transparent",
                                    marginBottom: 8,
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <span style={{ fontSize: 11, color: "#aaa" }}>
                                    {showProtonDB ? "Show Deck Verified" : "Show ProtonDB"}
                                </span>
                            </Focusable>
                        </PanelSectionRow>
                        {(showProtonDB ? [
                            { key: "Platinum", color: "#b4c7dc", label: "Platinum" },
                            { key: "Gold", color: "#cfb53b", label: "Gold" },
                            { key: "Silver", color: "#a8a8a8", label: "Silver" },
                            { key: "Bronze", color: "#cd7f32", label: "Bronze" },
                            { key: "Borked", color: "#ff4444", label: "Borked" },
                            { key: "Unknown", color: "#666666", label: "Unknown" },
                        ] : [
                            { key: "Verified", color: "#88ff88", label: "Verified" },
                            { key: "Playable", color: "#ffcc00", label: "Playable" },
                            { key: "Unsupported", color: "#ff6666", label: "Unsupported" },
                            { key: "Unknown", color: "#888888", label: "Unknown" },
                        ]).map(({ key, color, label }) => {
                            const source = showProtonDB ? breakdown.protondb_tier : breakdown.deck_status;
                            const count = source[key] || 0;
                            const percentage = breakdown.total > 0 ? (count / breakdown.total) * 100 : 0;
                            return (
                                <PanelSectionRow key={key}>
                                    <Focusable 
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")} 
                                        onActivate={() => handleViewDeckStatus(key, showProtonDB)} 
                                        style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", padding: "8px", cursor: "pointer", border: "2px solid transparent", borderRadius: 6 }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                            <span style={{ color }}>{label}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ color: "#888" }}>{count} ({Math.round(percentage)}%)</span>
                                                <FaChevronRight size={10} style={{ color: "#666" }} />
                                            </div>
                                        </div>
                                        <div style={{ height: 8, backgroundColor: "#ffffff11", borderRadius: 4, overflow: "hidden" }}>
                                            <div
                                                style={{
                                                    width: `${percentage}%`,
                                                    height: "100%",
                                                    backgroundColor: color,
                                                    borderRadius: 4,
                                                }}
                                            />
                                        </div>
                                    </Focusable>
                                </PanelSectionRow>
                            );
                        })}
                    </PanelSection>

                    <PanelSection title={showMetacritic ? "Metacritic Scores" : "Steam Reviews"}>
                        <PanelSectionRow>
                            <Focusable
                                onActivate={() => setShowMetacritic(!showMetacritic)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "8px 12px",
                                    backgroundColor: "#ffffff11",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    border: "2px solid transparent",
                                    marginBottom: 8,
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <span style={{ fontSize: 11, color: "#aaa" }}>
                                    {showMetacritic ? "Show Steam Reviews" : "Show Metacritic"}
                                </span>
                            </Focusable>
                        </PanelSectionRow>
                        {(showMetacritic ? [
                            { key: "90+", color: "#66cc33", label: "90+" },
                            { key: "80-89", color: "#88cc44", label: "80-89" },
                            { key: "70-79", color: "#aacc55", label: "70-79" },
                            { key: "60-69", color: "#cccc66", label: "60-69" },
                            { key: "50-59", color: "#cc9944", label: "50-59" },
                            { key: "Below 50", color: "#cc6644", label: "Below 50" },
                            { key: "No Score", color: "#666666", label: "No Score" },
                        ] : [
                            { key: "Overwhelmingly Positive", color: "#66ccff", label: "Overwhelmingly Positive" },
                            { key: "Very Positive", color: "#88ddff", label: "Very Positive" },
                            { key: "Positive", color: "#88ff88", label: "Positive" },
                            { key: "Mostly Positive", color: "#aaff88", label: "Mostly Positive" },
                            { key: "Mixed", color: "#ffcc66", label: "Mixed" },
                            { key: "Mostly Negative", color: "#ffaa66", label: "Mostly Negative" },
                            { key: "Negative", color: "#ff8866", label: "Negative" },
                            { key: "Very Negative", color: "#ff6666", label: "Very Negative" },
                            { key: "Overwhelmingly Negative", color: "#ff4444", label: "Overwhelmingly Negative" },
                            { key: "No Reviews", color: "#666666", label: "No Reviews" },
                        ]).map(({ key, color, label }) => {
                            const source = showMetacritic ? breakdown.metacritic : breakdown.steam_reviews;
                            const count = source[key] || 0;
                            const percentage = breakdown.total > 0 ? (count / breakdown.total) * 100 : 0;
                            if (count === 0) return null;
                            return (
                                <PanelSectionRow key={key}>
                                    <Focusable 
                                        onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                        onBlur={(e: any) => (e.target.style.borderColor = "transparent")} 
                                        onActivate={() => handleViewReviews(key, showMetacritic)} 
                                        style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", padding: "8px", cursor: "pointer", border: "2px solid transparent", borderRadius: 6 }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                            <span style={{ color }}>{label}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ color: "#888" }}>{count} ({Math.round(percentage)}%)</span>
                                                <FaChevronRight size={10} style={{ color: "#666" }} />
                                            </div>
                                        </div>
                                        <div style={{ height: 8, backgroundColor: "#ffffff11", borderRadius: 4, overflow: "hidden" }}>
                                            <div
                                                style={{
                                                    width: `${percentage}%`,
                                                    height: "100%",
                                                    backgroundColor: color,
                                                    borderRadius: 4,
                                                }}
                                            />
                                        </div>
                                    </Focusable>
                                </PanelSectionRow>
                            );
                        })}
                    </PanelSection>
                </>
            )}
        </div>
    );
}
