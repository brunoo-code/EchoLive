import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import UserBadges from "./UserBadges.jsx";
import SocialEmptyState from "./SocialEmptyState.jsx";
import { Avatar } from "./SocialSidebar.jsx";
import { useSocial } from "../social/SocialContext.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function SocialUserProfileModal({ userId, initialUser, onClose, onMessage }) {
  const { user: viewer } = useAuth();
  const { loadUserProfile, startConversation, friends, sendFriendRequest, removeFriend } = useSocial();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("activity");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  async function refreshProfile() {
    setLoading(true);
    setError("");
    try {
      const data = await loadUserProfile(userId);
      setProfile(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadUserProfile(userId).then((data) => { if (active) setProfile(data); }).catch((requestError) => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadUserProfile, userId]);

  const person = profile?.user || initialUser;
  const isSelf = person?.id === viewer?.id;
  const relationship = profile?.relationship;
  const friend = friends.find((item) => item.user.id === userId);
  const isFriend = relationship?.status === "accepted" || friend?.status === "accepted";

  async function handleMessage() {
    setWorking(true);
    try {
      const conversation = await startConversation(userId);
      onMessage?.(conversation);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleFriendAction() {
    if (isFriend) {
      setRemoveConfirmOpen(true);
      return;
    }
    setWorking(true);
    try {
      await sendFriendRequest(person.username);
      const next = await loadUserProfile(userId);
      setProfile(next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  async function confirmRemoveFriend() {
    setWorking(true);
    try {
      await removeFriend(userId);
      setRemoveConfirmOpen(false);
      const next = await loadUserProfile(userId);
      setProfile(next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  if (!person) return null;
  return <div className="social-profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose?.(); }}>
    <section className="social-profile-modal" role="dialog" aria-modal="true" aria-label={`Perfil de ${person.displayName || person.username}`}>
      <button type="button" className="icon-button social-profile-modal-close" onClick={onClose} aria-label="Fechar perfil" title="Fechar"><Icon name="close" size={18} /></button>
      <aside className="social-profile-identity">
        <Avatar user={person} size={108} />
        <div className="social-profile-name"><h2>{person.displayName || person.username}</h2><span>@{person.username}</span><UserBadges user={person} badges={person.badges} /><span className="social-profile-badge-note">Insígnias da conta</span></div>
        <p className="social-profile-presence"><i className={person.status === "online" ? "is-online" : ""} />{person.status === "online" ? "Online" : "Offline"}</p>
        {person.bio && <p className="social-profile-bio">{person.bio}</p>}
        {!isSelf && !person.isOfficial && person.accountType !== "system" && <div className="social-profile-actions"><button type="button" className="primary-button" onClick={handleMessage} disabled={working}><Icon name="message" size={15} />Mensagem</button>{relationship?.status !== "pending" && <button type="button" className="secondary-button" onClick={handleFriendAction} disabled={working}>{isFriend ? "Remover amigo" : "Adicionar amigo"}</button>}{isFriend && <span className="social-profile-relationship is-friend"><Icon name="check" size={12} />Amigos</span>}{relationship?.status === "pending" && <span className="social-profile-relationship">Pedido pendente</span>}</div>}
        {!isSelf && !person.isOfficial && person.accountType !== "system" && removeConfirmOpen && <div className="social-profile-remove-confirm"><strong>Remover esta amizade?</strong><span>Você poderá enviar um novo pedido depois.</span><div><button type="button" className="primary-button danger" onClick={confirmRemoveFriend} disabled={working}>Remover</button><button type="button" className="secondary-button" onClick={() => setRemoveConfirmOpen(false)} disabled={working}>Cancelar</button></div></div>}
        {error && <p className="social-feedback is-error">{error}</p>}
      </aside>
      <div className="social-profile-detail">
        <nav className="social-profile-tabs" aria-label="Detalhes do perfil">{[["activity", "Atividade"], ["friends", "Amigos em comum"], ["rooms", "Salas em comum"]].map(([id, label]) => <button type="button" key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
        <p className="social-profile-summary">{loading ? "Carregando conexões..." : `${profile?.mutualFriends?.length || 0} amigos em comum · ${profile?.mutualRooms?.length || 0} salas em comum`}</p>
        {loading ? <ProfileTabSkeleton /> : error ? <div className="social-profile-tab-error"><strong>Não foi possível carregar este perfil.</strong><button type="button" className="secondary-button" onClick={refreshProfile}>Tentar novamente</button></div> : <>{tab === "activity" && <Activity profile={profile} />}{tab === "friends" && <MutualList title="Amigos em comum" items={profile?.mutualFriends || []} empty="Nenhum amigo em comum por enquanto." />}{tab === "rooms" && <MutualRooms profile={profile} />}</>}
      </div>
    </section>
  </div>;
}

function ProfileTabSkeleton() {
  return <div className="social-profile-tab-skeleton" aria-label="Carregando perfil"><i /><i /><i /></div>;
}

function Activity({ profile }) {
  const activity = profile?.activity;
  if (!activity || activity.status === "offline") return <SocialEmptyState title="Tudo tranquilo por aqui." copy="Este usuário está offline agora." variant={7} />;
  return <div className="social-profile-activity"><span className="section-label">AGORA</span><h3>{activity.kind === "voice" ? "Em voz" : activity.kind === "screen" ? "Compartilhando tela" : "Online"}</h3><p>{activity.room?.name || "Disponível para conversar"}</p>{activity.room?.joinable && <button type="button" className="secondary-button" disabled><Icon name="voice" size={15} />Entrar</button>}</div>;
}

function MutualList({ title, items, empty }) {
  return <div className="social-profile-list"><span className="section-label">{title}</span>{items.length ? items.map((item) => <div className="social-profile-list-row" key={item.id}><Avatar user={item} size={40} /><span><strong>{item.displayName || item.username}</strong><small>@{item.username}</small></span></div>) : <p className="social-profile-list-empty">{empty}</p>}</div>;
}

function MutualRooms({ profile }) {
  if (!profile) return <div className="social-profile-list"><span className="section-label">Salas em comum</span><p className="social-profile-list-empty">Carregando salas...</p></div>;
  const rooms = profile.mutualRooms || [];
  return <div className="social-profile-list"><span className="section-label">Salas em comum</span>{rooms.length ? rooms.map((room) => { const liveCount = Number(room.liveParticipantCount || 0); const recentCount = Number(room.participantCount || 0); const label = room.active && liveCount > 0 ? `Ativa agora · ${liveCount} participante${liveCount === 1 ? "" : "s"}` : room.active ? "Ativa agora" : recentCount > 0 ? `${recentCount} pessoa${recentCount === 1 ? "" : "s"} passaram por aqui` : "Visitada recentemente"; return <div className="social-profile-list-row mutual-room-row" key={room.id}><span className="mutual-room-icon"><Icon name="voice" size={16} /></span><span><strong>{room.name}</strong><small>{label}</small></span></div>; }) : <p className="social-profile-list-empty">Nenhuma sala recente em comum.</p>}</div>;
}
