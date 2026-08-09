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

export interface SupabaseProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
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

export interface SupabaseMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: "text" | "image";
  media_url?: string;
  created_at: string;
  expires_at?: string; // Para mensajes temporales con autodestrucción
  is_burned?: boolean;
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
 * Busca usuarios por nombre de usuario, correo o nombre visible.
 */
export async function searchProfiles(searchTerm: string, currentUserId: string): Promise<SupabaseProfile[]> {
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
  return data || [];
}

/**
 * Crea una conversación privada entre dos usuarios.
 */
export async function createPrivateConversation(currentUserId: string, otherUserId: string): Promise<string> {
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

  if (error) throw error;

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
 * Envía un mensaje (texto o imagen con expiración temporal)
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: "text" | "image" = "text",
  mediaUrl?: string,
  burnSeconds?: number
) {
  const expiresAt = burnSeconds ? new Date(Date.now() + burnSeconds * 1000).toISOString() : null;

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
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Sube una imagen al Storage de Supabase en el bucket 'chat-attachments'.
 */
export async function uploadImageToStorage(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
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
 * Carga mensajes de una conversación, descartando los quemados o expirados.
 */
export async function getConversationMessages(conversationId: string): Promise<SupabaseMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return [];

  const now = new Date();

  // Filtrar o marcar mensajes que han expirado
  return (data || []).filter((msg) => {
    if (msg.is_burned) return false;
    if (msg.expires_at && new Date(msg.expires_at) < now) return false;
    return true;
  });
}

/**
 * Suscribe en tiempo real a los mensajes de una conversación.
 */
export function subscribeToMessages(conversationId: string, onNewMessage: (msg: SupabaseMessage) => void) {
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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
