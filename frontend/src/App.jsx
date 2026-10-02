import { useRoom } from "./useRoom";
import Landing from "./components/Landing";
import RoomView from "./components/RoomView";
import Toasts from "./components/Toasts";

export default function App() {
  const room = useRoom();

  return (
    <>
      {room.roomId ? <RoomView room={room} /> : <Landing room={room} />}
      <Toasts toasts={room.toasts} />
    </>
  );
}