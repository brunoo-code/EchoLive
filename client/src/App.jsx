import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";
import SocialPage from "./pages/SocialPage.jsx";
import DirectMessagePage from "./pages/DirectMessagePage.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { SocialProvider } from "./social/SocialContext.jsx";

function getRoute() {
  const pathname = window.location.pathname;
  const roomMatch = pathname.match(/^\/room\/([A-Za-z0-9]{3,9})$/);
  if (roomMatch) return { name: "room", roomCode: roomMatch[1].toUpperCase() };
  const dmMatch = pathname.match(/^\/dm\/([0-9a-f-]{36})$/i);
  if (dmMatch) return { name: "dm", conversationId: dmMatch[1] };
  if (pathname === "/friends") return { name: "social" };
  return { name: "home" };
}

export default function App() {
  return <AuthProvider><SocialProvider><AppContent /></SocialProvider></AuthProvider>;
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

  function navigateToSocial() {
    window.history.pushState({}, "", "/friends");
    setRoute({ name: "social" });
  }

  function navigateToDm(conversationId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(conversationId || ""))) {
      navigateToSocial();
      return;
    }
    window.history.pushState({}, "", `/dm/${conversationId}`);
    setRoute({ name: "dm", conversationId });
  }

  if (route.name === "room") {
    return <RoomPage roomCode={route.roomCode} onBack={navigateToHome} onNavigateRoom={navigateToRoom} onNavigateSocial={navigateToSocial} />;
  }
  if (route.name === "social") return <SocialPage onNavigateHome={navigateToHome} onNavigateDm={navigateToDm} />;
  if (route.name === "dm") return <DirectMessagePage conversationId={route.conversationId} onNavigateHome={navigateToHome} onNavigateFriends={navigateToSocial} onNavigateDm={navigateToDm} />;

  return <HomePage onRoomCreated={navigateToRoom} onNavigateSocial={navigateToSocial} />;
}
