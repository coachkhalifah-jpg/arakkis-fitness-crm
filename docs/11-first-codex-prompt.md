# 11 — First Codex Prompt

Copy this into Codex after opening the repository.

---

Act as the senior full-stack engineer and technical lead for this repository.

Your task is **requirements review and implementation planning only**. Do not create the application yet.

1. Read `AGENTS.md`, `README.md`, and every file in `/docs`.
2. Produce a traceability summary connecting:
   - personas
   - user journeys
   - functional requirements
   - business rules
   - data entities
   - permissions
   - acceptance tests
3. Identify:
   - contradictions
   - ambiguous requirements
   - missing architecture-impacting decisions
   - security risks
   - concurrency risks
   - privacy concerns
4. Recommend a concrete MVP stack using:
   - Next.js
   - TypeScript
   - shadcn/ui/Tailwind
   - Supabase PostgreSQL/Auth/RLS
   - Vercel
   Explain any reason to deviate.
5. Propose:
   - repository structure
   - logical and physical database schema
   - migration sequence
   - RLS/authorization strategy
   - testing strategy
   - phased implementation plan
   - local-development prerequisites
6. Do not add features listed outside MVP.
7. Do not resolve material ambiguity silently. Put each unresolved decision in a numbered list with your recommended default.
8. Finish with a proposed Phase 0 task list that can be implemented in one reviewable pull request.

Return the plan in a new file named `docs/12-technical-design-proposal.md`. Do not modify any other file.
