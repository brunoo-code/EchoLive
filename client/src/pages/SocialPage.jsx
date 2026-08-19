import { useEffect, useMemo, useRef, useState } from "react";
import AuthModal from "../components/AuthModal.jsx";
import BrandMark from "../components/BrandMark.jsx";
import Icon from "../components/Icon.jsx";
import SocialEmptyState from "../components/SocialEmptyState.jsx";
import SocialRail from "../components/SocialRail.jsx";
import SocialSidebar, { Avatar } from "../components/SocialSidebar.jsx";
import SocialUserProfileModal from "../components/SocialUserProfileModal.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useSocial } from "../social/SocialContext.jsx";

export default function SocialPage({ onNavigateHome, onNavigateDm }) {
  const { status, user } = useAuth();
  const [authModalMode, setAuthModalMode] = useState(null);
  if (status !== "authenticated") return <main className="page social-page social-page-gate"><SocialRail onHome={onNavigateHome} /><div className="social-guest-gate"><SocialEmptyState title="Quer continuar essa conversa depois?" copy="Crie uma conta para adicionar amigos e trocar mensagens no EchoLive." action="Criar conta" onAction={() => setAuthModalMode("register")} /><button type="button" className="text-button" onClick={onNavigateHome}>Agora nao</button></div><AuthModal open={Boolean(authModalMode)} initialMode="register" onClose={() => setAuthModalMode(null)} /></main>;
  return <AuthenticatedSocialPage user={user} onNavigateHome={onNavigateHome} onNavigateDm={onNavigateDm} />;
}

