import {
    ConfirmModal,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    SidebarNavigation,
    SliderField,
    TextField,
    ToggleField,
    showModal,
} from "@decky/ui";
import { routerHook } from "@decky/api";
import { useState } from "react";
import { FaTags, FaGamepad, FaClock, FaCheck, FaTimes, FaSteam, FaFolder, FaExchangeAlt, FaUsers, FaSave, FaEdit, FaTrash } from "react-icons/fa";
import { SuggestFilters, DEFAULT_FILTERS } from "../types";
import { useFilterPresets } from "../hooks/useFilterPresets";

interface PresetLabelModalProps {
    currentLabel: string;
    onSave: (label: string) => void;
    closeModal?: () => void;
}

function PresetLabelModalContent({ currentLabel, onSave, closeModal }: PresetLabelModalProps) {
    const [label, setLabel] = useState(currentLabel);

    const handleSave = () => {
        const trimmed = label.trim().slice(0, 20);
        onSave(trimmed || currentLabel);
        closeModal?.();
    };

    return (
        <ConfirmModal
            strTitle="Rename Preset"
            strDescription=""
            strOKButtonText="Save"
            strCancelButtonText="Cancel"
            onOK={handleSave}
            onCancel={() => closeModal?.()}
        >
            <div style={{ padding: '8px 0', minWidth: 300 }}>
                <TextField
                    label="Preset Name"
                    value={label}
                    onChange={(e) => setLabel(e.target.value.slice(0, 20))}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    Max 20 characters ({20 - label.length} remaining)
                </div>
            </div>
        </ConfirmModal>
    );
}

function showPresetLabelModal(currentLabel: string, onSave: (label: string) => void) {
    showModal(<PresetLabelModalContent currentLabel={currentLabel} onSave={onSave} />);
}

interface SearchModalProps {
    title: string;
    onSearch: (query: string) => void;
    availableItems?: string[];
    closeModal?: () => void;
}

function SearchModalContent({ title, onSearch, availableItems = [], closeModal }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const [focusedItem, setFocusedItem] = useState<string | null>(null);

    const handleSearch = (finalQuery: string) => {
        onSearch(finalQuery.trim());
        closeModal?.();
    };

    const suggestions = query.trim() && availableItems.length > 0
        ? availableItems.filter(item => item.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
        : [];

    return (
        <ConfirmModal
            strTitle={title}
            strDescription=""
            strOKButtonText="Search"
            strCancelButtonText="Cancel"
            onOK={() => handleSearch(query)}
            onCancel={() => closeModal?.()}
        >
            <div style={{ padding: '8px 0', minWidth: 300 }}>
                <TextField
                    label="Search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {suggestions.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {suggestions.map(item => (
                            <Focusable
                                key={item}
                                onActivate={() => handleSearch(item)}
                                onClick={() => handleSearch(item)}
                                style={{
                                    padding: '8px 12px',
                                    backgroundColor: focusedItem === item ? '#4488aa' : '#ffffff11',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    border: focusedItem === item ? '1px solid white' : '1px solid transparent'
                                }}
                                onFocus={() => setFocusedItem(item)}
                                onBlur={() => setFocusedItem(null)}
                            >
                                {item}
                            </Focusable>
                        ))}
                    </div>
                )}
            </div>
        </ConfirmModal>
    );
}

function showSearchModal(title: string, onSearch: (query: string) => void, availableItems?: string[]) {
    showModal(<SearchModalContent title={title} onSearch={onSearch} availableItems={availableItems} />);
}

export const FILTERS_ROUTE = '/suggestme/filters';

interface FiltersModalProps {
    filters: SuggestFilters;
    availableGenres: string[];
    availableTags: string[];
    availableCommunityTags: string[];
    availableCollections: string[];
    onSave: (filters: SuggestFilters) => void;
}

let currentFiltersProps: FiltersModalProps | null = null;

