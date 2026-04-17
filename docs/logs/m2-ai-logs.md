# Milestone 1 AI Logs

## Summary

These are the conversations that were made with AI for consultation,
implementation and quality review during the second milestone of the project.

# Entries

### Entry 1 — April 17, 2026
**Tool:** Claude - planned all Tenant Portal Zod schemas as a Claude Code-ready specification.

**Prompt:** Plan production-ready Zod schemas for the Tenant Portal (Lease, Payment, two submission forms, payment history, tenant account with read-only state). Specify every field, type, nullability, and refinement. Leave nothing for Claude Code to decide.

**Output quality:** No corrections needed. All five files planned in correct dependency order, `.nullable()` vs `.optional()` correctly applied, File refinement included size + MIME constraints, read-only account state handled per spec.

**Time saved:** ~45–60 minutes reduced to ~5 minutes.

**Lessons learned:** Supplying both the portal spec and CLAUDE.md in one prompt meant conventions were respected without reminders. "Leave nothing to infer" was the key constraint. Next time: include the expected HTTP response shape so field mismatches can be caught at planning stage.

---

### Entry 2

**Date:** 17/04/2026

**Tool used:** Claude — asked what to build while teammate refactors the landing page and landlord portal.

**Prompt / input:**
> My teammate is doing a refactoring of what we currently have. What should I do while he is refactoring?

**Output quality:** Worked first try. Produced a prioritized list: Tenant Portal, Zustand, TanStack Query, Zod schemas, Playwright, `.cursorrules`. Clear reasoning for each.

**Time saved estimate:** 20 minutes — would have spent this figuring out how to split work without conflicts.

**Lessons learned:** Good use case for Claude as a project coordinator. The output was directly actionable.

---

### Entry 3

**Date:** 17/04/2026

**Tool used:** Claude — asked about `.claudeignore` and whether to give Claude Code access to the full repo or just the frontend.

**Prompt / input:**
> Can we talk about the .claudeignore file? I want to make one for the frontend. Also should I give Claude Code access to my entire repo or just the frontend?

**Output quality:** Corrected a misconception first try — `.claudeignore` doesn't exist. Gave clear reasoning for full repo access with Claude Code opened from the frontend directory.

**Time saved estimate:** 15 minutes — would have wasted time looking for a non-existent feature.

**Lessons learned:** Good for correcting assumptions before acting on them.

---

### Entry 4

**Date:** 17/04/2026

**Tool used:** Claude — asked how the `/app` directory should be structured.

**Prompt / input:**
> How should my /app structure look like?

**Output quality:** Worked first try. Produced the full App Router structure with route groups `(landlord)`, `(tenant)`, `(auth)`, dynamic segments, and explained the reasoning behind each decision.

**Time saved estimate:** 30 minutes — Next.js App Router conventions are non-obvious for a beginner.

**Lessons learned:** Explaining *why* (route groups, dynamic segments) alongside the structure made it immediately usable.

---

### Entry 5

**Date:** 17/04/2026

**Tool used:** Claude — asked whether to do Zod/Zustand/TanStack first or go straight to building the Tenant Portal UI.

**Prompt / input:**
> Would it be better to do the Zod schemas first then Zustand and TanStack then the tenant portal? Or can we make the tenant portal without them?

**Output quality:** Worked first try. Clear answer with honest tradeoff — skipping saves 2 hours now but costs 4 hours of rework Friday.

**Time saved estimate:** 10 minutes of deliberation avoided.

**Lessons learned:** Claude is useful for resolving order-of-operations decisions quickly.

---

### Entry 6

**Date:** 17/04/2026

**Tool used:** Claude — checked prerequisites before planning: Tailwind, packages, fonts, folder structure.

**Prompt / input:**
> Yes but what do I need before planning and executing?

**Output quality:** Worked first try. Produced a checklist of 4 things to verify and the exact command to send Opus.

**Time saved estimate:** 20 minutes — would have started planning with missing dependencies and hit errors mid-execution.

**Lessons learned:** Always verify environment before planning. Claude as a pre-flight checklist works well.

---

### Entry 7

**Date:** 17/04/2026

**Tool used:** Claude — diagnosed broken environment: wrong packages, wrong fonts, wrong CSS tokens.

