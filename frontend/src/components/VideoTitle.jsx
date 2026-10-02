import { useEffect, useState } from "react";
import { fetchTitle } from "../youtube";

// Shows a video's title. While it loads (or if it cannot be found) it shows the video ID instead.
export default function VideoTitle({ videoId }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchTitle(videoId).then((t) => {
      if (!cancelled) setTitle(t);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return <>{title || videoId}</>;
}