import { useAuth } from "./useAuth";
import { useRoom } from "./useRoom";
import Landing from "./components/Landing";
import RoomView from "./components/RoomView";
import Toasts from "./components/Toasts";

export default function App() {
  const auth = useAuth();
  const room = useRoom(auth.token, auth.signOut);

  return (
    <>
      {room.roomId ? <RoomView room={room} /> : <Landing room={room} auth={auth} />}
      <Toasts toasts={room.toasts} />
    </>
  );
}