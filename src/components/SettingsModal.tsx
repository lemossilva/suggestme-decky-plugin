import {
    ButtonItem,
    DropdownItem,
    Focusable,
    Navigation,
    PanelSection,
    PanelSectionRow,
    ProgressBar,
    SidebarNavigation,
    SliderField,
    Spinner,
    TextField,
} from "@decky/ui";
import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { FaKey, FaSteam, FaSync, FaCopy, FaDatabase, FaInfoCircle, FaWifi, FaLock, FaCheck, FaExclamationTriangle, FaGamepad, FaChevronRight, FaTrash, FaWrench, FaSlidersH, FaUndo, FaArrowUp, FaArrowDown, FaEye, FaEyeSlash, FaChartBar } from "react-icons/fa";
import { StatisticsTab } from "./StatisticsTab";
import { MetadataDrillDown } from "./MetadataDrillDown";
import { Game } from "../types";
import { useSuggestMeConfig } from "../hooks/useSuggestMeConfig";
import { useLibraryStatus } from "../hooks/useLibraryStatus";
import { navigateToNonSteamGames } from "./NonSteamGamesModal";
import { call, toaster } from "@decky/api";
import { NonSteamGamesInfo, IntelligentTuning, FreshAirTuning, SimilarToTuning, DEFAULT_INTELLIGENT_TUNING, DEFAULT_FRESH_AIR_TUNING, DEFAULT_SIMILAR_TO_TUNING, ModeTuning, SuggestMode, MODE_LABELS } from "../types";
import { logger } from "../utils/logger";

