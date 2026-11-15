# Product analytics contract

## Reliable service activity and missing coverage — #708 correction

Baseline `d4d914b` displayed 0 players/quests while product collection had stopped
on 26 October. The primary cards now read `service_activity` appended to the
existing capability-protected `lumen_admin_cockpit` response. The private
`lumen_commands.service_activity` reader unions canonical/historical victory
receipts, requires Lumen membership and a current catalogue quest, and deduplicates
the same account/operation/quest across domains. It returns distinct accounts,
distinct quests, successful operations (including replays), and distinct
account/quest pairs marked `firstCompletion` by the server. Server receipt time
in UTC is not play time, browser acknowledgement, an authenticated session or
proof that every device is synchronised. Test accounts are included; no human
filter is invented for receipts. Summaries cover the complete selected window;
the drilldown lists at most 250 accounts and intersects the loaded directory.

Receipt metrics work without optional tracking. Product collection remains off;
the old primary player/session/DAU/WAU/start/completion cards and J1/J3/J7 display
unavailable instead of false zeroes/percentages. Historical quest events remain
explicitly qualified. There is no new tracking or consent purpose. Missing starts,
aids, abandonment, offline play dates and retention cannot be reconstructed.
Collection opt-in for future product events remains separate work.

The corrected historical summary preserves explicit event ownership, links a
guest only to an unambiguous human/non-QA owner, deduplicates paired completion
events by actor/quest/session/attempt/run, counts actual attempt starts rather
than grid openings, and computes WAU independently of the selected window.
First observation is per attributed actor, not per newly encountered browser;
it remains different from account creation. Directory readers use the same
qualified traffic; points are catalogue ordinals, never inferred numeric next
quests. Recent receipt evidence can advance an observed point, never a save.

Optional sessions renew after 30 minutes idle even in an open page. Future
permitted attempt events include `grid_revision`. Duration medians omit unknown
revisions and become unavailable when known revisions differ; valid samples and
the observed revision accompany the result. This is not a claim of difficulty
on the current grid. Tutorial completion stays unavailable.

Technical last-known outbox totals remain unchanged. Separate fresh pending and
critical counts require a signal within 15 minutes; alerts carry observation time
and freshness and are bounded to 20. Unresolved hydration is an incident history,
not proof of current blockage. Equivalent version spellings are aggregated.
Safe nonnegative integer diagnostic totals are retained above the daily budget.

Migration: `20261115162545_reliable_analytics_708.sql`, repeatable, functions and
two receipt-time indexes only. No player rows, receipts, progress, rewards,
wallets, entitlements, retention or consent preferences are written. Before
activation, the new cards explicitly say unavailable. Rollback restores prior
function definitions from the recorded pre-activation definitions; keep player
records intact. The indexes can remain. No new persisted personal data exists.

## Actionable journey and technical dashboards — #708

`ui/analytics-dashboard.js` projects the existing authorised responses into an
overview, a journey/quest analysis and a technical triage view. The initial
dashboard introduced no collector or writer; the correction above extends its
existing server reader. Product collection is
still disabled: journey/activation/activity charts describe recorded history,
not current complete player behaviour. Missing sources show unavailable, never
manufactured zeroes; failure of the optional product aggregate no longer hides
the independent technical response.

Quest signals compare distinct players with starts/finishes and event counts
for hints/resets. At least five observed starting players are needed for a
signal: finishes below 60% of starts, hints at least 80% of starts, or resets
at least as numerous as starts. These are review prompts, not causal difficulty
scores or per-attempt success/abandon rates. A smaller sample stays visible but
unqualified. Finishes exceeding starts are retained as different period
populations. Explicit abandon counts stay separate from interruption/absence.
Active median time is not the penalised official score; revision-qualified sample
counts are supplied by the corrected reader. Stable catalogue identity owns labels/grouping; inconsistent
IDs/ordinals and duplicate identities are excluded, not reassigned.

Journey filters use current catalogue adventure metadata, quest/constellation
search and a starting-player minimum; they survive same-owner refresh. The
overview can open the selected quest detail. Jalon bars are independent counts,
not an ordered conversion funnel; tutorial completion is not currently measured.
Unqualified legacy retention remains in a labelled closed disclosure. Raw
start/finish counts replace the misleading completion ratio in the legacy table.

