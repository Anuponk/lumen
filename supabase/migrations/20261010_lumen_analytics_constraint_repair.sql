-- Repair deployed analytics table constraints to match lumen_track_event RPC.
-- Existing analytics rows are preserved.
alter table lumen.analytics_events drop constraint if exists analytics_events_puzzle_id_check;
alter table lumen.analytics_events add constraint analytics_events_puzzle_id_check check (puzzle_id between 1 and 10000);
alter table lumen.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table lumen.analytics_events add constraint analytics_events_event_name_check check (event_name = any(array[
 'session_start','app_opened','puzzle_start','puzzle_complete','tutorial_complete',
 'attempt_started','attempt_run_started','attempt_reset','attempt_completed','attempt_abandoned',
 'hint_used','verify_used','guided_intervention','auto_marking_enabled',
 'referral_visit','share_result','pwa_install_offer','pwa_install_choice','pwa_install_later','pwa_installed',
 'push_offer','push_choice','campaign_completed','account_signin_success','account_signin_failure','feedback_submitted'
]));
