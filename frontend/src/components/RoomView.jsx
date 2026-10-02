import "../social.css";
import ReactionBar from "./ReactionBar";
import RequestsPanel from "./RequestsPanel";
import RoleBadge from "./RoleBadge";
import SidebarTabs from "./SidebarTabs";
import VideoPlayer from "./VideoPlayer";
import VideoUrlBar from "./VideoUrlBar";
import Wordmark from "./Wordmark";

export default function RoomView({ room }) {
  const { roomId, myRole } = room;
  const inviteLink = `${window.location.origin}/?room=${roomId}`;

  async function copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      room.notify(message);
    } catch {
      room.notify("Could not copy. Please copy it by hand.", "error");
    }
  }

  return (
    <div className="room">
      <header className="topbar">
        <Wordmark />

        <div className="room-code">
          Room <strong>{roomId}</strong>
          <button onClick={() => copy(roomId, "Room code copied")}>Copy code</button>
          <button onClick={() => copy(inviteLink, "Invite link copied")}>Copy invite link</button>
        </div>

        <div className="me">
          <RoleBadge role={myRole} />
          <button className="danger" onClick={room.leaveRoom}>
            Leave
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="stage card">
          <VideoPlayer room={room} />
          <VideoUrlBar room={room} />
          <ReactionBar room={room} />
        </section>

        <aside className="sidebar">
          <RequestsPanel room={room} />
          <SidebarTabs room={room} />
        </aside>
      </div>
    </div>
  );
}