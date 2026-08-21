let presenceUpdater = null;

export function registerPresenceUpdater(updater) {
  presenceUpdater = typeof updater === "function" ? updater : null;
}

export function updatePresenceFromProfile(userId, status) {
  presenceUpdater?.(userId, status);
}
