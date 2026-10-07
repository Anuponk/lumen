-- Issue #150 follow-up: feedback must support the dynamic quest catalogue.
-- The original table constraint still capped puzzle_id at 100, so feedback
-- from quests 101+ reached the RPC but failed on insert.

alter table lumen.feedback
  drop constraint if exists feedback_puzzle_id_check;

alter table lumen.feedback
  add constraint feedback_puzzle_id_check
  check (puzzle_id is null or puzzle_id >= 1);
