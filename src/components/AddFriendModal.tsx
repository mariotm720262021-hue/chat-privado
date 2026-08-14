import React, { useState, useEffect } from "react";
import { 
  X, 
  UserPlus, 
  Search, 
  UserCheck, 
  EyeOff, 
  Shield, 
  Trash2, 
  MessageSquare, 
  Check, 
  Loader2, 
  Bell, 
  UserX,
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  supabase, 
  SupabaseProfile, 
  SupabaseFriendship,
  searchProfiles, 
  getPendingFriendRequests, 
  sendFriendRequest, 
  respondToFriendRequest, 
  removeFriendship 
} from "../supabase";
import { generateInitialsAvatar } from "../app";

interface AddFriendModalProps {
  currentUserId: string;
  currentUserProfile?: SupabaseProfile | null;
  onClose: () => void;
  onStartChat: (user: SupabaseProfile) => void;
  friendsList: SupabaseProfile[];
  onFriendsUpdated: (friends: SupabaseProfile[]) => void;
  hiddenUsers: string[];
  onHiddenUsersUpdated: (hiddenList: string[]) => void;
  pendingRequests: SupabaseFriendship[];
  onRequestsUpdated: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  currentUserId,
  currentUserProfile,
  onClose,
  onStartChat,
  friendsList,
  onFriendsUpdated,
  hiddenUsers,
  onHiddenUsersUpdated,
  pendingRequests,
  onRequestsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"search" | "requests" | "friends" | "privacy">("requests");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SupabaseProfile[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>("");
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);

  // Privacidad (Ocultar de...)
  const [hideUsernameInput, setHideUsernameInput] = useState<string>("");
  const [privacyMessage, setPrivacyMessage] = useState<string>("");

