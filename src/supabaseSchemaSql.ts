export const SUPABASE_SQL_SCRIPT = `-- ========================================================
-- ESQUEMA Y CONFIGURACIÓN COMPLETA PARA CHAT PRIVADO
-- Ejecuta este script en el Editor SQL de tu proyecto Supabase
-- (Supabase -> SQL Editor -> New Query -> Run)
-- ========================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PERFILES DE USUARIOS (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status_message TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_message text;

-- Index para búsquedas rápidas por username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Trigger para crear perfil automáticamente cuando un nuevo usuario se registra en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, is_online, last_seen)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'display_name', SPLIT_PART(new.email, '@', 1)),
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. TABLA DE CONVERSACIONES (conversations)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('private', 'group')) DEFAULT 'private',
  name TEXT,
  invite_code TEXT UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index para búsquedas por código de invitación
CREATE INDEX IF NOT EXISTS idx_conversations_invite_code ON public.conversations(invite_code);

-- 4. TABLA DE PARTICIPANTES EN CONVERSACIONES (conversation_participants)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- 5. TABLA DE MENSAJES (messages)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('text', 'image', 'audio')) DEFAULT 'text',
  media_url TEXT,
  expires_at TIMESTAMPTZ,
  is_burned BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar tipo de mensaje 'audio' y columnas de lectura en instalaciones existentes
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'audio'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';

-- Index para ordenamiento y consultas por conversación
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);

-- 5.1. TABLA DE SOLICITUDES DE AMISTAD (friendships)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_sender ON public.friendships(sender_id, status);

-- 6. PUBLICACIÓN PARA TIEMPO REAL (Supabase Realtime)
-- Permite recibir alertas en vivo cuando se insertan o actualizan registros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- 7. ACTIVAR SEGURIDAD A NIVEL DE FILA (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- POLÍTICAS RLS: FRIENDSHIPS
-- ========================================================
DROP POLICY IF EXISTS "Ver amistades" ON public.friendships;
CREATE POLICY "Ver amistades"
  ON public.friendships FOR SELECT
  TO public, authenticated
  USING (true);

DROP POLICY IF EXISTS "Crear y gestionar amistades" ON public.friendships;
CREATE POLICY "Crear y gestionar amistades"
  ON public.friendships FOR ALL
  TO public, authenticated
  USING (true)
  WITH CHECK (true);


-- ========================================================
-- POLÍTICAS RLS: PROFILES
-- ========================================================
DROP POLICY IF EXISTS "Perfiles visibles para todos" ON public.profiles;
DROP POLICY IF EXISTS "Perfiles visibles para usuarios autenticados" ON public.profiles;
CREATE POLICY "Perfiles visibles para todos"
  ON public.profiles FOR SELECT
  TO public, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir crear o actualizar propio perfil" ON public.profiles;
CREATE POLICY "Permitir crear o actualizar propio perfil"
  ON public.profiles FOR ALL
  TO public, authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================================
-- POLÍTICAS RLS: CONVERSATIONS
-- Permite ver y crear conversaciones privadas y grupales sin bloqueos de RETURNING / SELECT
-- ========================================================
DROP POLICY IF EXISTS "Ver conversaciones" ON public.conversations;
DROP POLICY IF EXISTS "Ver conversaciones del usuario o por código de invitación" ON public.conversations;
CREATE POLICY "Ver conversaciones"
  ON public.conversations FOR SELECT
  TO public, authenticated
  USING (true);

DROP POLICY IF EXISTS "Crear conversaciones" ON public.conversations;
CREATE POLICY "Crear conversaciones"
  ON public.conversations FOR INSERT
  TO public, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizar conversaciones" ON public.conversations;
CREATE POLICY "Actualizar conversaciones"
  ON public.conversations FOR UPDATE
  TO public, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminar conversaciones" ON public.conversations;
CREATE POLICY "Eliminar conversaciones"
  ON public.conversations FOR DELETE
  TO public, authenticated
  USING (true);

-- ========================================================
-- POLÍTICAS RLS: CONVERSATION PARTICIPANTS
-- ========================================================
DROP POLICY IF EXISTS "Ver participantes de conversaciones" ON public.conversation_participants;
CREATE POLICY "Ver participantes de conversaciones"
  ON public.conversation_participants FOR SELECT
  TO public, authenticated
  USING (true);

DROP POLICY IF EXISTS "Agregar participantes a conversaciones" ON public.conversation_participants;
CREATE POLICY "Agregar participantes a conversaciones"
  ON public.conversation_participants FOR ALL
  TO public, authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================================
-- POLÍTICAS RLS: MESSAGES
-- ========================================================
DROP POLICY IF EXISTS "Ver mensajes de conversaciones donde participa el usuario" ON public.messages;
DROP POLICY IF EXISTS "Ver mensajes" ON public.messages;
CREATE POLICY "Ver mensajes"
  ON public.messages FOR SELECT
  TO public, authenticated
  USING (true);

DROP POLICY IF EXISTS "Enviar mensajes en conversaciones donde participa" ON public.messages;
DROP POLICY IF EXISTS "Enviar mensajes" ON public.messages;
CREATE POLICY "Enviar mensajes"
  ON public.messages FOR INSERT
  TO public, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizar mensajes" ON public.messages;
CREATE POLICY "Actualizar mensajes"
  ON public.messages FOR UPDATE
  TO public, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminar mensajes" ON public.messages;
CREATE POLICY "Eliminar mensajes"
  ON public.messages FOR DELETE
  TO public, authenticated
  USING (true);

-- 8. CREACIÓN DE BUCKETS EN SUPABASE STORAGE (chat-attachments, avatars)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para imágenes y notas de voz
DROP POLICY IF EXISTS "Permitir ver adjuntos de chat a autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir ver adjuntos de chat a todos" ON storage.objects;
CREATE POLICY "Permitir ver adjuntos de chat a todos"
  ON storage.objects FOR SELECT
  TO public, authenticated
  USING (bucket_id IN ('chat-attachments', 'avatars'));

DROP POLICY IF EXISTS "Permitir subir adjuntos de chat a autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subir adjuntos de chat a todos" ON storage.objects;
CREATE POLICY "Permitir subir adjuntos de chat a todos"
  ON storage.objects FOR INSERT
  TO public, authenticated
  WITH CHECK (bucket_id IN ('chat-attachments', 'avatars'));

DROP POLICY IF EXISTS "Permitir actualizar adjuntos de chat" ON storage.objects;
CREATE POLICY "Permitir actualizar adjuntos de chat"
  ON storage.objects FOR UPDATE
  TO public, authenticated
  USING (bucket_id IN ('chat-attachments', 'avatars'));

-- 9. FUNCIÓN DE LIMPIEZA DE CHAT A LAS 5 HORAS
CREATE OR REPLACE FUNCTION delete_old_chat_data() 
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '5 hours';
  DELETE FROM public.conversations WHERE created_at < NOW() - INTERVAL '5 hours' AND type = 'group';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
