import BrandMark from "./BrandMark.jsx";

export default function UserAvatar({ user, size = 34, className = "", alt = "" }) {
  const displayName = user?.displayName || user?.nickname || user?.username || "Usuario";
  const guestVariant = Number.isInteger(user?.avatarVariant) ? user.avatarVariant : null;
  const classes = ["user-avatar", className].filter(Boolean).join(" ");

  if (user?.avatarUrl) {
    return <img className={classes} width={size} height={size} src={user.avatarUrl} alt={alt} />;
  }

  return (
    <span className={`${classes} user-avatar-eko`} style={{ width: size, height: size }} role="img" aria-label={alt || `Avatar de ${displayName}`}>
      <BrandMark size={size} variant={guestVariant} />
    </span>
  );
}
