export async function getBcrypt() {
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default || bcryptModule;

  if (typeof bcrypt.hash !== "function" || typeof bcrypt.compare !== "function") {
    throw new Error("BCRYPTJS_INVALID_EXPORT");
  }

  return bcrypt;
}
