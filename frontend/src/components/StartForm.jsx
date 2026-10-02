import { useState } from "react";

// If someone opens an invite link like /?room=K7P2QX, we start on the "join" tab with the code filled in
const linkCode = new URLSearchParams(window.location.search).get("room") || "";

export default function StartForm({ room }) {
  const [mode, setMode] = useState(linkCode ? "join" : "create");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState(linkCode.toUpperCase().slice(0, 6));

  const name = username.trim();
  const connecting = room.status === "connecting";
  const canSubmit = name !== "" && !connecting && (mode === "create" || code.length === 6);

  function submit(e) {
    e.preventDefault();   // stops the page from reloading
    if (!canSubmit) return;
    if (mode === "create") room.createRoom(name);
    else room.joinRoom(code, name);
  }

  let note = "Ask the host for the 6-character code or the invite link.";
  if (mode === "create") note = "You will be the host, and you get a code to share.";
  if (connecting) note = "Connecting. The server may need a few seconds to wake up.";

  return (
    <form className="start" id="start" onSubmit={submit}>
      <div className="seg" role="tablist" aria-label="Start or join">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          className={mode === "create" ? "on" : ""}
          onClick={() => setMode("create")}
        >
          Start a room
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "join"}
          className={mode === "join" ? "on" : ""}
          onClick={() => setMode("join")}
        >
          Join with a code
        </button>
      </div>

      <label>
        Your name
        <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} placeholder="e.g. Alex" />
      </label>

      {mode === "join" && (
        <label>
          Room code
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="K7P2QX"
          />
        </label>
      )}

      <button className="primary big" disabled={!canSubmit}>
        {mode === "create" ? "Create room" : "Join room"}
      </button>

      <p className="start-note">{note}</p>
    </form>
  );
}