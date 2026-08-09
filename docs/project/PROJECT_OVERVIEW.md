# Arakkis project overview

## Purpose

Arakkis is a lightweight, multi-organization fitness-event booking and operations system. It connects public event registration with administrator-managed events, rosters, attendance, participant history, and manual follow-up.

## Users and journeys

- Participants browse eligible public events, select one or more dates, submit acknowledgments, register without an account, and receive confirmation/calendar links.
- Host Admins operate assigned organizations and events: rosters, registrations, walk-ins, check-in, attendance, and approved scoped Venue operations.
- System Admins manage Organizations, global Venues, Events, publishing, invitations, participants, attendance exceptions, CRM/follow-up, and design assets.

The primary operational journey is: create Event → validate and publish → participant registers → authorized admin operates the roster → check in and finalize attendance → derive participant indicators → create and complete manual follow-up.

## MVP boundary

Included: multi-organization Events, Organizations, Venues, public multi-date registration, attendance, participant CRM, manual follow-up, cancellation workflows, optional manual WhatsApp invitation workflows, Auth/RLS authorization, audit history, and legal controls.

Excluded unless a new approved decision changes scope: payments, memberships, participant accounts, automated SMS/WhatsApp, automated waitlists, QR check-in as a participant workflow, medical records, native mobile apps, and advanced marketing automation.

## Pilot objective

Validate the complete synthetic local pilot with clear organization scope, safe public registration, reliable attendance/follow-up operations, auditable mutations, and a repeatable handoff to owner-controlled staging and production environments.

## Technology

Next.js App Router, TypeScript strict mode, React, Tailwind/shadcn-style UI primitives, Supabase Auth/Postgres/RLS/Storage, ordered SQL migrations, Vitest, Testing Library, Playwright, Docker, Mailpit, pnpm, and Vercel as the documented hosting target.

## Current validated milestone

The validated J5 Event workflow baseline is commit `28b63d68b58a0a310e1811d6b29e88da745790af` on branch `codex/mvp-free-tier-deployment`, backed up at the private GitHub repository `coachkhalifah-jpg/arakkis-fitness-crm`. It includes atomic/idempotent Event creation, Event image replacement, Storage cleanup, Admin Workspace navigation/authorization corrections, focused tests, and local QA evidence. Hosted deployment and legal approval remain incomplete.
