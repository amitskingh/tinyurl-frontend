import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  connectSocket,
  disconnectSocket,
  getSocketStatus,
  joinRoom,
  leaveRoom,
  subscribeToClickUpdates,
  subscribeToConnectionStatus,
  type SocketConnectionStatus,
} from "../services/socketService";
import type { ClickUpdatePayload } from "../types/analytics";

interface UseRealtimeAnalyticsResult {
  clickUpdate: ClickUpdatePayload | null;
  totalClicks: number | null;
  status: SocketConnectionStatus;
  isConnected: boolean;
  error: string | null;
}

interface RoomClickUpdate {
  room: string;
  payload: ClickUpdatePayload;
}

const idleStatus: SocketConnectionStatus = {
  state: "idle",
  connected: false,
  reconnectAttempt: 0,
  error: null,
};

function normalizeAliasId(aliasId: string | number | null | undefined) {
  if (typeof aliasId === "number") {
    return Number.isFinite(aliasId) ? String(aliasId) : null;
  }

  const trimmed = aliasId?.trim();
  return trimmed ? trimmed : null;
}

export function useRealtimeAnalytics(
  aliasId: string | number | null | undefined
): UseRealtimeAnalyticsResult {
  const { token } = useAuth();
  const [lastUpdate, setLastUpdate] = useState<RoomClickUpdate | null>(null);
  const [status, setStatus] = useState<SocketConnectionStatus>(() =>
    getSocketStatus()
  );

  const room = useMemo(() => normalizeAliasId(aliasId), [aliasId]);

  useEffect(() => {
    if (!token || !room) {
      return;
    }

    connectSocket(token);
    joinRoom(room);

    const unsubscribeUpdates = subscribeToClickUpdates((payload) => {
      if (String(payload.aliasId) === room) {
        setLastUpdate({ room, payload });
      }
    });

    const unsubscribeStatus = subscribeToConnectionStatus(setStatus);

    return () => {
      unsubscribeUpdates();
      unsubscribeStatus();
      leaveRoom(room);
      disconnectSocket();
    };
  }, [room, token]);

  const activeStatus = token && room ? status : idleStatus;
  const clickUpdate = lastUpdate?.room === room ? lastUpdate.payload : null;

  return {
    clickUpdate,
    totalClicks: clickUpdate?.totalClicks ?? null,
    status: activeStatus,
    isConnected: activeStatus.connected,
    error: activeStatus.error,
  };
}
