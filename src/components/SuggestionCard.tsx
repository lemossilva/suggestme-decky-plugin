import { ButtonItem, PanelSectionRow, Focusable } from "@decky/ui";
import { FaExternalLinkAlt, FaDice, FaGamepad, FaTimes } from "react-icons/fa";
import { Game, SuggestMode, MODE_LABELS } from "../types";

interface SuggestionCardProps {
  game: Game;
  modeUsed: SuggestMode;
  candidatesCount: number;
  excludedCount?: number;
  onReroll: () => void;
  onLaunch: () => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function SuggestionCard({
  game,
  modeUsed,
  candidatesCount,
  excludedCount,
  onReroll,
  onLaunch,
  onClear,
  isLoading,
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

  const effectiveAppId = game.is_non_steam && game.matched_appid ? game.matched_appid : game.appid;
  const headerUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${effectiveAppId}/header.jpg`;

  return (
    <Focusable
      style={{
        background: "var(--gpSystemLighterGrey)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          backgroundImage: `url(${headerUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          height: "100px",
          borderRadius: "8px 8px 0 0",
        }}
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

        <div
          style={{
            fontSize: "11px",
            color: "var(--gpSystemLightGrey)",
            marginBottom: "12px",
          }}
        >
          {MODE_LABELS[modeUsed]} • {candidatesCount} candidates{excludedCount ? ` • ${excludedCount} excluded` : ''}
        </div>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onLaunch} disabled={isLoading}>
            <FaExternalLinkAlt style={{ marginRight: "8px" }} />
            View Game
          </ButtonItem>
        </PanelSectionRow>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onReroll} disabled={isLoading}>
            <FaDice style={{ marginRight: "8px" }} />
            Pick Another
          </ButtonItem>
        </PanelSectionRow>

        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onClear} disabled={isLoading}>
            <FaTimes style={{ marginRight: "8px" }} />
            Clear Suggestion
          </ButtonItem>
        </PanelSectionRow>
      </div>
    </Focusable>
  );
}
