import {
    ButtonItem,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    ProgressBar,
    SidebarNavigation,
    Spinner,
    TextField,
} from "@decky/ui";
import { useState, useEffect, useRef } from "react";
import { FaKey, FaSteam, FaSync, FaCopy, FaDatabase, FaInfoCircle, FaWifi, FaLock, FaCheck, FaExclamationTriangle, FaGamepad, FaChevronRight, FaTrash, FaWrench } from "react-icons/fa";
import { useSuggestMeConfig } from "../hooks/useSuggestMeConfig";
import { useLibraryStatus } from "../hooks/useLibraryStatus";
import { navigateToNonSteamGames } from "./NonSteamGamesModal";
import { call, toaster } from "@decky/api";
import { NonSteamGamesInfo } from "../types";

export const SETTINGS_ROUTE = '/suggestme/settings';

const ScrollableContent = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        padding: '16px 24px 80px 24px',
        maxHeight: 'calc(100vh - 60px)',
        overflowY: 'auto'
    }}>
        {children}
    </div>
);

const validateSteamApiKey = (key: string): { valid: boolean; message: string } => {
    const trimmed = key.trim();
    if (!trimmed) return { valid: false, message: '' };
    if (trimmed.length !== 32) return { valid: false, message: `API key should be 32 characters (got ${trimmed.length})` };
    if (!/^[A-F0-9]+$/i.test(trimmed)) return { valid: false, message: 'API key should only contain hexadecimal characters' };
    return { valid: true, message: 'Valid API key format' };
};

const detectSteamIdFormat = (id: string): { format: string; message: string; isValid: boolean } => {
    const trimmed = id.trim();
    if (!trimmed) return { format: '', message: '', isValid: false };
    
    if (/^STEAM_[0-5]:[01]:\d+$/i.test(trimmed)) {
        return { format: 'Steam ID', message: 'This is Steam ID format. Please use Steam ID 64 (17 digits)', isValid: false };
    }
    if (/^\[U:1:\d+\]$/.test(trimmed)) {
        return { format: 'Steam ID 3', message: 'This is Steam ID 3 format. Please use Steam ID 64 (17 digits)', isValid: false };
    }
    if (/^\d{1,10}$/.test(trimmed)) {
        return { format: 'Account ID', message: 'This looks like an Account ID. Please use Steam ID 64 (17 digits starting with 7656)', isValid: false };
    }
    if (/^7656119\d{10}$/.test(trimmed) && trimmed.length === 17) {
        return { format: 'Steam ID 64', message: 'Valid Steam ID 64 format', isValid: true };
    }
    if (/^\d{17}$/.test(trimmed)) {
        if (!trimmed.startsWith('7656')) {
            return { format: 'Unknown', message: 'Steam ID 64 should start with 7656119...', isValid: false };
        }
        return { format: 'Steam ID 64', message: 'Valid Steam ID 64 format', isValid: true };
    }
    if (/^https?:\/\/steamcommunity\.com/.test(trimmed)) {
        return { format: 'Profile URL', message: 'Please enter your Steam ID 64, not the profile URL. Use steamid.io to find it.', isValid: false };
    }
    return { format: 'Unknown', message: 'Please enter a valid 17-digit Steam ID 64', isValid: false };
};

const CopyableLink = ({ url, label }: { url: string; label: string }) => {
    const [copied, setCopied] = useState(false);
    const [focused, setFocused] = useState(false);
    const [pressed, setPressed] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const handleCopy = () => {
        setPressed(true);
        setTimeout(() => { if (mountedRef.current) setPressed(false); }, 150);
        try {
            const el = document.createElement('textarea');
            el.value = url;
            el.style.position = 'fixed';
            el.style.opacity = '0';
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);

            setCopied(true);
            setTimeout(() => { if (mountedRef.current) setCopied(false); }, 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    return (
        <Focusable
            onActivate={handleCopy}
            onClick={handleCopy}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                backgroundColor: pressed ? '#66aacc' : (focused ? '#4488aa' : '#ffffff11'),
                borderRadius: 8,
                border: focused ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: 8,
                transform: pressed ? 'scale(0.98)' : 'scale(1)',
                transition: 'all 0.1s ease'
            }}
        >
            <FaCopy size={14} style={{ color: copied ? '#88ff88' : '#aaa' }} />
            <span style={{ flex: 1, fontSize: 12 }}>{label}</span>
            <span style={{ 
                fontSize: 11, 
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: copied ? '#88ff8833' : '#ffffff11',
                color: copied ? '#88ff88' : '#aaa'
            }}>
                {copied ? '✓ Copied!' : 'Copy URL'}
            </span>
        </Focusable>
    );
};

