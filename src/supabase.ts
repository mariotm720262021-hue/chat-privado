import { createClient } from "@supabase/supabase-js";

// Credenciales iniciales
const DEFAULT_SUPABASE_URL = "https://wscmqhypdbviusfamwig.supabase.co";

const getSavedUrl = () => {
  const saved = localStorage.getItem("custom_supabase_url");
  if (!saved || saved === "https://xyzcompany.supabase.co") {
    return import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== "https://xyzcompany.supabase.co" 
      ? import.meta.env.VITE_SUPABASE_URL 
      : DEFAULT_SUPABASE_URL;
  }
  return saved;
};

const getSavedKey = () => localStorage.getItem("custom_supabase_key") || import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_5NAjwhDe-jVi6NyDVJoqcw_cao0ikQJ";

export let supabaseUrl = getSavedUrl();
export let supabaseKey = getSavedKey();

export let supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function updateSupabaseCredentials(newUrl: string, newKey: string) {
  const cleanUrl = newUrl.trim();
  const cleanKey = newKey.trim();
  
  if (!cleanUrl || !cleanKey) {
    throw new Error("El URL y la Key de Supabase no pueden estar vacíos.");
  }

  localStorage.setItem("custom_supabase_url", cleanUrl);
  localStorage.setItem("custom_supabase_key", cleanKey);

  supabaseUrl = cleanUrl;
  supabaseKey = cleanKey;

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function resetSupabaseCredentials() {
  localStorage.removeItem("custom_supabase_url");
  localStorage.removeItem("custom_supabase_key");

  supabaseUrl = getSavedUrl();
  supabaseKey = getSavedKey();

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return { supabaseUrl, supabaseKey };
}

export interface SupabaseProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  status_message?: string;
  is_online?: boolean;
  last_seen?: string;
  created_at?: string;
}

export interface SupabaseConversation {
  id: string;
  type: "private" | "group";
  name?: string;
  invite_code?: string;
  created_by?: string;
  created_at?: string;
  expires_at?: string; // Para conversaciones con duración máxima (ej. 24h)
}

export type MessageMediaType = "text" | "image" | "audio" | "video" | "youtube" | "iptv";

export interface SupabaseMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: MessageMediaType;
  media_url?: string;
  created_at: string;
  expires_at?: string; // Para mensajes temporales con autodestrucción
  is_burned?: boolean;
  is_read?: boolean;
  status?: "sent" | "delivered" | "read";
  sender?: {
    id?: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    status_message?: string;
  };
}

/**
 * Comprueba si la conexión con Supabase es correcta.
 */
export async function checkSupabaseConnection(): Promise<{ success: boolean; message: string; tablesExist: boolean }> {
  try {
    // Intenta hacer una consulta simple a auth o a profiles
    const { data, error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      if (error.code === "PGRST301" || error.message.includes("relation") || error.code === "42P01") {
        return {
          success: true, // Conexión exitosa pero faltan las tablas
          tablesExist: false,
          message: "Conexión a Supabase establecida. Las tablas aún no están creadas en la base de datos.",
        };
      }
      // Error de credenciales o red
      return {
        success: false,
        tablesExist: false,
        message: `Error al conectar con Supabase: ${error.message}`,
      };
    }

    return {
      success: true,
      tablesExist: true,
      message: "¡Conexión y tablas de Supabase operativas correctamente!",
    };
  } catch (err: any) {
    return {
      success: false,
      tablesExist: false,
      message: err?.message || "Error inesperado al probar conexión con Supabase.",
    };
  }
}

/**
 * Registra un nuevo usuario con Correo Electrónico, Contraseña y Nombre de usuario único.
 */
export async function registerWithEmail(email: string, pass: string, username: string, displayName: string) {
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
  
  if (!cleanUsername) {
    throw new Error("El nombre de usuario no es válido.");
  }

  // Comprobar si el nombre de usuario ya está tomado
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (existingUser) {
    throw new Error(`El nombre de usuario @${cleanUsername} ya está registrado por otra persona.`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        username: cleanUsername,
        display_name: displayName || cleanUsername,
      },
    },
  });

  if (error) throw error;

  // Si el usuario se creó
  if (data.user) {
    // Crear o actualizar perfil en la tabla public.profiles
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: data.user.id,
      username: cleanUsername,
      display_name: displayName || cleanUsername,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
      is_online: true,
      last_seen: new Date().toISOString(),
    });

    if (profileErr && profileErr.code !== "42P01") {
      console.warn("Aviso al crear perfil:", profileErr);
    }
  }

  return data;
}

/**
 * Inicia sesión con Correo Electrónico y Contraseña.
 */
export async function loginWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) throw error;

  if (data.user) {
    await supabase.from("profiles").update({
      is_online: true,
      last_seen: new Date().toISOString(),
    }).eq("id", data.user.id);
  }

  return data;
}

