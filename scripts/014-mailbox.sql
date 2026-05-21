-- ============================================================
-- Migration 014: Player mailbox system
-- Tables: mail_messages, mail_reads, mail_attachments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mail_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES public.profiles(id),
  subject        text NOT NULL,
  body           text NOT NULL,
  target         text NOT NULL DEFAULT 'all',  -- 'all' | 'user'
  target_user_id uuid REFERENCES public.profiles(id),
  expires_at     timestamptz,
  is_published   boolean NOT NULL DEFAULT false,
  published_at   timestamptz
);

CREATE TABLE IF NOT EXISTS public.mail_reads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at    timestamptz,
  claimed_at timestamptz,
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.mail_attachments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES public.items(id),
  quantity   integer NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);

CREATE INDEX IF NOT EXISTS idx_mail_reads_user ON public.mail_reads(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_mail_messages_published ON public.mail_messages(is_published, created_at);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.mail_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_reads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;

-- Players read published messages targeting them
CREATE POLICY "players_read_own_mail" ON public.mail_messages
  FOR SELECT USING (
    is_published = true AND
    (target = 'all' OR target_user_id = auth.uid())
  );

-- Admins can insert
CREATE POLICY "admins_send_mail" ON public.mail_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Players manage their own read rows
CREATE POLICY "players_manage_reads" ON public.mail_reads
  FOR ALL USING (user_id = auth.uid());

-- Players read attachments for messages they can access
CREATE POLICY "players_read_attachments" ON public.mail_attachments
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM public.mail_messages
      WHERE is_published = true
        AND (target = 'all' OR target_user_id = auth.uid())
    )
  );