const MultiSelectChips = ({ 
    title,
    available, 
    selected,
    excluded = [],
    onToggle,
    maxVisible = 30,
    showSearch = false,
    searchTitle = "Search"
}: { 
    title: string;
    available: string[]; 
    selected: string[];
    excluded?: string[];
    onToggle: (item: string) => void;
    maxVisible?: number;
    showSearch?: boolean;
    searchTitle?: string;
}) => {
    const [showAll, setShowAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    
    const filteredItems = searchQuery.trim()
        ? available.filter(item => 
            item.toLowerCase().includes(searchQuery.toLowerCase()) ||
            selected.includes(item) ||
            excluded.includes(item)
          )
        : available;
    
    const displayItems = showAll || searchQuery.trim() ? filteredItems : filteredItems.slice(0, maxVisible);
    const hasMore = filteredItems.length > maxVisible && !searchQuery.trim();

    const handleOpenSearch = () => {
        showSearchModal(searchTitle, (query) => {
            setSearchQuery(query);
        }, available);
    };

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#aaa' }}>{title}</div>
                {showSearch && available.length > 10 && (
                    <Focusable
                        onActivate={handleOpenSearch}
                        style={{
                            padding: '4px 10px',
                            backgroundColor: searchQuery ? '#4488aa33' : '#ffffff11',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: '2px solid transparent',
                            fontSize: 11,
                            color: searchQuery ? '#4488aa' : '#888',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                        {searchQuery ? `"${searchQuery}"` : 'Search'}
                        {searchQuery && (
                            <span 
                                onClick={(e) => { e.stopPropagation(); setSearchQuery(""); }}
                                style={{ marginLeft: 4, cursor: 'pointer' }}
                            >×</span>
                        )}
                    </Focusable>
                )}
            </div>
            <Focusable
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    maxHeight: 200,
                    overflowY: 'auto'
                }}
            >
                {displayItems.map(item => {
                    const isSelected = selected.includes(item);
                    const isExcluded = excluded.includes(item);
                    return (
                        <Focusable
                            key={item}
                            onActivate={() => onToggle(item)}
                            onClick={() => onToggle(item)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: 16,
                                fontSize: 11,
                                backgroundColor: isSelected ? '#4488aa' : (isExcluded ? '#ffffff08' : '#ffffff11'),
                                opacity: isExcluded ? 0.4 : 1,
                                color: isSelected ? '#fff' : '#aaa',
                                border: '2px solid transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = 'white'}
                            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                        >
                            {isSelected && <FaCheck size={8} />}
                            {item}
                        </Focusable>
                    );
                })}
                {hasMore && !showAll && (
                    <Focusable
                        onActivate={() => setShowAll(true)}
                        onClick={() => setShowAll(true)}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 16,
                            fontSize: 11,
                            backgroundColor: '#ffffff22',
                            color: '#4488aa',
                            border: '2px solid transparent',
                            cursor: 'pointer'
                        }}
                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                        +{filteredItems.length - maxVisible} more
                    </Focusable>
                )}
            </Focusable>
            {selected.length > 0 && (
                <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>
                    {selected.length} selected
                </div>
            )}
        </div>
    );
};

const GameSourcePage = ({ filters, setFilters }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void }) => (
    <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <PanelSection title="Game Source">
            <PanelSectionRow>
                <ToggleField
                    label="Non-Steam games only"
                    description="Only suggest non-Steam games"
                    checked={filters.non_steam_only}
                    onChange={(v) => setFilters({ ...filters, non_steam_only: v, exclude_non_steam: v ? false : filters.exclude_non_steam })}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    label="Exclude non-Steam games"
                    description="Only suggest Steam games"
                    checked={filters.exclude_non_steam}
                    onChange={(v) => setFilters({ ...filters, exclude_non_steam: v, non_steam_only: v ? false : filters.non_steam_only })}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    label="Installed only"
                    description="Only suggest games currently installed"
                    checked={filters.installed_only}
                    onChange={(v) => setFilters({ ...filters, installed_only: v, not_installed_only: v ? false : filters.not_installed_only })}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    label="Not installed only"
                    description="Only suggest games not currently installed"
                    checked={filters.not_installed_only}
                    onChange={(v) => setFilters({ ...filters, not_installed_only: v, installed_only: v ? false : filters.installed_only })}
                />
            </PanelSectionRow>
        </PanelSection>
    </div>
);