function AuthenticatedSocialPage({ user, onNavigateHome, onNavigateDm }) {
  const { friends, receivedRequests, sentRequests, onlineUserIds, conversations, acceptFriendRequest, deleteFriendRequest, removeFriend, sendFriendRequest, startConversation } = useSocial();
  const [activeTab, setActiveTab] = useState("friends");
  const [friendQuery, setFriendQuery] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const feedbackTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

  function clearFeedback() {
    window.clearTimeout(feedbackTimerRef.current);
    setFeedback(null);
  }

  function showFeedback(message, kind = "success") {
    window.clearTimeout(feedbackTimerRef.current);
    setFeedback({ message, kind });
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 4200);
  }

  function changeTab(nextTab) {
    clearFeedback();
    setActiveTab(nextTab);
  }

  const onlineFriends = useMemo(() => friends.filter((item) => onlineUserIds.has(item.user.id)), [friends, onlineUserIds]);
  const visibleFriends = activeTab === "online" ? onlineFriends : friends;

  async function handleAddFriend(event) {
    event.preventDefault();
    clearFeedback();
    setIsAdding(true);
    try {
      const result = await sendFriendRequest(addUsername);
      showFeedback(`Pedido enviado para @${result.relation.user.username}.`);
      setAddUsername("");
    } catch (requestError) {
      showFeedback(requestError.message, "error");
    } finally {
      setIsAdding(false);
    }
  }

  async function openDm(userId) {
    clearFeedback();
    try {
      const conversation = await startConversation(userId);
      onNavigateDm(conversation.id, conversation);
    } catch (requestError) {
      showFeedback(requestError.message, "error");
    }
  }

  async function confirmRemove(userId) {
    clearFeedback();
    try {
      await removeFriend(userId);
      setRemoveTarget(null);
      showFeedback("Amizade removida.", "neutral");
    } catch (requestError) {
      showFeedback(requestError.message, "error");
    }
  }

  async function handleAcceptRequest(requestId) {
    clearFeedback();
    try {
      await acceptFriendRequest(requestId);
      showFeedback("Pedido aceito.");
    } catch (requestError) {
      showFeedback(requestError.message, "error");
    }
  }

  async function handleDeleteRequest(requestId, received) {
    clearFeedback();
    try {
      await deleteFriendRequest(requestId);
      showFeedback(received ? "Pedido recusado." : "Pedido cancelado.", "neutral");
    } catch (requestError) {
      showFeedback(requestError.message, "error");
    }
  }

  const pendingCount = receivedRequests.length + sentRequests.length;
  return <main className="page social-page">
    <SocialRail onHome={onNavigateHome} />
    <SocialSidebar activeTab={activeTab} onTabChange={changeTab} conversations={conversations} onlineUserIds={onlineUserIds} user={user} onHome={onNavigateHome} onOpenConversation={onNavigateDm} onOpenProfile={setProfileTarget} />
    <section className="social-content">
      <header className="social-topbar"><div className="social-topbar-title"><Icon name="account" size={18} /><strong>Amigos</strong></div><nav className="social-tabs" aria-label="Visoes de Amigos">{[["friends", "Amigos"], ["online", "Online"], ["all", "Todos"], ["pending", "Pendentes"]].map(([id, label]) => <button type="button" key={id} className={activeTab === id ? "is-active" : ""} onClick={() => changeTab(id)}>{label}{id === "pending" && pendingCount > 0 && <b className="social-tab-badge">{pendingCount > 9 ? "9+" : pendingCount}</b>}</button>)}<button type="button" className={`social-tab-add ${activeTab === "add" ? "is-active" : ""}`} onClick={() => changeTab("add")}><Icon name="plus" size={14} />Adicionar amigo</button></nav><span className="social-topbar-note">Sua rede no EchoLive</span></header>
      {activeTab === "add" ? <AddFriendView addUsername={addUsername} setAddUsername={setAddUsername} onSubmit={handleAddFriend} isSubmitting={isAdding} /> : activeTab === "pending" ? <PendingView received={receivedRequests} sent={sentRequests} onAccept={handleAcceptRequest} onDelete={handleDeleteRequest} /> : <FriendsView friends={visibleFriends} allFriends={friends} onlineFriends={onlineFriends} onlineUserIds={onlineUserIds} activeTab={activeTab} search={friendQuery} onSearch={setFriendQuery} onMessage={openDm} onOpenProfile={setProfileTarget} removeTarget={removeTarget} setRemoveTarget={setRemoveTarget} onRemove={confirmRemove} onAdd={() => changeTab("add")} />}
    </section>
    {feedback && <div className="social-toast-stack" aria-live="polite"><div className={`social-toast is-${feedback.kind}`}><Icon name={feedback.kind === "error" ? "info" : feedback.kind === "neutral" ? "check" : "check"} size={15} /><span>{feedback.message}</span></div></div>}
    <aside className="social-online-panel"><h2>Online agora</h2>{onlineFriends.length ? onlineFriends.slice(0, 8).map((item) => <div className="social-online-row" key={item.user.id}><button type="button" className="social-online-identity" onClick={() => setProfileTarget(item.user)}><Avatar user={item.user} size={32} /><span><strong>{item.user.displayName || item.user.username}</strong><small>Online</small></span></button><button type="button" className="icon-button" title="Enviar mensagem" aria-label={`Enviar mensagem para ${item.user.displayName || item.user.username}`} onClick={() => openDm(item.user.id)}><Icon name="message" size={15} /></button><i className="online-dot" /></div>) : <SocialEmptyState title="Tudo tranquilo por aqui." copy="Nenhum amigo esta online agora." variant={7} />}</aside>
    {profileTarget && <SocialUserProfileModal userId={profileTarget.id} initialUser={profileTarget} onClose={() => setProfileTarget(null)} onMessage={(conversation) => { setProfileTarget(null); onNavigateDm(conversation.id, conversation); }} />}
  </main>;
}

