import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook, call } from "@decky/api";
import { FaLightbulb } from "react-icons/fa";
import { SuggestMeRoot } from "./components/SuggestMeRoot";
import { SettingsPage, SETTINGS_ROUTE } from "./components/SettingsModal";
import { FiltersPage, FILTERS_ROUTE } from "./components/FiltersModal";
import { NonSteamGamesPage, NON_STEAM_ROUTE } from "./components/NonSteamGamesModal";
import { PlayNextPage, PLAY_NEXT_ROUTE } from "./components/PlayNextModal";
import { ExcludedGamesPage, EXCLUDED_GAMES_ROUTE } from "./components/ExcludedGamesModal";
import { HistoryPage, HISTORY_ROUTE } from "./components/HistoryModal";
import { SpinWheelPage, SPIN_WHEEL_ROUTE } from "./components/SpinWheelPage";
import { VersusPageWrapper, VERSUS_ROUTE } from "./components/VersusPage";
import { SimilarToPageWrapper, SIMILAR_TO_ROUTE } from "./components/SimilarToPage";
import { logger } from "./utils/logger";

declare const SteamClient: {
  GameSessions: {
    RegisterForAppLifetimeNotifications: (callback: (data: { unAppID: number; bRunning: boolean }) => void) => { unregister: () => void };
  };
};

let gameLifetimeUnregister: (() => void) | null = null;

export default definePlugin(() => {
  logger.info("[SuggestMe] Plugin initializing");

  routerHook.addRoute(SETTINGS_ROUTE, () => <SettingsPage />);
  routerHook.addRoute(FILTERS_ROUTE, () => <FiltersPage />);
  routerHook.addRoute(NON_STEAM_ROUTE, () => <NonSteamGamesPage />);
  routerHook.addRoute(PLAY_NEXT_ROUTE, () => <PlayNextPage />);
  routerHook.addRoute(EXCLUDED_GAMES_ROUTE, () => <ExcludedGamesPage />);
  routerHook.addRoute(HISTORY_ROUTE, () => <HistoryPage />);
  routerHook.addRoute(SPIN_WHEEL_ROUTE, () => <SpinWheelPage />);
  routerHook.addRoute(VERSUS_ROUTE, () => <VersusPageWrapper />);
  routerHook.addRoute(SIMILAR_TO_ROUTE, () => <SimilarToPageWrapper />);

  try {
    const registration = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((data) => {
      if (!data.bRunning && data.unAppID) {
        logger.info(`[SuggestMe] Game closed: ${data.unAppID}, syncing playtime...`);
        call<[number], { success: boolean }>("sync_playtime_for_app", data.unAppID)
          .catch((e) => logger.error("[SuggestMe] Post-game sync failed:", e));
      }
    });
    gameLifetimeUnregister = registration.unregister;
    logger.info("[SuggestMe] Registered for game lifecycle events");
  } catch (e) {
    logger.warn("[SuggestMe] Could not register for game lifecycle events:", e);
  }

  return {
    name: "SuggestMe",
    titleView: <div className={staticClasses.Title} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaLightbulb size={16} />SuggestMe</div>,
    content: <SuggestMeRoot />,
    icon: <FaLightbulb />,
    onDismount() {
      logger.info("[SuggestMe] Plugin unloading");
      if (gameLifetimeUnregister) {
        gameLifetimeUnregister();
        gameLifetimeUnregister = null;
      }
      routerHook.removeRoute(SETTINGS_ROUTE);
      routerHook.removeRoute(FILTERS_ROUTE);
      routerHook.removeRoute(NON_STEAM_ROUTE);
      routerHook.removeRoute(PLAY_NEXT_ROUTE);
      routerHook.removeRoute(EXCLUDED_GAMES_ROUTE);
      routerHook.removeRoute(HISTORY_ROUTE);
      routerHook.removeRoute(SPIN_WHEEL_ROUTE);
      routerHook.removeRoute(VERSUS_ROUTE);
      routerHook.removeRoute(SIMILAR_TO_ROUTE);
    },
  };
});
