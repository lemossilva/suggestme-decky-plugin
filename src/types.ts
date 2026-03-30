export interface Game {
  appid: number;
  name: string;
  playtime_forever: number;
  rtime_last_played?: number;
  rtime_purchased?: number;
  release_date?: number;
  size_on_disk?: number;
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
  steam_review_score: number;
  steam_review_description: string;
  metacritic_score: number;
  metacritic_url: string;
}

export interface NonSteamGamesInfo {
  total: number;
  matched: number;
  unmatched: number;
  games: Game[];
}

export type SuggestMode = "guided" | "intelligent" | "fresh_air" | "luck" | "versus" | "similar_to";

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
  min_steam_review_score?: number;
  min_metacritic_score?: number;
  include_games_without_reviews: boolean;
  release_date_after?: number;
  release_date_before?: number;
  include_unknown_release_date?: boolean;
  release_date_map?: Record<number, number>;
  purchase_date_after?: number;
  purchase_date_before?: number;
  include_unknown_purchase_date?: boolean;
  purchase_date_map?: Record<number, number>;
  title_regex?: string;
  title_regex_case_sensitive?: boolean;
  min_size_mb?: number;
  max_size_mb?: number;
  size_on_disk_map?: Record<number, number>;
}

export interface SuggestMeConfig {
  has_steam_api_key?: boolean;
  has_steam_id?: boolean;
  history_limit?: number;
  mode_order?: SuggestMode[];
  default_mode?: SuggestMode;
  default_filters?: SuggestFilters;
  hide_credentials?: boolean;
  has_rawg_api_key?: boolean;
  date_format?: 'US' | 'EU' | 'ISO';
  luck_spin_wheel_enabled?: boolean;
  spin_wheel_silent?: boolean;
  exclude_play_next_from_suggestions?: boolean;
  similar_to_filter_pool?: boolean;
  auto_sync_play_next_collection?: boolean;
  auto_sync_excluded_collection?: boolean;
  auto_sync_new_games?: boolean;
  spin_wheel_banner_colors?: boolean;
}

export interface Credentials {
  steam_api_key: string;
  steam_id: string;
  rawg_api_key: string;
}

export interface SuggestionResult {
  game: Game | null;
  candidates_count: number;
  excluded_count?: number;
  mode_used: SuggestMode;
  reason?: string;
  error?: string;
}

export interface LibraryStatus {
  last_refresh?: number;
  total_games: number;
  steam_games_count: number;
  non_steam_games_count: number;
  is_refreshing: boolean;
  error?: string;
  sync_progress?: { current: number; total: number } | null;
}

export interface HistoryEntry {
  timestamp: number;
  appid: number;
  name: string;
  mode: SuggestMode;
  is_non_steam?: boolean;
  matched_appid?: number;
  filters?: SuggestFilters;
  preset_name?: string;
  extra_data?: Record<string, any>;
  release_date?: number;
}

export interface RefreshProgress {
  current: number;
  total: number;
  phase?: "fetch_list" | "processing" | "metadata" | "non_steam";
  phase_label?: string;
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
  min_steam_review_score: undefined,
  min_metacritic_score: undefined,
  include_games_without_reviews: true,
  release_date_after: undefined,
  release_date_before: undefined,
  include_unknown_release_date: true,
  purchase_date_after: undefined,
  purchase_date_before: undefined,
  include_unknown_purchase_date: true,
  title_regex: undefined,
  title_regex_case_sensitive: false,
  min_size_mb: undefined,
  max_size_mb: undefined,
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
  versus: "Versus",
  similar_to: "Similar To",
};

export const MODE_DESCRIPTIONS: Record<SuggestMode, string> = {
  guided: "Backlog clearing — least played games first",
  intelligent: "Similar to your recent gaming habits",
  fresh_air: "Something different from what you usually play",
  luck: "Random pick from your library",
  versus: "Head-to-head elimination — you pick the winner",
  similar_to: "Find games similar to one you choose",
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
  review_score_weight: number;
  rarity_boost_enabled: boolean;
  rarity_boost_strength: number;
}

export interface FreshAirTuning {
  genre_penalty_multiplier: number;
  tag_penalty_multiplier: number;
  community_tag_penalty_multiplier: number;
  unplayed_bonus: number;
  novel_genre_bonus: number;
  top_candidate_percentile: number;
  review_score_weight: number;
  rarity_boost_enabled: boolean;
  rarity_boost_strength: number;
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
  review_score_weight: 0.15,
  rarity_boost_enabled: true,
  rarity_boost_strength: 0.5,
};