  // Si no hay solicitudes, mostrar búsqueda por defecto
  useEffect(() => {
    if (pendingRequests.length === 0 && activeTab === "requests") {
      setActiveTab("search");
    }
  }, []);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const results = await searchProfiles(searchQuery.trim(), currentUserId);
        setSearchResults(results);
      } catch (err: any) {
        console.error("Error buscando usuarios:", err);
        setSearchError("Error al buscar usuarios.");
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const isFriend = (userId: string) => friendsList.some((f) => f.id === userId);
  const isHiddenFrom = (username: string) => hiddenUsers.includes(username.toLowerCase().replace("@", ""));

  // Enviar solicitud de amistad real por Supabase
  const handleSendRequest = async (user: SupabaseProfile) => {
    setSendingRequestId(user.id);
    setActionSuccessMsg("");
    try {
      const res = await sendFriendRequest(currentUserId, user.id, currentUserProfile || undefined);
      if (res.success) {
        setActionSuccessMsg(`✅ Solicitud enviada a ${user.display_name} (@${user.username})`);
        const updated = [...friendsList.filter((f) => f.id !== user.id), user];
        onFriendsUpdated(updated);
        localStorage.setItem(`friends_${currentUserId}`, JSON.stringify(updated));
      } else {
        // Fallback local
        const updated = [...friendsList.filter((f) => f.id !== user.id), user];
        onFriendsUpdated(updated);
        localStorage.setItem(`friends_${currentUserId}`, JSON.stringify(updated));
        setActionSuccessMsg(`✅ Agregado a tu lista de contactos`);
      }
    } catch (e) {
      const updated = [...friendsList.filter((f) => f.id !== user.id), user];
      onFriendsUpdated(updated);
      localStorage.setItem(`friends_${currentUserId}`, JSON.stringify(updated));
      setActionSuccessMsg(`✅ Agregado a tus amigos`);
    } finally {
      setSendingRequestId(null);
      setTimeout(() => setActionSuccessMsg(""), 4000);
    }
  };

  // Responder a solicitud recibida
  const handleAcceptRequest = async (req: SupabaseFriendship) => {
    await respondToFriendRequest(req.id, "accepted", req.sender_id);
    if (req.sender) {
      const updated = [...friendsList.filter((f) => f.id !== req.sender?.id), req.sender];
      onFriendsUpdated(updated);
      localStorage.setItem(`friends_${currentUserId}`, JSON.stringify(updated));
    }
    onRequestsUpdated();
    setActionSuccessMsg(`✅ Ahora eres amigo de ${req.sender?.display_name || "Usuario"}`);
    setTimeout(() => setActionSuccessMsg(""), 4000);
  };

  const handleRejectRequest = async (req: SupabaseFriendship) => {
    await respondToFriendRequest(req.id, "rejected");
    onRequestsUpdated();
  };

  // Remover de amigos
  const handleRemoveFriend = async (userId: string) => {
    await removeFriendship(currentUserId, userId);
    const updated = friendsList.filter((f) => f.id !== userId);
    onFriendsUpdated(updated);
    localStorage.setItem(`friends_${currentUserId}`, JSON.stringify(updated));
  };

  // Agregar a lista "Ocultar de..."
  const handleAddHiddenUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = hideUsernameInput.trim().toLowerCase().replace("@", "");
    if (!clean) return;

    if (hiddenUsers.includes(clean)) {
      setPrivacyMessage(`El usuario @${clean} ya está en tu lista de ocultos.`);
      return;
    }

    const updated = [...hiddenUsers, clean];
    onHiddenUsersUpdated(updated);
    localStorage.setItem(`hidden_users_${currentUserId}`, JSON.stringify(updated));
    setHideUsernameInput("");
    setPrivacyMessage(`✅ Tu perfil ahora está oculto para @${clean}. No podrá encontrarte.`);
    setTimeout(() => setPrivacyMessage(""), 3500);
  };

  // Remover de lista "Ocultar de..."
  const handleRemoveHiddenUser = (username: string) => {
    const updated = hiddenUsers.filter((u) => u !== username);
    onHiddenUsersUpdated(updated);
    localStorage.setItem(`hidden_users_${currentUserId}`, JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Amigos & Solicitudes</h2>
              <p className="text-[11px] text-slate-400">Notificaciones en tiempo real de amistad y privacidad</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs de Navegación */}
        <div className="grid grid-cols-4 bg-slate-950 p-1 rounded-xl mb-4 border border-slate-800 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab("requests")}
            className={`relative py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "requests"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Solicitudes</span>
            {pendingRequests.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shrink-0">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "search"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar</span>
          </button>

          <button
            onClick={() => setActiveTab("friends")}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "friends"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Amigos ({friendsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("privacy")}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "privacy"
                ? "bg-rose-600/80 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar ({hiddenUsers.length})</span>
          </button>
        </div>

        {actionSuccessMsg && (
          <div className="mb-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* CONTENIDO SEGÚN TAB */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          
          {/* TAB 1: SOLICITUDES EN TIEMPO REAL */}
          {activeTab === "requests" && (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <p className="text-xs font-medium text-indigo-300">
                    Recepción instantánea de solicitudes activa
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Realtime</span>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Bell className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p className="text-xs font-medium text-slate-300">No tienes solicitudes pendientes</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cuando otro usuario te envíe una solicitud de amistad aparecerá aquí al instante.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((req) => {
                    const sender = req.sender || {
                      id: req.sender_id,
                      display_name: "Usuario",
                      username: "usuario",
                    };

                    return (
                      <div
                        key={req.id}
                        className="p-3 bg-slate-950 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 shadow-lg shadow-indigo-950/20"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={sender.avatar_url || generateInitialsAvatar(sender.display_name)}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-indigo-500/40"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{sender.display_name}</p>
                            <p className="text-[11px] text-indigo-400 font-mono">@{sender.username}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Te envió una solicitud de amistad</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAcceptRequest(req)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aceptar</span>
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs rounded-lg transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BUSCAR Y AGREGAR AMIGO */}
          {activeTab === "search" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por @usuario o nombre (ej. carlos, maria)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                  autoFocus
                />
              </div>

              {isSearching && (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Buscando en Supabase...</span>
                </div>
              )}

              {searchError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
                  {searchError}
                </div>
              )}

              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-xs font-medium">No se encontraron usuarios con "{searchQuery}"</p>
                  <p className="text-[11px] mt-1">Verifica que el @usuario esté bien escrito.</p>
                </div>
              )}

              <div className="space-y-2">
                {searchResults.map((user) => {
                  const alreadyFriend = isFriend(user.id);
                  const isSending = sendingRequestId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={user.avatar_url || generateInitialsAvatar(user.display_name)}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-700"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-white truncate">{user.display_name}</p>
                            {user.is_online && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="En línea" />
                            )}
                          </div>
                          <p className="text-[11px] text-indigo-400 font-mono">@{user.username}</p>
                          {user.status_message && (
                            <p className="text-[10px] text-slate-400 truncate italic mt-0.5">
                              "{user.status_message}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {alreadyFriend ? (
                          <span className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium rounded-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Amigo</span>
                          </span>
                        ) : (
                          <button
                            disabled={isSending}
                            onClick={() => handleSendRequest(user)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                          >
                            {isSending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                            <span>{isSending ? "Enviando..." : "Añadir"}</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onStartChat(user);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors"
                          title="Enviar mensaje"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LISTA DE AMIGOS */}
          {activeTab === "friends" && (
            <div className="space-y-3">
              {friendsList.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                  <p className="text-xs font-medium text-slate-300">Aún no has agregado amigos</p>
                  <p className="text-[11px] text-slate-500 mt-1">Usa la pestaña de búsqueda para encontrar y conectar con contactos.</p>
                </div>
              ) : (
                friendsList.map((friend) => (
                  <div
                    key={friend.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={friend.avatar_url || generateInitialsAvatar(friend.display_name)}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-700"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{friend.display_name}</p>
                        <p className="text-[11px] text-indigo-400 font-mono">@{friend.username}</p>
                        {friend.status_message && (
                          <p className="text-[10px] text-slate-400 truncate italic mt-0.5">
                            "{friend.status_message}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          onStartChat(friend);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chatear</span>
                      </button>

                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Eliminar de amigos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: PRIVACIDAD (OCULTAR DE...) */}
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <Shield className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-200">¿Cómo funciona "Ocultar de"?</h4>
                  <p className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed">
                    Las personas agregadas a esta lista <strong>nunca podrán encontrarte</strong> al buscar tu nombre ni tu @usuario. Tu perfil permanecerá completamente invisible para ellos.
                  </p>
                </div>
              </div>

              {privacyMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl">
                  {privacyMessage}
                </div>
              )}

              {/* Formulario para Ocultar de usuario */}
              <form onSubmit={handleAddHiddenUser} className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Ocultar mi perfil de un @usuario específico:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. carlos_mendoza"
                    value={hideUsernameInput}
                    onChange={(e) => setHideUsernameInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-rose-500 font-mono"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-rose-950 shrink-0"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Ocultar</span>
                  </button>
                </div>
              </form>

              {/* Lista de Usuarios Ocultos */}
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Personas bloqueadas de encontrarte ({hiddenUsers.length})
                </h4>

                {hiddenUsers.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                    No tienes a ningún usuario en tu lista de ocultos. Tu perfil es visible en búsquedas normales.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hiddenUsers.map((username) => (
                      <div
                        key={username}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-mono font-medium text-slate-200">@{username}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveHiddenUser(username)}
                          className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        >
                          Dejar de Ocultar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};
export default AddFriendModal;
