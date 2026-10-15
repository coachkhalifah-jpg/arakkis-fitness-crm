# Engineering instructions — People profile collapsible IA (UAT-027)

**Status:** Implemented on branch `cursor/uat-027-people-profile-collapsible-ia-ee9a`  
**Surface:** System Admin `/admin/participants/[id]`

## Product intent

1. **Goals**, **Upcoming**, **History**, **Follow-up history**, and **Remove from people** are each collapsible/expandable in Arakkis admin (ops) UI format.
2. All of those sections **default to collapsed**.
3. **Remove from people** sits **under Manage / recovery link**, inside the **System Admin only** block.
4. The **System Admin only** block moves to the **bottom of the page**.

## Target page order (top → bottom)

1. Head + Participation snapshot (+ EDIT CONTACT above Active)
2. Goals (disclosure, default collapsed)
3. Upcoming (disclosure, default collapsed)
4. History (disclosure, default collapsed)
5. Follow-up history (disclosure, default collapsed)
6. System Admin only (bottom): recovery, then Remove from people (disclosure, default collapsed)

Reuse `DisclosureToggle` / `ops-venue-events-panel` patterns via `PeopleProfileDisclosure`.
