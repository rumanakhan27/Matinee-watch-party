import { useEffect, useState } from "react";
import "../landing.css";
import HeroDemo from "./HeroDemo";
import StartForm from "./StartForm";
import Wordmark from "./Wordmark";

const SECTIONS = ["home", "features", "how"];

// Remembers which section is on screen, so the menu can highlight it
function useActiveSection() {
  const [active, setActive] = useState("home");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return active;
}

const FEATURES = [
  {
    title: "Everyone stays in sync",
    text: "Play, pause, seek and video changes reach the whole room at once. Anyone who joins late lands on the right moment.",
  },
  {
    title: "Smart roles & permissions",
    text: "Hosts and moderators run the video. Every action is checked on the server, so hiding a button is never the only protection.",
  },
  {
    title: "Request-based controls",
    text: "Participants can request a pause, a jump or a new video. A host or moderator approves or rejects each request.",
  },
  {
    title: "Chat and floating reactions",
    text: "Talk in the sidebar, or send any emoji and watch it drift across the screen.",
  },
  {
    title: "Automatic host handover",
    text: "If the host leaves, a moderator takes over. If there is none, the person who has been there longest does.",
  },
];

const STEPS = [
  {
    title: "Open a room",
    text: "Type your name and start a room. You become the host and get a six-character code.",
  },
  {
    title: "Send the link",
    text: "Copy the invite link. Friends join in one click and start as participants.",
  },
  {
    title: "Press play",
    text: "Paste any YouTube link and every player follows yours. Promote a friend to moderator to share the controls.",
  },
];

export default function Landing({ room }) {
  const active = useActiveSection();
  const current = (id) => (active === id ? "true" : undefined);

  return (
    <div className="landing">
      <header className="nav">
        <div className="nav-inner">
          <Wordmark href="#home" />

          <nav aria-label="Main">
            <a href="#home" aria-current={current("home")}>
              Home
            </a>
            <a href="#features" aria-current={current("features")}>
              Features
            </a>
            <a href="#how" aria-current={current("how")}>
              How it works
            </a>
          </nav>

          <a className="nav-cta" href="#start">
            Start a room
          </a>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="beam" aria-hidden="true" />

          <div className="hero-inner">
            <div className="hero-copy">
              <h1>Watch together.</h1>
              <p className="lede">
                Create private rooms, invite your friends, and watch YouTube videos in perfect real-time
                synchronization.
              </p>
              <StartForm room={room} />
            </div>

            <HeroDemo />
          </div>
        </section>

        <section className="section" id="features">
          <div className="features-layout">
            <div className="section-head sticky">
              <h2>What you get</h2>
              <p>Built around one idea: the server is the single source of truth for the room.</p>
            </div>

            <ul className="feature-list">
              {FEATURES.map((f) => (
                <li className="feature" key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="how">
          <div className="section-head">
            <h2>How it works</h2>
            <p>From creating a room to sharing the same frame-- it only takes three steps. </p>
          </div>

          <ol className="strip">
            {STEPS.map((s, i) => (
              <li className="frame" key={s.title}>
                <span className="frame-number">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="footer">
        <Wordmark />
        <p>Built with React, FastAPI and WebSockets.</p>
      </footer>
    </div>
  );
}