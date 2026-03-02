export interface Game {
  appid: number;
  name: string;
  playtime_forever: number;
  rtime_last_played?: number;
  genres: string[];
  tags: string[];
  community_tags: string[];
  img_icon_url: string;
  has_community_visible_stats: boolean;
  is_non_steam: boolean;
  original_name: string;
  matched_appid?: number;
  match_status: string;
  deck_status: string;
  protondb_tier: string;
}

export interface NonSteamGamesInfo {
  total: number;
  matched: number;
  unmatched: number;
  games: Game[];
}

export type SuggestMode = "guided" | "intelligent" | "fresh_air" | "luck";

export interface SuggestFilters {
  include_genres: string[];
  exclude_genres: string[];
  include_tags: string[];
  exclude_tags: string[];
  include_community_tags: string[];
  exclude_community_tags: string[];
  min_playtime?: number;
  max_playtime?: number;
  installed_only: boolean;
  not_installed_only: boolean;
  include_unplayed: boolean;
  non_steam_only: boolean;
  exclude_non_steam: boolean;
  deck_status: string[];
  protondb_tier: string[];
  include_collections: string[];
  exclude_collections: string[];
  include_collection_appids?: number[];
  exclude_collection_appids?: number[];
}

export interface SuggestMeConfig {
  steam_api_key?: string;
  steam_id?: string;
  history_limit?: number;
  mode_order?: SuggestMode[];
  default_mode?: SuggestMode;
  default_filters?: SuggestFilters;
  hide_credentials?: boolean;
}

export interface SuggestionResult {
  game: Game | null;
  candidates_count: number;
  excluded_count?: number;
  mode_used: SuggestMode;
  error?: string;
}

export interface LibraryStatus {
  last_refresh?: number;
  total_games: number;
  steam_games_count: number;
  non_steam_games_count: number;
  is_refreshing: boolean;
  error?: string;
}

export interface HistoryEntry {
  timestamp: number;
  appid: number;
  name: string;
  mode: SuggestMode;
  is_non_steam?: boolean;
  matched_appid?: number;
}

export interface RefreshProgress {
  current: number;
  total: number;
}

export const DEFAULT_FILTERS: SuggestFilters = {
  include_genres: [],
  exclude_genres: [],
  include_tags: [],
  exclude_tags: [],
  include_community_tags: [],
  exclude_community_tags: [],
  min_playtime: undefined,
  max_playtime: undefined,
  installed_only: false,
  not_installed_only: false,
  include_unplayed: true,
  non_steam_only: false,
  exclude_non_steam: false,
  deck_status: [],
  protondb_tier: [],
  include_collections: [],
  exclude_collections: [],
};

export interface FilterPreset {
  id: number;
  label: string;
  filters: SuggestFilters;
}

export interface FilterPresetsState {
  presets: (FilterPreset | null)[];
  active_index: number | null;
}

export interface PlayNextEntry {
  appid: number;
  name: string;
  is_non_steam: boolean;
  matched_appid?: number;
  playtime_forever: number;
  added_at: number;
}

export interface ExcludedGame {
  appid: number;
  name: string;
  is_non_steam: boolean;
  matched_appid?: number;
  playtime_forever: number;
  deck_status: string;
  excluded_at: number;
}

export const MODE_LABELS: Record<SuggestMode, string> = {
  guided: "Guided",
  intelligent: "Intelligent",
  fresh_air: "Fresh Air",
  luck: "Wish Me Luck",
};

export const MODE_DESCRIPTIONS: Record<SuggestMode, string> = {
  guided: "Backlog clearing — least played games first",
  intelligent: "Similar to your recent gaming habits",
  fresh_air: "Something different from what you usually play",
  luck: "Random pick from your library",
};

export interface IntelligentTuning {
  recent_games_count: number;
  most_played_count: number;
  recency_decay_days: number;
  recency_weight_floor: number;
  playtime_weight_multiplier: number;
  genre_score_weight: number;
  tag_score_weight: number;
  community_tag_score_weight: number;
  unplayed_bonus: number;
  not_recently_played_days: number;
  not_recently_played_bonus: number;
  top_candidate_percentile: number;
}

export interface FreshAirTuning {
  genre_penalty_multiplier: number;
  tag_penalty_multiplier: number;
  community_tag_penalty_multiplier: number;
  unplayed_bonus: number;
  novel_genre_bonus: number;
  top_candidate_percentile: number;
}

export interface ModeTuning {
  intelligent: IntelligentTuning;
  fresh_air: FreshAirTuning;
}

export const DEFAULT_INTELLIGENT_TUNING: IntelligentTuning = {
  recent_games_count: 20,
  most_played_count: 30,
  recency_decay_days: 180,
  recency_weight_floor: 0.1,
  playtime_weight_multiplier: 0.6,
  genre_score_weight: 1.0,
  tag_score_weight: 0.5,
  community_tag_score_weight: 0.4,
  unplayed_bonus: 0.3,
  not_recently_played_days: 30,
  not_recently_played_bonus: 0.2,
  top_candidate_percentile: 20,
};

export const DEFAULT_FRESH_AIR_TUNING: FreshAirTuning = {
  genre_penalty_multiplier: 0.5,
  tag_penalty_multiplier: 0.3,
  community_tag_penalty_multiplier: 0.2,
  unplayed_bonus: 0.5,
  novel_genre_bonus: 0.2,
  top_candidate_percentile: 20,
};
