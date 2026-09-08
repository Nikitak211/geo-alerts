# Surface: Social Profile (Account)

<!-- impeccable:surface-brief -->

## Mode

Operate

## Job

Trainee identity hub: body vitals, weekly goal peek, gram-based daily meal logging with server-authoritative macros; account utilities stay secondary.

## Direction

Liquid Glass dark; Hebrew RTL-first. Meals block: day kcal bar + macro line, four meal slots, bottom sheet to search foods by name then weigh. Food rows: name at **inline-start**, kcal/100g|ml meta at **inline-end** (`dir=ltr` on numbers). Weigh step: large amount readout + **visible amount tiles** (half / serving / hints) + Custom field (no native spinner), 4-up macro preview with tooltips, lime primary CTA.

## Sketches (direction refs)

- `.impeccable/sketches/meals-sheet-search-rtl.png` — primary search sheet (ship toward this)
- `.impeccable/sketches/meals-sheet-grams-rtl.png` — weigh step
- `.impeccable/sketches/meals-profile-day-rtl.png` — Account meals day
- `.impeccable/sketches/meals-sheet-groups-rtl.png` — optional future: category groups / filters

## Primary targets

- `src/components/ProfileView.tsx`
- `src/components/MealFoodSheet.tsx`
- `src/components/AccountUtilities.tsx`
- `/api/me/profile`, `/api/me/meals`
