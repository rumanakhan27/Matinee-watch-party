import { useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import ParticipantList from "./ParticipantList";
import QueuePanel from "./QueuePanel";

const TABS = [
  { id: "chat", label: "Live chat" },
  { id: "members", label: "Members" },
  { id: "queue", label: "Queue" },
];

// One box on the right with three tabs: Live chat, Members and Queue.
export default function SidebarTabs({ room }) {
  const [tab, setTab] = useState("chat");
  const [seenId, setSeenId] = useState(null);   // the last chat message I have looked at

  const lastId = room.chat.length > 0 ? room.chat[room.chat.length - 1].messageId : null;

  // While the chat tab is open, everything counts as read
  useEffect(() => {
    if (tab === "chat") setSeenId(lastId);
  }, [tab, lastId]);

  const unread = tab !== "chat" && lastId !== seenId;
  const counts = { members: room.participants.length, queue: room.queue.length };

  return (
    <div className="side-tabs">
      <div className="tab-bar" role="tablist" aria-label="Room sidebar">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "chat" && unread && <span className="dot" role="status" aria-label="New messages" />}
            {counts[t.id] > 0 && <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "chat" && <ChatPanel room={room} />}
        {tab === "members" && <ParticipantList room={room} />}
        {tab === "queue" && <QueuePanel room={room} />}
      </div>
    </div>
  );
}