const PlaytimePage = ({ filters, setFilters }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void }) => (
    <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <PanelSection title="Playtime Filters">
            <PanelSectionRow>
                <ToggleField
                    label="Not played yet only"
                    description="Only suggest games with 0 playtime"
                    checked={filters.include_unplayed && filters.max_playtime === 0}
                    onChange={(v) => {
                        if (v) {
                            setFilters({ ...filters, include_unplayed: true, max_playtime: 0, min_playtime: undefined });
                        } else {
                            setFilters({ ...filters, max_playtime: undefined });
                        }
                    }}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    label="Include unplayed games"
                    description="Include games with 0 minutes playtime"
                    checked={filters.include_unplayed}
                    onChange={(v) => setFilters({ ...filters, include_unplayed: v })}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <SliderField
                    label="Minimum playtime"
                    description={filters.min_playtime ? `At least ${Math.round(filters.min_playtime / 60)} hours` : 'No minimum'}
                    value={filters.min_playtime ? filters.min_playtime / 60 : 0}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => setFilters({ ...filters, min_playtime: v === 0 ? undefined : v * 60 })}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <SliderField
                    label="Maximum playtime"
                    description={filters.max_playtime ? `At most ${Math.round(filters.max_playtime / 60)} hours` : 'No limit'}
                    value={filters.max_playtime ? filters.max_playtime / 60 : 500}
                    min={0}
                    max={500}
                    step={5}
                    onChange={(v) => setFilters({ ...filters, max_playtime: v >= 500 ? undefined : v * 60 })}
                />
            </PanelSectionRow>
        </PanelSection>

    </div>
);

const GenresPage = ({ filters, setFilters, genres }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void; genres: string[] }) => {
    const toggleInclude = (genre: string) => {
        const current = filters.include_genres;
        if (current.includes(genre)) {
            setFilters({ ...filters, include_genres: current.filter(g => g !== genre) });
        } else {
            setFilters({ 
                ...filters, 
                include_genres: [...current, genre],
                exclude_genres: filters.exclude_genres.filter(g => g !== genre)
            });
        }
    };

    const toggleExclude = (genre: string) => {
        const current = filters.exclude_genres;
        if (current.includes(genre)) {
            setFilters({ ...filters, exclude_genres: current.filter(g => g !== genre) });
        } else {
            setFilters({ 
                ...filters, 
                exclude_genres: [...current, genre],
                include_genres: filters.include_genres.filter(g => g !== genre)
            });
        }
    };

    return (
        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <PanelSection title="Official Steam Genres">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Steam's official genre categories (Action, RPG, Strategy, etc.)
                    </div>
                </PanelSectionRow>
                {genres.length === 0 ? (
                    <PanelSectionRow>
                        <div style={{ color: '#888', fontSize: 12 }}>
                            No genres available. Refresh your library first.
                        </div>
                    </PanelSectionRow>
                ) : (
                    <>
                        <MultiSelectChips
                            title="Include genres (match any)"
                            available={genres}
                            selected={filters.include_genres}
                            excluded={filters.exclude_genres}
                            onToggle={toggleInclude}
                            showSearch
                            searchTitle="Search Genres"
                        />
                        <MultiSelectChips
                            title="Exclude genres"
                            available={genres}
                            selected={filters.exclude_genres}
                            excluded={filters.include_genres}
                            onToggle={toggleExclude}
                            showSearch
                            searchTitle="Search Genres"
                        />
                    </>
                )}
            </PanelSection>
        </div>
    );
};

const TagsPage = ({ filters, setFilters, tags }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void; tags: string[] }) => {
    const toggleInclude = (tag: string) => {
        const current = filters.include_tags;
        if (current.includes(tag)) {
            setFilters({ ...filters, include_tags: current.filter(t => t !== tag) });
        } else {
            setFilters({ 
                ...filters, 
                include_tags: [...current, tag],
                exclude_tags: filters.exclude_tags.filter(t => t !== tag)
            });
        }
    };

    const toggleExclude = (tag: string) => {
        const current = filters.exclude_tags;
        if (current.includes(tag)) {
            setFilters({ ...filters, exclude_tags: current.filter(t => t !== tag) });
        } else {
            setFilters({ 
                ...filters, 
                exclude_tags: [...current, tag],
                include_tags: filters.include_tags.filter(t => t !== tag)
            });
        }
    };

    return (
        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <PanelSection title="Steam Features">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Official Steam features (Single-player, Multi-player, Co-op, Steam Achievements, etc.)
                    </div>
                </PanelSectionRow>
                {tags.length === 0 ? (
                    <PanelSectionRow>
                        <div style={{ color: '#888', fontSize: 12 }}>
                            No features available. Refresh your library first.
                        </div>
                    </PanelSectionRow>
                ) : (
                    <>
                        <MultiSelectChips
                            title="Include features (match any)"
                            available={tags}
                            selected={filters.include_tags}
                            excluded={filters.exclude_tags}
                            onToggle={toggleInclude}
                            showSearch
                            searchTitle="Search Features"
                        />
                        <MultiSelectChips
                            title="Exclude features"
                            available={tags}
                            selected={filters.exclude_tags}
                            excluded={filters.include_tags}
                            onToggle={toggleExclude}
                            showSearch
                            searchTitle="Search Features"
                        />
                    </>
                )}
            </PanelSection>
        </div>
    );
};

