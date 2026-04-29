import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/theme.css.ts";
import "./index.css";
import { AppProviders } from "./app/AppProviders";
import { initializeThemeClass } from "./shared/theme/theme-store";
import { installVitePreloadRecovery } from "./shared/vite/preloadRecovery";

initializeThemeClass();
installVitePreloadRecovery();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
