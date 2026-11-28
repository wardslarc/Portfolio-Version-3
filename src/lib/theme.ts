export const THEME_STORAGE_KEY = "cde-theme";

// Runs in <head> before first paint. On "/" it pins the homepage to the paper
// canvas and leaves stored blog theme preferences untouched.
export const themeScript = `try{var d=document.documentElement;if(location.pathname==="/"){d.setAttribute("data-home","");}else{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);}}catch(e){}`;

export function applyStoredTheme(): void {
  const html = document.documentElement;
  html.removeAttribute("data-theme");
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "light" || t === "dark") {
      html.setAttribute("data-theme", t);
    }
  } catch {
    // Ignore storage access errors (e.g. privacy mode).
  }
}