const CommunityTagsPage = ({ filters, setFilters, communityTags }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void; communityTags: string[] }) => {
    const includeTags = filters.include_community_tags || [];
    const excludeTags = filters.exclude_community_tags || [];

    const toggleInclude = (tag: string) => {
        if (includeTags.includes(tag)) {
            setFilters({ ...filters, include_community_tags: includeTags.filter(t => t !== tag) });
        } else {
            setFilters({ 
                ...filters, 
                include_community_tags: [...includeTags, tag],
                exclude_community_tags: excludeTags.filter(t => t !== tag)
            });
        }
    };

    const toggleExclude = (tag: string) => {
        if (excludeTags.includes(tag)) {
            setFilters({ ...filters, exclude_community_tags: excludeTags.filter(t => t !== tag) });
        } else {
            setFilters({ 
                ...filters, 
                exclude_community_tags: [...excludeTags, tag],
                include_community_tags: includeTags.filter(t => t !== tag)
            });
        }
    };

    return (
        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <PanelSection title="Community Tags">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        User-generated tags from the Steam community (Souls-like, Metroidvania, Roguelike, Open World, etc.)
                    </div>
                </PanelSectionRow>
                {communityTags.length === 0 ? (
                    <PanelSectionRow>
                        <div style={{ color: '#888', fontSize: 12 }}>
                            No community tags available. Refresh your library first.
                        </div>
                    </PanelSectionRow>
                ) : (
                    <>
                        <MultiSelectChips
                            title="Include tags (match any)"
                            available={communityTags}
                            selected={includeTags}
                            excluded={excludeTags}
                            onToggle={toggleInclude}
                            showSearch
                            searchTitle="Search Community Tags"
                        />
                        <MultiSelectChips
                            title="Exclude tags"
                            available={communityTags}
                            selected={excludeTags}
                            excluded={includeTags}
                            onToggle={toggleExclude}
                            showSearch
                            searchTitle="Search Community Tags"
                        />
                    </>
                )}
            </PanelSection>
        </div>
    );
};

const DECK_STATUS_OPTIONS = [
    { value: 'verified', label: 'Verified', color: '#88ff88' },
    { value: 'playable', label: 'Playable', color: '#ffcc00' },
    { value: 'unsupported', label: 'Unsupported', color: '#ff6666' },
    { value: 'unknown', label: 'Unknown', color: '#888888' },
];

const PROTONDB_TIER_OPTIONS = [
    { value: 'platinum', label: 'Platinum', color: '#b4c7dc' },
    { value: 'gold', label: 'Gold', color: '#cfb53b' },
    { value: 'silver', label: 'Silver', color: '#a8a8a8' },
    { value: 'bronze', label: 'Bronze', color: '#cd7f32' },
    { value: 'borked', label: 'Borked', color: '#ff0000' },
    { value: 'pending', label: 'Pending', color: '#666666' },
];