const CredentialsPage = () => {
    const { config, setSteamCredentials, isSaving } = useSuggestMeConfig();
    const [apiKey, setApiKey] = useState(config.steam_api_key || "");
    const [steamId, setSteamId] = useState(config.steam_id || "");
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [detectedId, setDetectedId] = useState<string | null>(null);

    useEffect(() => {
        setApiKey(config.steam_api_key || "");
        setSteamId(config.steam_id || "");
    }, [config.steam_api_key, config.steam_id]);

    useEffect(() => {
        const checkDetected = async () => {
            try {
                const result = await call<[], { detected: boolean; steam_id: string }>("get_detected_steam_id");
                if (result?.detected && result.steam_id) {
                    setDetectedId(result.steam_id);
                }
            } catch (e) {
                console.debug("[SuggestMe] Failed to get detected Steam ID:", e);
            }
        };
        checkDetected();
    }, []);

    const apiKeyValidation = validateSteamApiKey(apiKey);
    const steamIdValidation = detectSteamIdFormat(steamId);

    const handleSaveCredentials = async () => {
        const success = await setSteamCredentials(apiKey.trim(), steamId.trim());
        setSaveMessage(success ? "Credentials saved!" : "Failed to save");
        setTimeout(() => setSaveMessage(null), 3000);
    };

    const credentialsChanged =
        apiKey.trim() !== (config.steam_api_key || "") ||
        steamId.trim() !== (config.steam_id || "");

    const canSave = credentialsChanged && (apiKeyValidation.valid || steamIdValidation.isValid);

    return (
        <ScrollableContent>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        backgroundColor: '#4488aa22',
                        borderRadius: 8,
                        marginBottom: 8
                    }}>
                        <FaWifi size={14} style={{ color: '#4488aa' }} />
                        <span style={{ fontSize: 11, color: '#aaa' }}>
                            Internet connection required to fetch library data from Steam
                        </span>
                    </Focusable>
                </PanelSectionRow>
                <PanelSectionRow>
                    <Focusable style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        backgroundColor: '#88ff8811',
                        borderRadius: 8
                    }}>
                        <FaLock size={14} style={{ color: '#88aa88' }} />
                        <span style={{ fontSize: 11, color: '#aaa' }}>
                            Credentials are stored locally on your device only
                        </span>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Steam Web API Key">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                        Required to fetch your game library. Get your key from:
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <CopyableLink 
                        url="https://steamcommunity.com/dev/apikey" 
                        label="steamcommunity.com/dev/apikey" 
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <FaKey size={14} style={{ color: '#888' }} />
                            <span style={{ fontSize: 13 }}>API Key (32 characters)</span>
                        </div>
                        <TextField
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            bIsPassword={true}
                        />
                    </Focusable>
                </PanelSectionRow>
                {apiKey && apiKeyValidation.message && (
                    <PanelSectionRow>
                        <div style={{
                            fontSize: 11,
                            color: apiKeyValidation.valid ? '#88ff88' : '#ffaa00',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            {apiKeyValidation.valid ? <FaCheck size={10} /> : <FaExclamationTriangle size={10} />}
                            {apiKeyValidation.message}
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection title="Steam ID 64">
                {detectedId && steamId === detectedId && (
                    <PanelSectionRow>
                        <Focusable style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            backgroundColor: '#88ff8822',
                            borderRadius: 8,
                            marginBottom: 8
                        }}>
                            <FaCheck size={12} style={{ color: '#88ff88' }} />
                            <span style={{ fontSize: 11, color: '#88ff88' }}>
                                Auto-detected from local Steam files
                            </span>
                        </Focusable>
                    </PanelSectionRow>
                )}
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                        Your 17-digit Steam ID (starts with 7656119...). Find it at:
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <CopyableLink 
                        url="https://steamid.io/" 
                        label="steamid.io — Find your Steam ID 64" 
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <FaSteam size={14} style={{ color: '#888' }} />
                            <span style={{ fontSize: 13 }}>Steam ID 64 (17 digits)</span>
                        </div>
                        <TextField
                            value={steamId}
                            onChange={(e) => setSteamId(e.target.value)}
                        />
                    </Focusable>
                </PanelSectionRow>
                {steamId && steamIdValidation.message && (
                    <PanelSectionRow>
                        <div style={{
                            fontSize: 11,
                            color: steamIdValidation.isValid ? '#88ff88' : '#ffaa00',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap'
                        }}>
                            {steamIdValidation.isValid ? <FaCheck size={10} /> : <FaExclamationTriangle size={10} />}
                            {steamIdValidation.format && !steamIdValidation.isValid && (
                                <span style={{ color: '#ff8866' }}>Detected: {steamIdValidation.format}</span>
                            )}
                            <span>{steamIdValidation.message}</span>
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleSaveCredentials}
                        disabled={isSaving || !canSave}
                    >
                        {isSaving ? "Saving..." : "Save Credentials"}
                    </ButtonItem>
                </PanelSectionRow>
                {saveMessage && (
                    <PanelSectionRow>
                        <div style={{
                            textAlign: 'center',
                            color: saveMessage.includes('Failed') || saveMessage.includes('fix') ? '#ff6666' : '#88ff88',
                            fontSize: 12
                        }}>
                            {saveMessage}
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>
        </ScrollableContent>
    );
};

const LibraryPage = () => {
    const { hasCredentials } = useSuggestMeConfig();
    const { status, progress, formatLastRefresh, reload } = useLibraryStatus();
    const [nonSteamInfo, setNonSteamInfo] = useState<NonSteamGamesInfo | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const loadNonSteamInfo = async () => {
            try {
                const result = await call<[], NonSteamGamesInfo>("get_non_steam_games");
                setNonSteamInfo(result);
            } catch (e) {
                console.error("[SuggestMe] Failed to load non-steam info:", e);
            }
        };
        loadNonSteamInfo();
    }, []);

    const handleFullSync = async () => {
        setIsSyncing(true);

        try {
            const result = await call<[], { 
                success: boolean; 
                steam_count?: number; 
                non_steam_count?: number;
                non_steam_matched?: number;
                total_games?: number;
                error?: string;
            }>("full_sync");

            if (result?.success) {
                const steamCount = result.steam_count || 0;
                const nonSteamCount = result.non_steam_count || 0;
                const nonSteamMatched = result.non_steam_matched || 0;

                const updatedInfo = await call<[], NonSteamGamesInfo>("get_non_steam_games");
                setNonSteamInfo(updatedInfo);

                toaster.toast({
                    title: "Sync Complete",
                    body: `Steam: ${steamCount} • Non-Steam: ${nonSteamCount} (${nonSteamMatched} matched)`,
                    duration: 4000,
                });
            } else {
                toaster.toast({
                    title: "Sync Failed",
                    body: result?.error || "Unknown error",
                    duration: 5000,
                });
            }
        } catch (e) {
            console.error("[SuggestMe] Full sync failed:", e);
            toaster.toast({
                title: "Sync Failed",
                body: "Failed to sync library",
                duration: 5000,
            });
        }

        setIsSyncing(false);
        reload();
    };

    const steamGamesCount = status.steam_games_count || 0;
    const nonSteamGamesCount = nonSteamInfo?.matched || 0;

    return (
        <ScrollableContent>
            <PanelSection title="Library Overview">
                <PanelSectionRow>
                    <Focusable style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        padding: '12px',
                        backgroundColor: '#ffffff08',
                        borderRadius: 12,
                        width: '100%'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#4488aa' }}>
                                <FaSteam size={14} style={{ marginRight: 4 }} />
                                {steamGamesCount}
                            </div>
                            <div style={{ fontSize: 10, color: '#888' }}>Steam</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#88aa88' }}>
                                <FaGamepad size={14} style={{ marginRight: 4 }} />
                                {nonSteamGamesCount}
                            </div>
                            <div style={{ fontSize: 10, color: '#888' }}>Non-Steam</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#aaa' }}>
                                {steamGamesCount + nonSteamGamesCount}
                            </div>
                            <div style={{ fontSize: 10, color: '#888' }}>Total</div>
                        </div>
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <Focusable
                        onActivate={navigateToNonSteamGames}
                        onClick={navigateToNonSteamGames}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px',
                            backgroundColor: '#ffffff11',
                            borderRadius: 8,
                            cursor: 'pointer',
                            border: '2px solid transparent',
                            width: '100%'
                        }}
                        onFocus={(e: any) => e.target.style.borderColor = 'white'}
                        onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaGamepad size={14} style={{ color: '#88aa88' }} />
                            <span style={{ fontSize: 13 }}>Manage Non-Steam Games</span>
                        </div>
                        <FaChevronRight size={12} style={{ color: '#666' }} />
                    </Focusable>
                </PanelSectionRow>

                <PanelSectionRow>
                    <Focusable style={{ width: '100%' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0'
                        }}>
                            <span>Last refresh</span>
                            <strong>{formatLastRefresh()}</strong>
                        </div>
                    </Focusable>
                </PanelSectionRow>

                {status.is_refreshing && progress && (
                    <PanelSectionRow>
                        <div style={{ width: '100%', padding: '8px 0' }}>
                            <div style={{ fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                                Fetching game details: {progress.current}/{progress.total}
                            </div>
                            <ProgressBar nProgress={(progress.current / progress.total) * 100} />
                        </div>
                    </PanelSectionRow>
                )}

                {status.error && (
                    <PanelSectionRow>
                        <div style={{ 
                            color: '#ff6666', 
                            fontSize: 12, 
                            padding: '8px',
                            backgroundColor: '#ff000022',
                            borderRadius: 8
                        }}>
                            {status.error}
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection title="Sync Library">
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleFullSync}
                        disabled={status.is_refreshing || isSyncing || !hasCredentials}
                    >
                        {status.is_refreshing || isSyncing ? (
                            <>
                                <Spinner style={{ marginRight: 8, width: 16, height: 16 }} />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <FaSync style={{ marginRight: 8 }} />
                                Sync All Games
                            </>
                        )}
                    </ButtonItem>
                </PanelSectionRow>

                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>
                        Syncs Steam library and scans for non-Steam games
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 10, color: '#aa8844', textAlign: 'center', padding: '4px 8px', backgroundColor: '#aa884411', borderRadius: 6 }}>
                        Large libraries (300+ games) may take several minutes to sync
                    </div>
                </PanelSectionRow>

                {!hasCredentials && (
                    <PanelSectionRow>
                        <div style={{
                            fontSize: 12,
                            color: '#ffaa00',
                            textAlign: 'center',
                            padding: '8px',
                            backgroundColor: '#ffaa0022',
                            borderRadius: 8
                        }}>
                            Set up your Steam credentials first.
                        </div>
                    </PanelSectionRow>
                )}
            </PanelSection>
        </ScrollableContent>
    );
};

