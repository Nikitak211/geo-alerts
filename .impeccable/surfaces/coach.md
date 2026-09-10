# Surface: Coach dashboard

<!-- impeccable:surface-brief -->

## Mode

Operate

## Job

Trainers and gym admins scan the roster, set weekly train-day goals, review trainee adherence, vitals, and meal totals — without leaving the trainee app shell.

## Direction

Dense Operate glass lists + trainee detail. Lime rarity for primary CTAs only. RTL-first Hebrew labels.

Desktop (`≥900px`) is a persistent master-detail: roster rail at inline-start, trainee workspace filling the rest. Empty pane uses existing `coachSelectTrainee` copy. Phone stays stacked: card opens the schedule sheet; ⋮ opens the profile. Stats chips are chrome above the split (12px gap). Selected roster state stays inside the card (inset lime, no outer bloom). ⋮ must not change roster chrome height.

## Primary targets

- `src/coach/CoachView/CoachView.tsx`
- `src/coach/RosterList/`
- `src/coach/TraineeDetail/`
- `src/coach/TraineeScheduleSheet/`
- `/api/coach/*`