**Prompt / input:**
> [pasted npm run dev output, package.json, and globals.css]

**Output quality:** Worked first try. Identified 3 issues: deprecated `@next/font`, missing dependencies, wrong design system tokens in CSS. Produced exact fix for each.

**Time saved estimate:** 45 minutes — diagnosing package issues and CSS config manually would have taken a while.

**Lessons learned:** Pasting raw output (terminal + config files) gives Claude enough context to diagnose accurately.

---

### Entry 8

**Date:** 17/04/2026

**Tool used:** Claude — fixed CSS `@import` order error after following previous advice.

**Prompt / input:**
> I'm getting a CSS parsing error on line 235 — @import rules must precede all rules.

**Output quality:** Claude's fault — previous response gave the wrong import order. Fixed immediately, one-line correction. Worked after fix.

**Time saved estimate:** 5 minutes.

**Lessons learned:** Claude made an error here. Always run the dev server immediately after CSS changes to catch ordering issues fast.

---

### Entry 9

**Date:** 17/04/2026

**Tool used:** Claude — asked whether to fix a high severity npm vulnerability or proceed to planning.

**Prompt / input:**
> I got a high severity vulnerability when installing dependencies. Should I do anything or proceed to planning?

**Output quality:** Worked first try. Clear answer: fix it now, one command, nothing will break.

**Time saved estimate:** 10 minutes of uncertainty avoided.

**Lessons learned:** Don't skip security fixes under deadline pressure. The fix was trivial.

---

### Entry 10

**Date:** 17/04/2026

**Tool used:** Claude — asked how to prompt Opus to plan only, not write code.

**Prompt / input:**
> How should I make Opus actually plan only and not work? Also the intended audience is Claude Code Sonnet.

**Output quality:** Worked first try. Two additions: framing Opus as planner-only at the top, and specifying Claude Code as the audience so the plan would be explicit enough for another AI to execute without decisions.

**Time saved estimate:** 15 minutes — the audience framing was non-obvious and made a measurable difference in Opus's output quality.

**Lessons learned:** Telling the planning model who will execute the plan produces more explicit, less ambiguous output.

---

### Entry 11

**Date:** 17/04/2026

**Tool used:** Claude — reviewed all 5 Zod schema files produced by Claude Code, added comments, explained concepts.

**Prompt / input:**
> [pasted each file one by one] How is this looking? Can you explain what is happening here? Any comments I should add?

**Output quality:** All 5 files matched the Opus plan exactly. Claude Code made no deviations. Comments added were meaningful (explained *why*, not *what*). One product decision made during review: removed `depositAmount` from `leaseSummarySchema` as out of scope for MVP.

**Time saved estimate:** 1 hour — reviewing and commenting 5 TypeScript files manually, plus understanding Zod patterns from scratch.

**Lessons learned:** Reviewing AI output file by file with explanations is the right workflow for a beginner — catches assumptions early (e.g. depositAmount) before they become UI problems later. Opus → Claude Code → Claude review is an effective three-model pipeline.

---

### Entry 12

**Date:** 16/04/2026

**Tool used:** Claude — Asked how to connect Claude to GitHub to review PRs.

**Prompt / input:**
> How could I somehow connect you to GitHub and make you able to review a PR and tell me what it contains and if it's right?

**Output quality:** Claude explained the options clearly (paste diff, GitHub MCP via Claude Code, Copilot). No follow-up needed — led directly into the actual PR review workflow we used for the rest of the session.

**Time saved estimate:** ~20 minutes of Googling MCP setup docs and GitHub integration options.

**Lessons learned:** No GitHub MCP is available in the web UI — Claude Code is needed for that. Pasting code directly turned out to be faster anyway.

---

### Entry 13

**Date:** 16/04/2026

**Tool used:** Claude — Reviewed a teammate's landing page + auth UI component.

**Prompt / input:**
> How is this looking? My teammate made it. [pasted full TSX file]

**Output quality:** Claude identified what the file contained, what was done correctly (color tokens, fonts, TypeScript types), and flagged real issues — wrong auth pattern, no App Router routing, inline styles instead of Tailwind, no RHF+Zod. All flags were accurate and relevant to the milestone.