export const DEFAULT_FRESH_AIR_TUNING: FreshAirTuning = {
  genre_penalty_multiplier: 0.5,
  tag_penalty_multiplier: 0.3,
  community_tag_penalty_multiplier: 0.2,
  unplayed_bonus: 0.5,
  novel_genre_bonus: 0.2,
  top_candidate_percentile: 20,
  review_score_weight: 0.15,
  rarity_boost_enabled: true,
  rarity_boost_strength: 0.5,
};

export interface SpinWheelPayload {
  winner: Game | null;
  candidates: Game[];
  winner_index: number;
  candidates_count?: number;
  excluded_count?: number;
  error?: string;
}

export interface LibraryBreakdown {
  genres: Record<string, number>;
  unplayed_by_genre: Record<string, number>;
  deck_status: Record<string, number>;
  protondb_tier: Record<string, number>;
  steam_reviews: Record<string, number>;
  metacritic: Record<string, number>;
  total: number;
  unmatched_non_steam?: number;
}

export interface SimilarToTuning {
  genre_weight: number;
  tag_weight: number;
  community_tag_weight: number;
  review_proximity_weight: number;
  top_candidate_percentile: number;
  rarity_boost_enabled: boolean;
  rarity_boost_strength: number;
}

export const DEFAULT_SIMILAR_TO_TUNING: SimilarToTuning = {
  genre_weight: 1.0,
  tag_weight: 0.5,
  community_tag_weight: 0.4,
  review_proximity_weight: 0.15,
  top_candidate_percentile: 20,
  rarity_boost_enabled: true,
  rarity_boost_strength: 0.5,
};

export interface VersusRoundPayload {
  champion: Game;
  challenger: Game;
  pool_size: number;
  error?: string;
}

export interface VersusResult {
  winner: Game;
  rounds: number;
  pool_exhausted: boolean;
}

export function filtersEqual(a: SuggestFilters, b: SuggestFilters): boolean {
  const na = { ...DEFAULT_FILTERS, ...a };
  const nb = { ...DEFAULT_FILTERS, ...b };

  const arraysEqual = (x: string[] | number[] | undefined, y: string[] | number[] | undefined) => {
    const ax = x || [];
    const ay = y || [];
    if (ax.length !== ay.length) return false;
    return ax.every((v, i) => v === ay[i]);
  };
  
  return (
    arraysEqual(na.include_genres, nb.include_genres) &&
    arraysEqual(na.exclude_genres, nb.exclude_genres) &&
    arraysEqual(na.include_tags, nb.include_tags) &&
    arraysEqual(na.exclude_tags, nb.exclude_tags) &&
    arraysEqual(na.include_community_tags, nb.include_community_tags) &&
    arraysEqual(na.exclude_community_tags, nb.exclude_community_tags) &&
    arraysEqual(na.deck_status, nb.deck_status) &&
    arraysEqual(na.protondb_tier, nb.protondb_tier) &&
    arraysEqual(na.include_collections, nb.include_collections) &&
    arraysEqual(na.exclude_collections, nb.exclude_collections) &&
    na.min_playtime === nb.min_playtime &&
    na.max_playtime === nb.max_playtime &&
    na.installed_only === nb.installed_only &&
    na.not_installed_only === nb.not_installed_only &&
    na.include_unplayed === nb.include_unplayed &&
    na.non_steam_only === nb.non_steam_only &&
    na.exclude_non_steam === nb.exclude_non_steam &&
    na.min_steam_review_score === nb.min_steam_review_score &&
    na.min_metacritic_score === nb.min_metacritic_score &&
    na.include_games_without_reviews === nb.include_games_without_reviews &&
    na.release_date_after === nb.release_date_after &&
    na.release_date_before === nb.release_date_before &&
    na.include_unknown_release_date === nb.include_unknown_release_date &&
    na.purchase_date_after === nb.purchase_date_after &&
    na.purchase_date_before === nb.purchase_date_before &&
    na.include_unknown_purchase_date === nb.include_unknown_purchase_date &&
    na.title_regex === nb.title_regex &&
    na.title_regex_case_sensitive === nb.title_regex_case_sensitive &&
    na.min_size_mb === nb.min_size_mb &&
    na.max_size_mb === nb.max_size_mb
  );
}
