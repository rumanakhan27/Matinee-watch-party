import { useState } from "react";

export default function AuthForm({ auth }) {
  const [mode, setMode] = useState("login");   // login | register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = username.trim() !== "" && password !== "" && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await auth.signIn(mode, username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="start" id="start" onSubmit={submit}>
      <div className="seg" role="tablist" aria-label="Log in or register">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>
          Log in
        </button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>
          Create account
        </button>
      </div>

      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} placeholder="e.g. alex_22" autoComplete="username" />
      </label>

      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </label>

      <button className="primary big" disabled={!canSubmit}>
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="start-note">
        {error || (busy ? "The server may need a few seconds to wake up." : "Log in to start or join a room.")}
      </p>
    </form>
  );
}