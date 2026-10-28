// No React imports here: the root layout (a server component) uses this file.
export const THEME_KEY = "collab-workspace:theme";

// Runs in <head> before first paint so a saved dark theme never flashes light.
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
