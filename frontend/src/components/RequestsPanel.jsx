import { formatTime } from "../youtube";

// Turns a request from the server into a sentence
function describe(request) {
  switch (request.action) {
    case "play":
      return "play the video";
    case "pause":
      return "pause the video";
    case "seek":
      return `jump to ${formatTime(request.params.time)}`;
    case "change_video":
      return `change the video to ${request.params.videoId}`;
    case "queue_add":
      return `add ${request.params.videoId} to the queue`;
    default:
      return request.action;
  }
}

export default function RequestsPanel({ room }) {
  const { pendingRequests, myRole, myId, actions } = room;
  const canDecide = myRole === "host" || myRole === "moderator";

  if (pendingRequests.length === 0) return null;

  return (
    <div className="card">
      <h2>Requests ({pendingRequests.length})</h2>

      <ul className="requests">
        {pendingRequests.map((r) => {
          const mine = r.userId === myId;

          return (
            <li key={r.requestId}>
              <div>
                <strong>{mine ? "You" : r.username}</strong> {mine ? "asked to" : "wants to"} {describe(r)}
              </div>

              {canDecide ? (
                <div className="request-buttons">
                  <button className="primary" onClick={() => actions.approve(r.requestId)}>
                    Approve
                  </button>
                  <button onClick={() => actions.reject(r.requestId)}>Reject</button>
                </div>
              ) : (
                <span className="hint left">Waiting for approval…</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}