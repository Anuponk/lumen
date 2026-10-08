-- Progress must follow the dynamic campaign catalog.
-- The original schema capped cloud progress at quest 100, causing every
-- lumen_save_progress call for later quests to fail its table constraint.
alter table lumen.progress
  drop constraint if exists progress_puzzle_id_check;

alter table lumen.progress
  add constraint progress_puzzle_id_check
  check (puzzle_id >= 1);
