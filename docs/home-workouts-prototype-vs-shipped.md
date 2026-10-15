# Home workouts — prototype vs shipped

Canonical copy of the orchestrator gap analysis lives in the agent store as `home-workouts-prototype-vs-shipped.md`.

**Prototype:** Coach HTML mockup (dark full-bleed timer, title above clock, `#0B0B0C` / white / `#E10600`, mute-default audio, warn ≤3s, SlipL-A 43-step expansion, Editor A′ wireframe).

**Shipped:** `/workouts/[slug]` + `WorkoutTimer` — light utility countdown with Start/Pause/Next/Restart and a simple step list (migration `0081`).

## MUST to productize

1. Dark branded stage + expressive fonts  
2. Title above large clock; kind pill; progress  
3. Stage states prepare/work/rest/warn/done  
4. Restyle Start/Pause/Next/Restart  
5. Audio default muted + sticky unmute; begin/end; ≤3s warn beeps each second  
6. Hide empty cues  
7. Stay isolated from Events/People unless new DEC  
8. A11y basics (`aria-live`, mute pressed, focus)

## SHOULD

Cue/notes + optional theme; round/pass meta; step-list polish; mobile collapse decision.

## COULD / later

In-product Editor A′; access model; completion tracking; legal disclaimer.

## Open decisions

Beep each second (lean B); warn on title+clock (A); short block labels mobile (B); keep Prepare/Done (A); collapse step list mobile (B); mute text label (A).
