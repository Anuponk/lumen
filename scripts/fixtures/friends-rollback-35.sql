-- #35 rollback rehearsal (PR #893 procedure, step 4) on the migrated schema.
-- Disposable fixture only: everything below is rolled back.
begin;
drop trigger if exists lumen_social_forget_profile on lumen.profiles;
drop function if exists public.lumen_friend_search(text),public.lumen_friend_request(text),public.lumen_friend_respond(text,boolean),
 public.lumen_friend_remove(text),public.lumen_friend_list(),public.lumen_challenge_send_to_friend(uuid,text),public.lumen_challenge_inbox(),
 lumen.social_caller(),lumen.social_player(text),lumen.social_forget_profile();
drop function lumen_privacy.policy();
alter function lumen_privacy.policy_before_social_friends() rename to policy;
revoke all on function lumen_privacy.policy() from public,anon,authenticated,service_role;
drop table if exists lumen.social_challenge_invites,lumen.social_friend_edges;
do $$
begin
 assert to_regclass('lumen.social_friend_edges') is null and to_regclass('lumen.social_challenge_invites') is null,'tables removed';
 assert to_regprocedure('lumen_privacy.policy_before_social_friends()') is null,'policy chain restored';
 assert not exists(select 1 from lumen_privacy.policy() where rel in ('social_friend_edges','social_challenge_invites')),'no stale policy rows';
 assert lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[])->>'scope'='Lumen only','erasure review still passes';
 assert to_regprocedure('public.lumen_create_qualifying_challenge(text,text,integer,text,integer,integer,boolean,boolean,boolean,boolean,boolean,boolean)') is not null,'#892 untouched';
end $$;
rollback;
