import { SuggestFilters } from "../types";

const STEAM_REVIEW_SCORE_LABELS: Record<number, string> = {
    1: "Overwhelmingly Negative",
    2: "Very Negative",
    3: "Negative",
    4: "Mostly Negative",
    5: "Mixed",
    6: "Mostly Positive",
    7: "Positive",
    8: "Very Positive",
    9: "Overwhelmingly Positive",
};

export function getFilterSummary(filters: SuggestFilters): string {
    const parts: string[] = [];
    
    if (filters.non_steam_only) parts.push('Non-Steam only');
    if (filters.exclude_non_steam) parts.push('Steam only');
    if (filters.include_unplayed && filters.max_playtime === 0) {
        parts.push('Not played yet');
    } else {
        if (!filters.include_unplayed) parts.push('No unplayed');
        if (filters.max_playtime !== undefined && filters.max_playtime > 0) parts.push(`<${Math.round(filters.max_playtime / 60)}h`);
    }
    if (filters.installed_only) parts.push('Installed');
    if (filters.not_installed_only) parts.push('Not installed');
    if (filters.min_playtime) parts.push(`>${Math.round(filters.min_playtime / 60)}h`);
    if (filters.include_genres?.length) parts.push(`${filters.include_genres.length} genres`);
    if (filters.exclude_genres?.length) parts.push(`-${filters.exclude_genres.length} genres`);
    if (filters.include_tags?.length) parts.push(`${filters.include_tags.length} features`);
    if (filters.exclude_tags?.length) parts.push(`-${filters.exclude_tags.length} features`);
    if (filters.include_community_tags?.length) parts.push(`${filters.include_community_tags.length} community tags`);
    if (filters.exclude_community_tags?.length) parts.push(`-${filters.exclude_community_tags.length} community tags`);
    if (filters.deck_status?.length) parts.push(`${filters.deck_status.length} deck status`);
    if (filters.protondb_tier?.length) parts.push(`${filters.protondb_tier.length} ProtonDB`);
    if (filters.include_collections?.length) parts.push(`${filters.include_collections.length} collections`);
    if (filters.exclude_collections?.length) parts.push(`-${filters.exclude_collections.length} collections`);
    if (filters.min_steam_review_score) parts.push(`Steam ≥${STEAM_REVIEW_SCORE_LABELS[filters.min_steam_review_score] || filters.min_steam_review_score}`);
    if (filters.min_metacritic_score) parts.push(`Meta ≥${filters.min_metacritic_score}`);
    if (!filters.include_games_without_reviews) parts.push('Reviews required');
    if (filters.release_date_after !== undefined || filters.release_date_before !== undefined) parts.push('Release date');
    if (filters.purchase_date_after !== undefined || filters.purchase_date_before !== undefined) parts.push('Purchase date');
    if (filters.title_regex) parts.push('Title regex');
    if (filters.min_size_mb !== undefined || filters.max_size_mb !== undefined) parts.push('Size');
    
    return parts.length > 0 ? parts.join(' • ') : 'No filters';
}

export function hasActiveFilters(filters: SuggestFilters): boolean {
    return (
        filters.non_steam_only ||
        filters.exclude_non_steam ||
        !filters.include_unplayed ||
        (filters.include_unplayed && filters.max_playtime === 0) ||
        filters.installed_only ||
        filters.not_installed_only ||
        filters.min_playtime !== undefined ||
        (filters.max_playtime !== undefined && filters.max_playtime > 0) ||
        (filters.include_genres?.length || 0) > 0 ||
        (filters.exclude_genres?.length || 0) > 0 ||
        (filters.include_tags?.length || 0) > 0 ||
        (filters.exclude_tags?.length || 0) > 0 ||
        (filters.include_community_tags?.length || 0) > 0 ||
        (filters.exclude_community_tags?.length || 0) > 0 ||
        (filters.deck_status?.length || 0) > 0 ||
        (filters.protondb_tier?.length || 0) > 0 ||
        (filters.include_collections?.length || 0) > 0 ||
        (filters.exclude_collections?.length || 0) > 0 ||
        filters.min_steam_review_score !== undefined ||
        filters.min_metacritic_score !== undefined ||
        !filters.include_games_without_reviews ||
        filters.release_date_after !== undefined ||
        filters.release_date_before !== undefined ||
        filters.purchase_date_after !== undefined ||
        filters.purchase_date_before !== undefined ||
        !!filters.title_regex ||
        filters.min_size_mb !== undefined ||
        filters.max_size_mb !== undefined
    );
}
