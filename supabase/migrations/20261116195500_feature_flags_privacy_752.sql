-- #752 fix: lumen_commands.feature_flags (created by 20261116090000_pause_daily_light_streak_752)
-- holds no player data but was missing from the privacy inventory, so
-- lumen_privacy.review_erasure (and therefore erase_account) raised
-- LUMEN_ERASURE_SCHEMA_REVIEW_REQUIRED. Classify it as retain-rule. Idempotent.
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null
  and to_regprocedure('lumen_privacy.policy_before_feature_flags()') is null then
  alter function lumen_privacy.policy() rename to policy_before_feature_flags;
 end if;
 if to_regprocedure('lumen_privacy.policy_before_feature_flags()') is not null then
  execute $f$create or replace function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_feature_flags()
    union all values
     ('lumen_commands','feature_flags',null,null,null,'retain-rule')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_feature_flags() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;
