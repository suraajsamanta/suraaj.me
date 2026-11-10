"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BeerioRoomClient } from "./client";
export { BeerioRoomClient, getRelayUrl } from "./client";
export type { RoomInput, RoomPlayer, RoomSnapshot, RoomRole, RoomStatus } from "./types";

/** One hook per page. Keep the host mounted throughout the lobby, countdown, and race. */
export function useBeerioRoom({ autoResume = true }: { autoResume?: boolean } = {}) {
  const [client] = useState(() => new BeerioRoomClient());
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot);
  useEffect(() => {
    if (autoResume) {
      const linkedRoom = new URLSearchParams(window.location.search).get("room") ?? undefined;
      client.restoreSession(linkedRoom);
    }
    const onVisibility = () => client.setInputSuppressed(document.hidden);
    const onBlur = () => client.setInputSuppressed(true);
    const onFocus = () => client.setInputSuppressed(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    onVisibility();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      client.destroy();
    };
  }, [client, autoResume]);
  return {
    ...snapshot,
    createRoom: client.createRoom,
    joinRoom: client.joinRoom,
    joinRandomRoom: client.joinRandomRoom,
    setInput: client.setInput,
    useItem: client.useItem,
    resetInput: client.resetInput,
    publishState: client.publishState,
    onState: client.onState,
    leaveRoom: client.leaveRoom,
    retryConnection: client.retryConnection,
    resumeRace: client.resumeRace,
    setLocked: client.setLocked,
    setAppearance: client.setAppearance,
    setReady: client.setReady,
    beginCharacterSelection: client.beginCharacterSelection,
    chooseCharacter: client.chooseCharacter,
    skipOfflineDrivers: client.skipOfflineDrivers,
  };
}
