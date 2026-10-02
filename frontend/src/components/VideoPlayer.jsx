import { useCallback, useEffect, useRef, useState } from "react";
import { BUFFERING, ENDED, PLAYING, formatTime, loadYouTubeApi, syncPlayer } from "../youtube";
import ReactionOverlay from "./ReactionOverlay";

const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

export default function VideoPlayer({ room }) {
  const { video, myRole, actions, notify } = room;

  // Host and moderators control the video. Everyone else can only send requests.
  const canControl = myRole === "host" || myRole === "moderator";
  const playing = video.playState === "playing";

  const wrapRef = useRef(null);        // the box we put into fullscreen
  const mountRef = useRef(null);       // where the YouTube player is created
  const playerRef = useRef(null);      // the YouTube player itself
  const readyRef = useRef(false);      // true when the player is ready to take commands
  const loadedIdRef = useRef(null);    // which video is loaded in the player
  const latestVideo = useRef(video);   // always the newest shared state
  const stuckTicks = useRef(0);        // how long the player failed to start playing
  const canControlRef = useRef(canControl);   // newest value, for the player callbacks below

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState(null);       // slider value while dragging, otherwise null
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);  // true when the browser blocked autoplay

  // Make the player match the room (see youtube.js)
  const apply = useCallback(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    loadedIdRef.current = syncPlayer(player, latestVideo.current, loadedIdRef.current);
  }, []);

  // 1) Create the YouTube player once, when this screen appears
  useEffect(() => {
    let cancelled = false;
    let player = null;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;

      const holder = document.createElement("div");
      mountRef.current.appendChild(holder);

      player = new YT.Player(holder, {
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,        // we draw our own controls, so nobody can bypass the roles
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            apply();
          },
          onStateChange: (event) => {
            // The video finished. Host and moderators tell the server, which plays the next queued video.
            // (Several browsers may report it. The server only accepts the first report.)
            const endedId = latestVideo.current.videoId;
            if (event.data === ENDED && canControlRef.current && endedId) actions.videoEnded(endedId);
            apply();
          },
          onError: () => notify("This video can't be played here (it may be private or not allow embedding)", "error"),
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      loadedIdRef.current = null;
      playerRef.current = null;
      if (player && player.destroy) player.destroy();
    };
  }, [apply, notify, actions]);

  // Keep the "can I control?" answer fresh for the player callbacks
  useEffect(() => {
    canControlRef.current = canControl;
  }, [canControl]);

  // 2) Whenever the room's video state changes, update the player
  useEffect(() => {
    latestVideo.current = video;
    apply();
  }, [video, apply]);

  // 3) Update the time display twice a second
  useEffect(() => {
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      setPosition(player.getCurrentTime() || 0);
      setDuration(player.getDuration() || 0);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // 4) Every 1.5 seconds: fix any drift, and notice if the browser blocked autoplay
  useEffect(() => {
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;
      apply();

      const shared = latestVideo.current;
      const state = player.getPlayerState();
      const shouldPlay = shared.playState === "playing" && Boolean(shared.videoId);
      const stuck = shouldPlay && state !== PLAYING && state !== BUFFERING && state !== ENDED;
      stuckTicks.current = stuck ? stuckTicks.current + 1 : 0;
      setBlocked(stuckTicks.current >= 2);
    }, 1500);
    return () => clearInterval(id);
  }, [apply]);

  // 5) Volume is only for me, it is not shared with the room
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    player.setVolume(volume);
    if (muted) player.mute();
    else player.unMute();
  }, [volume, muted]);

  // ---------- what the buttons do ----------
  function playerTime() {
    const player = playerRef.current;
    if (!player || !readyRef.current) return 0;
    return Math.round(player.getCurrentTime() * 100) / 100;
  }

  function togglePlay() {
    if (!video.videoId) return;
    if (canControl) {
      if (playing) actions.pause(playerTime());
      else actions.play(playerTime());
    } else {
      // Participants can only ask. No time is sent, the server uses the room's own position.
      actions.requestChange(playing ? "pause" : "play", {});
    }
  }

  function finishScrub() {
    if (scrub === null) return;   // the slider was clicked but not moved
    const seconds = scrub;
    setScrub(null);
    if (canControl) actions.seek(seconds);
    else actions.requestChange("seek", { time: seconds });
  }

  function enablePlayback() {
    // This click counts as the "user interaction" browsers want before playing video
    stuckTicks.current = 0;
    setBlocked(false);
    const player = playerRef.current;
    if (player && readyRef.current) {
      player.playVideo();
      apply();
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrapRef.current && wrapRef.current.requestFullscreen) wrapRef.current.requestFullscreen();
  }

  const sliderMax = Math.max(duration, 1);
  const sliderValue = scrub !== null ? scrub : Math.min(position, sliderMax);

  return (
    <div className="player-wrap" ref={wrapRef}>
      <div className="player-frame">
        <div className="yt-mount" ref={mountRef} />

        {/* An invisible layer on top of the video, so nobody can click YouTube's own buttons */}
        <div
          className={`player-shield${canControl && video.videoId ? " clickable" : ""}`}
          onClick={canControl ? togglePlay : undefined}
        />

        {/* Emoji reactions float up over the video */}
        <ReactionOverlay reactions={room.reactions} />

        {!video.videoId && (
          <div className="player-empty">
            {canControl
              ? "Paste a YouTube link below to get started."
              : "Waiting for the host to pick a video. You can suggest one below."}
          </div>
        )}

        {blocked && video.videoId && (
          <button className="player-start" onClick={enablePlayback}>
            ▶ Click to start playback
          </button>
        )}
      </div>

      <div className="controls">
        <button onClick={togglePlay} disabled={!video.videoId}>
          {canControl ? (playing ? "⏸" : "▶") : `✋ Request ${playing ? "pause" : "play"}`}
        </button>

        <span className="time">{formatTime(sliderValue)}</span>
        <input
          className="seek"
          type="range"
          min={0}
          max={sliderMax}
          step={1}
          value={sliderValue}
          disabled={!video.videoId}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={finishScrub}
          onKeyUp={(e) => NAV_KEYS.includes(e.key) && finishScrub()}
          title={canControl ? "Jump to a time" : "Request a jump to a time"}
        />
        <span className="time">{formatTime(duration)}</span>

        <button onClick={() => setMuted((m) => !m)} title="Mute (only for you)">
          {muted || volume === 0 ? "🔇" : "🔊"}
        </button>
        <input
          className="volume"
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title="Volume (only for you)"
        />
        <button onClick={toggleFullscreen} title="Fullscreen">
          ⛶
        </button>
      </div>

      {!canControl && (
        <p className="hint left">
          You are a {myRole}. Your play, pause and jump buttons send a request that the host or a moderator can approve.
        </p>
      )}
    </div>
  );
}