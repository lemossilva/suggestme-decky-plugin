import os
import json
import time
import random
import asyncio
import ssl
import re
import certifi
import aiohttp
from dataclasses import dataclass, asdict, field
from typing import Optional
from enum import Enum

import decky


def _create_ssl_context() -> ssl.SSLContext:
    try:
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


class SuggestMode(str, Enum):
    GUIDED = "guided"
    INTELLIGENT = "intelligent"
    FRESH_AIR = "fresh_air"
    LUCK = "luck"


@dataclass
class Game:
    appid: int
    name: str
    playtime_forever: int = 0
    rtime_last_played: Optional[int] = None
    genres: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    community_tags: list[str] = field(default_factory=list)
    img_icon_url: str = ""
    has_community_visible_stats: bool = False
    is_non_steam: bool = False
    original_name: str = ""
    matched_appid: Optional[int] = None
    match_status: str = ""
    deck_status: str = ""
    protondb_tier: str = ""
    steam_review_score: int = 0
    steam_review_description: str = ""
    metacritic_score: int = 0
    metacritic_url: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Game":
        return cls(
            appid=data.get("appid", 0),
            name=data.get("name", "Unknown"),
            playtime_forever=data.get("playtime_forever", 0),
            rtime_last_played=data.get("rtime_last_played"),
            genres=data.get("genres", []),
            tags=data.get("tags", []),
            community_tags=data.get("community_tags", []),
            img_icon_url=data.get("img_icon_url", ""),
            has_community_visible_stats=data.get("has_community_visible_stats", False),
            is_non_steam=data.get("is_non_steam", False),
            original_name=data.get("original_name", ""),
            matched_appid=data.get("matched_appid"),
            match_status=data.get("match_status", ""),
            deck_status=data.get("deck_status", ""),
            protondb_tier=data.get("protondb_tier", ""),
            steam_review_score=data.get("steam_review_score", 0),
            steam_review_description=data.get("steam_review_description", ""),
            metacritic_score=data.get("metacritic_score", 0),
            metacritic_url=data.get("metacritic_url", ""),
        )


@dataclass
class SuggestionHistoryEntry:
    timestamp: int
    appid: int
    name: str
    mode: str
    is_non_steam: bool = False
    matched_appid: Optional[int] = None
    filters: Optional[dict] = None
    preset_name: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "SuggestionHistoryEntry":
        return cls(
            timestamp=data.get("timestamp", 0),
            appid=data.get("appid", 0),
            name=data.get("name", "Unknown"),
            mode=data.get("mode", "luck"),
            is_non_steam=data.get("is_non_steam", False),
            matched_appid=data.get("matched_appid"),
            filters=data.get("filters"),
            preset_name=data.get("preset_name"),
        )


SETTINGS_FILE = "settings.json"
LIBRARY_CACHE_FILE = "library_cache.json"
HISTORY_FILE = "history.json"
PLAY_NEXT_FILE = "play_next.json"
EXCLUDED_GAMES_FILE = "excluded_games.json"


@dataclass
class PlayNextEntry:
    appid: int
    name: str
    is_non_steam: bool = False
    matched_appid: Optional[int] = None
    playtime_forever: int = 0
    added_at: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "PlayNextEntry":
        return cls(
            appid=data.get("appid", 0),
            name=data.get("name", "Unknown"),
            is_non_steam=data.get("is_non_steam", False),
            matched_appid=data.get("matched_appid"),
            playtime_forever=data.get("playtime_forever", 0),
            added_at=data.get("added_at", 0),
        )


@dataclass
class ExcludedGame:
    appid: int
    name: str
    is_non_steam: bool = False
    matched_appid: Optional[int] = None
    playtime_forever: int = 0
    deck_status: str = ""
    excluded_at: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ExcludedGame":
        return cls(
            appid=data.get("appid", 0),
            name=data.get("name", "Unknown"),
            is_non_steam=data.get("is_non_steam", False),
            matched_appid=data.get("matched_appid"),
            playtime_forever=data.get("playtime_forever", 0),
            deck_status=data.get("deck_status", ""),
            excluded_at=data.get("excluded_at", 0),
        )


@dataclass
class IntelligentTuning:
    recent_games_count: int = 20
    most_played_count: int = 30
    recency_decay_days: int = 180
    recency_weight_floor: float = 0.1
    playtime_weight_multiplier: float = 0.6
    genre_score_weight: float = 1.0
    tag_score_weight: float = 0.5
    community_tag_score_weight: float = 0.4
    unplayed_bonus: float = 0.3
    not_recently_played_days: int = 30
    not_recently_played_bonus: float = 0.2
    top_candidate_percentile: int = 20
    review_score_weight: float = 0.15

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "IntelligentTuning":
        return cls(
            recent_games_count=data.get("recent_games_count", 20),
            most_played_count=data.get("most_played_count", 30),
            recency_decay_days=data.get("recency_decay_days", 180),
            recency_weight_floor=data.get("recency_weight_floor", 0.1),
            playtime_weight_multiplier=data.get("playtime_weight_multiplier", 0.6),
            genre_score_weight=data.get("genre_score_weight", 1.0),
            tag_score_weight=data.get("tag_score_weight", 0.5),
            community_tag_score_weight=data.get("community_tag_score_weight", 0.4),
            unplayed_bonus=data.get("unplayed_bonus", 0.3),
            not_recently_played_days=data.get("not_recently_played_days", 30),
            not_recently_played_bonus=data.get("not_recently_played_bonus", 0.2),
            top_candidate_percentile=data.get("top_candidate_percentile", 20),
            review_score_weight=data.get("review_score_weight", 0.15),
        )


@dataclass
class FreshAirTuning:
    genre_penalty_multiplier: float = 0.5
    tag_penalty_multiplier: float = 0.3
    community_tag_penalty_multiplier: float = 0.2
    unplayed_bonus: float = 0.5
    novel_genre_bonus: float = 0.2
    top_candidate_percentile: int = 20
    review_score_weight: float = 0.15

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "FreshAirTuning":
        return cls(
            genre_penalty_multiplier=data.get("genre_penalty_multiplier", 0.5),
            tag_penalty_multiplier=data.get("tag_penalty_multiplier", 0.3),
            community_tag_penalty_multiplier=data.get("community_tag_penalty_multiplier", 0.2),
            unplayed_bonus=data.get("unplayed_bonus", 0.5),
            novel_genre_bonus=data.get("novel_genre_bonus", 0.2),
            top_candidate_percentile=data.get("top_candidate_percentile", 20),
            review_score_weight=data.get("review_score_weight", 0.15),
        )


DEFAULT_INTELLIGENT_TUNING = IntelligentTuning()
DEFAULT_FRESH_AIR_TUNING = FreshAirTuning()

DEFAULT_SETTINGS = {
    "steam_api_key": "",
    "steam_id": "",
    "rawg_api_key": "",
    "history_limit": 50,
    "mode_order": ["luck", "guided", "intelligent", "fresh_air"],
    "default_mode": "luck",
    "default_filters": {
        "include_genres": [],
        "exclude_genres": [],
        "include_tags": [],
        "exclude_tags": [],
        "min_playtime": None,
        "max_playtime": None,
        "installed_only": False,
        "include_unplayed": True,
        "not_installed_only": False,
        "non_steam_only": False,
        "exclude_non_steam": False,
        "deck_status": [],
        "protondb_tier": [],
        "include_collections": [],
        "exclude_collections": [],
        "min_steam_review_score": None,
        "min_metacritic_score": None,
        "include_games_without_reviews": True,
    },
    "filter_presets": [None, None, None, None, None],
    "active_preset_index": None,
    "intelligent_tuning": DEFAULT_INTELLIGENT_TUNING.to_dict(),
    "fresh_air_tuning": DEFAULT_FRESH_AIR_TUNING.to_dict(),
    "hide_credentials": False,
    "date_format": "US",
    "luck_spin_wheel_enabled": False,
    "spin_wheel_silent": False,
    "exclude_play_next_from_suggestions": False
}


