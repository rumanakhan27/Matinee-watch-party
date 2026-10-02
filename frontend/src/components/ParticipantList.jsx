import RoleBadge from "./RoleBadge";

const ASSIGNABLE_ROLES = ["moderator", "participant", "viewer"];

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

// Gives every name its own colour, so avatars look different
function colorFor(name) {
  let hue = 0;
  for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hue} 55% 42%)`;
}

export default function ParticipantList({ room }) {
  const { participants, myId, myRole, actions } = room;
  const iAmHost = myRole === "host";

  return (
    <div className="card">
      <ul className="people">
        {participants.map((p) => {
          const isMe = p.userId === myId;

          return (
            <li key={p.userId}>
              <span className="avatar" style={{ background: colorFor(p.username) }}>
                {initials(p.username)}
              </span>

              <div className="who">
                <span className="name">
                  {p.username}
                  {isMe && " (you)"}
                </span>
                <RoleBadge role={p.role} />
              </div>

              {/* Only the host sees these controls, and never on their own row */}
              {iAmHost && !isMe && (
                <div className="host-tools">
                  <select
                    value={p.role}
                    onChange={(e) => actions.assignRole(p.userId, e.target.value)}
                    title="Change role"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    title="Make host"
                    onClick={() => {
                      if (window.confirm(`Make ${p.username} the host? You will become a moderator.`)) {
                        actions.transferHost(p.userId);
                      }
                    }}
                  >
                    👑
                  </button>
                  <button
                    title="Remove from room"
                    onClick={() => {
                      if (window.confirm(`Remove ${p.username} from the room?`)) {
                        actions.removeParticipant(p.userId);
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}