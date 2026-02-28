import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { FaLightbulb } from "react-icons/fa";
import { SuggestMeRoot } from "./components/SuggestMeRoot";
import { SettingsPage, SETTINGS_ROUTE } from "./components/SettingsModal";
import { FiltersPage, FILTERS_ROUTE } from "./components/FiltersModal";
import { NonSteamGamesPage, NON_STEAM_ROUTE } from "./components/NonSteamGamesModal";

export default definePlugin(() => {
  console.log("[SuggestMe] Plugin initializing");

  routerHook.addRoute(SETTINGS_ROUTE, () => <SettingsPage />);
  routerHook.addRoute(FILTERS_ROUTE, () => <FiltersPage />);
  routerHook.addRoute(NON_STEAM_ROUTE, () => <NonSteamGamesPage />);

  return {
    name: "SuggestMe",
    titleView: <div className={staticClasses.Title} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaLightbulb size={16} />SuggestMe</div>,
    content: <SuggestMeRoot />,
    icon: <FaLightbulb />,
    onDismount() {
      console.log("[SuggestMe] Plugin unloading");
      routerHook.removeRoute(SETTINGS_ROUTE);
      routerHook.removeRoute(FILTERS_ROUTE);
      routerHook.removeRoute(NON_STEAM_ROUTE);
    },
  };
});
