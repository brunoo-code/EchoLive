import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";

function getRoute() {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{3,9})$/);
  return match ? { name: "room", roomCode: match[1].toUpperCase() } : { name: "home" };
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}

function AppContent() {
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
    const code = String(roomCode || "").toUpperCase();
    if (!/^[A-Z0-9]{3,9}$/.test(code)) {
      navigateToHome();
      return;
    }
    window.history.pushState({}, "", `/room/${code}`);
    setRoute({ name: "room", roomCode: code });
  }

  if (route.name === "room") {
    return <RoomPage roomCode={route.roomCode} onBack={navigateToHome} onNavigateRoom={navigateToRoom} />;
  }

  return <HomePage onRoomCreated={navigateToRoom} />;
}
