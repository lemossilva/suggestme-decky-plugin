import { ButtonItem, PanelSectionRow, Focusable } from "@decky/ui";
import { FaExternalLinkAlt, FaDice, FaGamepad, FaTimes, FaStar, FaStore, FaCalendarAlt } from "react-icons/fa";
import { Game, SuggestMode, MODE_LABELS } from "../types";
import { GameImage } from "../utils/GameImage";

interface SuggestionCardProps {
  game: Game;
  modeUsed: SuggestMode;
  candidatesCount: number;
  excludedCount?: number;
  reason?: string;
  onReroll: () => void;
  onLaunch: () => void;
  onClear: () => void;
  releaseDate?: number;
}

export function SuggestionCard({
  game,
  modeUsed,
  candidatesCount,
  excludedCount,
  reason,
  onReroll,
  onLaunch,
  onClear,
  releaseDate,
}: SuggestionCardProps) {
  const formatPlaytime = (minutes: number): string => {
    if (minutes === 0) return "Never played";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m played`;
    if (mins === 0) return `${hours}h played`;
    return `${hours}h ${mins}m played`;
  };

  const formatLastPlayed = (timestamp?: number): string => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return "Unknown";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Focusable
      style={{
        background: "var(--gpSystemLighterGrey)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "0px",
      }}
    >
      <GameImage
        appid={game.appid}
        isNonSteam={game.is_non_steam}
        matchedAppid={game.matched_appid}
        aspect="landscape"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "8px 8px 0 0",
          aspectRatio: "460 / 215",
        }}
        placeholderIcon={game.is_non_steam ? "gamepad" : "steam"}
      />

      <div style={{ padding: "12px" }}>
        <div style={{ fontSize: "15px", fontWeight: "bold", color: "white", marginBottom: 8 }}>
          {game.name}
          {game.is_non_steam && (
            <span style={{ marginLeft: "8px", fontSize: 11, color: "#6688aa", fontWeight: 400 }}>(Non-Steam)</span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "8px",
          }}
        >
          {game.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              style={{
                background: "var(--gpColor-Blue)",
                color: "white",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
              }}
            >
              {genre}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "var(--gpSystemLightGrey)",
            marginBottom: "8px",
          }}
        >
          <span>
            <FaGamepad style={{ marginRight: "4px" }} />
            {formatPlaytime(game.playtime_forever)}
          </span>
          <span>Last: {formatLastPlayed(game.rtime_last_played)}</span>
        </div>

        {(game.steam_review_description || game.metacritic_score > 0) && (
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              fontSize: "11px",
              color: "var(--gpSystemLightGrey)",
              marginBottom: "8px",
            }}
          >
            {game.steam_review_description && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <FaStar style={{ color: "#ffcc00" }} />
                {game.steam_review_description}
              </span>
            )}
            {game.metacritic_score > 0 && (
              <span
                style={{
                  background: game.metacritic_score >= 75 ? "#66cc33" : game.metacritic_score >= 50 ? "#ffcc33" : "#ff6666",
                  color: "#000",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  fontWeight: "bold",
                  fontSize: "10px",
                }}
              >
                {game.metacritic_score}
              </span>
            )}
          </div>
        )}

        {/* Release Date only */}
        {releaseDate && releaseDate > 0 && (
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              fontSize: "11px",
              color: "var(--gpSystemLightGrey)",
              marginBottom: "8px",
              padding: "6px 8px",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "4px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <FaCalendarAlt style={{ color: "#bb88aa" }} />
              Released: {formatDate(releaseDate)}
            </span>
          </div>
        )}

        <div
          style={{
            fontSize: "11px",
            color: "var(--gpSystemLightGrey)",
            marginBottom: reason ? "6px" : "12px",
          }}
        >
          {MODE_LABELS[modeUsed]} • {candidatesCount} candidates{excludedCount ? ` • ${excludedCount} excluded` : ''}
        </div>

        {reason && (
          <div
            style={{
              fontSize: "11px",
              color: "#aabbcc",
              fontStyle: "italic",
              marginBottom: "12px",
              padding: "6px 8px",
              backgroundColor: "rgba(68, 136, 170, 0.15)",
              borderRadius: "4px",
              borderLeft: "2px solid #4488aa",
            }}
          >
            {reason}
          </div>
        )}

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onLaunch}>
            <FaExternalLinkAlt style={{ marginRight: "8px" }} />
            View Game
          </ButtonItem>
        </PanelSectionRow>

        {((!game.is_non_steam) || (game.is_non_steam && game.matched_appid)) && (
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => {
                const storeAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;
                window.open(`steam://store/${storeAppId}`, "_blank");
              }}
            >
              <FaStore style={{ marginRight: "8px" }} />
              Store Page
            </ButtonItem>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onReroll}>
            <FaDice style={{ marginRight: "8px" }} />
            Pick Another
          </ButtonItem>
        </PanelSectionRow>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onClear}>
            <FaTimes style={{ marginRight: "8px" }} />
            Clear Suggestion
          </ButtonItem>
        </PanelSectionRow>
      </div>
    </Focusable>
  );
}
