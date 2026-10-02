import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WS_URL } from "./config";

const EMPTY_VIDEO = { playState: "paused", currentTime: 0, videoId: null, receivedAt: 0 };

// Friendly text for the small pop-up messages (toasts)
const ACTION_TEXT = {
  play: "pressed play",
  pause: "paused the video",
  seek: "jumped to a new time",
  change_video: "changed the video",
  next_video: "started the next video",
};

/**
 * This hook is the "brain" of the frontend.
 * It opens the WebSocket, listens to every message from the server,
 * keeps the room's state, and gives the screens simple functions to call.
 */
export function useRoom(token, onAuthError) {
  // Refs hold values that should NOT cause a re-draw when they change
  const wsRef = useRef(null);      // the WebSocket connection
  const myIdRef = useRef(null);    // my user id (known after joining)
  const nextId = useRef(1);        // counter to give toasts/reactions unique ids

  // State holds values the screen shows. When they change, React re-draws.
  const [status, setStatus] = useState("idle");        // idle | connecting | open
  const [roomId, setRoomId] = useState(null);
  const [myId, setMyId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [chat, setChat] = useState([]);
  const [video, setVideo] = useState(EMPTY_VIDEO);
  const [reactions, setReactions] = useState([]);
  const [queue, setQueue] = useState([]);                       // videos waiting to play
  const [toasts, setToasts] = useState([]);

  // ---------- small helpers ----------
  const notify = useCallback((text, kind = "info") => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);

  const resetRoom = useCallback(() => {
    myIdRef.current = null;
    setStatus("idle");
    setRoomId(null);
    setMyId(null);
    setParticipants([]);
    setPendingRequests([]);
    setChat([]);
    setVideo(EMPTY_VIDEO);
    setReactions([]);
    setQueue([]);
  }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;   // set to null first, so our onclose knows we closed it on purpose
    if (ws) ws.close();
  }, []);

  // ---------- every message from the server comes here ----------
  const handleMessage = useCallback(
    (msg) => {
      switch (msg.type) {
        case "room_joined":
          myIdRef.current = msg.userId;
          setMyId(msg.userId);
          setRoomId(msg.roomId);
          setParticipants(msg.participants);
          setPendingRequests(msg.pendingRequests);
          setChat(msg.chatHistory);
          setQueue(msg.queue || []);
          break;

        case "sync_state":
          setVideo({
            playState: msg.playState,
            currentTime: msg.currentTime,
            videoId: msg.videoId,
            receivedAt: Date.now(),
          });
          if (msg.action && msg.by) notify(`${msg.by} ${ACTION_TEXT[msg.action] || ""}`);
          break;

        case "user_joined":
          setParticipants(msg.participants);
          if (msg.userId !== myIdRef.current) notify(`${msg.username} joined`);
          break;

        case "user_left":
          setParticipants(msg.participants);
          notify(`${msg.username} left`);
          break;

        case "role_assigned":
          setParticipants(msg.participants);
          if (msg.reason === "host_left") {
            notify(`${msg.username} is now the host`);
          } else if (msg.userId === myIdRef.current) {
            notify(`You are now a ${msg.role}`);
          } else {
            notify(`${msg.username} is now a ${msg.role}`);
          }
          break;

        case "host_transferred":
          setParticipants(msg.participants);
          notify(`${msg.newHostName} is now the host`);
          break;

        case "participant_removed":
          if (msg.userId === myIdRef.current) {
            closeSocket();
            resetRoom();
            notify("You were removed from the room by the host", "error");
          } else {
            setParticipants(msg.participants);
            notify(`${msg.username} was removed`);
          }
          break;

        case "change_requested":
          setPendingRequests(msg.pendingRequests);
          notify(`${msg.request.username} requested: ${msg.request.action.replace("_", " ")}`);
          break;

        case "request_resolved":
          setPendingRequests(msg.pendingRequests);
          if (msg.status !== "cancelled") {
            notify(`${msg.by} ${msg.status} ${msg.request.username}'s request`);
          }
          break;

        case "queue_updated":
          setQueue(msg.queue);
          if (msg.action === "added") notify(`${msg.by} added a video to the queue`);
          if (msg.action === "removed") notify(`${msg.by} removed a video from the queue`);
          break;

        case "chat_message":
          setChat((list) => [...list, msg].slice(-100));
          break;

        case "reaction": {
          const id = nextId.current++;
          setReactions((list) => [...list, { id, emoji: msg.emoji, username: msg.username }]);
          setTimeout(() => setReactions((list) => list.filter((r) => r.id !== id)), 3000);
          break;
        }

        case "error":
          notify(msg.message, "error");
          if (msg.code === "auth" && onAuthError) onAuthError();   // login expired: back to the login form
          // An error before we are inside a room (for example "Room not found")
          if (!myIdRef.current) {
            closeSocket();
            setStatus("idle");
          }
          break;

        default:
          break;
      }
    },
    [notify, closeSocket, resetRoom, onAuthError]
  );

  // ---------- connecting ----------
  const connect = useCallback(
    (firstMessage) => {
      closeSocket();
      resetRoom();
      setStatus("connecting");

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("open");
        ws.send(JSON.stringify(firstMessage));   // create_room or join_room
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch (err) {
          console.error("Bad message from server", err);
        }
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;   // we closed it on purpose, nothing to report
        wsRef.current = null;
        const wasInRoom = myIdRef.current !== null;
        resetRoom();
        notify(wasInRoom ? "Disconnected from the server" : "Could not connect to the server", "error");
      };
    },
    [closeSocket, resetRoom, handleMessage, notify]
  );

  // Close the connection if the whole app is closed
  useEffect(() => closeSocket, [closeSocket]);

  // ---------- things the screens can do ----------
  const send = useCallback(
    (message) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      } else {
        notify("Not connected to the server", "error");
      }
    },
    [notify]
  );

  const createRoom = useCallback(() => connect({ type: "create_room", token }), [connect, token]);
  const joinRoom = useCallback((code) => connect({ type: "join_room", roomId: code, token }), [connect, token]);
  const leaveRoom = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "leave_room", roomId }));   // polite goodbye, then we hang up
    }
    closeSocket();
    resetRoom();
  }, [roomId, closeSocket, resetRoom]);

  // One small function per server event from the PDF
  const actions = useMemo(
    () => ({
      play: (time) => send({ type: "play", time }),
      pause: (time) => send({ type: "pause", time }),
      seek: (time) => send({ type: "seek", time }),
      changeVideo: (videoId) => send({ type: "change_video", videoId }),
      requestChange: (action, fields) => send({ type: "request_change", action, ...fields }),
      approve: (requestId) => send({ type: "approve_request", requestId }),
      reject: (requestId) => send({ type: "reject_request", requestId }),
      assignRole: (userId, role) => send({ type: "assign_role", userId, role }),
      removeParticipant: (userId) => send({ type: "remove_participant", userId }),
      transferHost: (userId) => send({ type: "transfer_host", userId }),
      chat: (text) => send({ type: "chat", text }),
      react: (emoji) => send({ type: "react", emoji }),
      queueAdd: (videoId) => send({ type: "queue_add", videoId }),
      queueRemove: (queueId) => send({ type: "queue_remove", queueId }),
      queuePlay: (queueId) => send({ type: "queue_play", queueId }),
      videoEnded: (videoId) => send({ type: "video_ended", videoId }),
    }),
    [send]
  );

  // My role comes from the participants list, so it is always up to date
  const me = participants.find((p) => p.userId === myId);

  return {
    status,
    roomId,
    myId,
    myRole: me ? me.role : "participant",
    participants,
    pendingRequests,
    chat,
    video,
    reactions,
    queue,
    toasts,
    notify,
    createRoom,
    joinRoom,
    leaveRoom,
    actions,
  };
}