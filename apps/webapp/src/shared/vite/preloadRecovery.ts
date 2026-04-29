const PRELOAD_RETRY_STORAGE_KEY = "webapp:vite-preload-retry";
const PRELOAD_RETRY_WINDOW_MS = 60_000;

type PreloadRetryState = {
  pathname: string;
  timestamp: number;
};

type VitePreloadErrorEvent = Event & {
  payload?: unknown;
};

function getCurrentLocationKey(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function readPreloadRetryState(): PreloadRetryState | null {
  try {
    const rawState = window.sessionStorage.getItem(PRELOAD_RETRY_STORAGE_KEY);
    if (!rawState) {
      return null;
    }

    const parsedState = JSON.parse(rawState) as PreloadRetryState;
    if (
      typeof parsedState.pathname !== "string" ||
      typeof parsedState.timestamp !== "number"
    ) {
      return null;
    }

    return parsedState;
  } catch {
    return null;
  }
}

function writePreloadRetryState(state: PreloadRetryState) {
  try {
    window.sessionStorage.setItem(
      PRELOAD_RETRY_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage failures and fall back to the default Vite error.
  }
}

export function installVitePreloadRecovery() {
  window.addEventListener("vite:preloadError", (event) => {
    const preloadErrorEvent = event as VitePreloadErrorEvent;
    const currentLocationKey = getCurrentLocationKey();
    const retryState = readPreloadRetryState();

    if (
      retryState?.pathname === currentLocationKey &&
      Date.now() - retryState.timestamp < PRELOAD_RETRY_WINDOW_MS
    ) {
      return;
    }

    // One hard reload is usually enough after a new deployment invalidates an old chunk URL.
    preloadErrorEvent.preventDefault();
    writePreloadRetryState({
      pathname: currentLocationKey,
      timestamp: Date.now(),
    });
    window.location.reload();
  });
}
