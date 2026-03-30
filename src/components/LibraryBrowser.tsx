import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@decky/ui";
import { call } from "@decky/api";
import { Game } from "../types";
import { GamesListModal } from "./GamesListModal";
import { logger } from "../utils/logger";

export const LIBRARY_BROWSER_ROUTE = "/suggestme/library-browser";

let pendingNavigate = false;
let includeNonSteamSetting = true;
let includeUnmatchedSetting = false;

export function navigateToLibraryBrowser() {
    if (pendingNavigate) return;
    pendingNavigate = true;
    Navigation.Navigate(LIBRARY_BROWSER_ROUTE);
    setTimeout(() => { pendingNavigate = false; }, 500);
}

export function setLibraryBrowserSettings(includeNonSteam: boolean, includeUnmatched: boolean) {
    includeNonSteamSetting = includeNonSteam;
    includeUnmatchedSetting = includeUnmatched;
}

export function LibraryBrowserPage() {
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [includeNonSteam, setIncludeNonSteam] = useState(includeNonSteamSetting);
    const [includeUnmatched, setIncludeUnmatched] = useState(includeUnmatchedSetting);

    useEffect(() => {
        (async () => {
            try {
                const result = await call<[], { games: Game[] }>("get_library_games");
                if (result?.games) setAllGames(result.games);
            } catch (e) {
                logger.error("[SuggestMe] Failed to load library games:", e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        includeNonSteamSetting = includeNonSteam;
        includeUnmatchedSetting = includeUnmatched;
    }, [includeNonSteam, includeUnmatched]);

    const filteredGames = allGames.filter(g => {
        if (!includeNonSteam && g.is_non_steam) return false;
        if (includeNonSteam && !includeUnmatched && g.is_non_steam && g.match_status !== "matched") return false;
        return true;
    });

    const handleBack = useCallback(() => {
        Navigation.NavigateBack();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
                Loading library...
            </div>
        );
    }

    return (
        <GamesListModal
            title="Library Browser"
            subtitle={`${filteredGames.length} games`}
            games={filteredGames}
            onBack={handleBack}
            showNonSteamToggles
            includeNonSteam={includeNonSteam}
            includeUnmatched={includeUnmatched}
            onIncludeNonSteamChange={setIncludeNonSteam}
            onIncludeUnmatchedChange={setIncludeUnmatched}
        />
    );
}
