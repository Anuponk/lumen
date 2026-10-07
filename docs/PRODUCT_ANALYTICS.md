# Product analytics contract

Issue #65 measures campaign lifetime and friction without logging cell-by-cell play.

## Identity and privacy
- `anonymous_id` is the existing stable random browser identifier used by `lumen_track_event`.
- Authenticated identity is resolved server-side where available.
- Product-attempt telemetry must not send email, name, nickname, free-form board content or other unnecessary personal data.
- QA events remain marked with `qa_mode`.

## Attempt vs run
`attempt_id` is the technical identity owned by the attempt engine. It survives reload and campaign/replay Reset. Social challenges remain one-shot.

A Reset creates a new **run** for product analysis. `run_index = reset_count + 1` distinguishes fresh runs without manufacturing a second technical attempt ID.

## Canonical attempt properties
Lifecycle events carry `attempt_id`, `attempt_mode`, `run_index`, `reset_count`, `active_seconds`, `quest_index`, `grid_size`, `constellation_index`, `constellation_name`, `progress_solved`, `quest_attempt_number`, `assistance_used`, `mistake_committed`, `qualifying`, `guided_enabled` and `auto_marking_enabled`.

Active duration comes from the attempt engine, not wall-clock tab time.

## Events
- `attempt_started`: first real board action.
- `attempt_run_started`: fresh campaign/replay run after Reset.
- `attempt_reset`: closes the current run and gives `next_run_index`.
- `attempt_completed`: successful solve.
- `attempt_abandoned`: explicit abandon.
- `hint_used`, `verify_used`, `guided_intervention`, `auto_marking_enabled`: assistance detail.

Legacy `puzzle_start`, `puzzle_complete` and challenge events remain for continuity.

## Query recipes
The examples assume the existing storage backing `lumen_track_event` exposes `event_name`, `puzzle_id`, `properties jsonb`, `created_at`, `anonymous_id` and nullable `user_id`.

### Median active solve time by quest
```sql
select puzzle_id,
 percentile_cont(0.5) within group (order by (properties->>'active_seconds')::numeric) as median_active_seconds,
 count(*) as completions
from lumen.analytics_events
where event_name='attempt_completed'
group by puzzle_id order by puzzle_id;
```

### Reset / abandon friction
```sql
select puzzle_id,
 count(*) filter (where event_name='attempt_reset') as resets,
 count(*) filter (where event_name='attempt_abandoned') as abandons,
 count(*) filter (where event_name='attempt_completed') as completions
from lumen.analytics_events
where event_name in ('attempt_reset','attempt_abandoned','attempt_completed')
group by puzzle_id order by puzzle_id;
```

### Assistance usage
```sql
select puzzle_id,
 count(*) filter (where event_name='hint_used') as hints,
 count(*) filter (where event_name='verify_used') as verifies,
 count(*) filter (where event_name='guided_intervention') as guided_interventions,
 count(*) filter (where event_name='auto_marking_enabled') as auto_marking_activations
from lumen.analytics_events
where event_name in ('hint_used','verify_used','guided_intervention','auto_marking_enabled')
group by puzzle_id order by puzzle_id;
```

### Attempts before success
```sql
select puzzle_id,
 percentile_cont(0.5) within group (order by (properties->>'quest_attempt_number')::numeric) as median_attempt_number,
 avg((properties->>'quest_attempt_number')::numeric) as avg_attempt_number
from lumen.analytics_events
where event_name='attempt_completed'
group by puzzle_id order by puzzle_id;
```

Difficulty work (#81) can later add a deterministic difficulty score to the same property contract without changing event names.


## Admin beta cockpit (#115)

The beta cockpit is an authenticated internal surface guarded by the `analytics_cockpit` capability. Browser code never receives a service-role credential. Aggregation and player drill-down use capability-checked RPCs.

### Activity definitions
- **Active player**: one stable anonymous browser identity with at least one non-QA analytics event in the selected period. When that identity later authenticates, admin aggregation maps it to the authenticated player key to reduce double counting.
- **New player**: first non-QA event is inside the selected period.
- **Returning player**: active in the selected period, with first event before it.
- **Session**: stable analytics session renewed after 30 minutes of inactivity; reloads inside that window remain one session.
- **Completion**: canonical `attempt_completed` or legacy `puzzle_complete`.
- **DAU/WAU**: distinct mapped player identities active today / last seven days.
- **Retention J+N**: browser identity has at least one non-QA event exactly N calendar days after first seen.

QA events are excluded by default.

### Privacy
The cockpit shows a short deterministic label for anonymous players rather than their raw UUID. It deliberately does not collect cell-by-cell telemetry. From #115 onward feedback no longer stores the board state: the useful diagnostic context is quest, active duration, hint count, app version and device/user-agent. Admin timeline strips sensitive/free-form identity fields from event properties.

### Backend
`lumen_admin_cockpit(days)` returns summary, daily activity, activation funnel, retention and quest friction as aggregated JSON. `lumen_admin_players(days)`, `lumen_admin_player_timeline(player_key, limit)` and `lumen_admin_feedback(days)` provide bounded drill-downs. All require an authenticated user with `analytics_cockpit`.

The analytics ingestion allow-list accepts canonical attempt/friction events and future campaign puzzle IDs rather than the historical 100-quest ceiling. Event and feedback indexes cover date, identity, event and puzzle filters used by the cockpit.


### Admin account directory (#112)
The cockpit can list created authentication accounts through `lumen_admin_accounts(limit)`. The RPC reads email and authentication timestamps directly from `auth.users` only after checking the authenticated caller has the `analytics_cockpit` capability. Email is not copied into `analytics_events`, is not part of player telemetry, and the RPC is revoked from public/anonymous roles.


### Shared Supabase auth isolation (#112)
Lumen shares the SoldeZen Supabase project but not application membership. `lumen.users` is the source of truth for authenticated accounts that actually used Lumen; the admin directory joins `auth.users` through that registry, so SoldeZen-only accounts are excluded. Existing membership is backfilled only from Lumen-owned profile, progress, or authenticated analytics data. Google sign-in initiated by Lumen uses the canonical production return URL `https://lumen-xi-seven.vercel.app/` at both sign-in entry points.
