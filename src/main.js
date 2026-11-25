import {startGameScreen} from "./ui/game-screen.js";
import {browserLocalePreference} from "./ui/i18n.js";

let storage, tabStorage;
try { storage=window.localStorage; } catch { /* The current session can still use the selector. */ }
try { tabStorage=window.sessionStorage; } catch { /* The launch hint still works. */ }
startGameScreen({
 localePreference:browserLocalePreference({storage,navigator,location,sessionStorage:tabStorage}),
});
