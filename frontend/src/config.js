// Where the backend's WebSocket lives.
// On your computer it is ws://localhost:8000/ws.
// When we deploy, we will set VITE_WS_URL to wss://your-backend.onrender.com/ws
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";