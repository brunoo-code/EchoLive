import { useEffect, useState } from "react";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";
import SocialPage from "./pages/SocialPage.jsx";
import DirectMessagePage from "./pages/DirectMessagePage.jsx";
import ServerPage from "./pages/ServerPage.jsx";
import ServerInvitePage from "./pages/ServerInvitePage.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { SocialProvider } from "./social/SocialContext.jsx";
import { ServerProvider } from "./servers/ServerContext.jsx";
import { useSocial } from "./social/SocialContext.jsx";
import { useServers } from "./servers/ServerContext.jsx";
import QuickSwitcher from "./components/QuickSwitcher.jsx";

const BUILD_ID = import.meta.env.VITE_BUILD_ID || "8.0.3";

function getRoute() {
  const pathname = window.location.pathname;
  const roomMatch = pathname.match(/^\/room\/([A-Za-z0-9]{3,9})$/);
  if (roomMatch) return { name: "room", roomCode: roomMatch[1].toUpperCase() };
  const dmMatch = pathname.match(/^\/dm\/([0-9a-f-]{36})$/i);
  if (dmMatch) return { name: "dm", conversationId: dmMatch[1] };
  const serverMatch = pathname.match(/^\/server\/([0-9a-f-]{36})$/i);
  if (serverMatch) return { name: "server", serverId: serverMatch[1] };
  const inviteMatch = pathname.match(/^\/invite\/([A-Z0-9]{4,16})$/i);
  if (inviteMatch) return { name: "invite", code: inviteMatch[1].toUpperCase() };
  if (pathname === "/servers") return { name: "servers" };
  if (pathname === "/friends") return { name: "social" };
  return { name: "home" };
}

export default function App() {
  return <AuthProvider><ServerProvider><SocialProvider><AppContent /></SocialProvider></ServerProvider></AuthProvider>;
}

function AppContent() {
  const [route, setRoute] = useState(getRoute);
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
  const { servers } = useServers();
  const { conversations, friends } = useSocial();

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

  useEffect(() => {
    function handleQuickSwitcherShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsQuickSwitcherOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleQuickSwitcherShortcut);
    return () => window.removeEventListener("keydown", handleQuickSwitcherShortcut);
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

  let content;
  if (route.name === "room") {
    content = <RoomPage roomCode={route.roomCode} onBack={navigateToHome} onNavigateRoom={navigateToRoom} onNavigateSocial={navigateToSocial} onNavigateDm={navigateToDm} onNavigateServer={navigateToServer} />;
  } else if (route.name === "server" || route.name === "servers") {
    content = <ServerPage serverId={route.serverId || ""} onNavigateHome={navigateToHome} onNavigateSocial={navigateToSocial} onNavigateServer={navigateToServer} />;
  } else if (route.name === "invite") {
    content = <ServerInvitePage code={route.code} onNavigateHome={navigateToHome} onNavigateServer={navigateToServer} />;
  } else if (route.name === "social") {
    content = <SocialPage onNavigateHome={navigateToHome} onNavigateDm={navigateToDm} />;
  } else if (route.name === "dm") {
    content = <DirectMessagePage conversationId={route.conversationId} initialConversation={route.initialConversation} onNavigateHome={navigateToHome} onNavigateFriends={navigateToSocial} onNavigateDm={navigateToDm} />;
  } else {
    content = <HomePage onRoomCreated={navigateToRoom} onNavigateSocial={navigateToSocial} onNavigateServers={navigateToServers} />;
  }

  return <>
    {content}
    <QuickSwitcher open={isQuickSwitcherOpen} onClose={() => setIsQuickSwitcherOpen(false)} onNavigateRoom={navigateToRoom} onNavigateSocial={navigateToSocial} onNavigateServers={navigateToServers} onNavigateServer={navigateToServer} onNavigateDm={navigateToDm} servers={servers} friends={friends} conversations={conversations} />
  </>;
}
