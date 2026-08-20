import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";
import SocialPage from "./pages/SocialPage.jsx";
import DirectMessagePage from "./pages/DirectMessagePage.jsx";
import ServerPage from "./pages/ServerPage.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { SocialProvider } from "./social/SocialContext.jsx";
import { ServerProvider } from "./servers/ServerContext.jsx";

const BUILD_ID = import.meta.env.VITE_BUILD_ID || "8.0.3";

function getRoute() {
  const pathname = window.location.pathname;
  const roomMatch = pathname.match(/^\/room\/([A-Za-z0-9]{3,9})$/);
  if (roomMatch) return { name: "room", roomCode: roomMatch[1].toUpperCase() };
  const dmMatch = pathname.match(/^\/dm\/([0-9a-f-]{36})$/i);
  if (dmMatch) return { name: "dm", conversationId: dmMatch[1] };
  const serverMatch = pathname.match(/^\/server\/([0-9a-f-]{36})$/i);
  if (serverMatch) return { name: "server", serverId: serverMatch[1] };
  if (pathname === "/servers") return { name: "servers" };
  if (pathname === "/friends") return { name: "social" };
  return { name: "home" };
}

export default function App() {
  return <AuthProvider><ServerProvider><SocialProvider><AppContent /></SocialProvider></ServerProvider></AuthProvider>;
}

function AppContent() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    document.documentElement.dataset.echoliveBuild = BUILD_ID;
    if (import.meta.env.DEV) {
      console.debug("[ECHOLIVE:build]", { buildId: BUILD_ID, path: window.location.pathname });
    }
    return () => { delete document.documentElement.dataset.echoliveBuild; };
  }, []);

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

  function navigateToServers() {
    window.history.pushState({}, "", "/servers");
    setRoute({ name: "servers" });
  }

  function navigateToServer(serverId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(serverId || ""))) {
      navigateToServers();
      return;
    }
    window.history.pushState({}, "", `/server/${serverId}`);
    setRoute({ name: "server", serverId });
  }

  function navigateToDm(conversationId, initialConversation = null) {
    if (!/^[0-9a-f-]{36}$/i.test(String(conversationId || ""))) {
      navigateToSocial();
      return;
    }
    window.history.pushState({}, "", `/dm/${conversationId}`);
    setRoute({ name: "dm", conversationId, initialConversation });
  }

  if (route.name === "room") {
    return <RoomPage roomCode={route.roomCode} onBack={navigateToHome} onNavigateRoom={navigateToRoom} onNavigateSocial={navigateToSocial} onNavigateDm={navigateToDm} onNavigateServer={navigateToServer} />;
  }
  if (route.name === "server" || route.name === "servers") return <ServerPage serverId={route.serverId || ""} onNavigateHome={navigateToHome} onNavigateSocial={navigateToSocial} onNavigateServer={navigateToServer} />;
  if (route.name === "social") return <SocialPage onNavigateHome={navigateToHome} onNavigateDm={navigateToDm} />;
  if (route.name === "dm") return <DirectMessagePage conversationId={route.conversationId} initialConversation={route.initialConversation} onNavigateHome={navigateToHome} onNavigateFriends={navigateToSocial} onNavigateDm={navigateToDm} />;

  return <HomePage onRoomCreated={navigateToRoom} onNavigateSocial={navigateToSocial} onNavigateServers={navigateToServers} />;
}
