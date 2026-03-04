import { useState } from "react";
import {
    Focusable,
    PanelSection,
    PanelSectionRow,
    Navigation,
} from "@decky/ui";
import { FaArrowLeft, FaSteam, FaGamepad, FaCheck } from "react-icons/fa";
import { Game } from "../types";

interface MetadataDrillDownProps {
    label: string;
    games: Game[];
    onBack: () => void;
}

export function MetadataDrillDown({ label, games, onBack }: MetadataDrillDownProps) {
    const [sortBy, setSortBy] = useState<"name" | "type">("name");

    // Filter out unmatched non-steam games as requested
    const filteredGames = games.filter(g => !g.is_non_steam || g.match_status === "matched");

    const sortedGames = [...filteredGames].sort((a, b) => {
        if (sortBy === "type") {
            if (a.is_non_steam !== b.is_non_steam) {
                return a.is_non_steam ? 1 : -1;
            }
        }
        return a.name.localeCompare(b.name);
    });

    const handleLaunchGame = (game: Game) => {
        const effectiveAppId = game.is_non_steam && game.matched_appid
            ? game.matched_appid
            : game.appid;
        Navigation.NavigateToLibraryTab();
        Navigation.Navigate(`/library/app/${effectiveAppId}`);
    };

    return (
        <div style={{ padding: "16px 24px 80px 24px", maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable
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
                        <span style={{ fontSize: 12 }}>Back to Statistics</span>
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            Games Missing: {label}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                            {games.length} game{games.length !== 1 ? "s" : ""} without this field
                        </div>
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <Focusable
                        flow-children="row"
                        style={{ display: "flex", gap: 8, marginBottom: 12 }}
                    >
                        <Focusable
                            onActivate={() => setSortBy("name")}
                            style={{
                                padding: "6px 12px",
                                backgroundColor: sortBy === "name" ? "#4488aa" : "#ffffff11",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 11,
                                border: "2px solid transparent",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            Sort by Name
                        </Focusable>
                        <Focusable
                            onActivate={() => setSortBy("type")}
                            style={{
                                padding: "6px 12px",
                                backgroundColor: sortBy === "type" ? "#4488aa" : "#ffffff11",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 11,
                                border: "2px solid transparent",
                            }}
                            onFocus={(e: any) => (e.target.style.borderColor = "white")}
                            onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                        >
                            Sort by Type
                        </Focusable>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection>
                {sortedGames.length === 0 ? (
                    <PanelSectionRow>
                        <div style={{ textAlign: "center", color: "#888", padding: 16 }}>
                            All games have this field filled!
                        </div>
                    </PanelSectionRow>
                ) : (
                    sortedGames.map((game) => (
                        <PanelSectionRow key={game.appid}>
                            <Focusable
                                onActivate={() => handleLaunchGame(game)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 12px",
                                    backgroundColor: "#ffffff08",
                                    borderRadius: 8,
                                    border: "2px solid transparent",
                                    cursor: "pointer",
                                }}
                                onFocus={(e: any) => (e.target.style.borderColor = "white")}
                                onBlur={(e: any) => (e.target.style.borderColor = "transparent")}
                            >
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 4,
                                        backgroundColor: game.is_non_steam ? "#aa886622" : "#4488aa22",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {game.is_non_steam ? (
                                        <FaGamepad size={12} style={{ color: "#aa8866" }} />
                                    ) : (
                                        <FaSteam size={12} style={{ color: "#4488aa" }} />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {game.name}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
                                        {game.is_non_steam ? (
                                            <>
                                                <span>Non-Steam</span>
                                                <span style={{ color: "#666" }}>•</span>
                                                {game.match_status === "matched" && (
                                                    <span style={{ color: "#88aa88", display: "flex", alignItems: "center", gap: 3 }}>
                                                        <FaCheck size={8} /> Matched
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span>Steam • ID: {game.appid}</span>
                                        )}
                                    </div>
                                </div>
                            </Focusable>
                        </PanelSectionRow>
                    ))
                )}
            </PanelSection>
        </div>
    );
}
