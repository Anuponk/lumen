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
