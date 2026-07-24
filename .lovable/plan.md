# Fix calendar tooltips (Day / Week / Month)

File: `src/routes/panou.sali.$id.calendar.tsx`

## 1. Single provider at the calendar root
- Remove the localized `<TooltipProvider>` inside the Month view (line 1002).
- Wrap the whole calendar container (around the view switch, line ~817) in one `<TooltipProvider delayDuration={150}>` so Day, Week, and Month all inherit it.

## 2. Day view (≈ lines 817–895)
- Wrap each existing entry `<button>` with `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent side="right" className="p-2"><EntryTooltipCard e={e!} /></TooltipContent></Tooltip>`.
- Keep the button's click behavior (opens details / block). Remove the redundant native `title` attributes on inner spans (recurrence badge) so we don't get double tooltips.
- Apply the same wrap to the "Blocat" row buttons — `EntryTooltipCard` already handles `entry_type === "blocat"`.

## 3. Week view (≈ lines 895–990)
- Same treatment: wrap each entry `<button>` (booking and blocat) with `Tooltip` / `TooltipTrigger asChild` / `TooltipContent side="top"` rendering `<EntryTooltipCard e={e!} />`.
- Remove inner `title=` attributes.

## 4. Month view (≈ lines 1015–1090) — unnest trigger from `<button>`
Nesting `<span tabIndex=0>` (TooltipTrigger) inside a day-cell `<button>` is invalid HTML and can break Radix pointer tracking. Restructure the day cell:
- Change the outer day cell from `<button type="button" onClick=…>` to a `<div>` container with the same styling.
- Put the day-number header inside a small clickable area (a `<button>` wrapping just the date number, or making the empty area of the cell clickable via a positioned overlay button behind the chips) that triggers the existing navigate-to-day/week behavior.
- Each chip becomes a `<Tooltip><TooltipTrigger asChild><span …>chip</span></TooltipTrigger><TooltipContent><EntryTooltipCard e={e} /></TooltipContent></Tooltip>` — no longer inside a button, so Radix hover works cleanly.

## 5. Verification
- Manual: hover a booking chip in each view — tooltip appears with renter/interval/duration/total/status. Hover a blocked slot — tooltip shows "Blocat" + interval + note.
- Clicking a Month cell (empty area or date number) still navigates to Day/Week as before. Clicking a chip does not double-fire.
- `tsgo` typecheck passes.

## Out of scope
- No changes to `EntryTooltipCard` content, business logic, RPCs, or booking data flow.
- No styling changes beyond what's required to unnest the Month trigger.
