# SuggestMe

![SuggestMe](https://img.shields.io/badge/Decky-Plugin-blue)
![Version](https://img.shields.io/badge/release-v1.5.2-green)
![License](https://img.shields.io/badge/license-BSD--3--Clause-blue)

![SuggestMe Promo](assets/promo.png)

**Smart game suggestion from your Steam library, native to Steam Deck.**

SuggestMe is a Decky Loader plugin that helps you decide what game to play next from your Steam library. It analyzes your game collection, play patterns, and library metadata to suggest games based on different modes.

## Features

### Suggestion Modes
- **Luck** - Random pick from your filtered library
- **Guided** - Backlog clearing: least played games first
- **Intelligent** - Recommends games similar to your recent gaming habits (fully tunable)
- **Fresh Air** - Something different from what you usually play (fully tunable)
- **Versus** - Head-to-head elimination tournament: two games face off each round, you pick the winner until a champion emerges
- **Similar To** - Pick a reference game from your library and find the most similar games based on genre, tag, and community tag overlap (fully tunable)

### Mode Tuning
Fine-tune how Intelligent, Fresh Air, and Similar To modes score games:
- **Intelligent Mode** - Adjust recent games count, most-played count, recency decay, genre/tag/community tag weights, unplayed bonus, and top candidate percentile
- **Fresh Air Mode** - Adjust genre/tag/community tag penalties, unplayed bonus, novel genre bonus, and top candidate percentile
- **Similar To Mode** - Adjust genre/tag/community tag overlap weights, review proximity bonus, and top candidate percentile
- **Rarity Boost** - Toggle and tune how much rare tags (e.g., "Programming") are weighted higher than common tags (e.g., "Action") in all tunable modes
- Community tags are integrated into the preference profile and scoring for all tunable modes

### Powerful Filtering Engine
- **Source** - Include or exclude Steam vs. Non-Steam games
- **Playtime** - Set minimum/maximum hours played, filter for unplayed games only, or toggle installed-only games
- **Genres** - Include or exclude official Steam genres (Action, RPG, Strategy, etc.) with search
- **Steam Features** - Include or exclude official features (Single-player, Multi-player, Steam Achievements, etc.) with search
- **Community Tags** - Filter by user-generated Steam community tags (Souls-like, Metroidvania, Roguelike, Open World, etc.) with search
- **Deck Compatibility** - Filter by Valve Deck Verified status or ProtonDB ratings
- **Collections** - Filter by your Steam user collections
- **Game Review** - Filter by game review (positive, mixed, negative) and metacritic score
- **Advanced Filters** - Filter by release date, purchase date, title regex (with live validation), and size on disk
- **Filter Presets** - Save up to 5 filter combinations and quickly switch between them from the main screen

### Non-Steam Games Support
- **Auto-detection** - Automatically detects Non-Steam games added to your Steam library
- **Store matching** - Matches Non-Steam games with their Steam store equivalents to pull metadata (tags, genres, Deck status)

### Intelligent Library Sync
- **Sleep-proof syncing** - Library sync saves progress periodically. If you exit the plugin or the Deck goes to sleep, the sync will resume from where it left off
- **Comprehensive metadata** - Fetches genres, categories, community tags, Valve Deck verification status, and ProtonDB ratings for every game

### History & UI Features
- **Statistics Tab** - View data quality and metadata coverage analysis for your library. Track how many games are fully enriched vs missing key data like genres, tags, or scores, and click through to see exactly which games need metadata updates
- **Spin Wheel** - Can't decide even with suggestions? Let the Spin Wheel randomly pick a game for you from your filtered candidates. The wheel is fully responsive and looks great on both the Deck and external displays.
- **Track history** - Previously suggested games are tracked per-mode with quick actions to launch them, add them to Play Next, or exclude them directly from the history view.
- **Play Next & Excluded Lists** - Add games to a queue to play later, or exclude games from ever being suggested
- **Steam Collections Integration** - Sync your Play Next queue and Excluded games directly to native Steam Collections, with optional auto-sync on every change
- **Steam UI integration** - "Launch Game" button takes you directly to the game's library page

## Screenshots

<details>
<summary>📸 Click to view screenshots</summary>

### Main Panel

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/main_panel.jpg" alt="Main panel - Choose your mode" style="width:100%;height:auto;" />
      <br/><sub>Main panel - Choose your mode</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/suggestion_card_result.jpg" alt="A game suggestion, ready to launch" style="width:100%;height:auto;" />
      <br/><sub>A game suggestion, ready to launch</sub>
    </td>
  </tr>
</table>

<br/>

---

### Spin Wheel

<p align="center" style="margin:1.25rem 0;">
  <img src="assets/screenshots/spinning_wheel_running.gif" alt="Can't decide? Let the Spin Wheel choose for you" style="width:90%;height:auto;" />
  <br/><sub>Can't decide? Let the Spin Wheel choose for you</sub>
</p>

---

### Suggestion Modes

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/luck_result.jpg" alt="Luck - A random pick from your library" style="width:100%;height:auto;" />
      <br/><sub>Luck - A random pick from your library</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/guided_result.jpg" alt="Guided - Clear your backlog, least played first" style="width:100%;height:auto;" />
      <br/><sub>Guided - Clear your backlog, least played first</sub>
    </td>
  </tr>
</table>

<br/>

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/smart_result.jpg" alt="Intelligent - Tailored to your recent gaming habits" style="width:100%;height:auto;" />
      <br/><sub>Intelligent - Tailored to your recent gaming habits</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/fresh_result.jpg" alt="Fresh Air - Something completely different" style="width:100%;height:auto;" />
      <br/><sub>Fresh Air - Something completely different</sub>
    </td>
  </tr>
</table>

<br/>

---

### Filters

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/filter_playtime.jpg" alt="Playtime filters - Set your range or unplayed only" style="width:100%;height:auto;" />
      <br/><sub>Playtime filters - Set your range or unplayed only</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/filter_genres.jpg" alt="Genre filters - Include or exclude what you want" style="width:100%;height:auto;" />
      <br/><sub>Genre filters - Include or exclude what you want</sub>
    </td>
  </tr>
</table>

<br/>

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/filter_tags.jpg" alt="Community Tags - Souls-like, Roguelike, Metroidvania and more" style="width:100%;height:auto;" />
      <br/><sub>Community Tags - Souls-like, Roguelike, Metroidvania and more</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/filter_compatibility.jpg" alt="Deck Compatibility - Filter by Verified status or ProtonDB rating" style="width:100%;height:auto;" />
      <br/><sub>Deck Compatibility - Filter by Verified status or ProtonDB rating</sub>
    </td>
  </tr>
</table>

<br/>

<p align="center" style="margin:1.25rem 0;">
  <img src="assets/screenshots/filter_preset.jpg" alt="Filter Presets - Save your favorite filters and switch instantly" style="width:90%;height:auto;" />
  <br/><sub>Filter Presets - Save your favorite filters and switch instantly</sub>
</p>

<div style="height:2rem;"></div>

---

### Intelligent Mode Tuning

<p align="center" style="margin:1.25rem 0;">
  <img src="assets/screenshots/mode_tuning.jpg" alt="Fine-tune Intelligent mode - Adjust weights, recency, and scoring" style="width:90%;height:auto;" />
  <br/><sub>Fine-tune Intelligent mode - Adjust weights, recency, and scoring</sub>
</p>

<div style="height:2rem;"></div>

---

### History & Lists

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/history_modal.jpg" alt="Suggestion history - Revisit and act on past picks" style="width:100%;height:auto;" />
      <br/><sub>Suggestion history - Revisit and act on past picks</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/play_next.jpg" alt="Play Next queue - Games you want to play soon" style="width:100%;height:auto;" />
      <br/><sub>Play Next - Games you want to play soon</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/excluded_list.jpg" alt="Excluded games - Never see them again" style="width:100%;height:auto;" />
      <br/><sub>Excluded games - Never see them again</sub>
    </td>
  </tr>
</table>

<div style="height:2rem;"></div>

---

### Library Analytics

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/metadata_coverage.jpg" alt="Metadata coverage - Track enrichment completeness at a glance" style="width:100%;height:auto;" />
      <br/><sub>Metadata coverage - Track enrichment completeness at a glance</sub>
    </td>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/library_breakdown_statistics_1.jpg" alt="Enrichment and Genre/Feature/Tag library analytics" style="width:100%;height:auto;" />
      <br/><sub>Enrichment and Genre / Feature / Tag analytics</sub>
    </td>
  </tr>
</table>

<br/>

<table style="width:100%;table-layout:fixed;">
  <tr>
    <td align="center" style="padding:0.5rem;">
      <img src="assets/screenshots/library_breakdown_statistics_2.jpg" alt="Compatibility and game review score analytics" style="width:100%;height:auto;" />
      <br/><sub>Compatibility and review score analytics</sub>
    </td>
    <td align="center" style="padding:0.5rem;"></td>
  </tr>
</table>

</details>

## Installation

### From Decky Store
*Pending approval in the Decky Store.*

### Manual Installation
1. Download the latest release from the [Releases](https://github.com/lemossilva/suggestme-decky-plugin/releases) page
2. Open Decky Loader > Settings > Developer > "Install from Zip" > Select the Zip release file (not source code!).
3. Restart Decky Loader

## Setup (Required)

SuggestMe needs read-only access to your Steam library to analyze your games.

1. **Get your Steam Web API Key** at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
2. **Find your Steam ID 64** at [steamid.io](https://steamid.io/) (17-digit format)
3. Open the plugin on your Steam Deck and go to **Settings** (gear icon) -> **Credentials**.
4. Paste your API Key and Steam ID 64.
5. Go to the **Library** tab and click "**Sync Library**". The plugin will fetch your games and their metadata. This may take a few minutes for large libraries.

## Development

### Prerequisites

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm v9
sudo npm install -g pnpm@9

# Verify
node --version  # Should be 18.x+
pnpm --version  # Should be 9.x
```

### Building

```bash
# Install dependencies
pnpm install

# Build for production
pnpm run build

# Watch mode for development
pnpm run watch
```

### Deploying to Steam Deck

1. Enable SSH on your Steam Deck (Desktop Mode)
2. Deploy:
   ```bash
   ./deploy.sh 192.168.X.X
   ```

### CEF Debugging

1. Enable "Allow Remote CEF Debugging" in Decky Developer Settings
2. Open Chrome/Edge and go to `chrome://inspect`
3. Configure network target: `DECK_IP:8081`
4. Select "SharedJSContext" to debug

## Privacy & Data Usage

<details>
<summary>This plugin is <b>privacy-first</b> and prioritizes keeping your data safe. Click to read how your data is handled.</summary>

- All data stays locally on your device
- No telemetry or external data sharing
- Internet connection is only needed for the library sync and metadata fetching

### How Your Credentials Are Used

SuggestMe requires a **Steam Web API Key** and your **Steam ID 64** to function. Here's exactly how they are used:

| Credential | Purpose | Where It's Used |
|------------|---------|-----------------|
| **Steam API Key** | Fetches your owned games list from Steam | [`main.py` → `_fetch_owned_games()`](main.py) |
| **Steam ID 64** | Identifies your Steam account for the API call | [`main.py` → `_fetch_owned_games()`](main.py) |
| **RAWG API Key** *(optional)* | Fetches additional game metadata (scores) when Steam data is incomplete | [`main.py` → `_fetch_rawg_data()`](main.py) |

### What SuggestMe does NOT do

-  **No external servers** — Your credentials are never sent to any server other than the official Steam API (`api.steampowered.com`) and optionally RAWG (`api.rawg.io`).
-  **No telemetry** — The plugin does not collect or transmit any usage data.
-  **No cloud storage** — All settings, history, and cached data are stored locally in `~/.config/decky/settings/SuggestMe/`.

### Where Credentials Are Stored

Your API keys and Steam ID are saved locally in a JSON file on your Steam Deck:

```
/home/deck/homebrew/settings/suggestme-decky-plugin/settings.json
```

This file is protected with `chmod 600` (owner read/write only). You can verify this in [`main.py` → `_save_settings()`](main.py):

```python
os.chmod(path, 0o600)
```

### Verify It Yourself

The entire plugin is open source. You can audit the code to confirm:

1. **API calls are only to official endpoints**:
   - Steam: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/`
   - Steam Store: `https://store.steampowered.com/api/appdetails`
   - RAWG (optional): `https://api.rawg.io/api/games`

2. **No outbound requests to unknown servers** — Search the codebase for `aiohttp` or `fetch` calls; they only target the APIs listed above.

3. **Settings file permissions** — The settings file is chmod'd to 600, ensuring only your user can read it.

If you have any concerns, please [open an issue](https://github.com/lemossilva/suggestme-decky-plugin/issues) and I'll address them transparently.

</details>

## License

BSD-3-Clause License - See [LICENSE](LICENSE) for details.

## Credits

- **Author**: Guilherme Lemos
- **Framework**: [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/)
- **Inspiration**: Advanced filter concepts inspired by [TabMaster](https://github.com/Tormak9970/TabMaster)

## Support

If you encounter any issues, please [open an issue](https://github.com/lemossilva/suggestme-decky-plugin/issues) on GitHub.