const CollectionsPage = ({ filters, setFilters, collections }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void; collections: string[] }) => {
    const toggleInclude = (col: string) => {
        const current = filters.include_collections || [];
        if (current.includes(col)) {
            setFilters({ ...filters, include_collections: current.filter(c => c !== col) });
        } else {
            setFilters({ 
                ...filters, 
                include_collections: [...current, col],
                exclude_collections: (filters.exclude_collections || []).filter(c => c !== col)
            });
        }
    };

    const toggleExclude = (col: string) => {
        const current = filters.exclude_collections || [];
        if (current.includes(col)) {
            setFilters({ ...filters, exclude_collections: current.filter(c => c !== col) });
        } else {
            setFilters({ 
                ...filters, 
                exclude_collections: [...current, col],
                include_collections: (filters.include_collections || []).filter(c => c !== col)
            });
        }
    };

    return (
        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <PanelSection title="Steam Collections">
                {collections.length === 0 ? (
                    <PanelSectionRow>
                        <div style={{ color: '#888', fontSize: 12 }}>
                            No collections found. Create collections in your Steam library to filter by them.
                        </div>
                    </PanelSectionRow>
                ) : (
                    <>
                        <MultiSelectChips
                            title="Include collections (match any)"
                            available={collections}
                            selected={filters.include_collections || []}
                            excluded={filters.exclude_collections || []}
                            onToggle={toggleInclude}
                        />
                        <MultiSelectChips
                            title="Exclude collections"
                            available={collections}
                            selected={filters.exclude_collections || []}
                            excluded={filters.include_collections || []}
                            onToggle={toggleExclude}
                        />
                    </>
                )}
            </PanelSection>
        </div>
    );
};

const DeckCompatPage = ({ filters, setFilters }: { filters: SuggestFilters; setFilters: (f: SuggestFilters) => void }) => {
    const toggleDeckStatus = (status: string) => {
        const current = filters.deck_status || [];
        if (current.includes(status)) {
            setFilters({ ...filters, deck_status: current.filter(s => s !== status) });
        } else {
            setFilters({ ...filters, deck_status: [...current, status] });
        }
    };

    const toggleProtondbTier = (tier: string) => {
        const current = filters.protondb_tier || [];
        if (current.includes(tier)) {
            setFilters({ ...filters, protondb_tier: current.filter(t => t !== tier) });
        } else {
            setFilters({ ...filters, protondb_tier: [...current, tier] });
        }
    };

    return (
        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <PanelSection title="Valve Deck Status">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Filter by Valve's official Steam Deck compatibility rating.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <Focusable style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {DECK_STATUS_OPTIONS.map(opt => {
                            const selected = (filters.deck_status || []).includes(opt.value);
                            return (
                                <Focusable
                                    key={opt.value}
                                    onActivate={() => toggleDeckStatus(opt.value)}
                                    onClick={() => toggleDeckStatus(opt.value)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 6,
                                        backgroundColor: selected ? opt.color + '33' : '#ffffff11',
                                        border: selected ? `2px solid ${opt.color}` : '2px solid transparent',
                                        color: selected ? opt.color : '#aaa',
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                    onBlur={(e: any) => e.target.style.borderColor = selected ? opt.color : 'transparent'}
                                >
                                    {selected && <FaCheck size={10} style={{ marginRight: 4 }} />}
                                    {opt.label}
                                </Focusable>
                            );
                        })}
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="ProtonDB Rating">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Filter by community-driven ProtonDB compatibility ratings.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <Focusable style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PROTONDB_TIER_OPTIONS.map(opt => {
                            const selected = (filters.protondb_tier || []).includes(opt.value);
                            return (
                                <Focusable
                                    key={opt.value}
                                    onActivate={() => toggleProtondbTier(opt.value)}
                                    onClick={() => toggleProtondbTier(opt.value)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 6,
                                        backgroundColor: selected ? opt.color + '33' : '#ffffff11',
                                        border: selected ? `2px solid ${opt.color}` : '2px solid transparent',
                                        color: selected ? opt.color : '#aaa',
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                    onBlur={(e: any) => e.target.style.borderColor = selected ? opt.color : 'transparent'}
                                >
                                    {selected && <FaCheck size={10} style={{ marginRight: 4 }} />}
                                    {opt.label}
                                </Focusable>
                            );
                        })}
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>
        </div>
    );
};

