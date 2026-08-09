# UAT process

## Method

Test complete journeys with synthetic data, not isolated buttons. Record role, route, viewport, environment, preconditions, steps, expected result, actual result, timestamp, and sanitized evidence. Include success, validation failure, direct-route, cross-Organization, manipulated-request, mobile, keyboard, focus, accessibility, and refresh/retry paths where relevant.

## Issue IDs and classifications

Use `ARAKKIS-<TYPE>-<number>` with one classification: `BUG`, `REQ`, `UX`, `UI`, `FRICTION`, `A11Y`, `COPY`, `SEC`, `DATA`, `TEST`, or `QUESTION`.

## Evidence requirements

Capture sanitized screenshots or recordings only when needed, plus route/role and reproducible steps. Never include credentials, tokens, service keys, personal data, or generated demo credential files. For data/security findings include the expected scope, actual scope, database/RLS or server evidence, and whether the result is reproducible after reset.

## Acceptance and retest

An item passes only when its approved acceptance criteria pass at the intended boundary and no protected data leaks. A fix requires targeted retest plus relevant regression. Product Owner accepts requirement/UX decisions; Engineering verifies implementation; Independent QA verifies the evidence; release owner signs off only after legal, backup, authorization, and deployment gates are complete.
