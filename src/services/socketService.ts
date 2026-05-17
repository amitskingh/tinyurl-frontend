import { io, type Socket } from "socket.io-client";
import type { ClickUpdatePayload } from "../types/analytics";

interface ServerToClientEvents {
  clickUpdate: (payload: ClickUpdatePayload) => void;
}

interface ClientToServerEvents {
  join: (aliasId: string | number) => void;
  leave: (aliasId: string | number) => void;
}

export type SocketConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface SocketConnectionStatus {
  state: SocketConnectionState;
  connected: boolean;
  reconnectAttempt: number;
  error: string | null;
}

type AnalyticsSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type ClickUpdateHandler = (payload: ClickUpdatePayload) => void;
type StatusHandler = (status: SocketConnectionStatus) => void;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:8080";

let socket: AnalyticsSocket | null = null;
let activeToken: string | null = null;
let connectionRefs = 0;
let cleanupSocketEvents: (() => void) | null = null;

const roomRefs = new Map<string, number>();
const statusHandlers = new Set<StatusHandler>();

let status: SocketConnectionStatus = {
  state: "idle",
  connected: false,
  reconnectAttempt: 0,
  error: null,
};

function normalizeRoom(aliasId: string | number): string {
  return String(aliasId);
}

function emitStatus(nextStatus: SocketConnectionStatus) {
  status = nextStatus;
  statusHandlers.forEach((handler) => handler(status));
}

function setStatus(
  state: SocketConnectionState,
  options: Partial<Omit<SocketConnectionStatus, "state">> = {}
) {
  emitStatus({
    state,
    connected: options.connected ?? state === "connected",
    reconnectAttempt: options.reconnectAttempt ?? status.reconnectAttempt,
    error: options.error ?? null,
  });
}

function rejoinRooms(activeSocket: AnalyticsSocket) {
  roomRefs.forEach((_count, room) => {
    activeSocket.emit("join", room);
  });
}

function bindSocketEvents(activeSocket: AnalyticsSocket) {
  const handleConnect = () => {
    setStatus("connected", {
      connected: true,
      reconnectAttempt: 0,
    });
    rejoinRooms(activeSocket);
  };

  const handleDisconnect = () => {
    setStatus("disconnected", {
      connected: false,
    });
  };

  const handleConnectError = (error: Error) => {
    setStatus("error", {
      connected: false,
      error: error.message,
    });
  };

  const handleReconnectAttempt = (attempt: number) => {
    setStatus("reconnecting", {
      connected: false,
      reconnectAttempt: attempt,
    });
  };

  activeSocket.on("connect", handleConnect);
  activeSocket.on("disconnect", handleDisconnect);
  activeSocket.on("connect_error", handleConnectError);
  activeSocket.io.on("reconnect_attempt", handleReconnectAttempt);

  cleanupSocketEvents = () => {
    activeSocket.off("connect", handleConnect);
    activeSocket.off("disconnect", handleDisconnect);
    activeSocket.off("connect_error", handleConnectError);
    activeSocket.io.off("reconnect_attempt", handleReconnectAttempt);
    cleanupSocketEvents = null;
  };
}

function createSocket(token: string): AnalyticsSocket {
  const nextSocket: AnalyticsSocket = io(SOCKET_URL, {
    auth: {
      token,
    },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });

  bindSocketEvents(nextSocket);
  return nextSocket;
}

export function connectSocket(token: string): AnalyticsSocket {
  connectionRefs += 1;

  if (socket && activeToken === token) {
    if (!socket.connected) {
      setStatus("connecting", {
        connected: false,
      });
      socket.connect();
    }
    return socket;
  }

  if (socket) {
    cleanupSocketEvents?.();
    socket.disconnect();
  }

  activeToken = token;
  socket = createSocket(token);
  setStatus("connecting", {
    connected: false,
    reconnectAttempt: 0,
  });
  socket.connect();

  return socket;
}

export function disconnectSocket() {
  connectionRefs = Math.max(0, connectionRefs - 1);
  if (connectionRefs > 0) return;

  roomRefs.clear();
  cleanupSocketEvents?.();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  activeToken = null;
  setStatus("idle", {
    connected: false,
    reconnectAttempt: 0,
  });
}

export function joinRoom(aliasId: string | number) {
  const room = normalizeRoom(aliasId);
  const nextCount = (roomRefs.get(room) ?? 0) + 1;
  roomRefs.set(room, nextCount);

  if (nextCount === 1 && socket?.connected) {
    socket.emit("join", room);
  }
}

export function leaveRoom(aliasId: string | number) {
  const room = normalizeRoom(aliasId);
  const currentCount = roomRefs.get(room) ?? 0;
  if (currentCount <= 1) {
    roomRefs.delete(room);
    if (socket?.connected) {
      socket.emit("leave", room);
    }
    return;
  }

  roomRefs.set(room, currentCount - 1);
}

export function subscribeToClickUpdates(
  callback: ClickUpdateHandler
): () => void {
  socket?.on("clickUpdate", callback);

  return () => {
    socket?.off("clickUpdate", callback);
  };
}

export function getSocketStatus(): SocketConnectionStatus {
  return status;
}

export function subscribeToConnectionStatus(callback: StatusHandler): () => void {
  statusHandlers.add(callback);
  callback(status);

  return () => {
    statusHandlers.delete(callback);
  };
}
