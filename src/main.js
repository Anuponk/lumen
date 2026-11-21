import {startGameScreen} from "./ui/game-screen.js";
import {createLocalePreference} from "./ui/i18n.js";

let storage;
try { storage=window.localStorage; } catch { /* The current session can still use the selector. */ }
startGameScreen({
 localePreference:createLocalePreference({storage,languages:navigator.languages,language:navigator.language}),
});
