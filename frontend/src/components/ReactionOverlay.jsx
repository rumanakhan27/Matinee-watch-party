// Emojis that float up over the video. The list comes from the server,
// and each emoji removes itself after 3 seconds (see useRoom.js).
export default function ReactionOverlay({ reactions }) {
  return (
    <div className="reaction-layer">
      {reactions.map((r) => (
        <div key={r.id} className="floating-emoji" style={{ left: `${10 + ((r.id * 37) % 75)}%` }}>
          <span className="emoji">{r.emoji}</span>
          <span className="reaction-name">{r.username}</span>
        </div>
      ))}
    </div>
  );
}