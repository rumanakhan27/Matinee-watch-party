// ---------- loading YouTube's player code ----------
let apiPromise = null;

// Loads YouTube's IFrame API script once and gives back the YT object when it is ready
export function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);

  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previous) previous();
        resolve(window.YT);
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

// ---------- keeping the player in sync with the room ----------

// YouTube player states (these numbers come from YouTube)
export const ENDED = 0;
export const PLAYING = 1;
export const BUFFERING = 3;

// If someone is more than this many seconds away from the room, we move them
export const DRIFT_LIMIT = 1.5;

// Where the video should be right now, according to the room's shared state
export function expectedTime(shared) {
  if (shared.playState !== "playing") return shared.currentTime;
  return shared.currentTime + (Date.now() - shared.receivedAt) / 1000;
}

/**
 * Makes the YouTube player match the room's shared state.
 * It only does something when the player is different from the room,
 * so it is safe to call it again and again.
 * Returns the id of the video that is loaded afterwards.
 */
export function syncPlayer(player, shared, loadedId) {
  // No video chosen yet
  if (!shared.videoId) {
    if (loadedId) player.stopVideo();
    return null;
  }

  const target = expectedTime(shared);

  // 1) A different video? Load it at the right spot.
  if (loadedId !== shared.videoId) {
    const options = { videoId: shared.videoId, startSeconds: target };
    if (shared.playState === "playing") player.loadVideoById(options);
    else player.cueVideoById(options);
    return shared.videoId;
  }

  // 2) The video already finished? Leave it alone.
  const state = player.getPlayerState();
  const length = player.getDuration();
  if (state === ENDED && (!length || target >= length - 1)) return loadedId;

  // 3) Play or pause to match the room
  const running = state === PLAYING || state === BUFFERING;
  if (shared.playState === "playing" && !running) player.playVideo();
  if (shared.playState !== "playing" && running) player.pauseVideo();

  // 4) Same position? If we are too far off, jump to the right spot
  if (Math.abs(player.getCurrentTime() - target) > DRIFT_LIMIT) {
    player.seekTo(target, true);
  }

  return loadedId;
}

// ---------- small helpers ----------

// 83 -> "1:23", 3725 -> "1:02:05"
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// ---------- video titles and thumbnails ----------
// The server only stores video IDs. The browser looks up the title once (YouTube's public
// "oEmbed" service, no API key needed) and remembers it here.
const titles = new Map();

export function rememberTitle(videoId, title) {
  if (videoId && title) titles.set(videoId, title);
}

export async function fetchTitle(videoId) {
  if (titles.has(videoId)) return titles.get(videoId);
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`);
    if (!res.ok) return "";
    const data = await res.json();
    rememberTitle(videoId, data.title);
    return data.title || "";
  } catch {
    return "";   // offline or blocked: the screen falls back to showing the video ID
  }
}

export function thumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}