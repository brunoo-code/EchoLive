import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";

function getRoute() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9_-]{3,16})$/);
  return match ? { name: "room", roomCode: match[1].toUpperCase() } : { name: "home" };
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigateToHome() {
    window.history.pushState({}, "", "/");
    setRoute({ name: "home" });
  }

  function navigateToRoom(roomCode) {
    const code = roomCode.toUpperCase();
    window.history.pushState({}, "", `/room/${code}`);
    setRoute({ name: "room", roomCode: code });
  }

  if (route.name === "room") {
    return <RoomPage roomCode={route.roomCode} onBack={navigateToHome} />;
  }

  return <HomePage onRoomCreated={navigateToRoom} />;
}
