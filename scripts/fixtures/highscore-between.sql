-- Disposable DB: an account created after migration belongs to the new cohort.
insert into auth.users values('65000000-0000-4000-8000-000000000004');
insert into lumen.profiles(user_id,nickname) values('65000000-0000-4000-8000-000000000004','New cohort');
