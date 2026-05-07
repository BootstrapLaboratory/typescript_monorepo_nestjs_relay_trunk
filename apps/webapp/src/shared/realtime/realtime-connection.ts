import { useSyncExternalStore } from "react";
import { type GraphqlWsConnectionState } from "@omgjs/labkit-webapp-realtime";
import { relayRuntime } from "../relay/environment";

export {
  getRealtimeConnectionMessage,
  type GraphqlWsConnectionState,
  type GraphqlWsConnectionStatus,
} from "@omgjs/labkit-webapp-realtime";

export const realtimeConnection = relayRuntime.getRealtime();

export function subscribeToRealtimeConnectionState(
  listener: (state: GraphqlWsConnectionState) => void,
) {
  return relayRuntime.subscribeToRealtimeConnectionState(listener);
}

export function getRealtimeConnectionState(): GraphqlWsConnectionState {
  return relayRuntime.getRealtimeConnectionState();
}

export function useRealtimeConnectionState(): GraphqlWsConnectionState {
  return useSyncExternalStore(
    relayRuntime.subscribeToRealtimeConnectionState,
    relayRuntime.getRealtimeConnectionState,
    relayRuntime.getRealtimeConnectionState,
  );
}
