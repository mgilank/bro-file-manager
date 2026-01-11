import type { FormEvent } from "react";

type LoginFormProps = {
  loginUsername: string;
  password: string;
  error: string | null;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function LoginForm({
  loginUsername,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  return (
    <form className="card login" onSubmit={onSubmit}>
      <h2>Protected Workspace</h2>
      <p>Enter your username (if required) and passphrase to continue.</p>
      <div className="field">
        <input
          type="text"
          value={loginUsername}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="Username (optional for single-user)"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Access key"
          autoComplete="current-password"
          autoFocus
        />
        <button type="submit">Unlock</button>
      </div>
      <p className="hint">Legacy admin mode uses username "admin" (or leave blank).</p>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
