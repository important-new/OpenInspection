export interface PublishBlockingDefect {
    sectionId:    string;
    sectionTitle: string;
    itemId:       string;
    itemLabel:    string;
    cannedId:     string;
    cannedTitle:  string;
    missing:      Array<'location' | 'trade'>;
    unresolvedTokens: string[];
}

export interface PublishReadiness {
    ready: boolean;
    blockingDefects: PublishBlockingDefect[];
}