const PresetsPage = ({ 
    filters, 
    setFilters,
    onPresetChange
}: { 
    filters: SuggestFilters; 
    setFilters: (f: SuggestFilters) => void;
    onPresetChange: (label: string | null) => void;
}) => {
    const { presets, activeIndex, savePreset, renamePreset, deletePreset, setActive } = useFilterPresets();
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedSlot, setSavedSlot] = useState<number | null>(null);

    const handleSaveToSlot = async (slotIndex: number) => {
        const existing = presets[slotIndex];
        const label = existing?.label || `Preset ${slotIndex + 1}`;
        const result = await savePreset(slotIndex, label, filters);
        if (result.success) {
            onPresetChange(label);
            setSaveError(null);
            setSavedSlot(slotIndex);
            setTimeout(() => setSavedSlot(null), 2000);
        } else {
            setSaveError(result.error || "Failed to save");
            setTimeout(() => setSaveError(null), 3000);
        }
    };

    const handleLoadPreset = async (slotIndex: number) => {
        const preset = presets[slotIndex];
        if (preset) {
            setFilters(preset.filters);
            await setActive(slotIndex);
            onPresetChange(preset.label);
        }
    };

    const handleStartRename = (slotIndex: number) => {
        const preset = presets[slotIndex];
        if (preset) {
            showPresetLabelModal(preset.label, async (newLabel) => {
                await renamePreset(slotIndex, newLabel);
            });
        }
    };

    const handleDelete = async (slotIndex: number) => {
        await deletePreset(slotIndex);
        if (activeIndex === slotIndex) {
            onPresetChange(null);
        }
    };

    return (
        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <PanelSection title="Filter Presets">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
                        Save up to 5 filter combinations. Load a preset to apply its filters.
                    </div>
                </PanelSectionRow>
                {saveError && (
                    <PanelSectionRow>
                        <div style={{ 
                            fontSize: 11, 
                            color: '#ff6666', 
                            padding: '8px 12px',
                            backgroundColor: '#ff666622',
                            borderRadius: 6,
                            marginBottom: 8
                        }}>
                            {saveError}
                        </div>
                    </PanelSectionRow>
                )}
                {presets.map((preset, index) => (
                    <PanelSectionRow key={index}>
                        <Focusable
                            flow-children="row"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%'
                            }}
                        >
                            {preset ? (
                                <>
                                    <Focusable
                                        onActivate={() => handleLoadPreset(index)}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            backgroundColor: activeIndex === index ? '#4488aa33' : '#ffffff11',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            border: '2px solid transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        {activeIndex === index && <FaCheck size={10} style={{ color: '#4488aa' }} />}
                                        <span style={{ fontSize: 13 }}>{preset.label}</span>
                                    </Focusable>
                                    <Focusable
                                        onActivate={() => handleStartRename(index)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: '#ffffff11',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            border: '2px solid transparent'
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <FaEdit size={12} style={{ color: '#888' }} />
                                    </Focusable>
                                    <Focusable
                                        onActivate={() => handleSaveToSlot(index)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: savedSlot === index ? '#88ff8833' : (activeIndex === index ? '#4488aa' : '#4488aa22'),
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            border: '2px solid transparent',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        {savedSlot === index ? (
                                            <FaCheck size={12} style={{ color: '#88ff88' }} />
                                        ) : (
                                            <FaSave size={12} style={{ color: activeIndex === index ? '#fff' : '#4488aa' }} />
                                        )}
                                    </Focusable>
                                    <Focusable
                                        onActivate={() => handleDelete(index)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: '#ff666622',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            border: '2px solid transparent'
                                        }}
                                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <FaTrash size={12} style={{ color: '#ff6666' }} />
                                    </Focusable>
                                </>
                            ) : (
                                <Focusable
                                    onActivate={() => handleSaveToSlot(index)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        backgroundColor: savedSlot === index ? '#88ff8833' : '#ffffff08',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        border: '2px solid transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        color: savedSlot === index ? '#88ff88' : '#666',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                                >
                                    {savedSlot === index ? <FaCheck size={12} /> : <FaSave size={12} />}
                                    <span style={{ fontSize: 12 }}>{savedSlot === index ? 'Saved!' : `Save to Slot ${index + 1}`}</span>
                                </Focusable>
                            )}
                        </Focusable>
                    </PanelSectionRow>
                ))}
            </PanelSection>
            <div style={{ 
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)', 
                margin: '16px 0',
                paddingTop: 8
            }}>
                <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 8 }}>
                    ↓ Filter Categories Below ↓
                </div>
            </div>
        </div>
    );
};

