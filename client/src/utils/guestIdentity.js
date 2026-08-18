const GUEST_IDENTITY_KEY = "echolive.guestIdentity";
const GUEST_AVATAR_VARIANTS = 6;

let memoryIdentity = null;

export function getGuestIdentity() {
  if (memoryIdentity) {
    return memoryIdentity;
  }

  const saved = readStoredIdentity();
  if (saved) {
    memoryIdentity = saved;
    return saved;
  }

  const identity = {
    nickname: `User ${randomNumber(100, 9999)}`,
    avatarVariant: randomNumber(0, GUEST_AVATAR_VARIANTS - 1),
    isGuest: true
  };

  try {
    window.sessionStorage.setItem(GUEST_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Session storage may be disabled; the in-memory identity still lasts for this mount.
  }

  memoryIdentity = identity;
  return identity;
}

export function getGuestAvatarVariant(value) {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue)) {
    return 0;
  }
  return ((numericValue % GUEST_AVATAR_VARIANTS) + GUEST_AVATAR_VARIANTS) % GUEST_AVATAR_VARIANTS;
}

function readStoredIdentity() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(GUEST_IDENTITY_KEY) || "null");
    if (!saved || !/^User \d{3,4}$/.test(saved.nickname)) {
      return null;
    }
    return {
      nickname: saved.nickname,
      avatarVariant: getGuestAvatarVariant(saved.avatarVariant),
      isGuest: true
    };
  } catch {
    return null;
  }
}

function randomNumber(min, max) {
  const range = max - min + 1;
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return min + (values[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}
