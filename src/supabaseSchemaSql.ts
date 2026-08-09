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
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  type TEXT CHECK (type IN ('text', 'image')) DEFAULT 'text',
  media_url TEXT,
  expires_at TIMESTAMPTZ,
  is_burned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para ordenamiento y consultas por conversación
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);

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

-- POLÍTICAS RLS: PROFILES
DROP POLICY IF EXISTS "Perfiles visibles para usuarios autenticados" ON public.profiles;
CREATE POLICY "Perfiles visibles para usuarios autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir crear o actualizar propio perfil" ON public.profiles;
CREATE POLICY "Permitir crear o actualizar propio perfil"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- POLÍTICAS RLS: CONVERSATIONS
DROP POLICY IF EXISTS "Ver conversaciones del usuario o por código de invitación" ON public.conversations;
CREATE POLICY "Ver conversaciones del usuario o por código de invitación"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
    )
    OR invite_code IS NOT NULL
  );

DROP POLICY IF EXISTS "Crear conversaciones" ON public.conversations;
CREATE POLICY "Crear conversaciones"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- POLÍTICAS RLS: CONVERSATION PARTICIPANTS
DROP POLICY IF EXISTS "Ver participantes de conversaciones" ON public.conversation_participants;
CREATE POLICY "Ver participantes de conversaciones"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Agregar participantes a conversaciones" ON public.conversation_participants;
CREATE POLICY "Agregar participantes a conversaciones"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- POLÍTICAS RLS: MESSAGES
DROP POLICY IF EXISTS "Ver mensajes de conversaciones donde participa el usuario" ON public.messages;
CREATE POLICY "Ver mensajes de conversaciones donde participa el usuario"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Enviar mensajes en conversaciones donde participa" ON public.messages;
CREATE POLICY "Enviar mensajes en conversaciones donde participa"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

-- 8. CREACIÓN DEL BUCKET EN SUPABASE STORAGE (chat-attachments)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para imágenes
DROP POLICY IF EXISTS "Permitir ver adjuntos de chat a autenticados" ON storage.objects;
CREATE POLICY "Permitir ver adjuntos de chat a autenticados"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Permitir subir adjuntos de chat a autenticados" ON storage.objects;
CREATE POLICY "Permitir subir adjuntos de chat a autenticados"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');
`;
