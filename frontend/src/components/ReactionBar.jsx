import { useRef, useState } from "react";

const QUICK = ["👍", "❤️", "😂", "😮", "👏", "🔥"];

const MORE = [
  "😀", "😁", "🥹", "😍", "🤩", "😎", "🤯", "😭",
  "😱", "🥳", "🤔", "😴", "🙄", "😅", "🤣", "😬",
  "👀", "🙌", "🙏", "💪", "👌", "🤝", "💯", "✨",
  "🎉", "🍿", "🎬", "🎶", "💀", "😈", "🤡", "🫡",
];

export default function ReactionBar({ room }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const cooling = useRef(false);

  function send(emoji) {
    // Ignore very fast double clicks, the server has a short cooldown too
    if (cooling.current) return;
    cooling.current = true;
    setTimeout(() => {
      cooling.current = false;
    }, 350);
    room.actions.react(emoji);
  }

  function sendCustom() {
    const value = custom.trim();
    if (!value) return;
    send(value);
    setCustom("");
  }

  return (
    <div className="reactions">
      {QUICK.map((emoji) => (
        <button key={emoji} onClick={() => send(emoji)}>
          {emoji}
        </button>
      ))}

      <div className="reaction-more">
        <button onClick={() => setOpen((o) => !o)} title="More emojis">
          ➕
        </button>

        {open && (
          <div className="emoji-pop">
            {MORE.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  send(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}

            <div className="emoji-custom">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendCustom();
                }}
                maxLength={16}
                placeholder="Or type any emoji"
              />
              <button onClick={sendCustom}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}