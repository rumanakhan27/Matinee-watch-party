import { useState } from "react";
import AuthForm from "./AuthForm";

// If someone opens an invite link like /?room=K7P2QX, we start on the "join" tab with the code filled in
const linkCode = new URLSearchParams(window.location.search).get("room") || "";

export default function StartForm({ room, auth }) {
  const [mode, setMode] = useState(linkCode ? "join" : "create");
  const [code, setCode] = useState(linkCode.toUpperCase().slice(0, 6));

  // Not logged in yet: show the login form instead
  if (!auth.token) return <AuthForm auth={auth} />;

  const connecting = room.status === "connecting";
  const canSubmit = !connecting && (mode === "create" || code.length === 6);

  function submit(e) {
    e.preventDefault();   // stops the page from reloading
    if (!canSubmit) return;
    if (mode === "create") room.createRoom();
    else room.joinRoom(code);
  }

  let note = "Ask the host for the 6-character code or the invite link.";
  if (mode === "create") note = "You will be the host, and you get a code to share.";
  if (connecting) note = "Connecting. The server may need a few seconds to wake up.";

  return (
    <form className="start" id="start" onSubmit={submit}>
      <p className="start-note">
        Logged in as <strong>{auth.username}</strong>{" "}
        <button type="button" onClick={auth.signOut}>Log out</button>
      </p>

      <div className="seg" role="tablist" aria-label="Start or join">
        <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "on" : ""} onClick={() => setMode("create")}>
          Start a room
        </button>
        <button type="button" role="tab" aria-selected={mode === "join"} className={mode === "join" ? "on" : ""} onClick={() => setMode("join")}>
          Join with a code
        </button>
      </div>

      {mode === "join" && (
        <label>
          Room code
          <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="K7P2QX" />
        </label>
      )}

      <button className="primary big" disabled={!canSubmit}>
        {mode === "create" ? "Create room" : "Join room"}
      </button>

      <p className="start-note">{note}</p>
    </form>
  );
}