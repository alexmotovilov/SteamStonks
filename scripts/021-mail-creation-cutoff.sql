-- ============================================================
-- Migration 021: Broadcast mail creation cutoff
-- New accounts should not inherit broadcast ("all") announcements
-- that were sent before the account existed. User-targeted mail is
-- always created post-signup, so it keeps no creation cutoff.
-- Mirrors the query filter in mailbox/page.tsx + mailbox-indicator.tsx.
-- ============================================================

-- Players read published messages targeting them, plus broadcasts sent
-- after their account was created.
DROP POLICY IF EXISTS "players_read_own_mail" ON public.mail_messages;
CREATE POLICY "players_read_own_mail" ON public.mail_messages
  FOR SELECT USING (
    is_published = true AND (
      target_user_id = auth.uid()
      OR (
        target = 'all'
        AND created_at >= (SELECT created_at FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- Attachments follow the same visibility rule as their parent message.
DROP POLICY IF EXISTS "players_read_attachments" ON public.mail_attachments;
CREATE POLICY "players_read_attachments" ON public.mail_attachments
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM public.mail_messages
      WHERE is_published = true
        AND (
          target_user_id = auth.uid()
          OR (
            target = 'all'
            AND created_at >= (SELECT created_at FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );
