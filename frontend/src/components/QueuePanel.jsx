import { useState } from "react";
import { thumbnail } from "../youtube";
import VideoTitle from "./VideoTitle";

export default function QueuePanel({ room }) {
  const { queue, video, myId, myRole, actions } = room;
  const [text, setText] = useState("");

  // Host and moderators change the queue directly. Everyone else sends a request that
  // a host or moderator approves (the same approval flow as play, pause and seek).
  const canManage = myRole === "host" || myRole === "moderator";

  function addToQueue(videoId) {
    if (canManage) actions.queueAdd(videoId);
    else actions.requestChange("queue_add", { videoId });
  }

  function add(e) {
    e.preventDefault();   // stops the page from reloading
    const value = text.trim();
    if (!value) return;
    addToQueue(value);
    setText("");
  }

  return (
    <div className="card queue-panel">
      <form className="q-add" onSubmit={add}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canManage ? "Add a YouTube link to the queue…" : "Suggest a YouTube link for the queue…"}
        />
        <button className="primary" disabled={!text.trim()}>
          {canManage ? "Add" : "Suggest"}
        </button>
      </form>
      {!canManage && <p className="hint left">Your suggestions join the queue once the host or a moderator approves them.</p>}

      {video.videoId && (
        <section>
          <h3 className="q-heading">Now playing</h3>
          <div className="q-item now">
            <img className="q-thumb" src={thumbnail(video.videoId)} alt="" />
            <div className="q-info">
              <span className="q-title">
                <VideoTitle videoId={video.videoId} />
              </span>
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="q-heading">Up next ({queue.length})</h3>
        {queue.length === 0 ? (
          <p className="q-empty">The queue is empty. Add a YouTube link above.</p>
        ) : (
          <ul className="q-list">
            {queue.map((item) => (
              <li className="q-item" key={item.queueId}>
                <img className="q-thumb" src={thumbnail(item.videoId)} alt="" loading="lazy" />
                <div className="q-info">
                  <span className="q-title">
                    <VideoTitle videoId={item.videoId} />
                  </span>
                  <span className="q-meta">Added by {item.userId === myId ? "you" : item.username}</span>
                </div>
                <div className="q-actions">
                  {canManage && (
                    <button title="Play now" onClick={() => actions.queuePlay(item.queueId)}>
                      ▶
                    </button>
                  )}
                  {canManage && (
                    <button title="Remove from queue" onClick={() => actions.queueRemove(item.queueId)}>
                      ✕
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}