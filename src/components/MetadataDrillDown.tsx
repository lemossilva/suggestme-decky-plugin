import { Game } from "../types";
import { GamesListModal } from "./GamesListModal";

interface MetadataDrillDownProps {
    label: string;
    games: Game[];
    highlightField?: keyof Game;
    onBack: () => void;
}

export function MetadataDrillDown({ label, games, highlightField, onBack }: MetadataDrillDownProps) {
    return (
        <GamesListModal
            title={`Games Missing: ${label}`}
            subtitle={`${games.length} game${games.length !== 1 ? "s" : ""} without this field`}
            games={games}
            highlightField={highlightField}
            filterCategory="missing_field"
            onBack={onBack}
        />
    );
}
