import { call } from "@decky/api";

type LogLevel = "debug" | "info" | "warning" | "error";

async function sendLogToBackend(level: LogLevel, ...args: any[]) {
    const message = args.map(arg => {
        if (typeof arg === "object") {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(" ");

    try {
        await call<[string, string], void>("log_message", level, message);
    } catch (e) {
        // Fallback to standard console if backend call fails
    }
}

export const logger = {
    debug: (...args: any[]) => {
        console.debug(...args);
        sendLogToBackend("debug", ...args);
    },
    info: (...args: any[]) => {
        console.info(...args);
        sendLogToBackend("info", ...args);
    },
    warn: (...args: any[]) => {
        console.warn(...args);
        sendLogToBackend("warning", ...args);
    },
    error: (...args: any[]) => {
        console.error(...args);
        sendLogToBackend("error", ...args);
    }
};
