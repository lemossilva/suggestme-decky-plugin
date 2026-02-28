# SuggestMe

![Version](https://img.shields.io/badge/release-v1.0.0-green)

**Smart game suggestion from your Steam library, native to Steam Deck.**

SuggestMe is a Decky Loader plugin that helps you decide what game to play next from your Steam library. It analyzes your game collection, play patterns, and library metadata to suggest games based on different modes.

## Features

### Suggestion Modes
Switch between modes using the tab bar:

- **Luck** 🎲 — Random pick from your filtered library
- **Guided** 🧭 — Backlog clearing: least played games first
- **Intelligent** 🧠 — Recommends games similar to your recent gaming habits
- **Fresh Air** 🍃 — Something different from what you usually play

### Powerful Filtering Engine
Extensive filter options to narrow down suggestions:

- **Source:** Include or exclude Steam vs. Non-Steam games
- **Playtime:** Set minimum/maximum hours played, filter for unplayed games only, or toggle installed-only games
- **Genres:** Include or exclude official Steam genres (Action, RPG, Strategy, etc.)
- **Steam Features:** Include or exclude official features (Single-player, Multi-player, Steam Achievements, etc.)
- **Community Tags:** Filter by user-generated Steam community tags (Souls-like, Metroidvania, Roguelike, Open World, etc.)
- **Deck Compatibility:** Filter by Valve Deck Verified status or ProtonDB ratings
- **Collections:** Filter by your Steam user collections

### Non-Steam Games Support
- Automatically detects Non-Steam games added to your library
- Matches Non-Steam games with their Steam store equivalents to pull metadata (tags, genres, Deck status)
- Dedicated UI to view matched vs. unmatched games and manually trigger rescans
- Unified sync process that handles Steam and Non-Steam games in one go

### Intelligent Library Sync
- **Sleep-proof syncing:** Library sync saves progress periodically. If you exit the plugin or the Deck goes to sleep, the sync will resume from where it left off
- **Comprehensive metadata:** Fetches genres, categories, community tags, Valve Deck verification status, and ProtonDB ratings for every game

### History & UI Features
- Previously suggested games are tracked per-mode with quick actions to launch them
- Direct integration with Steam UI: "Launch Game" button takes you directly to the game's library page
- Fast, native Decky UI with gamepad-friendly navigation
- Easy paste buttons for API key and Steam ID in settings

### Privacy-First
- All data stays on your device
- No telemetry or external data sharing
- Steam API key is stored locally only
- Internet connection only needed for library sync and metadata fetching

## Requirements

- Steam Deck with [Decky Loader](https://decky.xyz/) installed
- Steam Web API Key
- Steam ID 64 (17-digit format)
- Internet connection for initial library sync

## Setup

1. **Get your Steam Web API Key** at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
2. **Find your Steam ID 64** at [steamid.io](https://steamid.io/)
3. Install SuggestMe via Decky Loader
4. Open Settings → Credentials
5. Paste your API Key and Steam ID 64
6. Go to Library tab and click "Refresh Library"

The plugin will fetch your games and their metadata (genres, tags, playtime). This may take a few minutes for large libraries.

## Development

### Dependencies

- Node.js v16.14+
- pnpm v9+
- Python 3.10+

### Building

```bash
pnpm install
pnpm run build
```

### Deploying to Steam Deck

```bash
./deploy.sh <DECK_IP>
```

## License

BSD-3-Clause