/**
 * Inicia sesión / Registro con OAuth (Google).
 * Utiliza dinámicamente la URL real actual del navegador (window.location.origin / href).
 */
export async function loginWithOAuth(provider: "google" = "google", redirectUrl?: string) {
  // Determina dinámicamente la URL de origen actual en el navegador
  const currentUrl = typeof window !== "undefined" 
    ? window.location.href.split('?')[0].split('#')[0]
    : "";

  const targetRedirect = redirectUrl || currentUrl;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: targetRedirect,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Envia código OTP por WhatsApp / Teléfono.
 */
export async function sendWhatsAppOtp(phone: string) {
  const cleanPhone = phone.trim();
  if (!cleanPhone) throw new Error("Ingresa un número de teléfono con código de país (ej. +50499887766).");

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: cleanPhone,
    options: {
      channel: "whatsapp",
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Verifica el código OTP de WhatsApp / Teléfono.
 */
export async function verifyWhatsAppOtp(phone: string, token: string) {
  const cleanPhone = phone.trim();
  const cleanToken = token.trim();
  if (!cleanPhone || !cleanToken) throw new Error("El número de teléfono y el código son obligatorios.");

  const { data, error } = await supabase.auth.verifyOtp({
    phone: cleanPhone,
    token: cleanToken,
    type: "sms",
  });
  if (error) throw error;

  if (data.user) {
    await ensureProfileExists(data.user.id);
  }
  return data;
}

/**
 * Cierra sesión.
 */
export async function logoutUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({
      is_online: false,
      last_seen: new Date().toISOString(),
    }).eq("id", user.id);
  }
  await supabase.auth.signOut();
}

/**
 * Obtiene el perfil del usuario actual o de otro por ID.
 */
export async function getProfile(userId: string): Promise<SupabaseProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data;
}

/**
 * Asegura que exista un registro en la tabla public.profiles para el ID dado.
 * Si no existe, lo crea automáticamente basado en los datos de auth.users.
 */