const ModeRow = ({ title, description }: { title: string; description: string }) => {
    return (
        <Focusable
            onActivate={() => {}}
            onFocus={(e: any) => {
                e.target.style.backgroundColor = '#4488aa33';
                e.target.style.border = '2px solid white';
            }}
            onBlur={(e: any) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.border = '2px solid transparent';
            }}
            style={{
                padding: '10px 12px',
                backgroundColor: 'transparent',
                borderRadius: 8,
                marginBottom: 4,
                border: '2px solid transparent',
                transition: 'all 0.1s ease-in-out'
            }}
        >
            <strong style={{ color: '#4488aa', fontSize: 13 }}>{title}</strong>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        </Focusable>
    );
};

const AboutPage = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    return (
        <div ref={scrollRef} style={{
            padding: '16px 24px 80px 24px',
            maxHeight: 'calc(100vh - 60px)',
            overflowY: 'auto'
        }}>
            <Focusable style={{ height: 0, overflow: 'hidden' }}>{null}</Focusable>
            <PanelSection>
                <PanelSectionRow>
                    <Focusable style={{ width: '100%', textAlign: 'center', padding: '12px 0' }}>
                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                            SuggestMe (v1.0.1) is a smart game recommender for your Steam library.
                        </div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                            By Guilherme Lemos
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Suggestion Modes">
                <ModeRow 
                    title="Wish Me Luck" 
                    description="Pure random selection from your filtered library. Every game has an equal chance, with a slight bias toward unplayed titles. Perfect when you can't decide."
                />
                <ModeRow 
                    title="Guided" 
                    description="Prioritizes your backlog by suggesting games with the least playtime first. Weights games inversely to hours played, helping you finally start those untouched purchases."
                />
                <ModeRow 
                    title="Intelligent" 
                    description="Analyzes your recent play sessions and most-played games to build a preference profile based on genres, tags, and play patterns. Suggests similar games you haven't explored yet."
                />
                <ModeRow 
                    title="Fresh Air" 
                    description="The opposite of Intelligent — identifies your comfort zone and deliberately suggests games outside it. Finds titles with genres and tags you rarely play to broaden your horizons."
                />
            </PanelSection>

        </div>
    );
};

