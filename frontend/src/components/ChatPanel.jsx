import { useEffect, useRef, useState } from "react";
import RoleBadge from "./RoleBadge";

function clock(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({ room }) {
  const { chat, myId, actions } = room;
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // Whenever a new message arrives, scroll the list to the bottom
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat.length]);

  function send(e) {
    e.preventDefault();   // stops the page from reloading
    const value = text.trim();
    if (!value) return;
    actions.chat(value);
    setText("");
  }

  return (
    <div className="card chat">
      <div className="chat-list" ref={listRef}>
        {chat.length === 0 && <p className="chat-empty">No messages yet. Say hi! 👋</p>}

        {chat.map((m) => (
          <div key={m.messageId} className={`chat-msg${m.userId === myId ? " mine" : ""}`}>
            <div className="chat-meta">
              <strong>{m.userId === myId ? "You" : m.username}</strong>
              {(m.role === "host" || m.role === "moderator") && <RoleBadge role={m.role} />}
              <span>{clock(m.sentAt)}</span>
            </div>
            <div className="chat-text">{m.text}</div>
          </div>
        ))}
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Type a message…"
        />
        <button className="primary" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}