class Plugin:
    settings: dict = {}
    library_cache: list[Game] = []
    history: list[SuggestionHistoryEntry] = []
    play_next_list: list[PlayNextEntry] = []
    excluded_games: list[ExcludedGame] = []
    last_refresh: Optional[int] = None
    is_refreshing: bool = False
    refresh_error: Optional[str] = None
    intelligent_tuning: IntelligentTuning = DEFAULT_INTELLIGENT_TUNING
    fresh_air_tuning: FreshAirTuning = DEFAULT_FRESH_AIR_TUNING

    def _get_settings_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, SETTINGS_FILE)

    def _get_library_cache_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, LIBRARY_CACHE_FILE)

    def _get_history_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, HISTORY_FILE)

    def _get_play_next_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, PLAY_NEXT_FILE)

    def _get_excluded_games_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, EXCLUDED_GAMES_FILE)

    def _load_play_next(self) -> list[PlayNextEntry]:
        path = self._get_play_next_path()
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    return [PlayNextEntry.from_dict(e) for e in data]
            except Exception as e:
                decky.logger.error(f"Failed to load play next list: {e}")
        return []

    def _save_play_next(self) -> bool:
        path = self._get_play_next_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump([e.to_dict() for e in self.play_next_list], f, indent=2)
            return True
        except Exception as e:
            decky.logger.error(f"Failed to save play next list: {e}")
            return False

    def _load_excluded_games(self) -> list[ExcludedGame]:
        path = self._get_excluded_games_path()
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    return [ExcludedGame.from_dict(e) for e in data]
            except Exception as e:
                decky.logger.error(f"Failed to load excluded games: {e}")
        return []

    def _save_excluded_games(self) -> bool:
        path = self._get_excluded_games_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump([e.to_dict() for e in self.excluded_games], f, indent=2)
            return True
        except Exception as e:
            decky.logger.error(f"Failed to save excluded games: {e}")
            return False

    def _load_settings(self) -> dict:
        path = self._get_settings_path()
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    settings = json.load(f)
                    for key, value in DEFAULT_SETTINGS.items():
                        settings.setdefault(key, value)
                    return settings
            except Exception as e:
                decky.logger.error(f"Failed to load settings: {e}")
        return DEFAULT_SETTINGS.copy()

    def _load_tuning_from_settings(self):
        intelligent_data = self.settings.get("intelligent_tuning", {})
        fresh_air_data = self.settings.get("fresh_air_tuning", {})
        self.intelligent_tuning = IntelligentTuning.from_dict(intelligent_data)
        self.fresh_air_tuning = FreshAirTuning.from_dict(fresh_air_data)

    def _save_settings(self) -> bool:
        path = self._get_settings_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump(self.settings, f, indent=2)
            os.chmod(path, 0o600)
            return True
        except Exception as e:
            decky.logger.error(f"Failed to save settings: {e}")
            return False

    def _load_library_cache(self) -> tuple[list[Game], Optional[int]]:
        path = self._get_library_cache_path()
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    games = [Game.from_dict(g) for g in data.get("games", [])]
                    last_refresh = data.get("last_refresh")
                    return games, last_refresh
            except Exception as e:
                decky.logger.error(f"Failed to load library cache: {e}")
        return [], None

    def _save_library_cache(self) -> bool:
        path = self._get_library_cache_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            data = {
                "games": [g.to_dict() for g in self.library_cache],
                "last_refresh": self.last_refresh,
            }
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            decky.logger.error(f"Failed to save library cache: {e}")
            return False

    def _load_history(self) -> list[SuggestionHistoryEntry]:
        path = self._get_history_path()
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    return [SuggestionHistoryEntry.from_dict(h) for h in data]
            except Exception as e:
                decky.logger.error(f"Failed to load history: {e}")
        return []

    def _save_history(self) -> bool:
        path = self._get_history_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump([h.to_dict() for h in self.history], f, indent=2)
            return True
        except Exception as e:
            decky.logger.error(f"Failed to save history: {e}")
            return False

    def _add_to_history(self, game: Game, mode: str, filters: dict = None, preset_name: str = None):
        self.history = [h for h in self.history if not (h.appid == game.appid and h.mode == mode)]
        entry = SuggestionHistoryEntry(
            timestamp=int(time.time()),
            appid=game.appid,
            name=game.name,
            mode=mode,
            is_non_steam=game.is_non_steam,
            matched_appid=game.matched_appid,
            filters=filters,
            preset_name=preset_name,
        )
        self.history.insert(0, entry)
        limit = self.settings.get("history_limit", 50)
        self.history = self.history[:limit]
        self._save_history()

    def _detect_steam_id(self) -> Optional[str]:
        try:
            loginusers_paths = [
                os.path.expanduser("~/.steam/steam/config/loginusers.vdf"),
                os.path.expanduser("~/.local/share/Steam/config/loginusers.vdf"),
            ]
            
            for path in loginusers_paths:
                if os.path.exists(path):
                    try:
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        
                        user_pattern = r'"(\d{17})"\s*\{[^}]*"MostRecent"\s*"1"'
                        match = re.search(user_pattern, content, re.DOTALL)
                        if match:
                            steam_id = match.group(1)
                            if steam_id.startswith("7656"):
                                decky.logger.info(f"Auto-detected Steam ID: {steam_id[:8]}...")
                                return steam_id
                        
                        fallback_pattern = r'"(7656\d{13})"'
                        matches = re.findall(fallback_pattern, content)
                        if matches:
                            steam_id = matches[0]
                            decky.logger.info(f"Fallback detected Steam ID: {steam_id[:8]}...")
                            return steam_id
                    except Exception as e:
                        decky.logger.debug(f"Failed to parse {path}: {e}")
        except Exception as e:
            decky.logger.warning(f"Steam ID detection failed: {e}")
        return None

    async def log_message(self, level: str, message: str) -> None:
        """Route frontend logs to the decky plugin logger"""
        log_func = getattr(decky.logger, level.lower(), decky.logger.info)
        log_func(f"[Frontend] {message}")

    async def get_detected_steam_id(self) -> dict:
        steam_id = self._detect_steam_id()
        return {
            "detected": steam_id is not None,
            "steam_id": steam_id or ""
        }

    async def _main(self):
        decky.logger.info("SuggestMe plugin loaded")
        self.settings = self._load_settings()
        self._load_tuning_from_settings()
        self.library_cache, self.last_refresh = self._load_library_cache()
        self.history = self._load_history()
        self.play_next_list = self._load_play_next()
        self.excluded_games = self._load_excluded_games()
        
        if not self.settings.get("steam_id"):
            detected_id = self._detect_steam_id()
            if detected_id:
                self.settings["steam_id"] = detected_id
                self._save_settings()
                decky.logger.info("Auto-populated Steam ID from local files")
        
        decky.logger.info(f"Loaded {len(self.library_cache)} games from cache")

    async def _unload(self):
        decky.logger.info("SuggestMe plugin unloaded")

    async def _uninstall(self):
        decky.logger.info("SuggestMe plugin uninstalled")

    async def get_config(self) -> dict:
        api_key = self.settings.get("steam_api_key", "")
        steam_id = self.settings.get("steam_id", "")
        rawg_key = self.settings.get("rawg_api_key", "")
        return {
            "has_steam_api_key": bool(api_key),
            "has_steam_id": bool(steam_id),
            "history_limit": self.settings.get("history_limit", 50),
            "mode_order": self.settings.get("mode_order", ["luck", "guided", "intelligent", "fresh_air"]),
            "default_mode": self.settings.get("default_mode", "luck"),
            "default_filters": self.settings.get("default_filters", DEFAULT_SETTINGS["default_filters"]),
            "hide_credentials": self.settings.get("hide_credentials", False),
            "has_rawg_api_key": bool(rawg_key),
            "date_format": self.settings.get("date_format", "US"),
            "luck_spin_wheel_enabled": self.settings.get("luck_spin_wheel_enabled", False),
            "spin_wheel_silent": self.settings.get("spin_wheel_silent", False),
            "exclude_play_next_from_suggestions": self.settings.get("exclude_play_next_from_suggestions", False),
        }

    async def get_credentials(self) -> dict:
        return {
            "steam_api_key": self.settings.get("steam_api_key", ""),
            "steam_id": self.settings.get("steam_id", ""),
            "rawg_api_key": self.settings.get("rawg_api_key", ""),
        }

    async def save_steam_credentials(self, api_key: str, steam_id: str) -> dict:
        self.settings["steam_api_key"] = api_key
        self.settings["steam_id"] = steam_id
        success = self._save_settings()
        return {"success": success}

    async def save_hide_credentials(self, hide: bool) -> dict:
        self.settings["hide_credentials"] = hide
        success = self._save_settings()
        return {"success": success}

    async def save_rawg_api_key(self, api_key: str) -> dict:
        self.settings["rawg_api_key"] = api_key.strip()
        success = self._save_settings()
        return {"success": success}

    async def get_rawg_api_key(self) -> dict:
        key = self.settings.get("rawg_api_key", "")
        return {"rawg_api_key": key}

    async def save_date_format(self, format: str) -> dict:
        self.settings["date_format"] = format
        success = self._save_settings()
        return {"success": success}

    async def save_luck_spin_wheel_enabled(self, enabled: bool) -> dict:
        self.settings["luck_spin_wheel_enabled"] = enabled
        success = self._save_settings()
        return {"success": success}

    async def save_spin_wheel_silent(self, silent: bool) -> dict:
        self.settings["spin_wheel_silent"] = silent
        success = self._save_settings()
        return {"success": success}

    async def save_exclude_play_next_from_suggestions(self, exclude: bool) -> dict:
        self.settings["exclude_play_next_from_suggestions"] = exclude
        success = self._save_settings()
        return {"success": success}

    async def save_history_limit(self, limit: int) -> dict:
        self.settings["history_limit"] = limit
        # Trim history if needed
        if len(self.history) > limit:
            self.history = self.history[:limit]
            self._save_history()
        success = self._save_settings()
        return {"success": success}

    async def save_mode_order(self, order: list) -> dict:
        self.settings["mode_order"] = order
        success = self._save_settings()
        return {"success": success}

    async def save_default_mode(self, mode: str) -> dict:
        self.settings["default_mode"] = mode
        success = self._save_settings()
        return {"success": success}

    async def save_default_filters(self, filters: dict) -> dict:
        self.settings["default_filters"] = filters
        success = self._save_settings()
        return {"success": success}

    async def get_filter_presets(self) -> dict:
        presets = self.settings.get("filter_presets", [None] * 5)
        active_index = self.settings.get("active_preset_index")
        return {
            "presets": presets,
            "active_index": active_index
        }

    async def save_filter_preset(self, slot_index: int, label: str, filters: dict) -> dict:
        if slot_index < 0 or slot_index >= 5:
            return {"success": False, "error": "Invalid slot index"}
        
        presets = self.settings.get("filter_presets", [None] * 5)
        while len(presets) < 5:
            presets.append(None)
        
        for i, existing in enumerate(presets):
            if existing and i != slot_index:
                if existing.get("filters") == filters:
                    return {"success": False, "error": f"Duplicate of preset '{existing.get('label', 'Unnamed')}'"}
        
        presets[slot_index] = {
            "id": slot_index,
            "label": label,
            "filters": filters
        }
        self.settings["filter_presets"] = presets
        self.settings["active_preset_index"] = slot_index
        success = self._save_settings()
        return {"success": success}

    async def rename_filter_preset(self, slot_index: int, new_label: str) -> dict:
        if slot_index < 0 or slot_index >= 5:
            return {"success": False, "error": "Invalid slot index"}
        
        presets = self.settings.get("filter_presets", [None] * 5)
        if not presets[slot_index]:
            return {"success": False, "error": "Preset slot is empty"}
        
        presets[slot_index]["label"] = new_label
        self.settings["filter_presets"] = presets
        success = self._save_settings()
        return {"success": success}

    async def delete_filter_preset(self, slot_index: int) -> dict:
        if slot_index < 0 or slot_index >= 5:
            return {"success": False, "error": "Invalid slot index"}
        
        presets = self.settings.get("filter_presets", [None] * 5)
        presets[slot_index] = None
        self.settings["filter_presets"] = presets
        
        if self.settings.get("active_preset_index") == slot_index:
            self.settings["active_preset_index"] = None
        
        success = self._save_settings()
        return {"success": success}

    async def set_active_preset(self, slot_index: Optional[int]) -> dict:
        if slot_index is not None and (slot_index < 0 or slot_index >= 5):
            return {"success": False, "error": "Invalid slot index"}
        
        self.settings["active_preset_index"] = slot_index
        success = self._save_settings()
        return {"success": success}

    async def get_play_next_list(self) -> dict:
        return {
            "games": [e.to_dict() for e in self.play_next_list],
            "count": len(self.play_next_list)
        }

    async def add_to_play_next(self, game_data: dict) -> dict:
        appid = game_data.get("appid")
        if not appid:
            return {"success": False, "error": "Missing appid"}
        
        if any(e.appid == appid for e in self.play_next_list):
            return {"success": False, "error": "Game already in list"}
        
        entry = PlayNextEntry(
            appid=appid,
            name=game_data.get("name", "Unknown"),
            is_non_steam=game_data.get("is_non_steam", False),
            matched_appid=game_data.get("matched_appid"),
            playtime_forever=game_data.get("playtime_forever", 0),
            added_at=int(time.time())
        )
        self.play_next_list.append(entry)
        success = self._save_play_next()
        return {"success": success, "count": len(self.play_next_list)}

    async def remove_from_play_next(self, appid: int) -> dict:
        original_len = len(self.play_next_list)
        self.play_next_list = [e for e in self.play_next_list if e.appid != appid]
        if len(self.play_next_list) < original_len:
            self._save_play_next()
            return {"success": True, "count": len(self.play_next_list)}
        return {"success": False, "error": "Game not found in list"}

    async def reorder_play_next(self, appid: int, direction: str) -> dict:
        idx = next((i for i, e in enumerate(self.play_next_list) if e.appid == appid), -1)
        if idx == -1:
            return {"success": False, "error": "Game not found in list"}
        
        if direction == "up" and idx > 0:
            self.play_next_list[idx], self.play_next_list[idx - 1] = \
                self.play_next_list[idx - 1], self.play_next_list[idx]
        elif direction == "down" and idx < len(self.play_next_list) - 1:
            self.play_next_list[idx], self.play_next_list[idx + 1] = \
                self.play_next_list[idx + 1], self.play_next_list[idx]
        else:
            return {"success": False, "error": "Cannot move in that direction"}
        
        self._save_play_next()
        return {"success": True, "games": [e.to_dict() for e in self.play_next_list]}

    async def clear_play_next(self) -> dict:
        self.play_next_list = []
        success = self._save_play_next()
        return {"success": success}

    async def is_in_play_next(self, appid: int) -> dict:
        return {"in_list": any(e.appid == appid for e in self.play_next_list)}

    async def sync_play_next_to_collection(self) -> dict:
        try:
            appids = [e.appid for e in self.play_next_list]
            if not appids:
                return {"success": False, "error": "No games in Play Next list"}
            decky.logger.info(f"[SuggestMe] Sync Play Next to collection: {len(appids)} games")
            return {"success": True, "appids": appids, "collection_name": "Play Next"}
        except Exception as e:
            decky.logger.error(f"Failed to sync Play Next to collection: {e}")
            return {"success": False, "error": str(e)}

    async def get_excluded_games(self) -> dict:
        return {
            "games": [e.to_dict() for e in self.excluded_games],
            "count": len(self.excluded_games)
        }

    async def add_to_excluded(self, game_data: dict) -> dict:
        appid = game_data.get("appid")
        if not appid:
            return {"success": False, "error": "Missing appid"}
        
        if any(e.appid == appid for e in self.excluded_games):
            return {"success": False, "error": "Game already excluded"}
        
        entry = ExcludedGame(
            appid=appid,
            name=game_data.get("name", "Unknown"),
            is_non_steam=game_data.get("is_non_steam", False),
            matched_appid=game_data.get("matched_appid"),
            playtime_forever=game_data.get("playtime_forever", 0),
            deck_status=game_data.get("deck_status", ""),
            excluded_at=int(time.time())
        )
        self.excluded_games.append(entry)
        success = self._save_excluded_games()
        return {"success": success, "count": len(self.excluded_games)}

    async def remove_from_excluded(self, appid: int) -> dict:
        original_len = len(self.excluded_games)
        self.excluded_games = [e for e in self.excluded_games if e.appid != appid]
        if len(self.excluded_games) < original_len:
            self._save_excluded_games()
            return {"success": True, "count": len(self.excluded_games)}
        return {"success": False, "error": "Game not found in excluded list"}

    async def clear_excluded_games(self) -> dict:
        self.excluded_games = []
        success = self._save_excluded_games()
        return {"success": success}

    async def sync_excluded_to_collection(self) -> dict:
        try:
            appids = [e.appid for e in self.excluded_games]
            if not appids:
                return {"success": False, "error": "No excluded games"}
            decky.logger.info(f"[SuggestMe] Sync Excluded to collection: {len(appids)} games")
            return {"success": True, "appids": appids, "collection_name": "SuggestMe Excluded"}
        except Exception as e:
            decky.logger.error(f"Failed to sync Excluded to collection: {e}")
            return {"success": False, "error": str(e)}

    async def get_library_status(self) -> dict:
        steam_games = [g for g in self.library_cache if not g.is_non_steam]
        non_steam_games = [g for g in self.library_cache if g.is_non_steam]
        
        sync_progress = self._load_sync_progress()
        progress_info = None
        if sync_progress:
            progress_info = {
                "current": sync_progress.get("current", 0),
                "total": sync_progress.get("total", 0),
            }
        
        return {
            "last_refresh": self.last_refresh,
            "total_games": len(self.library_cache),
            "steam_games_count": len(steam_games),
            "non_steam_games_count": len(non_steam_games),
            "is_refreshing": self.is_refreshing,
            "error": self.refresh_error,
            "sync_progress": progress_info,
        }

    async def get_library_games(self) -> dict:
        return {
            "games": [g.to_dict() for g in self.library_cache]
        }

    async def get_review_coverage_stats(self) -> dict:
        """Diagnostic endpoint to quantify Metacritic and Steam review coverage."""
        total = len(self.library_cache)
        if total == 0:
            return {"total": 0, "message": "Library is empty"}
        
        with_metacritic = sum(1 for g in self.library_cache if g.metacritic_score > 0)
        with_steam_review = sum(1 for g in self.library_cache if g.steam_review_score > 0)
        with_either = sum(1 for g in self.library_cache if g.metacritic_score > 0 or g.steam_review_score > 0)
        with_both = sum(1 for g in self.library_cache if g.metacritic_score > 0 and g.steam_review_score > 0)
        
        games_with_metacritic = [
            {"name": g.name, "score": g.metacritic_score, "url": g.metacritic_url}
            for g in self.library_cache if g.metacritic_score > 0
        ][:20]
        
        games_without_metacritic_sample = [
            {"name": g.name, "appid": g.appid}
            for g in self.library_cache if g.metacritic_score == 0 and g.steam_review_score > 0
        ][:10]
        
        return {
            "total_games": total,
            "with_metacritic": with_metacritic,
            "with_steam_review": with_steam_review,
            "with_either_review": with_either,
            "with_both_reviews": with_both,
            "metacritic_coverage_percent": round(with_metacritic / total * 100, 1),
            "steam_review_coverage_percent": round(with_steam_review / total * 100, 1),
            "sample_games_with_metacritic": games_with_metacritic,
            "sample_games_without_metacritic": games_without_metacritic_sample,
        }

    async def _fetch_owned_games(self, api_key: str, steam_id: str) -> list[dict]:
        api_key = api_key.strip()
        steam_id = steam_id.strip()
        
        if not api_key or len(api_key) < 10:
            raise Exception("Invalid Steam API key. Get one at https://steamcommunity.com/dev/apikey")
        if not steam_id or not steam_id.isdigit() or len(steam_id) != 17:
            raise Exception(f"Invalid Steam ID format. Must be 17-digit Steam ID 64 (e.g. 76561198012345678). Got: {steam_id}")
        
        url = f"https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={api_key}&steamid={steam_id}&include_appinfo=1&include_played_free_games=1&format=json"
        
        # Mask key in logs
        masked_url = url.replace(f"key={api_key}", f"key={api_key[:4]}...{api_key[-4:]}") if api_key else url
        decky.logger.info(f"Fetching games from: {masked_url[:100]}...")
        
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.get(url) as response:
                if response.status != 200:
                    body = await response.text()
                    decky.logger.error(f"Steam API error {response.status}: {body[:500]}")
                    raise Exception(f"Steam API returned status {response.status}: {body[:200]}")
                data = await response.json()
                return data.get("response", {}).get("games", [])

    async def _fetch_game_details(self, appid: int) -> dict:
        url = f"https://store.steampowered.com/api/appdetails"
        params = {"appids": appid}
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    return {}
                data = await response.json()
                app_data = data.get(str(appid), {})
                if app_data.get("success"):
                    return app_data.get("data", {})
                return {}

    async def _fetch_rawg_metacritic(self, appid: int, game_name: str) -> dict:
        """Fetch Metacritic score from RAWG API using Steam appid as primary lookup."""
        rawg_key = self.settings.get("rawg_api_key", "")
        if not rawg_key:
            return {}
        
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)
        
        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                # RAWG allows searching by Steam store ID directly
                url = f"https://api.rawg.io/api/games"
                params = {
                    "key": rawg_key,
                    "stores": "1",  # Steam store
                    "search": game_name,
                    "page_size": 5
                }
                
                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return {}
                    data = await response.json()
                    results = data.get("results", [])
                    
                    # Find game with matching Steam appid in stores
                    for game in results:
                        game_id = game.get("id")
                        if not game_id:
                            continue
                        
                        # Fetch game details to check Steam store link
                        detail_url = f"https://api.rawg.io/api/games/{game_id}"
                        detail_params = {"key": rawg_key}
                        
                        async with session.get(detail_url, params=detail_params) as detail_resp:
                            if detail_resp.status != 200:
                                continue
                            detail_data = await detail_resp.json()
                            
                            # Check if this game has matching Steam appid
                            stores = detail_data.get("stores", [])
                            for store in stores:
                                store_info = store.get("store", {})
                                if store_info.get("slug") == "steam":
                                    store_url = store.get("url", "")
                                    if f"/app/{appid}" in store_url or f"/{appid}" in store_url:
                                        metacritic = detail_data.get("metacritic")
                                        if metacritic:
                                            return {
                                                "score": metacritic,
                                                "url": detail_data.get("metacritic_url", "")
                                            }
                    
                    # Fallback: use first result with metacritic if name matches closely
                    if results and self._calculate_name_similarity(game_name, results[0].get("name", "")) > 0.8:
                        metacritic = results[0].get("metacritic")
                        if metacritic:
                            return {"score": metacritic, "url": ""}
                    
                    return {}
        except Exception as e:
            decky.logger.debug(f"RAWG API error for {game_name}: {e}")
            return {}

    async def _fetch_steam_review_summary(self, appid: int) -> dict:
        url = f"https://store.steampowered.com/appreviews/{appid}"
        params = {"json": "1", "language": "all", "num_per_page": "0"}
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)
        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}) as response:
                    if response.status != 200:
                        return {}
                    data = await response.json()
                    return data.get("query_summary", {})
        except Exception as e:
            decky.logger.debug(f"Failed to fetch review summary for {appid}: {e}")
            return {}

    def _normalize_game_name(self, name: str) -> str:
        normalized = re.sub(r'[^\w\s]', '', name).strip().lower()
        normalized = re.sub(r'\s+', ' ', normalized)
        for suffix in [' edition', ' goty', ' definitive', ' complete', ' deluxe', ' ultimate', ' remastered', ' remake']:
            normalized = normalized.replace(suffix, '')
        return normalized.strip()

    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        n1 = self._normalize_game_name(name1)
        n2 = self._normalize_game_name(name2)
        if n1 == n2:
            return 1.0
        if not n1 or not n2:
            return 0.0
        words1 = set(n1.split())
        words2 = set(n2.split())
        if not words1 or not words2:
            return 0.0
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        return intersection / union if union > 0 else 0.0

    async def _search_steam_store(self, game_name: str) -> Optional[dict]:
        clean_name = re.sub(r'[^\w\s]', '', game_name).strip()
        if not clean_name or len(clean_name) < 3:
            return None
        
        url = "https://store.steampowered.com/api/storesearch/"
        params = {"term": clean_name, "cc": "us", "l": "en"}
        ssl_ctx = _create_ssl_context()
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)
        
        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url, params=params) as response:
                    if response.status != 200:
                        return None
                    data = await response.json()
                    items = data.get("items", [])
                    if not items:
                        return None
                    
                    best_match = None
                    best_score = 0.0
                    
                    for item in items[:5]:
                        item_name = item.get("name", "")
                        score = self._calculate_name_similarity(game_name, item_name)
                        if score > best_score:
                            best_score = score
                            best_match = item
                    
                    if best_match and best_score >= 0.6:
                        return {
                            "appid": best_match.get("id"),
                            "name": best_match.get("name"),
                            "price": best_match.get("price", {}).get("final", 0),
                            "match_confidence": best_score,
                        }
        except Exception as e:
            decky.logger.warning(f"Steam store search failed for '{game_name}': {e}")
        return None

    async def _fetch_steam_tags(self, appid: int) -> list[str]:
        try:
            url = f"https://store.steampowered.com/app/{appid}"
            ssl_ctx = _create_ssl_context()
            connector = aiohttp.TCPConnector(ssl=ssl_ctx)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url, headers={"Accept-Language": "en"}) as response:
                    if response.status == 200:
                        html = await response.text()
                        tag_pattern = r'<a[^>]*class="app_tag"[^>]*>\s*([^<]+?)\s*</a>'
                        matches = re.findall(tag_pattern, html)
                        tags = [self._clean_text(t.strip()) for t in matches[:15]]
                        return [t for t in tags if t and self._is_valid_label(t)]
        except Exception as e:
            decky.logger.debug(f"Steam tags fetch failed for {appid}: {e}")
        return []

    async def _fetch_protondb_tier(self, appid: int) -> str:
        try:
            url = f"https://www.protondb.com/api/v1/reports/summaries/{appid}.json"
            ssl_ctx = _create_ssl_context()
            connector = aiohttp.TCPConnector(ssl=ssl_ctx)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        tier = data.get("tier", "")
                        if tier:
                            return tier.lower()
                        return ""
                    return ""
        except Exception as e:
            decky.logger.debug(f"ProtonDB fetch failed for {appid}: {e}")
            return ""

    async def _fetch_deck_status(self, appid: int) -> str:
        try:
            url = f"https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID={appid}"
            ssl_ctx = _create_ssl_context()
            connector = aiohttp.TCPConnector(ssl=ssl_ctx)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = data.get("results", {})
                        category = results.get("resolved_category", 0)
                        if category == 3:
                            return "verified"
                        elif category == 2:
                            return "playable"
                        elif category == 1:
                            return "unsupported"
                        return ""
                    return ""
        except Exception as e:
            decky.logger.debug(f"Deck status fetch failed for {appid}: {e}")
            return ""

    async def _get_user_collections(self) -> dict[str, list[int]]:
        collections = {}
        try:
            userdata_path = os.path.expanduser("~/.steam/steam/userdata")
            if not os.path.exists(userdata_path):
                userdata_path = os.path.expanduser("~/.local/share/Steam/userdata")
            
            if os.path.exists(userdata_path):
                for user_dir in os.listdir(userdata_path):
                    config_path = os.path.join(userdata_path, user_dir, "7", "remote", "sharedconfig.vdf")
                    if os.path.exists(config_path):
                        try:
                            with open(config_path, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                            
                            collection_pattern = r'"user-collections"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}'
                            match = re.search(collection_pattern, content, re.IGNORECASE | re.DOTALL)
                            if match:
                                collections_block = match.group(1)
                                name_pattern = r'"([^"]+)"\s*\{\s*"id"\s*"([^"]+)"(?:.*?"added"\s*\{([^}]*)\})?'
                                for col_match in re.finditer(name_pattern, collections_block, re.DOTALL):
                                    col_id = col_match.group(1)
                                    col_name = col_match.group(2) if col_match.group(2) else col_id
                                    added_block = col_match.group(3) or ""
                                    
                                    appids = []
                                    appid_pattern = r'"(\d+)"\s*"\d+"'
                                    for appid_match in re.finditer(appid_pattern, added_block):
                                        appids.append(int(appid_match.group(1)))
                                    
                                    if col_name and appids:
                                        collections[col_name] = appids
                        except Exception as e:
                            decky.logger.debug(f"Failed to parse collections from {config_path}: {e}")
        except Exception as e:
            decky.logger.warning(f"Failed to get user collections: {e}")
        return collections

    async def get_collections(self) -> dict:
        collections = await self._get_user_collections()
        return {
            "collections": list(collections.keys()),
            "details": {name: len(appids) for name, appids in collections.items()}
        }

    async def _detect_non_steam_games(self) -> list[dict]:
        try:
            shortcuts_path = os.path.expanduser("~/.steam/steam/userdata")
            if not os.path.exists(shortcuts_path):
                shortcuts_path = os.path.expanduser("~/.local/share/Steam/userdata")
            
            non_steam_games = []
            if os.path.exists(shortcuts_path):
                for user_dir in os.listdir(shortcuts_path):
                    vdf_path = os.path.join(shortcuts_path, user_dir, "config", "shortcuts.vdf")
                    if os.path.exists(vdf_path):
                        try:
                            games = self._parse_shortcuts_vdf(vdf_path)
                            non_steam_games.extend(games)
                        except Exception as e:
                            decky.logger.warning(f"Failed to parse shortcuts.vdf: {e}")
            
            return non_steam_games
        except Exception as e:
            decky.logger.error(f"Failed to detect non-steam games: {e}")
            return []

    def _parse_shortcuts_vdf(self, vdf_path: str) -> list[dict]:
        games = []
        try:
            with open(vdf_path, "rb") as f:
                data = f.read()
            
            i = 0
            while i < len(data):
                app_name_start = data.find(b'\x01AppName\x00', i)
                if app_name_start == -1:
                    break
                
                name_start = app_name_start + len(b'\x01AppName\x00')
                name_end = data.find(b'\x00', name_start)
                if name_end == -1:
                    break
                
                app_name = data[name_start:name_end].decode('utf-8', errors='ignore')
                
                appid_marker = data.find(b'\x02appid\x00', i)
                appid = 0
                if appid_marker != -1 and appid_marker < name_start + 500:
                    appid_start = appid_marker + len(b'\x02appid\x00')
                    if appid_start + 4 <= len(data):
                        appid = int.from_bytes(data[appid_start:appid_start+4], 'little', signed=False)
                
                if app_name:
                    games.append({
                        "name": app_name,
                        "appid": appid,
                        "is_non_steam": True
                    })
                
                i = name_end + 1
        except Exception as e:
            decky.logger.warning(f"Error parsing VDF: {e}")
        
        return games

    def _save_sync_progress(self, current: int, total: int) -> None:
        try:
            progress_file = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "sync_progress.json")
            progress_data = {
                "current": current,
                "total": total,
                "timestamp": int(time.time()),
            }
            with open(progress_file, 'w') as f:
                json.dump(progress_data, f)
        except Exception as e:
            decky.logger.debug(f"Failed to save sync progress: {e}")

    def _load_sync_progress(self) -> dict | None:
        try:
            progress_file = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "sync_progress.json")
            if os.path.exists(progress_file):
                with open(progress_file, 'r') as f:
                    data = json.load(f)
                
                # Auto-expire after 1 hour
                if time.time() - data.get("timestamp", 0) > 3600:
                    self._clear_sync_progress()
                    return None
                    
                return data
        except Exception as e:
            decky.logger.debug(f"Failed to load sync progress: {e}")
        return None

    def _clear_sync_progress(self) -> None:
        try:
            progress_file = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "sync_progress.json")
            if os.path.exists(progress_file):
                os.remove(progress_file)
        except Exception:
            pass

    async def _fetch_game_metadata_batch(self, games: list[Game], batch_size: int = 5, start_from: int = 0) -> None:
        use_rawg = bool(self.settings.get("rawg_api_key", ""))
        
        async def fetch_single(game: Game):
            try:
                fetch_appid = game.matched_appid if game.is_non_steam and game.matched_appid else game.appid
                details, review_summary, deck_status, protondb, steam_tags = await asyncio.gather(
                    self._fetch_game_details(fetch_appid),
                    self._fetch_steam_review_summary(fetch_appid),
                    self._fetch_deck_status(fetch_appid),
                    self._fetch_protondb_tier(fetch_appid),
                    self._fetch_steam_tags(fetch_appid),
                    return_exceptions=True
                )
                if isinstance(details, dict):
                    genres = details.get("genres", [])
                    game.genres = [self._clean_text(g.get("description", "")) for g in genres]
                    categories = details.get("categories", [])
                    game.tags = [self._clean_text(c.get("description", "")) for c in categories]
                    metacritic = details.get("metacritic", {})
                    if metacritic:
                        game.metacritic_score = metacritic.get("score", 0) or 0
                        game.metacritic_url = metacritic.get("url", "") or ""
                
                # Fallback to RAWG API if Steam doesn't have Metacritic data
                if game.metacritic_score == 0 and use_rawg:
                    rawg_data = await self._fetch_rawg_metacritic(fetch_appid, game.name)
                    if rawg_data:
                        game.metacritic_score = rawg_data.get("score", 0) or 0
                        game.metacritic_url = rawg_data.get("url", "") or ""
                
                if isinstance(review_summary, dict) and review_summary:
                    game.steam_review_score = review_summary.get("review_score", 0) or 0
                    game.steam_review_description = review_summary.get("review_score_desc", "") or ""
                if isinstance(steam_tags, list):
                    game.community_tags = steam_tags
                if isinstance(deck_status, str):
                    game.deck_status = deck_status
                if isinstance(protondb, str):
                    game.protondb_tier = protondb
            except Exception as e:
                decky.logger.debug(f"Batch fetch failed for {game.name}: {e}")

        for i in range(start_from, len(games), batch_size):
            batch = games[i:i + batch_size]
            await asyncio.gather(*[fetch_single(g) for g in batch])
            await asyncio.sleep(0.1)
            
            current_progress = min(i + batch_size, len(games))
            if current_progress % 25 == 0 or current_progress == len(games):
                await decky.emit("suggestme_refresh_progress", {
                    "current": current_progress,
                    "total": len(games),
                })
                self._save_sync_progress(current_progress, len(games))

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        cleaned = ''.join(c for c in text if ord(c) < 0x0400 or ord(c) > 0x04FF)
        return cleaned.strip()

    async def refresh_library(self) -> dict:
        if self.is_refreshing:
            return {"success": False, "error": "Already refreshing"}

        api_key = self.settings.get("steam_api_key", "")
        steam_id = self.settings.get("steam_id", "")

        if not api_key or not steam_id:
            return {"success": False, "error": "Steam API key and Steam ID are required"}

        self.is_refreshing = True
        self.refresh_error = None
        await decky.emit("suggestme_library_status_changed", {
            "is_refreshing": True,
            "error": None,
        })

        try:
            decky.logger.info("Fetching owned games from Steam API...")
            raw_games = await self._fetch_owned_games(api_key, steam_id)
            decky.logger.info(f"Found {len(raw_games)} games")

            games: list[Game] = []
            skipped_playtests = 0
            for raw in raw_games:
                name = raw.get("name", "Unknown")
                if name.endswith(" Playtest"):
                    skipped_playtests += 1
                    continue
                game = Game(
                    appid=raw.get("appid", 0),
                    name=name,
                    playtime_forever=raw.get("playtime_forever", 0),
                    rtime_last_played=raw.get("rtime_last_played"),
                    img_icon_url=raw.get("img_icon_url", ""),
                    has_community_visible_stats=raw.get("has_community_visible_stats", False),
                )
                games.append(game)
            
            if skipped_playtests > 0:
                decky.logger.info(f"Skipped {skipped_playtests} playtest entries")

            await self._fetch_game_metadata_batch(games, batch_size=5)
            self._clear_sync_progress()

            existing_non_steam = [g for g in self.library_cache if g.is_non_steam]
            self.library_cache = games + existing_non_steam
            self.last_refresh = int(time.time())
            self._save_library_cache()

            steam_count = len(games)
            non_steam_count = len(existing_non_steam)
            
            self.is_refreshing = False
            await decky.emit("suggestme_library_status_changed", {
                "is_refreshing": False,
                "total_games": steam_count + non_steam_count,
                "steam_games_count": steam_count,
                "non_steam_games_count": non_steam_count,
                "last_refresh": self.last_refresh,
                "error": None,
            })

            return {
                "success": True,
                "total_games": steam_count,
                "steam_count": steam_count,
                "last_refresh": self.last_refresh,
            }

        except Exception as e:
            error_msg = str(e)
            decky.logger.error(f"Failed to refresh library: {error_msg}")
            self.is_refreshing = False
            self.refresh_error = error_msg
            await decky.emit("suggestme_library_status_changed", {
                "is_refreshing": False,
                "error": error_msg,
            })
            return {"success": False, "error": error_msg}

    def _get_excluded_appids(self) -> set[int]:
        return set(e.appid for e in self.excluded_games)

    def _get_play_next_appids(self) -> set[int]:
        return set(e.appid for e in self.play_next_list)

    def _filter_candidates(self, games: list[Game], filters: dict, installed_appids: set[int] = None, user_collections: dict = None) -> tuple[list[Game], int]:
        excluded_appids = self._get_excluded_appids()
        
        if self.settings.get("exclude_play_next_from_suggestions", False):
            excluded_appids = excluded_appids.union(self._get_play_next_appids())
        excluded_count = 0
        candidates = []
        include_genres = set(g.lower() for g in filters.get("include_genres", []))
        exclude_genres = set(g.lower() for g in filters.get("exclude_genres", []))
        include_tags = set(t.lower() for t in filters.get("include_tags", []))
        exclude_tags = set(t.lower() for t in filters.get("exclude_tags", []))
        include_community_tags = set(t.lower() for t in filters.get("include_community_tags", []))
        exclude_community_tags = set(t.lower() for t in filters.get("exclude_community_tags", []))
        include_collections = set(c.lower() for c in filters.get("include_collections", []))
        exclude_collections = set(c.lower() for c in filters.get("exclude_collections", []))
        include_collection_appids = filters.get("include_collection_appids")
        exclude_collection_appids = filters.get("exclude_collection_appids")
        min_playtime = filters.get("min_playtime")
        max_playtime = filters.get("max_playtime")
        include_unplayed = filters.get("include_unplayed", True)
        installed_only = filters.get("installed_only", False)
        not_installed_only = filters.get("not_installed_only", False)
        non_steam_only = filters.get("non_steam_only", False)
        exclude_non_steam = filters.get("exclude_non_steam", False)
        deck_status_filter = set(s.lower() for s in filters.get("deck_status", []))
        protondb_filter = set(s.lower() for s in filters.get("protondb_tier", []))
        min_steam_review_score = filters.get("min_steam_review_score")
        min_metacritic_score = filters.get("min_metacritic_score")
        include_games_without_reviews = filters.get("include_games_without_reviews", True)
        
        if installed_appids is None:
            installed_appids = set()

        # Build sets of appids for collections if needed
        allowed_by_collections = set()
        excluded_by_collections = set()
        
        if include_collection_appids is not None or exclude_collection_appids is not None:
            if include_collection_appids is not None:
                allowed_by_collections.update(include_collection_appids)
            if exclude_collection_appids is not None:
                excluded_by_collections.update(exclude_collection_appids)
        elif user_collections:
            for col_name, appids in user_collections.items():
                col_name_lower = col_name.lower()
                if col_name_lower in include_collections:
                    allowed_by_collections.update(appids)
                if col_name_lower in exclude_collections:
                    excluded_by_collections.update(appids)

        for game in games:
            if game.is_non_steam and game.match_status != "matched":
                continue

            if non_steam_only and not game.is_non_steam:
                continue

            if exclude_non_steam and game.is_non_steam:
                continue

            if not include_unplayed and game.playtime_forever == 0:
                continue

            if installed_only and installed_appids and game.appid not in installed_appids:
                continue

            if not_installed_only and installed_appids and game.appid in installed_appids:
                continue

            if min_playtime is not None and game.playtime_forever < min_playtime:
                continue

            if max_playtime is not None and game.playtime_forever > max_playtime:
                continue

            game_genres_lower = set(g.lower() for g in game.genres)
            game_tags_lower = set(t.lower() for t in game.tags)
            game_community_tags_lower = set(t.lower() for t in game.community_tags)

            if include_genres and not include_genres.intersection(game_genres_lower):
                continue

            if exclude_genres and exclude_genres.intersection(game_genres_lower):
                continue

            if include_tags and not include_tags.intersection(game_tags_lower):
                continue

            if exclude_tags and exclude_tags.intersection(game_tags_lower):
                continue

            if include_community_tags and not include_community_tags.intersection(game_community_tags_lower):
                continue

            if exclude_community_tags and exclude_community_tags.intersection(game_community_tags_lower):
                continue

            if deck_status_filter:
                if not game.deck_status or game.deck_status.lower() not in deck_status_filter:
                    continue

            if protondb_filter:
                if not game.protondb_tier or game.protondb_tier.lower() not in protondb_filter:
                    continue

            if min_steam_review_score is not None:
                has_review = game.steam_review_score > 0
                if has_review:
                    if game.steam_review_score < min_steam_review_score:
                        continue
                elif not include_games_without_reviews:
                    continue

            if min_metacritic_score is not None:
                has_metacritic = game.metacritic_score > 0
                if has_metacritic:
                    if game.metacritic_score < min_metacritic_score:
                        continue
                elif not include_games_without_reviews:
                    continue

            # Collection filtering
            if allowed_by_collections and game.appid not in allowed_by_collections:
                continue
                
            if excluded_by_collections and game.appid in excluded_by_collections:
                continue

            if game.appid in excluded_appids:
                # Count excluded games only after confirming they match active filters
                excluded_count += 1
                continue

            candidates.append(game)

        return candidates, excluded_count

    def _get_recent_games(self, n: int = 10) -> list[Game]:
        sorted_games = sorted(
            [g for g in self.library_cache if g.rtime_last_played],
            key=lambda g: g.rtime_last_played or 0,
            reverse=True,
        )
        return sorted_games[:n]

    def _get_most_played_games(self, n: int = 30) -> list[Game]:
        sorted_games = sorted(
            [g for g in self.library_cache if g.playtime_forever > 0],
            key=lambda g: g.playtime_forever,
            reverse=True,
        )
        return sorted_games[:n]

    def _compute_preference_profile(self, recent_games: list[Game], most_played: list[Game] = None) -> dict:
        tuning = self.intelligent_tuning
        genre_scores: dict[str, float] = {}
        tag_scores: dict[str, float] = {}
        community_tag_scores: dict[str, float] = {}

        now = time.time()
        for game in recent_games:
            days_ago = (now - (game.rtime_last_played or 0)) / 86400 if game.rtime_last_played else 365
            recency_weight = max(tuning.recency_weight_floor, 1.0 - (days_ago / tuning.recency_decay_days))
            for genre in game.genres:
                g = genre.lower()
                genre_scores[g] = genre_scores.get(g, 0) + recency_weight
            for tag in game.tags:
                t = tag.lower()
                tag_scores[t] = tag_scores.get(t, 0) + recency_weight * tuning.tag_score_weight
            for ctag in game.community_tags:
                ct = ctag.lower()
                community_tag_scores[ct] = community_tag_scores.get(ct, 0) + recency_weight * tuning.community_tag_score_weight

        if most_played:
            max_pt = max(g.playtime_forever for g in most_played) if most_played else 1
            for game in most_played:
                pt_weight = (game.playtime_forever / max_pt) * tuning.playtime_weight_multiplier
                for genre in game.genres:
                    g = genre.lower()
                    genre_scores[g] = genre_scores.get(g, 0) + pt_weight
                for tag in game.tags:
                    t = tag.lower()
                    tag_scores[t] = tag_scores.get(t, 0) + pt_weight * tuning.tag_score_weight
                for ctag in game.community_tags:
                    ct = ctag.lower()
                    community_tag_scores[ct] = community_tag_scores.get(ct, 0) + pt_weight * tuning.community_tag_score_weight

        total = (len(recent_games) + len(most_played or [])) or 1
        return {
            "genres": {k: v / total for k, v in genre_scores.items()},
            "tags": {k: v / total for k, v in tag_scores.items()},
            "community_tags": {k: v / total for k, v in community_tag_scores.items()},
        }

    def _score_intelligent(self, game: Game, profile: dict) -> float:
        tuning = self.intelligent_tuning
        score = 0.0
        genre_profile = profile.get("genres", {})
        tag_profile = profile.get("tags", {})
        community_tag_profile = profile.get("community_tags", {})

        for genre in game.genres:
            score += genre_profile.get(genre.lower(), 0) * tuning.genre_score_weight

        for tag in game.tags:
            score += tag_profile.get(tag.lower(), 0) * tuning.tag_score_weight

        for ctag in game.community_tags:
            score += community_tag_profile.get(ctag.lower(), 0) * tuning.community_tag_score_weight

        if game.playtime_forever == 0:
            score += tuning.unplayed_bonus

        if game.rtime_last_played:
            days_since = (time.time() - game.rtime_last_played) / 86400
            if days_since > tuning.not_recently_played_days:
                score += tuning.not_recently_played_bonus

        if game.steam_review_score > 0:
            normalized_steam = game.steam_review_score / 9.0
            score += normalized_steam * tuning.review_score_weight

        return score

    def _score_fresh_air(self, game: Game, profile: dict) -> float:
        tuning = self.fresh_air_tuning
        score = 1.0
        genre_profile = profile.get("genres", {})
        tag_profile = profile.get("tags", {})
        community_tag_profile = profile.get("community_tags", {})

        for genre in game.genres:
            score -= genre_profile.get(genre.lower(), 0) * tuning.genre_penalty_multiplier

        for tag in game.tags:
            score -= tag_profile.get(tag.lower(), 0) * tuning.tag_penalty_multiplier

        for ctag in game.community_tags:
            score -= community_tag_profile.get(ctag.lower(), 0) * tuning.community_tag_penalty_multiplier

        if game.playtime_forever == 0:
            score += tuning.unplayed_bonus

        all_genres = set(genre_profile.keys())
        game_genres = set(g.lower() for g in game.genres)
        novel_genres = game_genres - all_genres
        score += len(novel_genres) * tuning.novel_genre_bonus

        if game.steam_review_score > 0:
            normalized_steam = game.steam_review_score / 9.0
            score += normalized_steam * tuning.review_score_weight

        return max(0, score)

    def _get_mode_history_appids(self, mode: str) -> set[int]:
        return set(h.appid for h in self.history if h.mode == mode)

    def _build_suggestion_reason(self, game: Game, mode: str, profile: dict = None) -> str:
        if mode == SuggestMode.LUCK.value:
            if game.playtime_forever == 0:
                return "Random pick — unplayed games have higher chance."
            return "Random pick from your filtered library."

        if mode == SuggestMode.GUIDED.value:
            hours = game.playtime_forever // 60
            if game.playtime_forever == 0:
                return "Backlog pick — you haven't played this yet."
            elif hours < 1:
                return f"Backlog pick — only {game.playtime_forever}m played."
            else:
                return f"Backlog pick — only {hours}h played, among your least played."

        if mode == SuggestMode.INTELLIGENT.value and profile:
            reasons = []
            genre_profile = profile.get("genres", {})
            matching_genres = [g for g in game.genres if genre_profile.get(g.lower(), 0) > 0.05]
            if matching_genres:
                top_genres = matching_genres[:2]
                reasons.append(f"matches your {', '.join(top_genres)} preference")

            if game.playtime_forever == 0:
                reasons.append("unplayed")

            if game.rtime_last_played:
                days_since = int((time.time() - game.rtime_last_played) / 86400)
                if days_since > 90:
                    reasons.append(f"untouched for {days_since}+ days")

            if game.steam_review_score >= 7:
                reasons.append("well-reviewed")

            if reasons:
                return "Recommended: " + ", ".join(reasons) + "."
            return "Recommended based on your gaming habits."

        if mode == SuggestMode.FRESH_AIR.value and profile:
            reasons = []
            genre_profile = profile.get("genres", {})
            game_genres = set(g.lower() for g in game.genres)
            novel_genres = [g for g in game.genres if g.lower() not in genre_profile]

            if novel_genres:
                reasons.append(f"features {', '.join(novel_genres[:2])} — genres you rarely play")

            if game.playtime_forever == 0:
                reasons.append("never played")

            low_overlap = all(genre_profile.get(g.lower(), 0) < 0.1 for g in game.genres)
            if low_overlap and not novel_genres:
                reasons.append("different from your usual picks")

            if reasons:
                return "Fresh pick: " + ", ".join(reasons) + "."
            return "Something different from your recent habits."

        return ""

    async def get_candidates_count(self, filters: dict, installed_appids: list[int] = None) -> dict:
        if not self.library_cache:
            return {"count": 0, "excluded_count": 0}
        
        installed_set = set(installed_appids) if installed_appids else set()
        
        user_collections = None
        include_cols = filters.get("include_collections", [])
        exclude_cols = filters.get("exclude_collections", [])
        if include_cols or exclude_cols:
            user_collections = await self._get_user_collections()
            
        candidates, excluded_count = self._filter_candidates(self.library_cache, filters, installed_set, user_collections)
        return {"count": len(candidates), "excluded_count": excluded_count}

    async def get_suggestion(self, mode: str, filters: dict, installed_appids: list[int] = None, preset_name: str = None) -> dict:
        if not self.library_cache:
            return {
                "game": None,
                "candidates_count": 0,
                "mode_used": mode,
                "error": "Library is empty. Please refresh your library first.",
            }

        installed_set = set(installed_appids) if installed_appids else set()
        
        user_collections = None
        include_cols = filters.get("include_collections", [])
        exclude_cols = filters.get("exclude_collections", [])
        if include_cols or exclude_cols:
            user_collections = await self._get_user_collections()
            
        candidates, excluded_count = self._filter_candidates(self.library_cache, filters, installed_set, user_collections)

        mode_history = self._get_mode_history_appids(mode)
        fresh_candidates = [g for g in candidates if g.appid not in mode_history]

        if not fresh_candidates:
            fresh_candidates = candidates

        if not fresh_candidates:
            return {
                "game": None,
                "candidates_count": 0,
                "excluded_count": excluded_count,
                "mode_used": mode,
                "error": "No games match your filters.",
            }

        selected_game: Optional[Game] = None
        profile: dict = {}

        if mode == SuggestMode.GUIDED.value:
            sorted_candidates = sorted(fresh_candidates, key=lambda g: g.playtime_forever)
            top_pool = sorted_candidates[:max(3, len(sorted_candidates) // 5)]
            selected_game = random.choice(top_pool)

        elif mode == SuggestMode.INTELLIGENT.value:
            tuning = self.intelligent_tuning
            recent_games = self._get_recent_games(tuning.recent_games_count)
            most_played = self._get_most_played_games(tuning.most_played_count)
            profile = self._compute_preference_profile(recent_games, most_played)
            scored = [(g, self._score_intelligent(g, profile)) for g in fresh_candidates]
            scored.sort(key=lambda x: x[1], reverse=True)
            top_n = max(5, len(scored) * tuning.top_candidate_percentile // 100)
            top_pool = scored[:top_n]
            weights = [max(0.01, s) for _, s in top_pool]
            selected_game = random.choices([g for g, _ in top_pool], weights=weights, k=1)[0]

        elif mode == SuggestMode.FRESH_AIR.value:
            tuning_fa = self.fresh_air_tuning
            tuning_int = self.intelligent_tuning
            recent_games = self._get_recent_games(tuning_int.recent_games_count)
            most_played = self._get_most_played_games(tuning_int.most_played_count)
            profile = self._compute_preference_profile(recent_games, most_played)
            scored = [(g, self._score_fresh_air(g, profile)) for g in fresh_candidates]
            scored.sort(key=lambda x: x[1], reverse=True)
            top_n = max(5, len(scored) * tuning_fa.top_candidate_percentile // 100)
            top_pool = scored[:top_n]
            weights = [max(0.01, s) for _, s in top_pool]
            selected_game = random.choices([g for g, _ in top_pool], weights=weights, k=1)[0]

        elif mode == SuggestMode.LUCK.value:
            weights = []
            for g in fresh_candidates:
                w = 1.0
                if g.playtime_forever == 0:
                    w = 2.0
                weights.append(w)
            selected_game = random.choices(fresh_candidates, weights=weights, k=1)[0]

        else:
            selected_game = random.choice(fresh_candidates)

        if selected_game:
            self._add_to_history(selected_game, mode, filters, preset_name)

        reason = ""
        if selected_game:
            reason = self._build_suggestion_reason(selected_game, mode, profile)

        return {
            "game": selected_game.to_dict() if selected_game else None,
            "candidates_count": len(candidates),
            "excluded_count": excluded_count,
            "mode_used": mode,
            "reason": reason,
            "error": None,
        }

    async def get_luck_spin_candidates(self, filters: dict, installed_appids: list[int] = None, preset_name: str = None) -> dict:
        if not self.library_cache:
            return {
                "winner": None,
                "candidates": [],
                "winner_index": 0,
                "error": "Library is empty. Please refresh your library first.",
            }

        installed_set = set(installed_appids) if installed_appids else set()
        
        user_collections = None
        include_cols = filters.get("include_collections", [])
        exclude_cols = filters.get("exclude_collections", [])
        if include_cols or exclude_cols:
            user_collections = await self._get_user_collections()
            
        candidates, excluded_count = self._filter_candidates(self.library_cache, filters, installed_set, user_collections)

        if not candidates:
            return {
                "winner": None,
                "candidates": [],
                "winner_index": 0,
                "error": "No games match your filters.",
            }

        mode_history = self._get_mode_history_appids("luck")
        fresh_candidates = [g for g in candidates if g.appid not in mode_history]
        if not fresh_candidates:
            fresh_candidates = candidates

        weights = []
        for g in fresh_candidates:
            w = 1.0
            if g.playtime_forever == 0:
                w = 2.0
            weights.append(w)
        
        selected_game = random.choices(fresh_candidates, weights=weights, k=1)[0]
        
        self._add_to_history(selected_game, "luck", filters, preset_name)

        candidate_dicts = [g.to_dict() for g in candidates]
        
        winner_actual_index = next((i for i, g in enumerate(candidates) if g.appid == selected_game.appid), 0)
        
        total_candidates = len(candidate_dicts)
        if total_candidates > 1:
            random_offset = random.randint(0, total_candidates - 1)
            shuffled_candidates = candidate_dicts[random_offset:] + candidate_dicts[:random_offset]
            new_winner_index = (winner_actual_index - random_offset) % total_candidates
        else:
            shuffled_candidates = candidate_dicts
            new_winner_index = 0

        return {
            "winner": selected_game.to_dict(),
            "candidates": shuffled_candidates,
            "winner_index": new_winner_index,
            "candidates_count": len(candidates),
            "excluded_count": excluded_count,
            "error": None,
        }

    async def get_history(self, limit: int = 20) -> list[dict]:
        return [h.to_dict() for h in self.history[:limit]]

    async def get_suggestion_history(self) -> dict:
        result = {
            "luck": [],
            "guided": [],
            "intelligent": [],
            "fresh_air": []
        }
        for entry in self.history:
            mode = entry.mode
            if mode in result:
                result[mode].append(entry.to_dict())
        return result

    async def delete_history_entry(self, mode: str, appid: int) -> bool:
        original_len = len(self.history)
        self.history = [h for h in self.history if not (h.mode == mode and h.appid == appid)]
        if len(self.history) < original_len:
            self._save_history()
            return True
        return False

    async def clear_history(self) -> dict:
        self.history = []
        self._save_history()
        return {"success": True}

    async def clear_mode_history(self, mode: str) -> dict:
        self.history = [h for h in self.history if h.mode != mode]
        self._save_history()
        return {"success": True}

    def _is_valid_label(self, text: str) -> bool:
        if not text or not text.strip():
            return False
        stripped = text.strip()
        if stripped in ('', '()', '( )', '(  )'):
            return False
        if all(c in '() ' for c in stripped):
            return False
        return True

    async def get_library_breakdown(self) -> dict:
        if not self.library_cache:
            return {
                "genres": {},
                "unplayed_by_genre": {},
                "deck_status": {},
                "protondb_tier": {},
                "steam_reviews": {},
                "metacritic": {},
                "total": 0
            }

        genre_counts: dict[str, int] = {}
        unplayed_by_genre: dict[str, int] = {}
        deck_status_counts: dict[str, int] = {
            "Verified": 0,
            "Playable": 0,
            "Unsupported": 0,
            "Unknown": 0
        }
        protondb_counts: dict[str, int] = {
            "Platinum": 0,
            "Gold": 0,
            "Silver": 0,
            "Bronze": 0,
            "Borked": 0,
            "Unknown": 0
        }
        steam_review_counts: dict[str, int] = {
            "Overwhelmingly Positive": 0,
            "Very Positive": 0,
            "Positive": 0,
            "Mostly Positive": 0,
            "Mixed": 0,
            "Mostly Negative": 0,
            "Negative": 0,
            "Very Negative": 0,
            "Overwhelmingly Negative": 0,
            "No Reviews": 0
        }
        metacritic_counts: dict[str, int] = {
            "90+": 0,
            "80-89": 0,
            "70-79": 0,
            "60-69": 0,
            "50-59": 0,
            "Below 50": 0,
            "No Score": 0
        }

        eligible_total = 0
        unmatched_non_steam = 0

        for game in self.library_cache:
            if game.is_non_steam and game.match_status != "matched":
                unmatched_non_steam += 1
                continue
            eligible_total += 1
            for genre in game.genres:
                if self._is_valid_label(genre):
                    genre_counts[genre] = genre_counts.get(genre, 0) + 1
                    if game.playtime_forever == 0:
                        unplayed_by_genre[genre] = unplayed_by_genre.get(genre, 0) + 1

            status = game.deck_status.strip().lower() if game.deck_status else ""
            if status == "verified":
                deck_status_counts["Verified"] += 1
            elif status == "playable":
                deck_status_counts["Playable"] += 1
            elif status == "unsupported":
                deck_status_counts["Unsupported"] += 1
            else:
                deck_status_counts["Unknown"] += 1

            tier = game.protondb_tier.strip().lower() if game.protondb_tier else ""
            if tier == "platinum":
                protondb_counts["Platinum"] += 1
            elif tier == "gold":
                protondb_counts["Gold"] += 1
            elif tier == "silver":
                protondb_counts["Silver"] += 1
            elif tier == "bronze":
                protondb_counts["Bronze"] += 1
            elif tier == "borked":
                protondb_counts["Borked"] += 1
            else:
                protondb_counts["Unknown"] += 1

            review_desc = game.steam_review_description.strip() if game.steam_review_description else ""
            if review_desc in steam_review_counts:
                steam_review_counts[review_desc] += 1
            else:
                steam_review_counts["No Reviews"] += 1

            mc_score = game.metacritic_score
            if mc_score >= 90:
                metacritic_counts["90+"] += 1
            elif mc_score >= 80:
                metacritic_counts["80-89"] += 1
            elif mc_score >= 70:
                metacritic_counts["70-79"] += 1
            elif mc_score >= 60:
                metacritic_counts["60-69"] += 1
            elif mc_score >= 50:
                metacritic_counts["50-59"] += 1
            elif mc_score > 0:
                metacritic_counts["Below 50"] += 1
            else:
                metacritic_counts["No Score"] += 1

        sorted_genres = dict(sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:10])
        sorted_unplayed = {k: unplayed_by_genre.get(k, 0) for k in sorted_genres.keys()}

        return {
            "genres": sorted_genres,
            "unplayed_by_genre": sorted_unplayed,
            "deck_status": deck_status_counts,
            "protondb_tier": protondb_counts,
            "steam_reviews": steam_review_counts,
            "metacritic": metacritic_counts,
            "total": eligible_total,
            "unmatched_non_steam": unmatched_non_steam,
        }

    async def get_available_genres(self) -> list[str]:
        genres: set[str] = set()
        for game in self.library_cache:
            for g in game.genres:
                if self._is_valid_label(g):
                    genres.add(g)
        return sorted(genres)

    async def get_available_tags(self) -> list[str]:
        tags: set[str] = set()
        for game in self.library_cache:
            for t in game.tags:
                if self._is_valid_label(t):
                    tags.add(t)
        return sorted(tags)

    async def get_available_community_tags(self) -> list[str]:
        tags: set[str] = set()
        for game in self.library_cache:
            for t in game.community_tags:
                if self._is_valid_label(t):
                    tags.add(t)
        return sorted(tags)

    async def get_non_steam_games(self) -> dict:
        non_steam = [g for g in self.library_cache if g.is_non_steam]
        matched = [g for g in non_steam if g.matched_appid]
        unmatched = [g for g in non_steam if not g.matched_appid]
        return {
            "total": len(non_steam),
            "matched": len(matched),
            "unmatched": len(unmatched),
            "games": [g.to_dict() for g in non_steam]
        }

    async def full_sync(self) -> dict:
        api_key = self.settings.get("steam_api_key", "")
        steam_id = self.settings.get("steam_id", "")

        if not api_key or not steam_id:
            return {"success": False, "error": "Steam API key and Steam ID are required"}

        self.is_refreshing = True
        self.refresh_error = None
        await decky.emit("suggestme_library_status_changed", {
            "is_refreshing": True,
            "error": None,
        })

        try:
            decky.logger.info("Phase 1: Scanning Steam library...")
            raw_games = await self._fetch_owned_games(api_key, steam_id)
            decky.logger.info(f"Found {len(raw_games)} Steam games")

            steam_games: list[Game] = []
            for raw in raw_games:
                game = Game(
                    appid=raw.get("appid", 0),
                    name=raw.get("name", "Unknown"),
                    playtime_forever=raw.get("playtime_forever", 0),
                    rtime_last_played=raw.get("rtime_last_played"),
                    img_icon_url=raw.get("img_icon_url", ""),
                    has_community_visible_stats=raw.get("has_community_visible_stats", False),
                )
                steam_games.append(game)

            decky.logger.info("Phase 1: Scanning Non-Steam games...")
            detected = await self._detect_non_steam_games()
            
            seen_names = set()
            unique_detected = []
            for ns_game in detected:
                name_key = ns_game.get("name", "").lower().strip()
                if name_key and name_key not in seen_names:
                    seen_names.add(name_key)
                    unique_detected.append(ns_game)
            
            decky.logger.info(f"Found {len(unique_detected)} unique Non-Steam games")

            non_steam_games: list[Game] = []
            processed_names = set()
            
            for ns_game in unique_detected:
                name = ns_game.get("name", "")
                name_key = name.lower().strip()
                
                if name_key in processed_names:
                    continue
                processed_names.add(name_key)
                
                game = Game(
                    appid=ns_game.get("appid", 0),
                    name=name,
                    is_non_steam=True,
                    original_name=name,
                    match_status="pending"
                )
                non_steam_games.append(game)

            decky.logger.info("Phase 2: Matching Non-Steam games to Steam store...")
            matched_count = 0
            for i, game in enumerate(non_steam_games):
                match = await self._search_steam_store(game.original_name)
                if match:
                    game.matched_appid = match.get("appid")
                    game.match_status = "matched"
                    matched_count += 1
                else:
                    game.match_status = "unmatched"
                
                if (i + 1) % 10 == 0 or i == len(non_steam_games) - 1:
                    await decky.emit("suggestme_non_steam_progress", {
                        "current": i + 1,
                        "total": len(non_steam_games),
                        "name": game.name
                    })
                await asyncio.sleep(0.05)

            decky.logger.info(f"Matched {matched_count}/{len(non_steam_games)} Non-Steam games")

            all_games_to_process: list[Game] = []
            all_games_to_process.extend(steam_games)
            all_games_to_process.extend([g for g in non_steam_games if g.matched_appid])

            decky.logger.info(f"Phase 3: Fetching metadata for {len(all_games_to_process)} games...")
            await self._fetch_game_metadata_batch(all_games_to_process, batch_size=5)
            self._clear_sync_progress()

            self.library_cache = steam_games + non_steam_games
            self.last_refresh = int(time.time())
            self._save_library_cache()

            steam_count = len(steam_games)
            non_steam_count = len(non_steam_games)
            
            self.is_refreshing = False
            await decky.emit("suggestme_library_status_changed", {
                "is_refreshing": False,
                "total_games": steam_count + non_steam_count,
                "steam_games_count": steam_count,
                "non_steam_games_count": non_steam_count,
                "last_refresh": self.last_refresh,
                "error": None,
            })

            return {
                "success": True,
                "steam_count": steam_count,
                "non_steam_count": non_steam_count,
                "non_steam_matched": matched_count,
                "total_games": steam_count + non_steam_count,
                "last_refresh": self.last_refresh,
            }

        except Exception as e:
            error_msg = str(e)
            decky.logger.error(f"Failed to sync library: {error_msg}")
            self.is_refreshing = False
            self.refresh_error = error_msg
            await decky.emit("suggestme_library_status_changed", {
                "is_refreshing": False,
                "error": error_msg,
            })
            return {"success": False, "error": error_msg}

    async def sync_new_games(self) -> dict:
        """Incremental sync: only fetches metadata for new Steam games and new Non-Steam games."""
        api_key = self.settings.get("steam_api_key", "")
        steam_id = self.settings.get("steam_id", "")

        if not api_key or not steam_id:
            return {"success": False, "error": "Steam API key and Steam ID are required"}

        self.is_refreshing = True
        self.refresh_error = None
        await decky.emit("suggestme_library_status_changed", {
            "is_refreshing": True,
            "error": None,
        })

        try:
            existing_steam_appids = {g.appid for g in self.library_cache if not g.is_non_steam}
            existing_non_steam_names = {g.original_name.lower().strip() for g in self.library_cache if g.is_non_steam}

            decky.logger.info("Fetching owned games from Steam API...")
            raw_games = await self._fetch_owned_games(api_key, steam_id)
            decky.logger.info(f"Found {len(raw_games)} Steam games total")

            new_steam_games: list[Game] = []
            for raw in raw_games:
                appid = raw.get("appid", 0)
                if appid not in existing_steam_appids:
                    game = Game(
                        appid=appid,
                        name=raw.get("name", "Unknown"),
                        playtime_forever=raw.get("playtime_forever", 0),
                        rtime_last_played=raw.get("rtime_last_played"),
                        img_icon_url=raw.get("img_icon_url", ""),
                        has_community_visible_stats=raw.get("has_community_visible_stats", False),
                    )
                    new_steam_games.append(game)

            decky.logger.info(f"Found {len(new_steam_games)} new Steam games")

            detected = await self._detect_non_steam_games()
            seen_names = set()
            unique_detected = []
            for ns_game in detected:
                name_key = ns_game.get("name", "").lower().strip()
                if name_key and name_key not in seen_names:
                    seen_names.add(name_key)
                    unique_detected.append(ns_game)

            new_non_steam_games: list[Game] = []
            for ns_game in unique_detected:
                name = ns_game.get("name", "")
                name_key = name.lower().strip()
                if name_key not in existing_non_steam_names:
                    game = Game(
                        appid=ns_game.get("appid", 0),
                        name=name,
                        is_non_steam=True,
                        original_name=name,
                        match_status="pending"
                    )
                    new_non_steam_games.append(game)

            decky.logger.info(f"Found {len(new_non_steam_games)} new Non-Steam games")

            matched_count = 0
            for i, game in enumerate(new_non_steam_games):
                match = await self._search_steam_store(game.original_name)
                if match:
                    game.matched_appid = match.get("appid")
                    game.match_status = "matched"
                    matched_count += 1
                else:
                    game.match_status = "unmatched"

                if (i + 1) % 10 == 0 or i == len(new_non_steam_games) - 1:
                    await decky.emit("suggestme_non_steam_progress", {
                        "current": i + 1,
                        "total": len(new_non_steam_games),
                        "name": game.name
                    })
                await asyncio.sleep(0.05)

            all_new_games: list[Game] = []
            all_new_games.extend(new_steam_games)
            all_new_games.extend([g for g in new_non_steam_games if g.matched_appid])

            if all_new_games:
                decky.logger.info(f"Fetching metadata for {len(all_new_games)} new games...")
                await self._fetch_game_metadata_batch(all_new_games, batch_size=5)

            self.library_cache.extend(new_steam_games)
            self.library_cache.extend(new_non_steam_games)
            self.last_refresh = int(time.time())
            self._save_library_cache()

            steam_count = len([g for g in self.library_cache if not g.is_non_steam])
            non_steam_count = len([g for g in self.library_cache if g.is_non_steam])

            self.is_refreshing = False
            await decky.emit("suggestme_library_status_changed", {
                "is_refreshing": False,
                "total_games": steam_count + non_steam_count,
                "steam_games_count": steam_count,
                "non_steam_games_count": non_steam_count,
                "last_refresh": self.last_refresh,
                "error": None,
            })

            return {
                "success": True,
                "new_steam_count": len(new_steam_games),
                "new_non_steam_count": len(new_non_steam_games),
                "new_non_steam_matched": matched_count,
                "total_games": steam_count + non_steam_count,
                "last_refresh": self.last_refresh,
            }

        except Exception as e:
            error_msg = str(e)
            decky.logger.error(f"Failed to sync new games: {error_msg}")
            self.is_refreshing = False
            self.refresh_error = error_msg
            await decky.emit("suggestme_library_status_changed", {
                "is_refreshing": False,
                "error": error_msg,
            })
            return {"success": False, "error": error_msg}

    async def sync_non_steam_games(self) -> dict:
        decky.logger.info("Syncing non-steam games...")
        
        try:
            detected = await self._detect_non_steam_games()
            
            seen_names = set()
            unique_detected = []
            for ns_game in detected:
                name_key = ns_game.get("name", "").lower().strip()
                if name_key and name_key not in seen_names:
                    seen_names.add(name_key)
                    unique_detected.append(ns_game)
            
            decky.logger.info(f"Detected {len(unique_detected)} unique non-steam games")
            
            existing_non_steam_names = {g.original_name.lower().strip() for g in self.library_cache if g.is_non_steam}
            new_games = []
            processed = 0
            
            for ns_game in unique_detected:
                name = ns_game.get("name", "")
                name_key = name.lower().strip()
                processed += 1
                
                if name_key in existing_non_steam_names:
                    await decky.emit("suggestme_non_steam_progress", {
                        "current": processed,
                        "total": len(unique_detected),
                        "name": name
                    })
                    continue
                
                existing_non_steam_names.add(name_key)
                
                game = Game(
                    appid=ns_game.get("appid", 0),
                    name=name,
                    is_non_steam=True,
                    original_name=name,
                    match_status="pending"
                )
                
                match = await self._search_steam_store(name)
                if match:
                    matched_appid = match.get("appid")
                    game.matched_appid = matched_appid
                    game.match_status = "matched"
                    
                    details, review_summary, deck_status, protondb, steam_tags = await asyncio.gather(
                        self._fetch_game_details(matched_appid),
                        self._fetch_steam_review_summary(matched_appid),
                        self._fetch_deck_status(matched_appid),
                        self._fetch_protondb_tier(matched_appid),
                        self._fetch_steam_tags(matched_appid),
                        return_exceptions=True
                    )
                    if isinstance(details, dict):
                        genres = details.get("genres", [])
                        game.genres = [self._clean_text(g.get("description", "")) for g in genres]
                        categories = details.get("categories", [])
                        game.tags = [self._clean_text(c.get("description", "")) for c in categories]
                        metacritic = details.get("metacritic", {})
                        if metacritic:
                            game.metacritic_score = metacritic.get("score", 0) or 0
                            game.metacritic_url = metacritic.get("url", "") or ""
                    if isinstance(review_summary, dict) and review_summary:
                        game.steam_review_score = review_summary.get("review_score", 0) or 0
                        game.steam_review_description = review_summary.get("review_score_desc", "") or ""
                    if isinstance(steam_tags, list):
                        game.community_tags = steam_tags
                    if isinstance(deck_status, str):
                        game.deck_status = deck_status
                    if isinstance(protondb, str):
                        game.protondb_tier = protondb
                    
                    await asyncio.sleep(0.1)
                else:
                    game.match_status = "unmatched"
                
                new_games.append(game)
                await decky.emit("suggestme_non_steam_progress", {
                    "current": processed,
                    "total": len(unique_detected),
                    "name": name
                })
            
            self.library_cache.extend(new_games)
            self._save_library_cache()
            
            return {
                "success": True,
                "count": len(new_games),
                "detected": len(detected),
                "new": len(new_games),
                "matched": len([g for g in new_games if g.matched_appid])
            }
        except Exception as e:
            decky.logger.error(f"Failed to sync non-steam games: {e}")
            return {"success": False, "error": str(e)}

    async def resync_non_steam_game(self, original_name: str) -> dict:
        for game in self.library_cache:
            if game.is_non_steam and game.original_name == original_name:
                match = await self._search_steam_store(original_name)
                if match:
                    game.matched_appid = match.get("appid")
                    game.match_status = "matched"
                    
                    details = await self._fetch_game_details(match["appid"])
                    if details:
                        genres = details.get("genres", [])
                        game.genres = [g.get("description", "") for g in genres]
                        categories = details.get("categories", [])
                        game.tags = [c.get("description", "") for c in categories]
                    
                    self._save_library_cache()
                    return {"success": True, "game": game.to_dict()}
                else:
                    return {"success": False, "error": "No match found"}
        
        return {"success": False, "error": "Game not found"}

    async def remove_non_steam_game(self, original_name: str) -> dict:
        original_len = len(self.library_cache)
        self.library_cache = [g for g in self.library_cache if not (g.is_non_steam and g.original_name == original_name)]
        if len(self.library_cache) < original_len:
            self._save_library_cache()
            return {"success": True}
        return {"success": False, "error": "Game not found"}

    async def factory_reset(self) -> dict:
        try:
            self.library_cache = []
            self.history = []
            self.play_next_list = []
            self.excluded_games = []
            self.last_refresh = None
            self.settings = DEFAULT_SETTINGS.copy()
            self._load_tuning_from_settings()
            self._save_settings()
            self._save_library_cache()
            self._save_history()
            self._save_play_next()
            self._save_excluded_games()
            decky.logger.info("Factory reset completed")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Factory reset failed: {e}")
            return {"success": False, "error": str(e)}

    async def clear_cache(self) -> dict:
        try:
            self.library_cache = []
            self.last_refresh = None
            self._save_library_cache()
            decky.logger.info("Cache cleared (history and presets preserved)")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Clear cache failed: {e}")
            return {"success": False, "error": str(e)}

    async def update_non_steam_search_term(self, original_name: str, new_search_term: str) -> dict:
        for game in self.library_cache:
            if game.is_non_steam and game.original_name == original_name:
                match = await self._search_steam_store(new_search_term)
                if match:
                    game.matched_appid = match.get("appid")
                    game.match_status = "matched"
                    game.name = new_search_term
                    
                    details = await self._fetch_game_details(match["appid"])
                    if details:
                        genres = details.get("genres", [])
                        game.genres = [g.get("description", "") for g in genres]
                        categories = details.get("categories", [])
                        game.tags = [c.get("description", "") for c in categories]
                    
                    self._save_library_cache()
                    return {"success": True, "game": game.to_dict()}
                else:
                    return {"success": False, "error": f"No match found for '{new_search_term}'"}
        
        return {"success": False, "error": "Game not found"}

    async def get_mode_tuning(self) -> dict:
        return {
            "intelligent": self.intelligent_tuning.to_dict(),
            "fresh_air": self.fresh_air_tuning.to_dict(),
        }

    async def save_mode_tuning(self, mode: str, tuning: dict) -> dict:
        try:
            if mode == "intelligent":
                self.intelligent_tuning = IntelligentTuning.from_dict(tuning)
                self.settings["intelligent_tuning"] = self.intelligent_tuning.to_dict()
            elif mode == "fresh_air":
                self.fresh_air_tuning = FreshAirTuning.from_dict(tuning)
                self.settings["fresh_air_tuning"] = self.fresh_air_tuning.to_dict()
            else:
                return {"success": False, "error": f"Unknown mode: {mode}"}
            
            self._save_settings()
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Failed to save mode tuning: {e}")
            return {"success": False, "error": str(e)}

    async def reset_mode_tuning(self, mode: str) -> dict:
        try:
            if mode == "intelligent":
                self.intelligent_tuning = IntelligentTuning()
                self.settings["intelligent_tuning"] = self.intelligent_tuning.to_dict()
            elif mode == "fresh_air":
                self.fresh_air_tuning = FreshAirTuning()
                self.settings["fresh_air_tuning"] = self.fresh_air_tuning.to_dict()
            else:
                return {"success": False, "error": f"Unknown mode: {mode}"}
            
            self._save_settings()
            return {"success": True, "tuning": self.intelligent_tuning.to_dict() if mode == "intelligent" else self.fresh_air_tuning.to_dict()}
        except Exception as e:
            decky.logger.error(f"Failed to reset mode tuning: {e}")
            return {"success": False, "error": str(e)}
