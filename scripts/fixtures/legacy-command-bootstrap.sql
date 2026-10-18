-- Disposable PostgreSQL bootstrap only, NEVER run against Supabase/player data.
-- The daily and mirror RPCs below use the existing production signatures.
create table lumen.progress(user_id uuid not null references auth.users(id),puzzle_id integer not null,
 completed_at timestamptz not null default now(),duration_seconds integer,hints_used integer not null default 0,primary key(user_id,puzzle_id));
create table lumen.daily_progress(user_id uuid not null references auth.users(id),play_date date not null,puzzle_id integer not null,
 completed_at timestamptz not null default now(),primary key(user_id,play_date));
create function public.lumen_save_progress(p_puzzle_id integer,p_duration_seconds integer default null,p_hints_used integer default 0)
returns void language sql set search_path='' as $$
 insert into lumen.progress(user_id,puzzle_id,duration_seconds,hints_used)
 values(auth.uid(),p_puzzle_id,p_duration_seconds,greatest(coalesce(p_hints_used,0),0))
 on conflict(user_id,puzzle_id) do update set
 duration_seconds=case when lumen.progress.duration_seconds is null then excluded.duration_seconds when excluded.duration_seconds is null then lumen.progress.duration_seconds else least(lumen.progress.duration_seconds,excluded.duration_seconds) end,
 hints_used=least(lumen.progress.hints_used,excluded.hints_used),completed_at=least(lumen.progress.completed_at,excluded.completed_at);
$$;