function AddFriendView({ addUsername, setAddUsername, onSubmit, isSubmitting }) {
  return <div className="social-view social-add-view"><div className="social-add-layout"><div><div className="social-view-heading"><div><span className="section-label">CONEXOES</span><h1>Adicionar amigo</h1><p>Encontre alguem pelo @username.</p></div></div><form className="social-add-form" onSubmit={onSubmit}><label className="sr-only" htmlFor="social-username">Nome de usuario</label><span className="social-input-prefix">@</span><input id="social-username" value={addUsername} onChange={(event) => setAddUsername(event.target.value)} placeholder="nome_de_usuario" maxLength={25} /><button type="submit" className="primary-button" disabled={!addUsername.trim() || isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar pedido"}</button></form></div><div className="social-add-eko"><div className="social-add-eko-mark"><BrandMark size={105} /></div><strong>Encontre alguém para continuar a conversa.</strong><span>O Eko fica por aqui para ajudar.</span></div></div><div className="social-add-divider" /><SocialEmptyState title="Sua rede comeca aqui." copy="Adicione alguem pelo username e continue a conversa quando quiser." /></div>;
}

function PendingView({ received, sent, onAccept, onDelete }) {
  return <div className="social-view"><div className="social-view-heading"><div><span className="section-label">AMIGOS</span><h1>Pedidos pendentes</h1><p>Gerencie quem pode fazer parte da sua rede.</p></div></div>{received.length > 0 && <section className="social-list-section"><h2>Recebidos <span>{received.length}</span></h2>{received.map((item) => <PendingRow key={item.id} item={item} received onAccept={onAccept} onDelete={onDelete} />)}</section>}{sent.length > 0 && <section className="social-list-section"><h2>Enviados <span>{sent.length}</span></h2>{sent.map((item) => <PendingRow key={item.id} item={item} onDelete={onDelete} />)}</section>}{!received.length && !sent.length && <SocialEmptyState title="Nenhum pedido pendente." copy="Quando alguem enviar um pedido, ele aparecera aqui." variant={3} />}</div>;
}

function PendingRow({ item, received, onAccept, onDelete }) {
  return <div className="social-person-row"><Avatar user={item.user} size={42} /><span className="social-person-copy"><strong>{item.user.displayName || item.user.username}</strong><small>@{item.user.username}</small></span><span className="social-row-actions">{received && <button type="button" className="primary-button compact" onClick={() => onAccept(item.id)}><Icon name="check" size={14} />Aceitar</button>}<button type="button" className="text-button compact" onClick={() => onDelete(item.id, Boolean(received))}>{received ? "Recusar" : "Cancelar"}</button></span></div>;
}

function FriendsView({ friends, allFriends, onlineFriends, onlineUserIds, activeTab, search, onSearch, onMessage, onOpenProfile, removeTarget, setRemoveTarget, onRemove, onAdd }) {
  const title = activeTab === "online" ? "Online" : activeTab === "all" ? "Todos os amigos" : "Amigos";
  const normalizedQuery = search.trim().toLowerCase();
  const filteredFriends = friends.filter((item) => !normalizedQuery || `${item.user.displayName} ${item.user.username}`.toLowerCase().includes(normalizedQuery.replace(/^@/, "")));
  return <div className="social-view"><div className="social-view-heading"><div><span className="section-label">PESSOAS</span><h1>{title}</h1><p>{activeTab === "online" ? "Pessoas da sua rede conectadas agora." : "Pessoas que voce escolheu manter por perto."}</p></div></div><label className="social-search-field"><Icon name="search" size={16} /><span className="sr-only">Buscar amigos</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar amigos" /></label>{filteredFriends.length ? <section className="social-list-section"><h2>{activeTab === "online" ? `Online - ${onlineFriends.length}` : `Todos os amigos - ${allFriends.length}`}</h2>{filteredFriends.map((item) => <FriendRow key={item.user.id} item={item} isOnline={onlineUserIds.has(item.user.id)} onMessage={onMessage} onOpenProfile={onOpenProfile} removeTarget={removeTarget} setRemoveTarget={setRemoveTarget} onRemove={onRemove} />)}</section> : <SocialEmptyState title={normalizedQuery ? "Nenhum amigo encontrado." : activeTab === "online" ? "Nenhum amigo esta online." : "Ainda esta meio quieto por aqui."} copy={normalizedQuery ? "Tente buscar por outro nome ou username." : activeTab === "online" ? "Quando alguem entrar, voce vai ver por aqui." : "Adicione alguem para comecar."} action={activeTab === "online" || normalizedQuery ? undefined : "Adicionar amigo"} onAction={onAdd} variant={activeTab === "online" ? 6 : 0} />}</div>;
}

function FriendRow({ item, isOnline, onMessage, onOpenProfile, removeTarget, setRemoveTarget, onRemove }) {
  return <div className="social-person-row"><button type="button" className="social-person-identity" onClick={() => onOpenProfile(item.user)}><span className="social-person-avatar"><Avatar user={item.user} size={42} /><i className={isOnline ? "is-online" : ""} /></span><span className="social-person-copy"><strong>{item.user.displayName || item.user.username}</strong><small><i className={isOnline ? "online-dot" : "offline-dot"} />{isOnline ? "Online" : "Offline"}</small></span></button><span className="social-row-actions"><button type="button" className="secondary-button compact" onClick={() => onMessage(item.user.id)}><Icon name="chat" size={14} />Mensagem</button><button type="button" className="icon-button" title="Mais acoes" aria-label={`Mais acoes para ${item.user.username}`} onClick={() => setRemoveTarget(removeTarget === item.user.id ? null : item.user.id)}><Icon name="more" size={16} /></button></span>{removeTarget === item.user.id && <span className="social-remove-confirm"><span>Remover amizade?</span><button type="button" className="text-button danger" onClick={() => onRemove(item.user.id)}>Remover</button><button type="button" className="text-button" onClick={() => setRemoveTarget(null)}>Cancelar</button></span>}</div>;
}
