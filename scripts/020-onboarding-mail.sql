-- One welcome mail per account, ever
create unique index if not exists mail_messages_welcome_unique
  on public.mail_messages(target_user_id)
  where message_type = 'welcome';

-- One starter-kit mail per player per season
create unique index if not exists mail_messages_starter_kit_unique
  on public.mail_messages(target_user_id, season_id)
  where message_type = 'starter_kit';