const TAB_LABELS: Record<SuggestMode, string> = {
    luck: "Luck",
    guided: "Guided",
    intelligent: "Smart",
    fresh_air: "Fresh",
    versus: "VS",
    similar_to: "Like",
};

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
            logger.error('Failed to copy:', e);
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
    const { config, setSteamCredentials, setHideCredentials, getCredentials } = useSuggestMeConfig();
    const [apiKey, setApiKey] = useState("");
    const [steamId, setSteamId] = useState("");
    const [savedApiKey, setSavedApiKey] = useState("");
    const [savedSteamId, setSavedSteamId] = useState("");
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [detectedId, setDetectedId] = useState<string | null>(null);
    const showCredentials = !(config.hide_credentials ?? true);

    useEffect(() => {
        let cancelled = false;
        const loadCredentials = async () => {
            const creds = await getCredentials();
            if (cancelled) return;
            setApiKey(creds.steam_api_key);
            setSteamId(creds.steam_id);
            setSavedApiKey(creds.steam_api_key);
            setSavedSteamId(creds.steam_id);
        };
        loadCredentials();
        return () => { cancelled = true; };
    }, [getCredentials]);

    useEffect(() => {
        const checkDetected = async () => {
            try {
                const result = await call<[], { detected: boolean; steam_id: string }>("get_detected_steam_id");
                if (result?.detected && result.steam_id) {
                    setDetectedId(result.steam_id);
                }
            } catch (e) {
                logger.debug("[SuggestMe] Failed to get detected Steam ID:", e);
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
        apiKey.trim() !== savedApiKey ||
        steamId.trim() !== savedSteamId;

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
                    <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaKey size={14} style={{ color: '#888' }} />
                                <span style={{ fontSize: 13 }}>API Key (32 characters)</span>
                            </div>
                            <Focusable
                                onActivate={() => setHideCredentials(!config.hide_credentials)}
                                onClick={() => setHideCredentials(!config.hide_credentials)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 8px',
                                    backgroundColor: '#ffffff11',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    border: '2px solid transparent'
                                }}
                                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                            >
                                {showCredentials ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                                <span style={{ fontSize: 11 }}>{showCredentials ? "Hide" : "Show"}</span>
                            </Focusable>
                        </div>
                        {showCredentials ? (
                            <TextField
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                        ) : (
                            <Focusable 
                                onActivate={() => setHideCredentials(false)}
                                onClick={() => setHideCredentials(false)}
                                style={{
                                padding: '10px 12px',
                                backgroundColor: '#00000033',
                                borderRadius: 4,
                                color: '#888',
                                fontSize: 13,
                                fontStyle: 'italic',
                                cursor: 'pointer'
                            }}>
                                API Key is hidden. Click here or "Show" to view/edit.
                            </Focusable>
                        )}
                    </div>
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
                    <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FaSteam size={14} style={{ color: '#888' }} />
                                <span style={{ fontSize: 13 }}>Steam ID 64 (17 digits)</span>
                            </div>
                            <Focusable
                                onActivate={() => setHideCredentials(!config.hide_credentials)}
                                onClick={() => setHideCredentials(!config.hide_credentials)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 8px',
                                    backgroundColor: '#ffffff11',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    border: '2px solid transparent'
                                }}
                                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                            >
                                {showCredentials ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                                <span style={{ fontSize: 11 }}>{showCredentials ? "Hide" : "Show"}</span>
                            </Focusable>
                        </div>
                        {showCredentials ? (
                            <TextField
                                value={steamId}
                                onChange={(e) => setSteamId(e.target.value)}
                            />
                        ) : (
                            <Focusable 
                                onActivate={() => setHideCredentials(false)}
                                onClick={() => setHideCredentials(false)}
                                style={{
                                padding: '10px 12px',
                                backgroundColor: '#00000033',
                                borderRadius: 4,
                                color: '#888',
                                fontSize: 13,
                                fontStyle: 'italic',
                                cursor: 'pointer'
                            }}>
                                Steam ID is hidden. Click here or "Show" to view/edit.
                            </Focusable>
                        )}
                    </div>
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
                        disabled={!canSave}
                    >
                        Save Credentials
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

            <RawgApiKeySection />
        </ScrollableContent>
    );
};

const RawgApiKeySection = () => {
    const { setRawgApiKey, getCredentials } = useSuggestMeConfig();
    const [rawgKey, setRawgKey] = useState("");
    const [savedRawgKey, setSavedRawgKey] = useState("");
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const loadRawgKey = async () => {
            const creds = await getCredentials();
            if (cancelled) return;
            setRawgKey(creds.rawg_api_key);
            setSavedRawgKey(creds.rawg_api_key);
        };
        loadRawgKey();
        return () => { cancelled = true; };
    }, [getCredentials]);

    const handleSave = async () => {
        const success = await setRawgApiKey(rawgKey.trim());
        if (success) {
            setSavedRawgKey(rawgKey.trim());
        }
        setSaveMessage(success ? "RAWG API key saved!" : "Failed to save");
        setTimeout(() => setSaveMessage(null), 3000);
    };

    const keyChanged = rawgKey.trim() !== savedRawgKey;

    return (
        <PanelSection title="RAWG API Key (Optional)">
            <PanelSectionRow>
                <Focusable style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    backgroundColor: '#aa884422',
                    borderRadius: 8,
                    marginBottom: 8
                }}>
                    <FaInfoCircle size={14} style={{ color: '#aa8844' }} />
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                        Improves Metacritic score coverage. Steam only has scores for ~15% of games.
                    </span>
                </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                    Get a free API key from RAWG.io:
                </div>
            </PanelSectionRow>
            <PanelSectionRow>
                <CopyableLink 
                    url="https://rawg.io/apidocs" 
                    label="rawg.io/apidocs — Get Free API Key" 
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaKey size={14} style={{ color: '#888' }} />
                            <span style={{ fontSize: 13 }}>RAWG API Key</span>
                        </div>
                        <Focusable
                            onActivate={() => setShowKey(!showKey)}
                            onClick={() => setShowKey(!showKey)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 8px',
                                backgroundColor: '#ffffff11',
                                borderRadius: 4,
                                cursor: 'pointer',
                                border: '2px solid transparent'
                            }}
                            onFocus={(e: any) => e.target.style.borderColor = 'white'}
                            onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                        >
                            {showKey ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                            <span style={{ fontSize: 11 }}>{showKey ? "Hide" : "Show"}</span>
                        </Focusable>
                    </div>
                    {showKey ? (
                        <TextField
                            value={rawgKey}
                            onChange={(e) => setRawgKey(e.target.value)}
                        />
                    ) : (
                        <Focusable 
                            onActivate={() => setShowKey(true)}
                            onClick={() => setShowKey(true)}
                            style={{
                            padding: '10px 12px',
                            backgroundColor: '#00000033',
                            borderRadius: 4,
                            color: rawgKey ? '#88ff88' : '#888',
                            fontSize: 13,
                            fontStyle: 'italic',
                            cursor: 'pointer'
                        }}>
                            {rawgKey ? "RAWG API key configured ✓" : "No RAWG API key set. Click to add."}
                        </Focusable>
                    )}
                </div>
            </PanelSectionRow>
            {keyChanged && (
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={handleSave}
                    >
                        Save RAWG API Key
                    </ButtonItem>
                </PanelSectionRow>
            )}
            {saveMessage && (
                <PanelSectionRow>
                    <div style={{
                        textAlign: 'center',
                        color: saveMessage.includes('Failed') ? '#ff6666' : '#88ff88',
                        fontSize: 12
                    }}>
                        {saveMessage}
                    </div>
                </PanelSectionRow>
            )}
        </PanelSection>
    );
};

const GeneralSettingsPage = () => {
    const { config, setHistoryLimit, setModeOrder, setDateFormat } = useSuggestMeConfig();
    const [historyLimit, setHistoryLimitState] = useState(config.history_limit || 50);
    const [modeOrder, setModeOrderState] = useState<SuggestMode[]>(config.mode_order || ["luck", "guided", "intelligent", "fresh_air"]);
    const [dateFormat, setDateFormatState] = useState<'US' | 'EU' | 'ISO'>(config.date_format || 'US');

    useEffect(() => {
        if (config.date_format) {
            setDateFormatState(config.date_format);
        }
    }, [config.date_format]);

    useEffect(() => {
        if (config.history_limit) {
            setHistoryLimitState(config.history_limit);
        }
    }, [config.history_limit]);

    // Ensure a valid mode order with all modes present
    useEffect(() => {
        const defaultOrder: SuggestMode[] = ["luck", "guided", "intelligent", "fresh_air", "versus", "similar_to"];
        const currentOrder = config.mode_order || [];
        
        // If config is missing modes or has duplicates, reset/merge
        const uniqueCurrent = Array.from(new Set(currentOrder));
        const missing = defaultOrder.filter(m => !uniqueCurrent.includes(m));
        
        if (missing.length > 0 || uniqueCurrent.length !== defaultOrder.length) {
            setModeOrderState([...uniqueCurrent, ...missing]);
        } else {
            setModeOrderState(uniqueCurrent);
        }
    }, [config.mode_order]);

    const handleHistoryLimitChange = (value: number) => {
        setHistoryLimitState(value);
        setHistoryLimit(value);
    };

    const handleDateFormatChange = (data: any) => {
        const format = data.data as 'US' | 'EU' | 'ISO';
        setDateFormatState(format);
        setDateFormat(format);
    };

    const moveMode = async (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === modeOrder.length - 1)) {
            return;
        }

        const newOrder = [...modeOrder];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
        
        setModeOrderState(newOrder);
        await setModeOrder(newOrder);
    };

    return (
        <ScrollableContent>
            <PanelSection title="Display">
                <PanelSectionRow>
                    <DropdownItem
                        menuLabel="Date Format"
                        label="Date Format"
                        rgOptions={[
                            { data: 'US', label: 'US (MM/DD/YYYY)' },
                            { data: 'EU', label: 'EU (DD/MM/YYYY)' },
                            { data: 'ISO', label: 'ISO (YYYY-MM-DD)' }
                        ]}
                        selectedOption={dateFormat}
                        onChange={handleDateFormatChange}
                    />
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="History">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                        Limit the number of previously suggested games stored.
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <SliderField
                        label="History Size"
                        value={historyLimit}
                        min={10}
                        max={100}
                        step={5}
                        onChange={handleHistoryLimitChange}
                        showValue
                    />
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Tab Ordering">
                <PanelSectionRow>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
                        Reorder the suggestion mode tabs on the main screen.
                    </div>
                </PanelSectionRow>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {modeOrder.map((mode, index) => (
                        <PanelSectionRow key={mode}>
                            <Focusable
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 12px',
                                    backgroundColor: '#ffffff11',
                                    borderRadius: 8,
                                    border: '2px solid transparent'
                                }}
                                onFocus={(e: any) => e.target.style.borderColor = 'white'}
                                onBlur={(e: any) => e.target.style.borderColor = 'transparent'}
                            >
                                <span style={{ fontSize: 13 }}>{TAB_LABELS[mode]} <span style={{ color: '#666', fontSize: 11 }}>({MODE_LABELS[mode]})</span></span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <Focusable
                                        onActivate={index === 0 ? undefined : () => moveMode(index, 'up')}
                                        style={{
                                            padding: '6px',
                                            borderRadius: 4,
                                            backgroundColor: '#ffffff11',
                                            opacity: index === 0 ? 0.3 : 1,
                                            cursor: index === 0 ? 'default' : 'pointer'
                                        }}
                                    >
                                        <FaArrowUp size={10} />
                                    </Focusable>
                                    <Focusable
                                        onActivate={index === modeOrder.length - 1 ? undefined : () => moveMode(index, 'down')}
                                        style={{
                                            padding: '6px',
                                            borderRadius: 4,
                                            backgroundColor: '#ffffff11',
                                            opacity: index === modeOrder.length - 1 ? 0.3 : 1,
                                            cursor: index === modeOrder.length - 1 ? 'default' : 'pointer'
                                        }}
                                    >
                                        <FaArrowDown size={10} />
                                    </Focusable>
                                </div>
                            </Focusable>
                        </PanelSectionRow>
                    ))}
                </div>
            </PanelSection>
        </ScrollableContent>
    );
};

