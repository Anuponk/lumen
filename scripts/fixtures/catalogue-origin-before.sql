-- Isolated rows created before the additive migration, never player data.
insert into auth.users values('47000000-0000-0000-0000-000000000001'),('47000000-0000-0000-0000-000000000002');
insert into lumen.profile_snapshots(user_id,payload) values
 ('47000000-0000-0000-0000-000000000001','{"solved":{},"badges":{},"xp":0}'),
 ('47000000-0000-0000-0000-000000000002','{"solved":{"0":1},"badges":{"kept":1},"xp":10}');