**Time saved estimate:** ~45 minutes of manually cross-referencing the file against the stack rules and portals.md spec.

**Lessons learned:** Giving Claude the project spec files as context (CLAUDE.md, portals.md) made the review much more precise — it caught spec violations, not just code style issues.

---

### Entry 14

**Date:** 16/04/2026

**Tool used:** Claude — Clarified a confusing partial code snippet from a teammate.

**Prompt / input:**
> He removed these [pasted broken-looking snippet] — he is doing it in phases.

**Output quality:** Claude initially flagged it as broken code, which was a misread since it was just removed lines shown out of context. Needed one correction from me to clarify context. Claude then correctly reframed it as a font system migration in progress and gave the right next step to verify.

**Time saved estimate:** ~10 minutes. Useful for sanity-checking but required clarification.

**Lessons learned:** When sharing diffs, context matters — pasting removed lines without explanation looks like broken code. Labeling OLD/NEW clearly from the start would have avoided the back-and-forth.

---

### Entry 15

**Date:** 16/04/2026

**Tool used:** Claude — Reviewed a `globals.css` diff between old and new versions.

**Prompt / input:**
> Old: [pasted old globals.css] / New: [pasted new globals.css] — two different files.

**Output quality:** Claude accurately identified every change — removal of Google Fonts URL import, migration to `@theme` with `--color-*` tokens, new utility tokens added, dark mode moved into `@theme`. Verdict was correct and matched Tailwind v4 conventions.

**Time saved estimate:** ~30 minutes of manually diffing and verifying Tailwind v4 `@theme` behavior.

**Lessons learned:** Labeling OLD/NEW explicitly made the review fast and accurate. Claude's knowledge of Tailwind v4 `@theme` conventions was reliable here.

---

### Entry 16

**Date:** 16/04/2026

**Tool used:** Claude — Reviewed `layout.tsx` diff replacing boilerplate fonts with project fonts.

**Prompt / input:**
> [pasted old and new layout.tsx] — layout.tsx btw.

**Output quality:** Claude correctly identified all changes and flagged the one open question: what's inside `Providers.tsx`? That was exactly the right follow-up — led directly to the next review.

**Time saved estimate:** ~20 minutes of reading through the file and verifying `next/font` setup against the CSS variable chain.

**Lessons learned:** Claude connected the dots between `layout.tsx` and `globals.css` automatically because both were shared in the same session — having full context across the conversation made reviews faster and more complete.

---

### Entry 17

**Date:** 16/04/2026

**Tool used:** Claude — Reviewed `Providers.tsx` for correct TanStack Query setup.

**Prompt / input:**
> [pasted Providers.tsx] — this is what is here.

