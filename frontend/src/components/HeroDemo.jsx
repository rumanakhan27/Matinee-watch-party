// A small animated picture of a room. It is only decoration, nothing here is connected to the server.
export default function HeroDemo() {
  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-bar">
        <span className="demo-code">K7P2QX</span>
        <span className="demo-faces">
          <i style={{ background: "#d9714f" }}>A</i>
          <i style={{ background: "#3f8f8a" }}>D</i>
          <i style={{ background: "#8467c9" }}>M</i>
          <i style={{ background: "#c2a23a" }}>S</i>
        </span>
      </div>

      <div className="demo-screen">
        <div className="demo-scene" />
        <span className="demo-react r1">🔥</span>
        <span className="demo-react r2">❤️</span>
        <span className="demo-react r3">👏</span>
        <span className="demo-react r4">😂</span>
        <div className="demo-track">
          <span className="demo-fill" />
          <span className="demo-head" />
        </div>
      </div>

      <ul className="demo-list">
        <li>
          <i style={{ background: "#d9714f" }}>A</i>
          <span>Aisha</span>
          <b className="badge host">host</b>
        </li>
        <li>
          <i style={{ background: "#3f8f8a" }}>D</i>
          <span>Dev</span>
          <b className="badge moderator">moderator</b>
        </li>
        <li>
          <i style={{ background: "#8467c9" }}>M</i>
          <span>Mira asked to jump to 12:40</span>
          <b className="demo-approve">Approve</b>
        </li>
      </ul>
    </div>
  );
}