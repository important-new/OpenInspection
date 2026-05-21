export interface ProgressItem {
    id: string;
    sectionId?: string;
    rating?: string | null;
    [key: string]: unknown;
}

export interface Completion {
    rated:   number;
    total:   number;
    percent: number;
}

export interface SectionStats {
    sectionId: string;
    rated:     number;
    total:     number;
    percent:   number;
}

export function computeCompletion(items: ProgressItem[]): Completion;
export function etaMinutes(durationsSec: number[], remaining: number): number;
export function sectionHeatMap(items: ProgressItem[]): SectionStats[];