const MaintenancePage = () => {
    return (
        <ScrollableContent>
            <PanelSection title="Clear Cache">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                        Clears library cache, suggestion history, and filters while keeping your credentials.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <ClearCacheButton />
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Factory Reset">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aa6666', marginBottom: 8 }}>
                        Removes all data including credentials, library cache, and history. You will need to reconfigure the plugin.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <FactoryResetButton />
                </PanelSectionRow>
            </PanelSection>
        </ScrollableContent>
    );
};

const ClearCacheButton = () => {
    const [confirming, setConfirming] = useState(false);
    const [clearing, setClearing] = useState(false);

    const handleClear = async () => {
        if (!confirming) {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 5000);
            return;
        }

        setClearing(true);
        try {
            const result = await call<[], { success: boolean }>("clear_cache");
            if (result.success) {
                toaster.toast({
                    title: "Cache Cleared",
                    body: "Library, history, and filters have been reset. Credentials preserved.",
                    duration: 5000,
                });
                Navigation.NavigateBack();
                Navigation.OpenQuickAccessMenu();
            } else {
                toaster.toast({
                    title: "Clear Cache Failed",
                    body: "An error occurred.",
                    duration: 3000,
                });
            }
        } catch (e) {
            console.error("[SuggestMe] Clear cache failed:", e);
        } finally {
            setClearing(false);
            setConfirming(false);
        }
    };

    return (
        <ButtonItem
            layout="below"
            onClick={handleClear}
            disabled={clearing}
        >
            {clearing ? (
                <>
                    <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                    Clearing...
                </>
            ) : confirming ? (
                <>
                    <FaTrash style={{ marginRight: 8, color: '#ffaa00' }} />
                    Tap again to confirm
                </>
            ) : (
                <>
                    <FaDatabase style={{ marginRight: 8 }} />
                    Clear Cache
                </>
            )}
        </ButtonItem>
    );
};

