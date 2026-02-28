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
}

export interface SuggestMeConfig {
  steam_api_key: string;
  steam_id: string;
  default_mode: SuggestMode;
  default_filters: SuggestFilters;
}

export interface SuggestionResult {
  game: Game | null;
  candidates_count: number;
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
