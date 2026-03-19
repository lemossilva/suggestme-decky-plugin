import { useState, useEffect, useRef } from "react";
import { ConfirmModal, Focusable, TextField, showModal } from "@decky/ui";
import { call } from "@decky/api";
import { FaGamepad, FaStar, FaSearch } from "react-icons/fa";
import { Game } from "../types";
import { logger } from "../utils/logger";

interface GamePickerContentProps {
    onSelect: (game: Game) => void;
    closeModal?: () => void;
}

function GamePickerContent({ onSelect, closeModal }: GamePickerContentProps) {
    const [query, setQuery] = useState("");
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [focusedAppId, setFocusedAppId] = useState<number | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const loadGames = async () => {
            try {
                const result = await call<[], { games: Game[] }>("get_library_games");
                if (!mountedRef.current) return;
                if (result?.games) {
                    const eligible = result.games.filter(g =>
                        !g.is_non_steam || g.match_status === "matched"
                    );
                    eligible.sort((a, b) => a.name.localeCompare(b.name));
                    setAllGames(eligible);
                }
            } catch (e) {
                logger.error("[SuggestMe] Failed to load games for picker:", e);
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        };
        loadGames();
        return () => { mountedRef.current = false; };
    }, []);

    const filtered = query.trim()
        ? allGames.filter(g => g.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20)
        : allGames.slice(0, 20);

    const handleSelect = (game: Game) => {
        onSelect(game);
        closeModal?.();
    };

    const formatPlaytime = (minutes: number): string => {
        if (minutes === 0) return "Unplayed";
        const hours = Math.floor(minutes / 60);
        if (hours === 0) return `${minutes}m`;
        return `${hours}h`;
    };

    return (
        <ConfirmModal
            strTitle="Pick a Reference Game"
            strDescription=""
            strOKButtonText="Close"
            strCancelButtonText="Cancel"
            onOK={() => closeModal?.()}
            onCancel={() => closeModal?.()}
        >
            <div style={{ minWidth: 400, maxHeight: 500, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FaSearch size={12} style={{ color: "#888", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <TextField
                            label=""
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            bShowClearAction={true}
                        />
                    </div>
                </div>

                <div style={{ fontSize: 10, color: "#666" }}>
                    {query.trim()
                        ? `${filtered.length} match${filtered.length !== 1 ? "es" : ""}`
                        : `${allGames.length} games — type to search`
                    }
                </div>

                {loading && (
                    <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
                        Loading library...
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
                        {query.trim() ? "No games match your search." : "No games available."}
                    </div>
                )}

                {!loading && (
                    <div style={{
                        maxHeight: 380,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}>
                        {filtered.map(game => {
                            const effectiveAppId = game.is_non_steam && game.matched_appid
                                ? game.matched_appid : game.appid;
                            const capsuleUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${effectiveAppId}/capsule_184x69.jpg`;
                            const isFocused = focusedAppId === game.appid;

                            return (
                                <Focusable
                                    key={game.appid}
                                    onActivate={() => handleSelect(game)}
                                    onClick={() => handleSelect(game)}
                                    onFocus={() => setFocusedAppId(game.appid)}
                                    onBlur={() => setFocusedAppId(prev => prev === game.appid ? null : prev)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "8px 10px",
                                        backgroundColor: isFocused ? "#4488aa" : "#ffffff0a",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        border: isFocused ? "1px solid white" : "1px solid transparent",
                                        transition: "background-color 0.1s",
                                    }}
                                >
                                    <img
                                        src={capsuleUrl}
                                        alt=""
                                        style={{
                                            width: 60,
                                            height: 22,
                                            borderRadius: 3,
                                            objectFit: "cover",
                                            flexShrink: 0,
                                        }}
                                        onError={(e: any) => (e.target.style.display = "none")}
                                    />

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            color: "#fff",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {game.name}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#888", marginTop: 2 }}>
                                            {game.genres.slice(0, 2).map(g => (
                                                <span key={g} style={{
                                                    backgroundColor: "#ffffff11",
                                                    padding: "0 4px",
                                                    borderRadius: 2,
                                                }}>{g}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                        gap: 2,
                                        flexShrink: 0,
                                    }}>
                                        <span style={{ fontSize: 10, color: "#888" }}>
                                            <FaGamepad style={{ marginRight: 2 }} />
                                            {formatPlaytime(game.playtime_forever)}
                                        </span>
                                        {game.steam_review_description && (
                                            <span style={{ fontSize: 9, color: "#888", display: "flex", alignItems: "center", gap: 2 }}>
                                                <FaStar style={{ color: "#ffcc00" }} />
                                                {game.steam_review_description}
                                            </span>
                                        )}
                                    </div>
                                </Focusable>
                            );
                        })}
                    </div>
                )}
            </div>
        </ConfirmModal>
    );
}

export function showGamePickerModal(
    _totalGames: number,
    onSelect: (game: Game) => void
) {
    showModal(<GamePickerContent onSelect={onSelect} />);
}