export const FiltersPage = () => {
    const props = currentFiltersProps;
    const { setActive } = useFilterPresets();
    
    if (!props) {
        return (
            <div style={{ padding: 24, color: '#ff6666' }}>
                Filters not initialized. Please go back and try again.
            </div>
        );
    }

    const [localFilters, setLocalFilters] = useState<SuggestFilters>(props.filters);
    const [resetFeedback, setResetFeedback] = useState(false);
    const [filtersModified, setFiltersModified] = useState(false);

    const handleFilterChange = (newFilters: SuggestFilters) => {
        setLocalFilters(newFilters);
        if (!filtersModified) {
            setFiltersModified(true);
            setActive(null);
        }
    };

    const handleSave = async () => {
        await props.onSave(localFilters);
        Navigation.NavigateBack();
    };

    const handleReset = () => {
        setLocalFilters(DEFAULT_FILTERS);
        setFiltersModified(true);
        setActive(null);
        setResetFeedback(true);
        setTimeout(() => setResetFeedback(false), 1500);
    };

    const pages = [
        {
            title: "Presets",
            icon: <FaSave size={16} />,
            content: <PresetsPage filters={localFilters} setFilters={setLocalFilters} onPresetChange={() => setFiltersModified(false)} />
        },
        {
            title: "Source",
            icon: <FaExchangeAlt size={16} />,
            content: <GameSourcePage filters={localFilters} setFilters={handleFilterChange} />
        },
        {
            title: "Playtime",
            icon: <FaClock size={16} />,
            content: <PlaytimePage filters={localFilters} setFilters={handleFilterChange} />
        },
        {
            title: "Genres",
            icon: <FaGamepad size={16} />,
            content: <GenresPage filters={localFilters} setFilters={handleFilterChange} genres={props.availableGenres} />
        },
        {
            title: "Features",
            icon: <FaTags size={16} />,
            content: <TagsPage filters={localFilters} setFilters={handleFilterChange} tags={props.availableTags} />
        },
        {
            title: "Community",
            icon: <FaUsers size={16} />,
            content: <CommunityTagsPage filters={localFilters} setFilters={handleFilterChange} communityTags={props.availableCommunityTags} />
        },
        {
            title: "Deck",
            icon: <FaSteam size={16} />,
            content: <DeckCompatPage filters={localFilters} setFilters={handleFilterChange} />
        },
        {
            title: "Collections",
            icon: <FaFolder size={16} />,
            content: <CollectionsPage filters={localFilters} setFilters={handleFilterChange} collections={props.availableCollections} />
        }
    ];

    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#0e141b', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <SidebarNavigation pages={pages} />
            </div>
            <Focusable
                flow-children="row"
                style={{
                    display: 'flex',
                    gap: 8,
                    padding: '12px 24px 60px 24px',
                    borderTop: '1px solid #ffffff11'
                }}
            >
                <Focusable
                    onActivate={handleReset}
                    onClick={handleReset}
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: resetFeedback ? '#88ff8833' : '#ffffff11',
                        borderRadius: 6,
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        fontSize: 12,
                        color: resetFeedback ? '#88ff88' : 'inherit',
                        transition: 'all 0.2s ease'
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    {resetFeedback ? (
                        <>
                            <FaCheck size={10} style={{ marginRight: 4 }} />
                            Reset!
                        </>
                    ) : (
                        <>
                            <FaTimes size={10} style={{ marginRight: 4 }} />
                            Reset
                        </>
                    )}
                </Focusable>
                <Focusable
                    onActivate={handleSave}
                    onClick={handleSave}
                    style={{
                        flex: 3,
                        padding: '8px 0px',
                        backgroundColor: '#4488aa',
                        borderRadius: 6,
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        fontSize: 12,
                        fontWeight: 600
                    }}
                    onFocus={(e: any) => e.target.style.borderColor = 'white'}
                    onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                >
                    <FaCheck size={10} style={{ marginRight: 4 }} />
                    Apply
                </Focusable>
            </Focusable>
        </div>
    );
};

export function registerFiltersRoute() {
    routerHook.addRoute(FILTERS_ROUTE, () => <FiltersPage />);
}

export function unregisterFiltersRoute() {
    routerHook.removeRoute(FILTERS_ROUTE);
}

export function navigateToFilters(props: FiltersModalProps) {
    currentFiltersProps = props;
    Navigation.CloseSideMenus();
    Navigation.Navigate(FILTERS_ROUTE);
}

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
        (filters.exclude_collections?.length || 0) > 0
    );
}
