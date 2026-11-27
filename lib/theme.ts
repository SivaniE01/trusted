export const THEME_KEY = "theme";

/** Inline script: applies the saved theme before first paint, so light-theme visitors see no dark flash. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;