Technical counts retain their actual units: affected/stalled/critical **players**,
not summed incidents or queues. Hydration uses at most 90 selected rolling days,
optional details at most seven, and outbox observations are current-known state
outside the period filter. Version/cause bars show occurrence volumes, not error
rates or proof of a release regression. Queue alerts do not expose an account
identity, so no player association is invented. Player drill-down uses only
fresh qualified pending/failure evidence from the existing per-player batch.

The single registered-player projection now reuses the already-loaded Lumen
accounts in addition to analytics recency, capped at 250 before metadata reads.
Account-response order selects this bounded population; matching recent event
metadata is reused and unmatched recent registered players fill remaining slots.
An account without optional events can therefore be investigated. Auth date is
never copied into activity, missing sessions/progression stay unknown, anonymous
rows stay excluded, and nickname/email join remains exact and admin-only.
No additional profile read or second directory is introduced.

Every dashboard action rechecks current scope and DOM attachment. Account/role
changes clear all three dashboard hosts along with existing sensitive content.
Existing sessions, private support, reviewed reports, version filters, catalogue
and mastery preview remain accessible. Onboarding impact: none; only admin
analysis/presentation changes, with no player rule or teaching milestone change.

## Unified administration — #708, B1 candidate

The existing cockpit shell now supplies five sections at `/admin/analytics`:
overview, players/sessions, journeys/quests, sync/incidents and support. The
Administration menu opens this same DOM/controller; there is no second list,
telemetry pipeline or source of player state. Existing RPCs, live capability
checks, consent and reader limits remain unchanged. Section and period are in
the URL; history, direct entry and reload use the same shell. Player/session/
incident deep-link parameters are not implemented in B1.

`src/ui/analytics-navigation.js` owns presentation/history only. Reads wait for
the existing authenticated `analytics_cockpit` capability. Account/capability
changes close the view and clear all sensitive hosts before fresh reads; existing
request guards reject late responses. Opening pauses the current attempt via
the normal pause path; closing leaves it paused for explicit resume. No navigation
state enters a game save. No new consent provider or collection is introduced.

