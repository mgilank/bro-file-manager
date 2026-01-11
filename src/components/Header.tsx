import { BRAND_EYEBROW, BRAND_SUBTITLE, BRAND_TITLE, THEMES } from "../constants";
import type { AuthState, Theme, UserRole } from "../types";

type HeaderProps = {
  auth: AuthState;
  username: string;
  userRole: UserRole;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onLogout: () => void;
};

export function Header({
  auth,
  username,
  userRole,
  theme,
  onThemeChange,
  onLogout,
}: HeaderProps) {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">{BRAND_EYEBROW}</p>
        <h1>{BRAND_TITLE}</h1>
        <p className="subtitle">{BRAND_SUBTITLE}</p>
        {auth === "authed" ? (
          <p className="meta">
            Signed in as {username || "unknown"} ({userRole})
          </p>
        ) : null}
      </div>
      <div className="header-actions">
        <label className="theme-switcher">
          <span>Theme</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value as Theme)}>
            {THEMES.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase()}
                {option.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {auth === "authed" ? (
          <button className="ghost" onClick={onLogout}>
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}