const SyncNewGamesButton = ({ disabled, onComplete }: { disabled: boolean; onComplete: () => void }) => {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncNewGames = async () => {
        setIsSyncing(true);
        try {
            const result = await call<[], {
                success: boolean;
                new_steam_count?: number;
                new_non_steam_count?: number;
                new_non_steam_matched?: number;
                error?: string;
            }>("sync_new_games");

            if (result?.success) {
                const newSteam = result.new_steam_count || 0;
                const newNonSteam = result.new_non_steam_count || 0;
                const matched = result.new_non_steam_matched || 0;

                if (newSteam === 0 && newNonSteam === 0) {
                    toaster.toast({
                        title: "SuggestMe • No New Games",
                        body: "Your library is already up to date",
                        duration: 3000,
                    });
                } else {
                    toaster.toast({
                        title: "SuggestMe • Sync Complete",
                        body: `Added ${newSteam} Steam + ${newNonSteam} Non-Steam (${matched} matched)`,
                        duration: 4000,
                    });
                }
                onComplete();
            } else {
                toaster.toast({
                    title: "SuggestMe • Sync Failed",
                    body: result?.error || "Unknown error",
                    duration: 5000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Sync new games failed:", e);
            toaster.toast({
                title: "SuggestMe • Sync Failed",
                body: "Failed to sync new games",
                duration: 5000,
            });
        }
        setIsSyncing(false);
    };

    return (
        <ButtonItem
            layout="below"
            onClick={handleSyncNewGames}
            disabled={disabled || isSyncing}
        >
            {isSyncing ? (
                <>
                    <Spinner style={{ marginRight: 8, width: 16, height: 16 }} />
                    Syncing New Games...
                </>
            ) : (
                <>
                    <FaSync style={{ marginRight: 8 }} />
                    Sync New Games Only
                </>
            )}
        </ButtonItem>
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
                logger.error("[SuggestMe] Failed to load non-steam info:", e);
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
                    title: "SuggestMe • Sync Complete",
                    body: `Steam: ${steamCount} • Non-Steam: ${nonSteamCount} (${nonSteamMatched} matched)`,
                    duration: 4000,
                });
            } else {
                toaster.toast({
                    title: "SuggestMe • Sync Failed",
                    body: result?.error || "Unknown error",
                    duration: 5000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Full sync failed:", e);
            toaster.toast({
                title: "SuggestMe • Sync Failed",
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
                        Re-syncs entire library and refreshes all metadata
                    </div>
                </PanelSectionRow>
                <PanelSectionRow>
                    <div style={{ fontSize: 10, color: '#aa8844', textAlign: 'center', padding: '4px 8px', backgroundColor: '#aa884411', borderRadius: 6 }}>
                        Large libraries (300+ games) may take several minutes to sync
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <SyncNewGamesButton 
                        disabled={status.is_refreshing || isSyncing || !hasCredentials}
                        onComplete={() => {
                            reload();
                            call<[], NonSteamGamesInfo>("get_non_steam_games").then(setNonSteamInfo);
                        }}
                    />
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

const RowElement = ({ title, description }: { title: string; description: ReactNode }) => {
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
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>SuggestMe v1.3.1</div>
                        <div style={{ fontSize: 11, color: '#888' }}>
                            A smart game recommender for your Steam library.
                        </div>
                        <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                            By Guilherme Lemos
                        </div>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Suggestion Modes">
                <RowElement
                    title="Luck"
                    description="Random pick from your filtered library with a slight bias toward unplayed games. Enable Spin Wheel mode for a visual roulette experience."
                />
                <RowElement
                    title="Guided"
                    description="Backlog clearing — suggests games with the least playtime first. Helps you finally play those untouched purchases."
                />
                <RowElement
                    title="Smart (Intelligent)"
                    description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div>Builds a preference profile from your recent play sessions and most-played games. Suggests titles that match your taste in genres, tags, and play patterns.</div>
                            <div><strong>Tuning:</strong> Adjust via Settings &gt; Mode Tuning. Increase Recency Decay to weight long-term history. Increase Unplayed Bonus to prioritize backlog gems.</div>
                        </div>
                    }
                />
                <RowElement
                    title="Fresh (Fresh Air)"
                    description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div>The opposite of Intelligent — identifies your comfort zone and suggests games outside it. Finds genres and tags you rarely play.</div>
                            <div><strong>Tuning:</strong> Increase Genre/Tag Penalty to avoid your usual types. Increase Novel Genre Bonus for completely new experiences.</div>
                        </div>
                    }
                />
                <RowElement
                    title="VS (Versus)"
                    description="Head-to-head elimination bracket. Two games face off and you pick the winner. The champion takes on the next challenger until you stop or the pool is exhausted. Battle progress is saved automatically — resume anytime within 24 hours."
                />
                <RowElement
                    title="Like (Similar To)"
                    description="Pick any game from your library as a reference, and the algorithm finds similar titles based on shared genres, tags, community tags, and review scores. Opens in a dedicated page with a searchable game picker."
                />
            </PanelSection>

            <PanelSection title="Filters">
                <RowElement
                    title="What are filters?"
                    description="Filters narrow down which games are eligible for suggestions. They apply to all modes. Set them from the filter button on the main screen."
                />
                <RowElement
                    title="Genre / Tag / Community Tag"
                    description="Include or exclude games by their Steam genres (Action, RPG…), feature tags (Single-player, Controller Support…), or community-applied store tags (Souls-like, Cozy…)."
                />
                <RowElement
                    title="Playtime"
                    description="Set min/max playtime thresholds. Toggle whether to include unplayed (0 hours) games."
                />
                <RowElement
                    title="Install status"
                    description="Filter to only installed games, only not-installed games, or both."
                />
                <RowElement
                    title="Compatibility"
                    description="Filter by Steam Deck verification status (Verified, Playable, Unsupported) or ProtonDB tier (Platinum, Gold, Silver…)."
                />
                <RowElement
                    title="Review scores"
                    description="Set minimum Steam review score or Metacritic score. Optionally include games without reviews."
                />
                <RowElement
                    title="Collections"
                    description="Include or exclude games from your Steam collections."
                />
                <RowElement
                    title="Non-Steam games"
                    description="Filter to only Non-Steam games or exclude them entirely."
                />
            </PanelSection>

            <PanelSection title="Filter Presets">
                <RowElement
                    title="Overview"
                    description="Save up to 5 filter combinations as presets for quick switching. Active preset is shown on the main screen. Presets persist across sessions."
                />
                <RowElement
                    title="How to use"
                    description="Configure your filters, then save them to a preset slot. Tap a preset pill on the main screen to activate it instantly."
                />
            </PanelSection>

            <PanelSection title="Spin Wheel">
                <RowElement
                    title="Overview"
                    description="A visual roulette wheel for Luck mode. Toggle it on from the Luck tab. Swipe or press Spin to start. Sound effects can be muted."
                />
            </PanelSection>

            <PanelSection title="Play Next List">
                <RowElement
                    title="Overview"
                    description="A personal queue of games you intend to play. Add any suggested game to the list from the suggestion card or from full-page modes. Access the full list from the header bar."
                />
                <RowElement
                    title="Exclude from suggestions"
                    description='Enable "Exclude Play Next from suggestions" in General settings to prevent queued games from being suggested again.'
                />
            </PanelSection>

            <PanelSection title="Excluded Games">
                <RowElement
                    title="Overview"
                    description="Permanently hide games from all suggestions. Excluded games appear in the Excluded list accessible from the header bar, where they can be restored."
                />
            </PanelSection>

            <PanelSection title="History">
                <RowElement
                    title="Overview"
                    description="Every suggestion is recorded with its mode, filters used, and timestamp. Browse by mode or view all. Restore previous filter configurations from any history entry."
                />
                <RowElement
                    title="Limit"
                    description="Configurable in General settings (default: 50 entries). Older entries are automatically removed."
                />
            </PanelSection>

            <PanelSection title="Non-Steam Games">
                <RowElement
                    title="Detection"
                    description="Non-Steam shortcuts are detected from your Steam userdata. The plugin attempts to match each one to a Steam store entry for metadata (genres, tags, reviews, artwork)."
                />
                <RowElement
                    title="Management"
                    description="View matched/unmatched games, retry matching, edit search terms, or remove entries from the Non-Steam Games page in Settings."
                />
            </PanelSection>

            <PanelSection title="Library & Sync">
                <RowElement
                    title="Initial setup"
                    description="Enter your Steam API Key and Steam ID 64 in Settings > Credentials. Then refresh your library to fetch your owned games and metadata."
                />
                <RowElement
                    title="Full Sync vs Quick Refresh"
                    description="Quick Refresh fetches your owned games list. Full Sync also detects Non-Steam games and fetches detailed metadata (genres, tags, reviews) for all games — this can take a few minutes for large libraries."
                />
                <RowElement
                    title="Sync New Games"
                    description="Incrementally adds newly purchased or added games without re-syncing your entire library."
                />
            </PanelSection>

            <PanelSection title="Settings Overview">
                <RowElement
                    title="Credentials"
                    description="Steam API Key and Steam ID 64 for fetching your library. Optional RAWG API Key for additional metadata."
                />
                <RowElement
                    title="General"
                    description="History limit, tab ordering, date format, Spin Wheel toggle, and Play Next exclusion toggle."
                />
                <RowElement
                    title="Mode Tuning"
                    description="Fine-tune the Intelligent, Fresh Air, and Similar To algorithms. Adjust genre/tag weights, bonuses, and candidate pool sizes. Reset to defaults anytime."
                />
                <RowElement
                    title="Statistics"
                    description="View your library breakdown by genre, deck compatibility, review scores, and more."
                />
                <RowElement
                    title="Maintenance"
                    description="Clear cache (keeps credentials) or factory reset (removes everything)."
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
                    title: "SuggestMe • Cache Cleared",
                    body: "Library, history, and filters have been reset. Credentials preserved.",
                    duration: 5000,
                });
                Navigation.NavigateBack();
                Navigation.OpenQuickAccessMenu();
            } else {
                toaster.toast({
                    title: "SuggestMe • Clear Cache Failed",
                    body: "An error occurred.",
                    duration: 3000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Clear cache failed:", e);
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
                    title: "SuggestMe • Factory Reset",
                    body: "All data has been cleared. Please reconfigure your credentials.",
                    duration: 5000,
                });
                Navigation.NavigateBack();
                Navigation.OpenQuickAccessMenu();
            } else {
                toaster.toast({
                    title: "SuggestMe • Factory Reset Failed",
                    body: "An error occurred during reset.",
                    duration: 3000,
                });
            }
        } catch (e) {
            logger.error("[SuggestMe] Factory reset failed:", e);
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

const ModeTuningPage = () => {
    const [intelligentTuning, setIntelligentTuning] = useState<IntelligentTuning>(DEFAULT_INTELLIGENT_TUNING);
    const [freshAirTuning, setFreshAirTuning] = useState<FreshAirTuning>(DEFAULT_FRESH_AIR_TUNING);
    const [similarToTuning, setSimilarToTuning] = useState<SimilarToTuning>(DEFAULT_SIMILAR_TO_TUNING);

    useEffect(() => {
        const loadTuning = async () => {
            try {
                const result = await call<[], ModeTuning & { similar_to?: SimilarToTuning }>("get_mode_tuning");
                if (result) {
                    setIntelligentTuning(result.intelligent);
                    setFreshAirTuning(result.fresh_air);
                    if (result.similar_to) setSimilarToTuning(result.similar_to);
                }
            } catch (e) {
                logger.error("[SuggestMe] Failed to load mode tuning:", e);
            }
        };
        loadTuning();
    }, []);

    const saveIntelligent = useCallback(async (tuning: IntelligentTuning) => {
        try {
            await call<[string, IntelligentTuning], { success: boolean }>("save_mode_tuning", "intelligent", tuning);
        } catch (e) {
            logger.error("[SuggestMe] Failed to save intelligent tuning:", e);
        } 
    }, []);

    const saveFreshAir = useCallback(async (tuning: FreshAirTuning) => {
        try {
            await call<[string, FreshAirTuning], { success: boolean }>("save_mode_tuning", "fresh_air", tuning);
        } catch (e) {
            logger.error("[SuggestMe] Failed to save fresh air tuning:", e);
        }
    }, []);

    const saveSimilarTo = useCallback(async (tuning: SimilarToTuning) => {
        try {
            await call<[string, SimilarToTuning], { success: boolean }>("save_mode_tuning", "similar_to", tuning);
        } catch (e) {
            logger.error("[SuggestMe] Failed to save similar to tuning:", e);
        }
    }, []);

    const handleResetIntelligent = async () => {
        try {
            const result = await call<[string], { success: boolean; tuning: IntelligentTuning }>("reset_mode_tuning", "intelligent");
            if (result.success && result.tuning) {
                setIntelligentTuning(result.tuning);
                toaster.toast({ title: "SuggestMe • Reset", body: "Intelligent mode reset to defaults", duration: 2000 });
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to reset intelligent tuning:", e);
        }
    };

    const handleResetFreshAir = async () => {
        try {
            const result = await call<[string], { success: boolean; tuning: FreshAirTuning }>("reset_mode_tuning", "fresh_air");
            if (result.success && result.tuning) {
                setFreshAirTuning(result.tuning);
                toaster.toast({ title: "SuggestMe • Reset", body: "Fresh Air mode reset to defaults", duration: 2000 });
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to reset fresh air tuning:", e);
        }
    };

    const handleResetSimilarTo = async () => {
        try {
            const result = await call<[string], { success: boolean; tuning: SimilarToTuning }>("reset_mode_tuning", "similar_to");
            if (result.success && result.tuning) {
                setSimilarToTuning(result.tuning);
                toaster.toast({ title: "SuggestMe • Reset", body: "Similar To mode reset to defaults", duration: 2000 });
            }
        } catch (e) {
            logger.error("[SuggestMe] Failed to reset similar to tuning:", e);
        }
    };

    const updateIntelligent = (key: keyof IntelligentTuning, value: number) => {
        const updated = { ...intelligentTuning, [key]: value };
        setIntelligentTuning(updated);
        saveIntelligent(updated);
    };

    const updateFreshAir = (key: keyof FreshAirTuning, value: number) => {
        const updated = { ...freshAirTuning, [key]: value };
        setFreshAirTuning(updated);
        saveFreshAir(updated);
    };

    const updateSimilarTo = (key: keyof SimilarToTuning, value: number) => {
        const updated = { ...similarToTuning, [key]: value };
        setSimilarToTuning(updated);
        saveSimilarTo(updated);
    };


    return (
        <ScrollableContent>
            <PanelSection title="Intelligent Mode">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Recommends games similar to your recent gaming habits.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Recent Games Count"
                        description="Number of recently played games to analyze"
                        value={intelligentTuning.recent_games_count}
                        min={5}
                        max={50}
                        step={5}
                        onChange={(v) => updateIntelligent("recent_games_count", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Most Played Count"
                        description="Number of most-played games to analyze"
                        value={intelligentTuning.most_played_count}
                        min={10}
                        max={100}
                        step={5}
                        onChange={(v) => updateIntelligent("most_played_count", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Recency Decay (days)"
                        description="Days until recency weight reaches minimum"
                        value={intelligentTuning.recency_decay_days}
                        min={30}
                        max={365}
                        step={15}
                        onChange={(v) => updateIntelligent("recency_decay_days", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Genre Weight"
                        description="How much genres influence the score"
                        value={intelligentTuning.genre_score_weight}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateIntelligent("genre_score_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Tag Weight"
                        description="How much Steam features influence the score"
                        value={intelligentTuning.tag_score_weight}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateIntelligent("tag_score_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Community Tag Weight"
                        description="How much community tags influence the score"
                        value={intelligentTuning.community_tag_score_weight}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateIntelligent("community_tag_score_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Unplayed Bonus"
                        description="Extra score for games you haven't played"
                        value={intelligentTuning.unplayed_bonus}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(v) => updateIntelligent("unplayed_bonus", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Top Candidates %"
                        description="Percentage of top-scored games to pick from"
                        value={intelligentTuning.top_candidate_percentile}
                        min={5}
                        max={50}
                        step={5}
                        onChange={(v) => updateIntelligent("top_candidate_percentile", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Review Score Weight"
                        description="How much Steam/Metacritic scores influence the result"
                        value={intelligentTuning.review_score_weight}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateIntelligent("review_score_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem layout="below" onClick={handleResetIntelligent}>
                        <FaUndo style={{ marginRight: 8 }} />
                        Reset Intelligent to Defaults
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Fresh Air Mode">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Recommends something different from what you usually play.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Genre Penalty"
                        description="How much familiar genres reduce the score"
                        value={freshAirTuning.genre_penalty_multiplier}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(v) => updateFreshAir("genre_penalty_multiplier", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Tag Penalty"
                        description="How much familiar tags reduce the score"
                        value={freshAirTuning.tag_penalty_multiplier}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(v) => updateFreshAir("tag_penalty_multiplier", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Community Tag Penalty"
                        description="How much familiar community tags reduce the score"
                        value={freshAirTuning.community_tag_penalty_multiplier}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(v) => updateFreshAir("community_tag_penalty_multiplier", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Unplayed Bonus"
                        description="Extra score for games you haven't played"
                        value={freshAirTuning.unplayed_bonus}
                        min={0}
                        max={1}
                        step={0.1}
                        onChange={(v) => updateFreshAir("unplayed_bonus", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Novel Genre Bonus"
                        description="Extra score per genre you've never played"
                        value={freshAirTuning.novel_genre_bonus}
                        min={0}
                        max={0.5}
                        step={0.05}
                        onChange={(v) => updateFreshAir("novel_genre_bonus", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Top Candidates %"
                        description="Percentage of top-scored games to pick from"
                        value={freshAirTuning.top_candidate_percentile}
                        min={5}
                        max={50}
                        step={5}
                        onChange={(v) => updateFreshAir("top_candidate_percentile", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Review Score Weight"
                        description="How much Steam/Metacritic scores influence the result"
                        value={freshAirTuning.review_score_weight}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateFreshAir("review_score_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem layout="below" onClick={handleResetFreshAir}>
                        <FaUndo style={{ marginRight: 8 }} />
                        Reset Fresh Air to Defaults
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="Similar To Mode">
                <PanelSectionRow>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                        Finds games similar to a reference game you pick.
                    </div>
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Genre Weight"
                        description="How much genre overlap influences similarity"
                        value={similarToTuning.genre_weight}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSimilarTo("genre_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Tag Weight"
                        description="How much Steam feature overlap influences similarity"
                        value={similarToTuning.tag_weight}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSimilarTo("tag_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Community Tag Weight"
                        description="How much community tag overlap influences similarity"
                        value={similarToTuning.community_tag_weight}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSimilarTo("community_tag_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Review Proximity Weight"
                        description="Bonus for games with similar review scores"
                        value={similarToTuning.review_proximity_weight}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSimilarTo("review_proximity_weight", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <SliderField
                        label="Top Candidates %"
                        description="Percentage of top-scored games to pick from"
                        value={similarToTuning.top_candidate_percentile}
                        min={5}
                        max={50}
                        step={5}
                        onChange={(v) => updateSimilarTo("top_candidate_percentile", v)}
                        showValue
                    />
                </PanelSectionRow>

                <PanelSectionRow>
                    <ButtonItem layout="below" onClick={handleResetSimilarTo}>
                        <FaUndo style={{ marginRight: 8 }} />
                        Reset Similar To to Defaults
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

        </ScrollableContent>
    );
};

const StatisticsPage = () => {
    const [drillDownData, setDrillDownData] = useState<{ label: string; games: Game[]; highlightField?: keyof Game } | null>(null);

    const handleViewGames = (label: string, games: Game[], highlightField?: keyof Game) => {
        setDrillDownData({ label, games, highlightField });
    };

    const handleBack = () => {
        setDrillDownData(null);
    };

    if (drillDownData) {
        return (
            <MetadataDrillDown
                label={drillDownData.label}
                games={drillDownData.games}
                highlightField={drillDownData.highlightField}
                onBack={handleBack}
            />
        );
    }

    return <StatisticsTab onViewGames={handleViewGames} />;
};

export const SettingsPage = () => {
    const pages = [
        {
            title: "Credentials",
            icon: <FaKey size={14} />,
            content: <CredentialsPage />
        },
        {
            title: "General",
            icon: <FaWrench size={14} />,
            content: <GeneralSettingsPage />
        },
        {
            title: "Library",
            icon: <FaDatabase size={14} />,
            content: <LibraryPage />
        },
        {
            title: "Statistics",
            icon: <FaChartBar size={14} />,
            content: <StatisticsPage />
        },
        {
            title: "Mode Tuning",
            icon: <FaSlidersH size={14} />,
            content: <ModeTuningPage />
        },
        {
            title: "Maintenance",
            icon: <FaTrash size={14} />,
            content: <MaintenancePage />
        },
        {
            title: "About & Instructions",
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