This is B1 after the [lot A audit](https://github.com/Anuponk/lumen/pull/717).
QA/simulation controls stay in their existing Administration submenu and the
private support dossier stays in the selected player's sessions. The mastery
preview from #716 is now available in Support. Further tool integration is B2. Existing KPI definitions
and historical limitations remain pending B3; the navigation change does not
make legacy retention or identity mapping statistically reliable. Final parity,
retirement of the historical entry and production activation are not claimed.

Onboarding impact: only the privileged administrative destination changes; no
player rule, teaching milestone or gameplay destination changes.

## Administrative registered-player view

The recent-player directory shows registered identities only, by key/type,
without classifying nicknames. `Joueur XXXX` is an anonymous hash label and is
not evidence of QA. Existing server QA/traffic filters remain authoritative for
known test exclusions. View restriction does not rewrite analytics, delete
guests or change aggregate statistics; the heading states its registered scope.

## Stable quest reads (#522, candidate)

Lifecycle events carry `stable_quest_id` and `quest_ordinal`; their historical
`puzzle_id` remains the original numeric key plus one, or null for stable-only
quests. The admin quest metrics/timeline resolve current ordinals through the
server quest rules. Contradictory stable/numeric identities are not attributed
to a quest. The funnel uses visible teaching milestones. The directory's
**Point le plus avancé** uses the highest current catalogue ordinal observed
over the player's lifetime in quest opening/start/completion events, across
unambiguously linked devices. A later replay of an earlier quest cannot lower it.
This is an observed reached point, not a completed-quest count or the currently
open board; absent telemetry stays unknown. It never takes the maximum raw
historical numeric key. The compatible RPC field remains `current_players`;
the 1,000-player bound uses last qualifying activity independently of progression.
The reporting window still applies to friction/funnel; session timelines remain
chronological.

These read-only RPCs require a current `analytics_cockpit` capability, exclude
QA/non-human/unspecified traffic and cannot mutate campaign or reward data.
Guest-to-user linking requires one unambiguous authenticated owner for the
anonymous identity; an explicit event user always owns that event. Operational
day/row limits do not limit catalogue size. Feedback captures stable identity
in metadata and never substitutes a dormant quest's numeric ID.

Issue #65 measures campaign lifetime and friction without logging cell-by-cell play.

## Identity and privacy
- #316/#170 preparation: optional product analytics defaults to disabled. Every
  event/referral requires `environment.analyticsAllowed() === true`; a missing,
  denied or failing provider creates no analytics session/referral storage and
  sends no product event. The current UI supplies no provider. Historical data
  remains untouched, and required sync-health telemetry stays separate.
- `lumenAnonymousIdV1` still serves existing functional challenge, feedback,
  notification and recovery paths. It is not consent. The mixed child/adult
  launch still requires its minimization and parental-flow review; see
  [privacy audit](PRIVACY_AND_LEGAL_AUDIT.md).
- `anonymous_id` is the existing stable random browser identifier used by `lumen_track_event`.
- Authenticated identity is resolved server-side where available.
- Product-attempt telemetry must not send email, name, nickname, free-form board content or other unnecessary personal data.
- QA events remain marked with `qa_mode`.

## Attempt vs run
`attempt_id` is the technical identity owned by the attempt engine. It survives reload and campaign/replay Reset. Social challenges remain one-shot.

A Reset creates a new **run** for product analysis. `run_index = reset_count + 1` distinguishes fresh runs without manufacturing a second technical attempt ID.

## Canonical attempt properties
Lifecycle events carry `attempt_id`, `attempt_mode`, `run_index`, `reset_count`, `active_seconds`, `quest_index`, `grid_size`, `constellation_index`, `constellation_name`, `progress_solved`, `quest_attempt_number`, `assistance_used`, `mistake_committed`, `qualifying`, `guided_enabled` and `auto_marking_enabled`.

Quest identity (#522): lifecycle events and `puzzle_start` additionally carry
`stable_quest_id`, `quest_ordinal`, `pack_id`, `constellation_id` from the active
published quest. Numeric `puzzle_id` and zero-based `quest_index` retain their
historical storage meaning; both are null for quests without a numeric key,
never borrowed from the dormant numeric frontier. `quest_attempt_number` is null
for these quests because the current stable store has no authoritative counter.
Do not infer one from unrelated historical performance. `progress_solved` counts
actual canonical completions, and constellation metadata follows the active
stable identity. `puzzle_start` is emitted after attempt creation/restoration,
deduplicated by stable quest ID; its old fixed twenty-quest `sector` grouping is
replaced by the catalogue's explicit pack/constellation identities. Historical
rows and the generic transport API are not rewritten.
Reports grouped only by historical `puzzle_id` cannot distinguish stable-only
quests; use `stable_quest_id`/`quest_ordinal` when extending those reports. This
client correction does not claim that every existing SQL cockpit aggregate has
already migrated to the new grouping.

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

Recent player cards use labelled/symbolised green, amber, red and grey badges
for recent observed idle queues, pending work, reported problems and unknown/old
signals. This is not complete-device sync confirmation. Signals older than the
15-minute display freshness window (including the oldest device observation)
are grey and remain inspectable, with all original dates, under collapsed
“Détails de synchronisation”. Filters use the same qualified badge state. No
new data collection or authority is inferred from Auth/receipt timestamps.
The cockpit can list created authentication accounts through `lumen_admin_accounts(limit)`. The RPC reads email and authentication timestamps directly from `auth.users` only after checking the authenticated caller has the `analytics_cockpit` capability. Email is not copied into `analytics_events`, is not part of player telemetry, and the RPC is revoked from public/anonymous roles.

The recent registered-player list joins this already-loaded bounded account
response by exact user identity. It shows the email when the trimmed nickname is
empty and searches both fields regardless of which is displayed (case/accent and
surrounding-whitespace insensitive). Missing/unavailable account metadata keeps
the prior label; it never borrows another account's email. All cockpit sections
can be collapsed independently with native headings, without removing loaded
content or filter values. No RPC, schema, collection or aggregate changes.


### Shared Supabase auth isolation (#112)
Lumen shares the SoldeZen Supabase project but not application membership. `lumen.users` is the source of truth for authenticated accounts that actually used Lumen; the admin directory joins `auth.users` through that registry, so SoldeZen-only accounts are excluded. Existing membership is backfilled only from Lumen-owned profile, progress, or authenticated analytics data. Google sign-in initiated by Lumen uses the canonical production return URL `https://lumen-xi-seven.vercel.app/` at both sign-in entry points.