export async function ensureProfileExists(userId: string, force: boolean = false): Promise<SupabaseProfile | null> {
  if (!userId) return null;

  if (!force) {
    const existing = await getProfile(userId);
    if (existing) return existing;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email || "";
  const emailPrefix = email ? email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") : "usuario";
  const username = user?.user_metadata?.username || emailPrefix || `user_${userId.substring(0, 6)}`;
  const displayName = user?.user_metadata?.display_name || username;

  const profileData: SupabaseProfile = {
    id: userId,
    username: username,
    display_name: displayName,
    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
    is_online: true,
    last_seen: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profileData)
    .select()
    .maybeSingle();

  if (error) {
    console.warn("Aviso al asegurar perfil en public.profiles:", error);
    return profileData;
  }

  return data || profileData;
}

/**
 * Busca usuarios por nombre de usuario, correo o nombre visible.
 * Oculta automáticamente a los usuarios que hayan sido bloqueados/ocultados mediante 'Ocultar de...'.
 */
export async function searchProfiles(
  searchTerm: string, 
  currentUserId: string,
  currentUserUsername?: string
): Promise<SupabaseProfile[]> {
  if (!searchTerm.trim()) return [];
  const term = `%${searchTerm.trim().toLowerCase()}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .or(`username.ilike.${term},display_name.ilike.${term}`);

  if (error) {
    console.error("Error buscando usuarios:", error);
    return [];
  }

  let profiles: SupabaseProfile[] = data || [];

  // Filtrado de Privacidad: Ocultar de...
  try {
    // 1. Usuarios que el usuario actual ocultó
    const myHiddenUsersRaw = localStorage.getItem(`hidden_users_${currentUserId}`);
    const myHiddenUsers: string[] = myHiddenUsersRaw ? JSON.parse(myHiddenUsersRaw) : [];

    // 2. Comprobar si el usuario buscado ocultó su perfil del usuario actual
    const currentCleanUsername = currentUserUsername ? currentUserUsername.toLowerCase().replace("@", "") : "";

    profiles = profiles.filter((p) => {
      const pUsername = p.username?.toLowerCase() || "";
      // Si yo lo oculté, no me aparece
      if (myHiddenUsers.includes(pUsername)) return false;

      // Si él me ocultó a mí (guardado en su lista de privacidad local en esta instancia/navegador)
      const theirHiddenUsersRaw = localStorage.getItem(`hidden_users_${p.id}`);
      if (theirHiddenUsersRaw) {
        try {
          const theirHidden: string[] = JSON.parse(theirHiddenUsersRaw);
          if (currentCleanUsername && theirHidden.includes(currentCleanUsername)) {
            return false; // Ocultar el perfil para que no lo encuentre
          }
        } catch (_) {}
      }

      return true;
    });
  } catch (err) {
    console.warn("Aviso al filtrar privacidad de búsqueda:", err);
  }

  return profiles;
}

/**
 * Crea una conversación privada entre dos usuarios.
 */
export async function createPrivateConversation(currentUserId: string, otherUserId: string): Promise<string> {
  // Asegurar que existan los perfiles en public.profiles
  await ensureProfileExists(currentUserId);
  await ensureProfileExists(otherUserId);

  // Comprobar si ya existe una conversación privada entre ambos
  const { data: myConvs } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (myConvs && myConvs.length > 0) {
    const convIds = myConvs.map(c => c.conversation_id);
    const { data: commonConvs } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", convIds);

    if (commonConvs && commonConvs.length > 0) {
      // Verificar si alguna es tipo 'private'
      for (const item of commonConvs) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("id, type")
          .eq("id", item.conversation_id)
          .single();

        if (conv && conv.type === "private") {
          return conv.id;
        }
      }
    }
  }

  // Si no existe, crear nueva conversación con expiración de 24 horas por defecto
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: newConv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      type: "private",
      created_by: currentUserId,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (convErr) throw convErr;

  // Insertar participantes
  await supabase.from("conversation_participants").insert([
    { conversation_id: newConv.id, user_id: currentUserId },
    { conversation_id: newConv.id, user_id: otherUserId },
  ]);

  return newConv.id;
}

/**
 * Crea un grupo con un código de invitación único y expiración de 24h.
 */
export async function createGroupConversation(currentUserId: string, groupName: string): Promise<SupabaseConversation> {
  // Asegurar obligatoriamente que el usuario tenga su perfil creado en public.profiles
  await ensureProfileExists(currentUserId, true);

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: newGroup, error } = await supabase
    .from("conversations")
    .insert({
      type: "group",
      name: groupName,
      invite_code: inviteCode,
      created_by: currentUserId,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    // Si la clave foránea falló, reintentar asegurar el perfil e intentar de nuevo
    if (error.message?.includes("foreign key") || error.code === "23503") {
      await ensureProfileExists(currentUserId, true);
      const { data: retryGroup, error: retryErr } = await supabase
        .from("conversations")
        .insert({
          type: "group",
          name: groupName,
          invite_code: inviteCode,
          created_by: currentUserId,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (retryErr) throw retryErr;
      
      await supabase.from("conversation_participants").insert({
        conversation_id: retryGroup.id,
        user_id: currentUserId,
      });

      return retryGroup;
    }
    throw error;
  }

  // Agregar al creador como participante
  await supabase.from("conversation_participants").insert({
    conversation_id: newGroup.id,
    user_id: currentUserId,
  });

  return newGroup;
}

/**
 * Se une a un grupo mediante código de invitación.
 */
export async function joinGroupWithInviteCode(currentUserId: string, inviteCode: string): Promise<string> {
  await ensureProfileExists(currentUserId);
  const codeClean = inviteCode.trim().toUpperCase();
  
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, type, expires_at")
    .eq("invite_code", codeClean)
    .single();

  if (error || !conv) {
    throw new Error("Código de invitación no válido o expirado.");
  }

  if (conv.expires_at && new Date(conv.expires_at) < new Date()) {
    throw new Error("Esta conversación grupal ha expirado.");
  }

  // Insertar usuario
  const { error: partErr } = await supabase
    .from("conversation_participants")
    .upsert({
      conversation_id: conv.id,
      user_id: currentUserId,
    });

  if (partErr) throw partErr;

  return conv.id;
}

/**
 * Obtiene todas las conversaciones del usuario activo.
 */
export async function getUserConversations(currentUserId: string): Promise<any[]> {
  const { data: participantData, error: partErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (partErr || !participantData) return [];

  const convIds = participantData.map(p => p.conversation_id);
  if (convIds.length === 0) return [];

  const { data: conversations, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .in("id", convIds)
    .order("created_at", { ascending: false });

  if (convErr || !conversations) return [];

  // Filtrar conversaciones expiradas (más de 24h)
  const now = new Date();
  const validConversations = conversations.filter(c => !c.expires_at || new Date(c.expires_at) > now);

  // Cargar detalles de los otros participantes y último mensaje
  const result = await Promise.all(
    validConversations.map(async (conv) => {
      let otherUser: SupabaseProfile | null = null;

      if (conv.type === "private") {
        const { data: otherPart } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conv.id)
          .neq("user_id", currentUserId)
          .maybeSingle();

        if (otherPart) {
          otherUser = await getProfile(otherPart.user_id);
        }
      }

      // Obtener último mensaje
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...conv,
        otherUser,
        lastMessage: lastMsg || null,
      };
    })
  );

  return result;
}

/**
 * Actualiza el perfil de un usuario (display_name, status_message, avatar_url)
 */
export async function updateUserProfile(
  userId: string,
  updates: { display_name?: string; status_message?: string; avatar_url?: string }
): Promise<SupabaseProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Sube una imagen de avatar al Storage de Supabase en el bucket 'avatars'.
 */
export async function uploadAvatarToStorage(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `${userId}/avatar_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Error al subir avatar a Supabase Storage: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

/**
 * Sube un archivo de audio/nota de voz al Storage de Supabase en 'chat-attachments'.
 */
export async function uploadAudioToStorage(audioBlob: Blob, userId: string): Promise<string> {
  const fileName = `${userId}/voice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.webm`;

  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(fileName, audioBlob, {
      contentType: audioBlob.type || "audio/webm",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Error al subir nota de voz: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("chat-attachments")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

/**
 * Envía un mensaje (texto, imagen, audio, video, youtube o IPTV con expiración opcional)
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: MessageMediaType = "text",
  mediaUrl?: string,
  burnSeconds?: number
) {
  await ensureProfileExists(senderId);
  const expiresAt = burnSeconds ? new Date(Date.now() + burnSeconds * 1000).toISOString() : null;

  // Si la base de datos tiene una restricción de comprobación CHECK antigua (text, image, audio),
  // se inserta con el tipo directo o se reintenta como 'text' guardando la URL en media_url/content.
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        type,
        media_url: mediaUrl || null,
        expires_at: expiresAt,
        is_burned: false,
        is_read: false,
        status: "sent"
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err: any) {
    // Si la restricción de tipo falla en la BD de Supabase del usuario
    if (err.message?.includes("messages_type_check") || err.code === "23514") {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: content || mediaUrl || "",
          type: "text",
          media_url: mediaUrl || null,
          expires_at: expiresAt,
          is_burned: false,
          is_read: false,
          status: "sent"
        })
        .select()
        .single();

      if (fallbackErr) throw fallbackErr;
      return fallbackData;
    }
    throw err;
  }
}

/**
 * Sube una imagen al Storage de Supabase en el bucket 'chat-attachments'.
 */
export async function uploadImageToStorage(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Error al subir imagen a Supabase Storage: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("chat-attachments")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

/**
 * Carga mensajes de una conversación, filtrando solo los creados en las últimas 5 horas y descartando los quemados o expirados.
 * Incluye la relación con profiles (sender_id).
 */
export async function getConversationMessages(conversationId: string): Promise<SupabaseMessage[]> {
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  let messagesData: any[] = [];

  // Intenta consulta con JOIN de profiles
  const { data, error } = await supabase
    .from("messages")
    .select("*, sender:profiles!sender_id(id, username, display_name, avatar_url, status_message)")
    .eq("conversation_id", conversationId)
    .gte("created_at", fiveHoursAgo)
    .order("created_at", { ascending: true });

  if (error) {
    // Si la sintaxis relacional directa falla, probar sin alias
    const { data: fallbackData } = await supabase
      .from("messages")
      .select("*, profiles(id, username, display_name, avatar_url, status_message)")
      .eq("conversation_id", conversationId)
      .gte("created_at", fiveHoursAgo)
      .order("created_at", { ascending: true });

    if (fallbackData) {
      messagesData = fallbackData.map((m: any) => ({
        ...m,
        sender: m.profiles || m.sender
      }));
    } else {
      const { data: simpleData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .gte("created_at", fiveHoursAgo)
        .order("created_at", { ascending: true });
      messagesData = simpleData || [];
    }
  } else {
    messagesData = data || [];
  }

  const now = new Date();

  // Filtrar o marcar mensajes que han expirado
  return messagesData.filter((msg: any) => {
    if (msg.is_burned) return false;
    if (msg.expires_at && new Date(msg.expires_at) < now) return false;
    return true;
  });
}

/**
 * Marca como leídos los mensajes de una conversación dirigidos al usuario actual.
 */
export async function markMessagesAsRead(conversationId: string, currentUserId: string): Promise<void> {
  if (!conversationId || !currentUserId) return;
  try {
    await supabase
      .from("messages")
      .update({ is_read: true, status: "read" })
      .eq("conversation_id", conversationId)
      .neq("sender_id", currentUserId)
      .eq("is_read", false);
  } catch (err) {
    console.warn("Aviso al marcar mensajes como leídos:", err);
  }
}

/**
 * Suscribe en tiempo real a los mensajes de una conversación (nuevos mensajes y actualizaciones de estado).
 */
export function subscribeToMessages(
  conversationId: string, 
  onNewMessage: (msg: SupabaseMessage) => void,
  onUpdateMessage?: (msg: SupabaseMessage) => void
) {
  const channel = supabase
    .channel(`messages_conv_${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onNewMessage(payload.new as SupabaseMessage);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (onUpdateMessage) {
          onUpdateMessage(payload.new as SupabaseMessage);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