const FactoryResetButton = () => {
    const [confirming, setConfirming] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleReset = async () => {
        if (!confirming) {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 5000);
            return;
        }

        setResetting(true);
        try {
            const result = await call<[], { success: boolean }>("factory_reset");
            if (result.success) {
                toaster.toast({
                    title: "Factory Reset",
                    body: "All data has been cleared. Please reconfigure your credentials.",
                    duration: 5000,
                });
                Navigation.NavigateBack();
                Navigation.OpenQuickAccessMenu();
            } else {
                toaster.toast({
                    title: "Factory Reset Failed",
                    body: "An error occurred during reset.",
                    duration: 3000,
                });
            }
        } catch (e) {
            console.error("[SuggestMe] Factory reset failed:", e);
        } finally {
            setResetting(false);
            setConfirming(false);
        }
    };

    return (
        <ButtonItem
            layout="below"
            onClick={handleReset}
            disabled={resetting}
        >
            {resetting ? (
                <>
                    <Spinner style={{ marginRight: 8, width: 14, height: 14 }} />
                    Resetting...
                </>
            ) : confirming ? (
                <>
                    <FaTrash style={{ marginRight: 8, color: '#ff6666' }} />
                    Tap again to confirm reset
                </>
            ) : (
                <>
                    <FaTrash style={{ marginRight: 8 }} />
                    Factory Reset
                </>
            )}
        </ButtonItem>
    );
};

export const SettingsPage = () => {
    const pages = [
        {
            title: "Credentials",
            icon: <FaKey size={14} />,
            content: <CredentialsPage />
        },
        {
            title: "Library",
            icon: <FaDatabase size={14} />,
            content: <LibraryPage />
        },
        {
            title: "Maintenance",
            icon: <FaWrench size={14} />,
            content: <MaintenancePage />
        },
        {
            title: "About",
            icon: <FaInfoCircle size={14} />,
            content: <AboutPage />
        }
    ];

    return (
        <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0e141b'
        }}>
            <SidebarNavigation pages={pages} />
        </div>
    );
};

export function navigateToSettings() {
    Navigation.CloseSideMenus();
    Navigation.Navigate(SETTINGS_ROUTE);
}