**Output quality:** Claude confirmed the implementation was correct, explained why `useState` is the right pattern for `QueryClient` instantiation, and noted the one missing piece (Zustand doesn't need a provider). Accurate and concise.

**Time saved estimate:** ~15 minutes of reading TanStack Query docs to verify the correct client instantiation pattern.

**Lessons learned:** Claude's explanation of why `useState` matters for SSR safety was a useful bonus — learned something while reviewing, not just got a yes/no.

---

### Entry 18

**Date:** 16/04/2026

**Tool used:** Claude — Asked whether a `next-env.d.ts` change needed reviewing.

**Prompt / input:**
> He also edited this file: frontend/next-env.d.ts but i think it edited cuz he build the project again?

**Output quality:** Claude correctly identified it as auto-generated by Next.js and requires no review. One-line answer, no ambiguity.

**Time saved estimate:** ~5 minutes. Would have otherwise spent time verifying whether this was a manual change or build artifact.

**Lessons learned:** Auto-generated files don't need code review — Claude knew this immediately.

---

### Entry 19

**Date:** 16/04/2026

**Tool used:** Claude — Wrote a 3-sentence PR review summary for commenting.

**Prompt / input:**
> Could you write a summary about the review. Like 3 sentences max

**Output quality:** Produced a concise, comment-ready summary. One iteration, landed immediately.

**Time saved estimate:** ~5 minutes. Would have otherwise hand-written a summary myself.

**Lessons learned:** Claude can write review comments as-is — just ask for the format upfront.

---

### Entry 20

**Date:** 16/04/2026

**Tool used:** Claude — Wrote a 5-sentence extended PR merge description.

**Prompt / input:**
> Can you also write a 5 sentences max extended description summary for the merge

**Output quality:** Produced a detailed but concise summary covering all changes (fonts, tokens, TanStack Query, dark mode, auto-generated files). One shot, submission-ready.

**Time saved estimate:** ~10 minutes. Pulling together all the review insights into a coherent description would have been tedious.

**Lessons learned:** Claude synthesized the entire PR review into a clear narrative without re-prompting.

---

### Entry 23

**Date:** 17/04/2026

**Tool used:** Claude — Planning the Zustand store architecture for the Tenant Portal before any code was written.

**Prompt / input:**
> I need to plan and implement the Zustand store for the Tenant Portal. I want to understand what Zustand needs to handle before we plan or touch any code.

**Output quality:** Produced a clean breakdown of 3 slices (auth, UI, notification) with clear reasoning for what belongs in Zustand vs TanStack Query. No corrections needed. Led directly into the Opus planning phase.

**Time saved estimate:** ~1 hour. Figuring out state boundaries without guidance usually leads to over-engineering or missed concerns.

**Lessons learned:** Asking "what does X need to handle" before touching code is the right move. It surfaced decisions (persistence, toast behavior, modal flow) that would have required refactoring later.

---

### Entry 24

**Date:** 17/04/2026

**Tool used:** Claude — Explaining Zustand from scratch before making architectural decisions.

**Prompt / input:**
> I have no idea what is going on here and how it's going to work with Zustand. Can you first explain it to me?

**Output quality:** Covered the core concept, the problem it solves, how state and actions work, and the Zustand vs TanStack Query boundary. Clear enough to make informed decisions immediately after.

**Time saved estimate:** ~1.5 hours of reading docs and tutorials.

**Lessons learned:** Getting a concept explained in project context is faster than reading generic documentation. The Zustand vs TanStack Query boundary explanation alone prevented likely architectural mistakes.

---

### Entry 25

**Date:** 17/04/2026

**Tool used:** Claude — Deciding whether to persist auth state and understanding how Keycloak token loading works.

**Prompt / input:**
> Is it wasteful to not persist any auth state at all? Should we not cache it? Also explain the decode the token on load part.

**Output quality:** Explained why persisting auth in Zustand would cause stale state bugs, how Keycloak handles session continuity automatically, and how JWT decoding works in one line of JS. Directly answered both questions, no follow-up needed.

**Time saved estimate:** ~1 hour. Would have likely implemented localStorage persistence incorrectly without this.

**Lessons learned:** Asking about tradeoffs before implementing saves debugging time later. The explanation of why the "correct" pattern is correct matters as much as the pattern itself.

---

### Entry 26

**Date:** 17/04/2026

**Tool used:** Claude — Clarifying where passwords are stored and who the frontend communicates with.

**Prompt / input:**
> Where is the password saved? Also where is the login happening — do we talk to the backend or Keycloak when logged in?

**Output quality:** Concise and accurate. Keycloak owns passwords entirely, frontend never sees them. Clarified the frontend-to-backend vs frontend-to-Keycloak communication model cleanly.

**Time saved estimate:** ~30 minutes of reading Keycloak docs.

**Lessons learned:** Short conceptual questions get sharp answers. Good use of Claude for filling auth knowledge gaps quickly.

---

### Entry 27

**Date:** 17/04/2026

**Tool used:** Claude — Writing the Opus planning prompt for the Zustand store.

**Prompt / input:**
> Write the Opus planning prompt so it's ready to paste.

**Output quality:** Produced a complete, structured prompt covering slice pattern, TypeScript constraints, no-persistence decision, devtools requirement, and output format instructions. Used directly without edits.

**Time saved estimate:** ~30 minutes. Writing a precise technical prompt for another AI model requires care — getting it wrong wastes a full Opus call.

**Lessons learned:** Having Claude write the prompt for Opus worked well. The prompt was specific enough that Opus produced a usable plan on the first attempt.

---

### Entry 28

**Date:** 17/04/2026

**Tool used:** Claude — Reviewing the Opus-generated Zustand store plan for correctness.

**Prompt / input:**
> I think there might be some things here that need to be cut and some that need to be addressed. How is it looking?

**Output quality:** Identified one real concern (TenantAccountStatus comparison needing enum verification), confirmed everything else was correct, and flagged one thing to cut from the Claude Code prompt (the beginner explanation paragraph). Accurate review.

**Time saved estimate:** ~45 minutes of manually cross-checking the plan against Zustand and TypeScript docs.

**Lessons learned:** Using Claude to review an Opus output before execution caught a potential bug before it reached code. Two-model review workflow is worth keeping.

---

### Entry 29

**Date:** 17/04/2026

**Tool used:** Claude — Reviewing the four implemented Zustand store files produced by Claude Code.

**Prompt / input:**
> It's done. Should we review what it cooked up? [pasted all four files]

**Output quality:** Verified all files against the plan. All requirements met, no issues found. `useTenantStore.ts` confirmed correct on the double `()` pattern, `(...args)` spread, devtools label, and no persist middleware.

**Time saved estimate:** ~1 hour of manual code review against Zustand TypeScript docs.

**Lessons learned:** Claude Code followed the Opus plan accurately when given a precise implementation prompt. The plan quality directly determined the output quality — garbage in, garbage out applies to AI handoffs too.

---

### Entry 30

**Date:** 17/04/2026

**Tool used:** Claude — Planning the full Tenant Portal UI build order and file structure.

**Prompt / input:**
Asked Claude to read project files and produce a complete build plan for the Tenant Portal UI.

**Output quality:** Produced a phased 21-file plan with execution order, TSC checkpoints, and component specs. Worked first try.

**Time saved estimate:** ~3 hours. Manually sequencing files and resolving dependencies upfront would have taken significantly longer.

**Lessons learned:** Providing all context files upfront produced a precise, executable plan. Worth doing every time before touching code.

---

### Entry 31

**Date:** 17/04/2026

**Tool used:** Claude — Verifying ReceiptUploadFormSchema validation constraints before writing the form component.

**Prompt / input:**
Pasted `payment.ts` and asked whether explicit file size/type constraints were defined in the schema.

**Output quality:** Confirmed constraints instantly — 5MB limit, JPEG/PNG/PDF only, notes optional max 500 chars. No corrections needed.

**Time saved estimate:** ~20 minutes. Would have had to trace through the schema manually.

**Lessons learned:** Always verify actual schema exports before planning form components. Saves invented validation later.

---

### Entry 32

**Date:** 17/04/2026

**Tool used:** Claude — Scoping the conversation to Tenant Portal only and deciding on the Opus planning workflow.

**Prompt / input:**
Told Claude to focus on Tenant Portal only and clarified that Opus would plan and Claude Code would execute.

**Output quality:** Claude correctly adjusted scope and identified that source files were needed before Opus could plan accurately.

**Time saved estimate:** ~15 minutes. Catching missing source files early avoided a rework cycle.

**Lessons learned:** Clarifying the AI workflow early prevents the planner from writing execution-style output.

---

### Entry 33

**Date:** 17/04/2026

**Tool used:** Claude — Extracting visual design patterns from landlord portal screenshots for the Tenant Portal.

**Prompt / input:**
Uploaded 4 screenshots of the existing landlord portal and asked Claude to match the Tenant Portal visual style.

**Output quality:** Accurately identified card style, nav pattern, table headers, badge style, button treatment, and overall aesthetic. Baked into the Phase 1 prompt correctly.

**Time saved estimate:** ~1 hour. Writing a visual spec from screenshots manually and translating it to Tailwind classes would have taken much longer.

**Lessons learned:** Screenshots are more efficient than describing styles in words. Use them earlier.

---

### Entry 34

**Date:** 17/04/2026

**Tool used:** Claude — Writing the Phase 1 Opus planning prompt for UI primitives.

**Prompt / input:**
Asked Claude to write a prompt for Opus to plan Phase 1 (9 UI primitive components) with all context embedded.

**Output quality:** Produced a detailed prompt with full design system tokens, per-file specs, Framer Motion requirements, and executor instructions. Required one fix — wrong import style for `useTenantStore`.

**Time saved estimate:** ~2 hours. Writing a spec prompt at this level of detail manually would have been very time consuming.

**Lessons learned:** Always verify import styles against actual source files before finalising prompts.

---

### Entry 35

**Date:** 17/04/2026

**Tool used:** Claude — Reviewing the Opus Phase 1 plan for bugs before handing to Claude Code.

**Prompt / input:**
Pasted the Opus Phase 1 plan and asked Claude to review it for issues.

**Output quality:** Caught the `useTenantStore` default import bug immediately with the exact fix. No false positives.

**Time saved estimate:** ~30 minutes. Would have surfaced as a TSC error mid-execution without the review step.

**Lessons learned:** Always run the plan through Claude before handing to Claude Code. A second pass catches bugs Opus introduces.

---

### Entry 36

**Date:** 17/04/2026

**Tool used:** Claude — Reviewing each Phase 1 file as Claude Code produced it.

**Prompt / input:**
Pasted each file output from Claude Code and asked if it matched the spec.

**Output quality:** Caught missing `ReactNode` import in Button and flagged unused `setValue` in ReceiptUploadForm. All catches were real issues.

**Time saved estimate:** ~45 minutes across 9 files. Each review caught at least one issue that would have caused a TSC error.

**Lessons learned:** File-by-file review is worth the overhead. Claude Code occasionally deviates from spec in small ways.

---

### Entry 37

**Date:** 17/04/2026

**Tool used:** Claude — Writing the Phase 2 Opus planning prompt for feature components.

**Prompt / input:**
Pasted all hook files, store slices, and Zod schemas and asked Claude to write a Phase 2 planning prompt for Opus.

**Output quality:** Required four correction passes — wrong import style, wrong schema casing, unused Input import, unused Payment type, unused setValue. All caught before execution.

**Time saved estimate:** ~2.5 hours. Still far faster than writing the full spec manually.

**Lessons learned:** More source files means more surface area for mistakes. Review more carefully when input is large.

---

### Entry 38

**Date:** 17/04/2026

**Tool used:** Claude — Answering Opus's three architectural questions about Phase 2 decisions.

**Prompt / input:**
Opus asked three questions via interactive UI: resubmit id behaviour, payment history row click, and currency locale. Asked Claude for recommendations.

**Output quality:** All three recommendations were clear and well-reasoned. All adopted without changes.

**Time saved estimate:** ~20 minutes. Would have had to think through tradeoffs independently.

**Lessons learned:** Let Opus surface ambiguities before planning. The interactive question format worked well.

---

### Entry 39

**Date:** 17/04/2026

**Tool used:** Claude — Reviewing the Opus Phase 2 plan for bugs before execution.

**Prompt / input:**
Pasted the Opus Phase 2 plan and asked Claude to review it.

**Output quality:** Caught five real bugs across two review passes — import style, schema casing, unused imports, unused type, unused variable.

**Time saved estimate:** ~1 hour. All five would have caused TSC errors mid-execution.

**Lessons learned:** Opus consistently uses named imports for default exports. Check every plan for this pattern.

---

### Entry 40

**Date:** 17/04/2026

**Tool used:** Claude — Reviewing each Phase 2 file as Claude Code produced it.

**Prompt / input:**
Pasted each Phase 2 file output and asked if it matched the spec and had any issues.

**Output quality:** Caught missing ReactNode import in LeaseSummaryCard. TSC checkpoint caught JSX.Element namespace error across three files — Claude identified the correct fix.

**Time saved estimate:** ~1 hour across 6 files. The JSX.Element issue would have blocked the entire checkpoint.

**Lessons learned:** JSX.Element as an explicit return type causes TSC errors in this setup. Use inferred return types going forward.

---

### Entry 41

**Date:** 17/04/2026

**Tool used:** Claude — Writing the Phase 3 starter prompt for a new conversation.

**Prompt / input:**
Asked Claude to write a prompt to start a new conversation for Phase 3 covering layout wiring, dashboard page, loading, and error files.

**Output quality:** First attempt was too detailed — written as an execution plan rather than a conversation starter. Corrected after clarification.

**Time saved estimate:** ~20 minutes. The clarification round cost some time but the final prompt is clean.

**Lessons learned:** Be explicit upfront about what the prompt is for. The framing changes the output significantly.