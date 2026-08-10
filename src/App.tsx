/**
 * App.tsx
 * Aplicación de Chat Privado conectada a Supabase.
 * Soporta Autenticación con Correo, Nombres de usuario únicos (@usuario),
 * Conversaciones Privadas y Grupales (con código de invitación),
 * Mensajes de texto e imágenes mediante Supabase Storage,
 * Supabase Realtime, autodestrucción de mensajes y expiración de 24 horas.
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  MessageSquare, 
  User, 
  Settings, 
  Send, 
  Image as ImageIcon, 
  Clock, 
  Trash2, 
  LogOut, 
  Moon, 
  Sun, 
  Search, 
  Plus, 
  ArrowLeft, 
  Camera, 
  Info,
  Flame,
  X,
  Users,
  Lock,
  Mail,
  Key,
  UserPlus,
  LogIn,
  Check,
  CheckCheck,
  Copy,
  Database,
  RefreshCw,
  ExternalLink,
  AtSign,
  QrCode,
  Mic,
  Square,
  Smile,
  Edit3,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { 
  supabase, 
  checkSupabaseConnection, 
  registerWithEmail, 
  loginWithEmail, 
  logoutUser, 
  getProfile, 
  ensureProfileExists,
  searchProfiles, 
  createPrivateConversation, 
  createGroupConversation, 
  joinGroupWithInviteCode, 
  getUserConversations, 
  sendMessage, 
  uploadImageToStorage, 
  uploadAudioToStorage,
  getConversationMessages, 
  markMessagesAsRead,
  subscribeToMessages,
  updateSupabaseCredentials,
  supabaseUrl,
  supabaseKey,
  SupabaseProfile,
  SupabaseConversation,
  SupabaseMessage
} from "./supabase";

import { SUPABASE_SQL_SCRIPT } from "./supabaseSchemaSql";

import { 
  compressImage, 
  formatTime, 
  generateInitialsAvatar 
} from "./app";

import { AudioPlayer } from "./components/AudioPlayer";
import { ProfileModal } from "./components/ProfileModal";
import chatWallpaper from "./assets/images/chat_bg_wallpaper.jpg";
import sidebarWallpaper from "./assets/images/space_teal_doodle.jpg";

export default function App() {
  // Estado de Supabase Connection
  const [supabaseStatus, setSupabaseStatus] = useState<{
    success: boolean;
    tablesExist: boolean;
    message: string;
    checking: boolean;
  }>({
    success: false,
    tablesExist: false,
    message: "Verificando conexión con Supabase...",
    checking: true,
  });
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Credenciales Supabase editables en el cliente
  const [customUrlInput, setCustomUrlInput] = useState<string>(supabaseUrl);
  const [customKeyInput, setCustomKeyInput] = useState<string>(supabaseKey);
  const [credSaveSuccess, setCredSaveSuccess] = useState<string>("");

  // Estado de Usuario Autenticado
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<SupabaseProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Pantalla Activa: "auth", "chats", "chat_room", "profile", "settings"
  const [currentView, setCurrentView] = useState<string>("auth");

  // Estado de Formulario de Autenticación
  const [emailInput, setEmailInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [displayNameInput, setDisplayNameInput] = useState<string>("");
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Modal Crear Grupo / Unirse a Grupo
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [groupModalMode, setGroupModalMode] = useState<"create" | "join">("create");
  const [groupNameInput, setGroupNameInput] = useState<string>("");
  const [inviteCodeInput, setInviteCodeInput] = useState<string>("");
  const [groupModalError, setGroupModalError] = useState<string>("");
  const [groupModalLoading, setGroupModalLoading] = useState<boolean>(false);

  // Lista de Chats y Búsqueda
  const [chats, setChats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SupabaseProfile[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Chat Activo
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<SupabaseMessage[]>([]);
  const [profilesCache, setProfilesCache] = useState<Record<string, { display_name?: string; username?: string; avatar_url?: string }>>({});
  const [messageText, setMessageText] = useState<string>("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [selectedTTLSeconds, setSelectedTTLSeconds] = useState<number>(0); // 0 = sin autodestrucción corta

  // Tema
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Lightbox Foto
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Modal Editar Perfil
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  // Notas de Voz / MediaRecorder
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar Grabación de Nota de Voz
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      alert("No se pudo acceder al micrófono. Por favor permite el permiso en tu navegador.");
    }
  };

  // Detener y Enviar Nota de Voz
  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !activeChat?.id || !currentUser?.id) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    setIsUploadingVoice(true);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const ttlSeconds = selectedTTLSeconds;

      try {
        const audioUrl = await uploadAudioToStorage(audioBlob, currentUser.id);
        await sendMessage(
          activeChat.id,
          currentUser.id,
          "🎤 Nota de voz",
          "audio",
          audioUrl,
          ttlSeconds > 0 ? ttlSeconds : undefined
        );
        reloadConversations();
      } catch (err: any) {
        console.error("Error guardando nota de voz:", err);
        alert(err.message || "Error al enviar la nota de voz.");
      } finally {
        setIsRecording(false);
        setRecordingTime(0);
        setIsUploadingVoice(false);
        // Detener las pistas de audio
        mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      }
    };

    mediaRecorderRef.current.stop();
  };

  // Cancelar Grabación
  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Comprobar Conexión con Supabase al Iniciar
  const verifyConnection = async () => {
    setSupabaseStatus(prev => ({ ...prev, checking: true }));
    const result = await checkSupabaseConnection();
    setSupabaseStatus({
      success: result.success,
      tablesExist: result.tablesExist,
      message: result.message,
      checking: false,
    });
  };

  useEffect(() => {
    verifyConnection();
  }, []);

  // 2. Escuchar la Sesión en Supabase Auth
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true);
      if (session?.user) {
        setCurrentUser(session.user);
        let profile = await getProfile(session.user.id);
        if (!profile) {
          profile = await ensureProfileExists(session.user.id, true);
        }
        setUserProfile(profile);
        setCurrentView("chats");
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setCurrentView("auth");
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 3. Cargar la Lista de Conversaciones
  const reloadConversations = async () => {
    if (!currentUser?.id) return;
    try {
      const convs = await getUserConversations(currentUser.id);
      setChats(convs);
    } catch (err) {
      console.error("Error cargando conversaciones:", err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      reloadConversations();
      const interval = setInterval(reloadConversations, 10000); // Refrescar lista de chats
      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  // 4. Cargar Mensajes y Suscribirse en Tiempo Real al Chat Activo
  useEffect(() => {
    if (!activeChat?.id) return;

    let unsubscribe: (() => void) | null = null;

    const loadAndSubscribe = async () => {
      const msgs = await getConversationMessages(activeChat.id);
      setMessages(msgs);

      if (currentUser?.id) {
        await markMessagesAsRead(activeChat.id, currentUser.id);
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id !== currentUser.id
              ? { ...m, is_read: true, status: "read" }
              : m
          )
        );
      }

      // Guardar en caché los perfiles de sender que vengan en la consulta
      const newCache: Record<string, any> = {};
      msgs.forEach((m) => {
        if (m.sender_id && m.sender) {
          newCache[m.sender_id] = m.sender;
        }
      });
      if (Object.keys(newCache).length > 0) {
        setProfilesCache((prev) => ({ ...prev, ...newCache }));
      }

      // Cargar bajo demanda perfiles de sender faltantes
      const fetchedIds = new Set<string>();
      msgs.forEach((m) => {
        if (m.sender_id && !m.sender && !profilesCache[m.sender_id] && !newCache[m.sender_id] && !fetchedIds.has(m.sender_id)) {
          fetchedIds.add(m.sender_id);
          getProfile(m.sender_id).then((prof) => {
            if (prof) {
              setProfilesCache((prev) => ({ ...prev, [m.sender_id]: prof }));
            }
          });
        }
      });

      // Suscripción Realtime de Supabase (nuevos mensajes y actualizaciones)
      unsubscribe = subscribeToMessages(
        activeChat.id, 
        async (incomingMsg) => {
          let msgToAdd = incomingMsg;
          if (currentUser?.id && incomingMsg.sender_id !== currentUser.id) {
            await markMessagesAsRead(activeChat.id, currentUser.id);
            msgToAdd = { ...incomingMsg, is_read: true, status: "read" };
          }

          // Cargar perfil si falta
          if (msgToAdd.sender_id && !msgToAdd.sender && !profilesCache[msgToAdd.sender_id]) {
            getProfile(msgToAdd.sender_id).then((prof) => {
              if (prof) {
                setProfilesCache((prev) => ({ ...prev, [msgToAdd.sender_id]: prof }));
              }
            });
          }

          setMessages(prev => {
            if (prev.some(m => m.id === msgToAdd.id)) return prev;
            return [...prev, msgToAdd];
          });
        },
        (updatedMsg) => {
          setMessages(prev => 
            prev.map(m => m.id === updatedMsg.id ? { 
              ...m, 
              ...updatedMsg,
              sender: m.sender || (updatedMsg as any).sender || (m.sender_id ? profilesCache[m.sender_id] : undefined)
            } : m)
          );
        }
      );
    };

    loadAndSubscribe();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeChat?.id, currentUser?.id]);

  // 5. Scroll Automático al Fondo
  useEffect(() => {
    if (currentView === "chat_room") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentView]);

  // 6. Temporizador para Limpieza Visibles de Mensajes Expirados
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) => {
        if (!prev || prev.length === 0) return prev;
        const now = new Date();
        const valid = prev.filter((m) => !m.expires_at || new Date(m.expires_at) > now);
        if (valid.length === prev.length) return prev;
        return valid;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // --- MÉTODOS DE CREDENCIALES Y AUTENTICACIÓN SUPABASE ---

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredSaveSuccess("");
    try {
      updateSupabaseCredentials(customUrlInput, customKeyInput);
      setCredSaveSuccess("¡Credenciales guardadas! Probando conexión...");
      await verifyConnection();
    } catch (err: any) {
      alert(err.message || "Error al actualizar las credenciales de Supabase.");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (!emailInput.trim() || !emailInput.includes("@")) {
        throw new Error("Ingresa un correo electrónico válido.");
      }
      if (!passwordInput || passwordInput.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }

      if (isRegisterMode) {
        if (!usernameInput.trim()) {
          throw new Error("Ingresa un nombre de usuario (ej: carlos_mendoza).");
        }
        const cleanUser = usernameInput.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
        const name = displayNameInput.trim() || cleanUser;

        await registerWithEmail(emailInput.trim(), passwordInput, cleanUser, name);
      } else {
        await loginWithEmail(emailInput.trim(), passwordInput);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "";
      if (msg.includes("User already registered") || err.code === "user_already_exists") {
        setAuthError("Este correo electrónico ya está registrado. Haz clic en 'Iniciar Sesión'.");
      } else if (msg.includes("Invalid login credentials")) {
        setAuthError("Correo o contraseña incorrectos.");
      } else if (msg.includes("Failed to fetch") || msg.includes("fetch") || msg.includes("NetworkError")) {
        setAuthError(`No se pudo conectar a la URL de Supabase (${customUrlInput}). Revisa que tu URL de Supabase sea correcta en 'Configuración SQL / Credenciales'.`);
      } else if (msg.includes("Email not confirmed")) {
        setAuthError("Correo no confirmado. Revisa tu bandeja de entrada o desactiva 'Confirm Email' en Supabase -> Auth -> Providers -> Email.");
      } else {
        setAuthError(msg || "Error al autenticar en Supabase.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setUserProfile(null);
      setActiveChat(null);
      setCurrentView("auth");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  // --- BÚSQUEDA Y NAVEGACIÓN ---

  const handleSearch = async (term: string) => {
    setSearchQuery(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchProfiles(term, currentUser?.id);
      setSearchResults(results);
    } catch (err) {
      console.error("Error buscando perfiles:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChatWithUser = async (targetProfile: SupabaseProfile) => {
    if (!currentUser?.id) return;
    try {
      const convId = await createPrivateConversation(currentUser.id, targetProfile.id);
      setActiveChat({
        id: convId,
        type: "private",
        otherUser: targetProfile,
      });
      setCurrentView("chat_room");
      setSearchQuery("");
      setSearchResults([]);
      reloadConversations();
    } catch (err: any) {
      console.error("Error creando chat privado:", err);
      alert(err.message || "Error creando conversación. Asegúrate de ejecutar el script SQL en Supabase.");
    }
  };

  // --- CREAR / UNIRSE A GRUPO CON CÓDIGO ---

  const handleGroupAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setGroupModalError("");
    setGroupModalLoading(true);

    try {
      if (groupModalMode === "create") {
        if (!groupNameInput.trim()) {
          throw new Error("Por favor ingresa el nombre del grupo.");
        }
        const group = await createGroupConversation(currentUser.id, groupNameInput.trim());
        setActiveChat(group);
        setShowGroupModal(false);
        setGroupNameInput("");
        setCurrentView("chat_room");
        reloadConversations();
      } else {
        if (!inviteCodeInput.trim()) {
          throw new Error("Por favor ingresa el código de invitación.");
        }
        const convId = await joinGroupWithInviteCode(currentUser.id, inviteCodeInput.trim());
        setShowGroupModal(false);
        setInviteCodeInput("");
        reloadConversations();
        alert("¡Te has unido con éxito al grupo!");
      }
    } catch (err: any) {
      console.error(err);
      setGroupModalError(err.message || "Error procesando grupo.");
    } finally {
      setGroupModalLoading(false);
    }
  };

  // --- ENVIAR MENSAJE & ADJUNTAR IMAGEN ---

  const handleSelectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && !selectedImageFile) || !activeChat?.id || !currentUser?.id) return;

    const textToSend = messageText.trim();
    const fileToSend = selectedImageFile;
    const ttlSeconds = selectedTTLSeconds;

    setMessageText("");
    setSelectedImageFile(null);
    setSelectedImagePreview(null);

    try {
      let imageUrl = "";
      if (fileToSend) {
        imageUrl = await uploadImageToStorage(fileToSend, currentUser.id);
      }

      await sendMessage(
        activeChat.id,
        currentUser.id,
        textToSend || (fileToSend ? "📷 Imagen" : ""),
        fileToSend ? "image" : "text",
        imageUrl || undefined,
        ttlSeconds > 0 ? ttlSeconds : undefined
      );

      // Refrescar lista
      reloadConversations();
    } catch (err: any) {
      console.error("Error al enviar mensaje:", err);
      alert(err.message || "Error enviando mensaje. Asegúrate de ejecutar el script SQL en Supabase.");
    }
  };

  const copySqlScript = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  if (loading) {
    return (
      <div className="app-viewport flex items-center justify-center bg-slate-950 text-indigo-400">
        <div className="flex flex-col items-center gap-3">
          <Flame className="w-12 h-12 animate-pulse" />
          <p className="text-slate-400 font-medium text-sm">Cargando Chat Privado (Supabase)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-viewport ${theme === "light" ? "theme-light" : ""} flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans`}>
      
      {/* ==================== VISTA DE AUTENTICACIÓN / REGISTRO ==================== */}
      {currentView === "auth" && (
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 text-slate-100 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
          >
            {/* Header del Login */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Chat Privado</h1>
              <p className="text-xs text-slate-400 mt-1">
                Autenticación y almacenamiento impulsados por Supabase.
              </p>
            </div>

            {/* Mensajes de Error */}
            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium text-rose-400">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSqlModal(true)}
                  className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg transition-colors text-[11px] font-medium flex items-center justify-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Configurar URL / Keys / Script SQL de Supabase</span>
                </button>
              </div>
            )}

            {/* FORMULARIO SUPABASE AUTH */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isRegisterMode && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nombre de Usuario Único (@usuario)
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="carlos_mendoza"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl pl-9 pr-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                        required={isRegisterMode}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nombre Visible
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Carlos Mendoza"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl pl-9 pr-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <input 
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl pl-9 pr-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl pl-9 pr-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {authLoading ? (
                  <span className="text-xs">Conectando con Supabase...</span>
                ) : isRegisterMode ? (
                  <>
                    <span>Registrarse en Supabase</span>
                    <UserPlus className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <LogIn className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(""); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  {isRegisterMode 
                    ? "¿Ya tienes cuenta en Supabase? Inicia sesión" 
                    : "¿Nuevo usuario? Crear cuenta con Supabase"}
                </button>
              </div>

              <div className="text-center pt-3 border-t border-slate-800/80 mt-3">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(true)}
                  className="text-[11px] text-slate-500 hover:text-slate-400 font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Database className="w-3 h-3" />
                  <span>Configuración de Supabase / SQL</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ==================== PANEL PRINCIPAL DE CHAT ==================== */}
      {currentUser && currentView !== "auth" && (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
          
          {/* BARRA LATERAL / LISTA DE CHATS */}
          <div 
            className={`${currentView === "chat_room" ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 bg-emerald-950 border-r border-slate-800/80 shrink-0 h-full`}
            style={{
              backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.20)), url(${sidebarWallpaper})`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            
            {/* Header Lateral */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
              <button 
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-3 text-left group hover:opacity-90 transition-opacity min-w-0 flex-1 mr-2"
                title="Editar mi Perfil"
              >
                <div className="relative">
                  <img 
                    src={userProfile?.avatar_url || generateInitialsAvatar(userProfile?.display_name || "U")} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full border border-indigo-500/30 object-cover group-hover:border-indigo-400 transition-colors"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-indigo-600 p-0.5 rounded-full text-white text-[9px]">
                    <Edit3 className="w-2.5 h-2.5" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate flex items-center gap-1">
                    <span>{userProfile?.display_name || "Usuario"}</span>
                  </h2>
                  <p className="text-[11px] text-indigo-400 font-mono truncate">@{userProfile?.username || "usuario"}</p>
                  {userProfile?.status_message && (
                    <p className="text-[10px] text-slate-300 truncate italic mt-0.5">"{userProfile.status_message}"</p>
                  )}
                </div>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSqlModal(true)}
                  title="Configurar Supabase / SQL"
                  className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-colors backdrop-blur-sm"
                >
                  <Database className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setGroupModalMode("create"); setShowGroupModal(true); }}
                  title="Crear / Unirse a Grupo"
                  className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-colors backdrop-blur-sm"
                >
                  <Users className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Cerrar Sesión"
                  className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-colors backdrop-blur-sm"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Buscador de Usuarios en Supabase */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-300" />
                <input 
                  type="text"
                  placeholder="Buscar por @usuario o nombre..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-700/60 text-xs text-white placeholder-slate-300 pl-9 pr-4 py-2.5 rounded-xl outline-none focus:border-indigo-400 transition-colors backdrop-blur-sm"
                />
              </div>

              {/* Botón de Acceso Rápido a Unirse a Grupo */}
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => { setGroupModalMode("create"); setShowGroupModal(true); }}
                  className="flex-1 py-1.5 px-3 bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-400/40 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm backdrop-blur-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Grupo</span>
                </button>
                <button
                  onClick={() => { setGroupModalMode("join"); setShowGroupModal(true); }}
                  className="flex-1 py-1.5 px-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/70 rounded-xl text-xs font-medium text-slate-100 flex items-center justify-center gap-1.5 transition-colors backdrop-blur-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Código de Grupo</span>
                </button>
              </div>
            </div>

            {/* Resultados de Búsqueda o Lista de Conversaciones */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {searchQuery.trim() ? (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-1 tracking-wider">
                    Resultados en Supabase ({searchResults.length})
                  </p>
                  {isSearching ? (
                    <p className="text-xs text-slate-400 text-center py-4">Buscando en Supabase...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No se encontraron usuarios.</p>
                  ) : (
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartChatWithUser(user)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/80 transition-colors text-left"
                      >
                        <img src={user.avatar_url || generateInitialsAvatar(user.display_name)} alt="" className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{user.display_name}</p>
                          <p className="text-[11px] text-indigo-400 truncate">@{user.username}</p>
                        </div>
                        <Plus className="w-4 h-4 text-indigo-400 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-1 tracking-wider">
                    Conversaciones Activas (Máx 24h)
                  </p>
                  {chats.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-medium">No tienes conversaciones activas</p>
                      <p className="text-[11px] text-slate-500 mt-1">Busca un usuario por su @usuario para iniciar un chat privado.</p>
                    </div>
                  ) : (
                    chats.map((chat) => {
                      const isGroup = chat.type === "group";
                      const title = isGroup ? chat.name : (chat.otherUser?.display_name || "Usuario");
                      const subtitle = isGroup ? `Código: ${chat.invite_code}` : `@${chat.otherUser?.username || "usuario"}`;
                      const avatar = isGroup ? generateInitialsAvatar(title) : (chat.otherUser?.avatar_url || generateInitialsAvatar(title));

                      return (
                        <button
                          key={chat.id}
                          onClick={() => {
                            setActiveChat(chat);
                            setCurrentView("chat_room");
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left backdrop-blur-sm ${
                            activeChat?.id === chat.id ? "bg-indigo-600/30 border border-indigo-400/40 shadow-sm" : "bg-slate-900/30 hover:bg-slate-800/50 border border-slate-800/40"
                          }`}
                        >
                          <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-white truncate">{title}</p>
                              {chat.lastMessage && (
                                <span className="text-[10px] text-slate-500">
                                  {formatTime(chat.lastMessage.created_at)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {chat.lastMessage ? chat.lastMessage.content : subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* VISTA DE SALA DE CHAT */}
          <div className={`${currentView === "chat_room" ? "flex" : "hidden md:flex"} flex-1 flex-col bg-slate-950 h-full min-w-0 relative`}>
            {activeChat ? (
              <>
                {/* Header de la Sala de Chat */}
                <div className="p-3.5 px-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setCurrentView("chats")}
                      className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <img 
                      src={activeChat.type === "group" ? generateInitialsAvatar(activeChat.name) : (activeChat.otherUser?.avatar_url || generateInitialsAvatar(activeChat.otherUser?.display_name || "C"))} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-700"
                    />

                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {activeChat.type === "group" ? activeChat.name : activeChat.otherUser?.display_name}
                      </h3>
                      <p className="text-[11px] text-indigo-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {activeChat.type === "group" 
                            ? `Grupo • Código: ${activeChat.invite_code}` 
                            : `@${activeChat.otherUser?.username || "usuario"}`}
                        </span>
                      </p>
                      {activeChat.type === "private" && activeChat.otherUser?.status_message && (
                        <p className="text-[10px] text-emerald-400 truncate italic">
                          "{activeChat.otherUser.status_message}"
                        </p>
                      )}
                    </div>
                  </div>

                  {activeChat.type === "group" && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeChat.invite_code);
                        alert(`Código copiado: ${activeChat.invite_code}`);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 rounded-xl border border-slate-700/60 font-medium flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </button>
                  )}
                </div>

                {/* Área de Mensajes */}
                <div 
                  className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950"
                  style={{
                    backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.35)), url(${chatWallpaper})`,
                    backgroundSize: "420px",
                    backgroundRepeat: "repeat",
                    backgroundPosition: "center"
                  }}
                >
                  <div className="text-center my-2">
                    <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span>Cifrado y almacenado de forma segura en Supabase</span>
                    </span>
                  </div>

                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p className="text-xs font-medium">No hay mensajes aún.</p>
                      <p className="text-[11px] mt-1">Envía el primer mensaje para iniciar la conversación.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUser?.id;

                      // Obtener datos del remitente
                      const senderProfile = msg.sender || profilesCache[msg.sender_id] || (activeChat?.otherUser?.id === msg.sender_id ? activeChat.otherUser : null);
                      const senderDisplayName = senderProfile?.display_name || (senderProfile?.username ? `@${senderProfile.username}` : "Usuario");
                      const senderAvatar = senderProfile?.avatar_url || generateInitialsAvatar(senderDisplayName);

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          {/* Identificación del Remitente para mensajes recibidos en chats y grupos */}
                          {!isMe && (
                            <div className="flex items-center gap-1.5 mb-1 ml-1 text-slate-300">
                              <img 
                                src={senderAvatar} 
                                alt={senderDisplayName} 
                                className="w-4 h-4 rounded-full object-cover border border-slate-700/80 shadow-sm"
                              />
                              <span className="text-[11px] font-semibold text-indigo-300/90 tracking-wide">
                                {senderDisplayName}
                              </span>
                            </div>
                          )}

                          <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl text-sm ${
                            isMe 
                              ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-950/40" 
                              : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none"
                          }`}>
                            {msg.type === "image" && msg.media_url && (
                              <img 
                                src={msg.media_url} 
                                alt="Imagen" 
                                onClick={() => setLightboxImage(msg.media_url || null)}
                                className="w-full max-h-60 object-cover rounded-xl mb-2 cursor-pointer hover:opacity-95 transition-opacity"
                              />
                            )}

                            {msg.type === "audio" && msg.media_url ? (
                              <AudioPlayer src={msg.media_url} isMe={isMe} />
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}

                            {/* Pie del mensaje: Hora, indicador de lectura, etiqueta temporal */}
                            <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isMe ? "text-indigo-200 justify-end" : "text-slate-400"}`}>
                              <span>{formatTime(msg.created_at)}</span>

                              {/* Indicador de estado de lectura para mensajes propios */}
                              {isMe && (
                                <span className="inline-flex items-center ml-0.5" title={msg.is_read || msg.status === "read" ? "Leído" : msg.status === "delivered" ? "Entregado" : "Enviado"}>
                                  {msg.is_read || msg.status === "read" ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" />
                                  ) : msg.status === "delivered" ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-indigo-200/70" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-indigo-200/70" />
                                  )}
                                </span>
                              )}

                              {msg.expires_at && (
                                <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-0.5 ml-1">
                                  <Clock className="w-2.5 h-2.5" /> Temporal
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Previsualización de Imagen Adjunta */}
                {selectedImagePreview && (
                  <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={selectedImagePreview} alt="" className="w-12 h-12 object-cover rounded-lg border border-indigo-500" />
                      <div>
                        <p className="text-xs font-medium text-white">Imagen lista para subir a Supabase Storage</p>
                        <p className="text-[10px] text-slate-400">Se guardará en el bucket chat-attachments</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setSelectedImageFile(null); setSelectedImagePreview(null); }}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Barra de Envío de Mensajes */}
                <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleSelectImageFile} 
                    className="hidden" 
                  />

                  {isRecording ? (
                    <div className="flex-1 flex items-center justify-between bg-slate-950 border border-rose-500/40 rounded-xl px-3 py-2 animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-mono font-bold text-rose-400">
                          {formatTimer(recordingTime)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                          Grabando nota de voz...
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelRecording}
                          disabled={isUploadingVoice}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Cancelar</span>
                        </button>

                        <button
                          type="button"
                          onClick={stopAndSendRecording}
                          disabled={isUploadingVoice}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-rose-950 transition-colors"
                        >
                          {isUploadingVoice ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Subiendo...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Enviar Audio</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Adjuntar Imagen (Supabase Storage)"
                        className="p-2.5 text-slate-400 hover:text-indigo-400 bg-slate-800 rounded-xl transition-colors shrink-0"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>

                      {/* Selector de Autodestrucción de Mensaje */}
                      <select
                        value={selectedTTLSeconds}
                        onChange={(e) => setSelectedTTLSeconds(Number(e.target.value))}
                        className="bg-slate-800 border border-slate-700 text-xs text-slate-300 px-2 py-2.5 rounded-xl outline-none"
                        title="Tiempo de autodestrucción del mensaje"
                      >
                        <option value={0}>Sin autodestrucción</option>
                        <option value={10}>Autodestrucción 10s</option>
                        <option value={60}>Autodestrucción 1m</option>
                        <option value={300}>Autodestrucción 5m</option>
                        <option value={3600}>Autodestrucción 1h</option>
                      </select>

                      <input 
                        type="text"
                        placeholder="Escribe un mensaje seguro..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                      />

                      {/* Botón de Grabación de Nota de Voz */}
                      <button
                        type="button"
                        onClick={startRecording}
                        title="Grabar nota de voz (Autodestrucción 5h)"
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl transition-colors shrink-0 border border-slate-700/60"
                      >
                        <Mic className="w-5 h-5" />
                      </button>

                      <button
                        type="submit"
                        disabled={!messageText.trim() && !selectedImageFile}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors shadow-md shadow-indigo-950 shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <ShieldCheck className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">Bienvenido a Chat Privado</h3>
                <p className="text-xs max-w-sm mt-1">
                  Selecciona una conversación existente o busca a un usuario por su @usuario para chatear en tiempo real.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL DE CREAR / UNIRSE A GRUPO ==================== */}
      <AnimatePresence>
        {showGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white">
                  {groupModalMode === "create" ? "Crear Conversación Grupal" : "Unirse con Código de Invitación"}
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {groupModalError && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {groupModalError}
                </div>
              )}

              <form onSubmit={handleGroupAction} className="space-y-4">
                {groupModalMode === "create" ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Grupo</label>
                    <input 
                      type="text"
                      placeholder="Ej. Proyecto Alpha"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Se generará un código único para que otros puedan unirse.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Código de Invitación</label>
                    <input 
                      type="text"
                      placeholder="Ej. X7B9A2"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-center uppercase tracking-widest font-mono text-sm text-indigo-400 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={groupModalLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {groupModalLoading ? "Procesando en Supabase..." : (groupModalMode === "create" ? "Crear Grupo" : "Unirse al Grupo")}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== MODAL DE SCRIPT Y ESTADO SQL SUPABASE ==================== */}
      <AnimatePresence>
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-bold text-white">Configuración del Proyecto Supabase</h2>
                </div>
                <button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 text-xs pr-1">
                
                {/* SECCIÓN 1: EDITAR O VERIFICAR CREDENCIALES SUPABASE */}
                <form onSubmit={handleSaveCredentials} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-indigo-400" />
                      Credenciales de tu Proyecto Supabase:
                    </span>
                    {supabaseStatus.success ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                        ✓ Conectado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-medium">
                        ⚠ Revisa tu URL / Key
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      URL del Proyecto (SUPABASE_URL):
                    </label>
                    <input 
                      type="text"
                      placeholder="https://tu-proyecto.supabase.co"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Clave Anónima / Publishable Key (SUPABASE_ANON_KEY):
                    </label>
                    <input 
                      type="text"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                      value={customKeyInput}
                      onChange={(e) => setCustomKeyInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  {credSaveSuccess && (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] rounded-lg">
                      {credSaveSuccess}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Guardar y Probar Conexión</span>
                    </button>
                  </div>
                </form>

                {/* SECCIÓN 2: INSTRUCCIONES PASO A PASO */}
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-indigo-200 space-y-2">
                  <p className="font-semibold text-indigo-300">Pasos para conectar y activar las tablas:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                    <li>Ingresa a tu consola en <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-medium">app.supabase.com</a> y abre tu proyecto.</li>
                    <li>Ve a <strong>Project Settings -&gt; API</strong> para copiar tu <strong>Project URL</strong> y tu <strong>anon public key</strong> si deseas cambiar las de arriba.</li>
                    <li>En el menú lateral, entra al <strong>SQL Editor</strong>.</li>
                    <li>Copia el script SQL de abajo, pégalo en una nueva consulta (<strong>New Query</strong>) y presiona <strong>Run</strong>.</li>
                    <li>En <strong>Authentication -&gt; Providers -&gt; Email</strong>, asegúrate de desmarcar "Confirm email" si deseas inicio de sesión directo sin verificar correo.</li>
                  </ol>
                </div>

                {/* SECCIÓN 3: SCRIPT SQL */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-300">Script SQL para crear las tablas y Storage en Supabase:</span>
                    <button
                      onClick={copySqlScript}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5 font-medium"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? "¡Copiado al portapapeles!" : "Copiar Script SQL"}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-[11px] overflow-x-auto max-h-52 whitespace-pre">
                    {SUPABASE_SQL_SCRIPT}
                  </pre>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => {
                    verifyConnection();
                    setShowSqlModal(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Entendido y Probar Conexión
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX DE FOTO */}
      <AnimatePresence>
        {lightboxImage && (
          <div 
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
          >
            <img src={lightboxImage} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE EDITAR PERFIL */}
      {showProfileModal && (
        <ProfileModal
          userProfile={userProfile}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={(updatedProfile) => {
            setUserProfile(updatedProfile);
          }}
        />
      )}

    </div>
  );
}
