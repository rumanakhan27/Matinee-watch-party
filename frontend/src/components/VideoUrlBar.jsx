import { useState } from "react";

export default function VideoUrlBar({ room }) {
  const [text, setText] = useState("");
  const canControl = room.myRole === "host" || room.myRole === "moderator";

  function submit() {
    const value = text.trim();
    if (!value) return;

    if (canControl) {
      room.actions.changeVideo(value);
    } else {
      // Participants can only suggest. A host or moderator has to approve it.
      room.actions.requestChange("change_video", { videoId: value });
    }
    setText("");
  }

  return (
    <div className="url-bar">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Paste a YouTube link…"
      />
      <button className="primary" onClick={submit} disabled={!text.trim()}>
        {canControl ? "Play this video" : "Suggest this video"}
      </button>
    </div>
  );
}