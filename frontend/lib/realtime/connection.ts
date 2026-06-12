// MyProperty — SignalR connection factory.
//
// Thin, side-effect-free builder for the notifications hub connection. Kept out
// of the React provider so the wiring (URL, auth token factory, reconnect
// policy, log level) can be unit-tested and reasoned about in isolation.

import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

// Server hub route — mirrors NotificationsHub.Path on the backend. The hub is
// mounted at the API ROOT, not under /api/v1, so callers join it to the bare
// API origin (NEXT_PUBLIC_API_BASE_URL), not the versioned REST base.
export const NOTIFICATIONS_HUB_PATH = "/hubs/notifications";

// Builds (does not start) the notifications hub connection.
//
// - accessTokenFactory: invoked on every (re)connect. SignalR appends the
//   returned JWT as ?access_token= on the WebSocket handshake (browsers can't
//   set an Authorization header on a WS upgrade); the backend lifts it into the
//   bearer pipeline for /hubs/* paths (see Program.cs JwtBearerEvents).
// - withAutomaticReconnect(): default backoff (0, 2s, 10s, 30s, then stop).
// - LogLevel.Warning: quiet by default; transport/handshake failures still log.
export function buildHubConnection(
  hubUrl: string,
  accessTokenFactory: () => string | Promise<string>,
): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(hubUrl, { accessTokenFactory })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}
