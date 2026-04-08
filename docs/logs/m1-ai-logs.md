# Milestone 1 AI Logs

## Summary

These are the conversations that were made with AI for consultation, 
implementation and quality review during the first milestone of the project.

# Entries

### Entry 1

**Date:** 23/03/2024 20:27

**Tool used:** ChatGPT — I asked it about the current competition in the Balkans for property management software.

**Prompt / input:**
> Is there any property management software currently popular for the Balkans?

**Output quality:** It told me about Rentigo, Bidrento, Renflow and other competitors. 
I had no prior knowledge of these, so I was surprised by the quality of the answer. 
<br> It also provided me with a brief description of each software, which was helpful. And made me see the gaps in the market.

**Time saved estimate:** I would say it saved me around 2 hours of research, as I would have had to search for these competitors myself and read about them.

**Lessons learned:** I think my prompt was a bit too vague and short. Maybe I should have asked for a more specific question and asked for a summary of the competitors.<br>
Although I think the quality of the answer was good, I could have gotten more detailed information if I had asked for it. For example, I could have asked for the pricing of each software or the features they offer.

---

### Entry 2

**Date:** 24/03/2024 6:19

**Tool used:** ChatGPT — I asked it to analyze the competitors and see what are the gaps we should implement and what are the solid foundations we should have.

**Prompt / input:**
> Could you analyze all these other tools and see what are the gaps we should implement and what are the solid foundations we should have?

**Output quality:** It told me that what landlords in the Balkans need is not a fancier tool built for enterprises, but a simple and easy-to-use tool that can help them manage their properties efficiently. <br>
It also told me that the most important features for landlords in the Balkans are: Local payments (cash is a big thing in the Balkans but also digital), utility management, multilingual communication, <br>
simple owner reporting and a fast onboarding experience with easy-to-use features.

**Time saved estimate:** I would say it saved me around 3 hours of analysis and brainstorming, as I would have had to analyze each competitor myself and come up with a list of features and gaps.<br>
It also saved me time by helping me understand the current market needs and the challenges of the Balkans. What lone landlords in the Balkans need is a simple tool.

**Lessons learned:** I should have asked for a diagram or table of the features and gaps of each competitor. This would have helped me visualize the information better and compare the competitors more easily. <br>

---

### Entry 3

**Date:** 27/03/2024 19:45

**Tool used:** ChatGPT — Explanation of story points (difficulty versus time, and how to use them correctly)

**Prompt / input:**

> On a difficulty and timescale what do the story points we assign to story points mean?

**Output quality:** Worked out of the box. The explanation was clear, structured, and directly addressed the confusion between time and effort. No edits needed.

**Time saved estimate:** ~45 minutes. Instead of researching multiple sources and piecing together the concept, the explanation provided a complete and practical understanding in one response.

**Lessons learned:**

* Asking direct, focused questions leads to better answers.
* It helps to clarify confusion explicitly (in this case: difficulty versus time).
* The response is more useful when it includes practical examples, not just theory.
* Next time, I could improve results further by giving context about my project (e.g., team size, sprint length) to get even more tailored guidance.

### Entry 4

**Date:** 27/3/2024 19:53

**Tool used:** ChatGPT — Explanation of Axios interceptors for handling authentication tokens in frontend applications

**Prompt / input:**
> Token stored via Axios interceptors or alternatives. What is this?

**Output quality:** Worked out of the box. The explanation was clear, structured, and included practical code examples. No edits needed.

**Time saved estimate:** ~45 minutes
Without AI, you’d likely search multiple docs (Axios interceptors, JWT handling, examples), piece them together, and still risk missing best practices like centralized logic.

**Lessons learned:**

* Simple, direct questions produce high-quality explanations when the topic is well-defined.
* Asking “what is this?” is effective when you already have context but need clarity.
* Including implementation context (e.g., “alternatives”) leads to deeper, more useful answers.
* Next time: ask follow-up questions immediately (e.g., refresh tokens, security tradeoffs) to go from understanding → production-ready faster.

---

### Entry 5 

**Date:** 2/4/2026 17:42

**Tool used:** ChatGPT — Guidance on how to structure and use sprints (cycles) in Linear

**Prompt / input:**
> Asked where to create “Sprint 1” in Linear and whether current cycle settings were configured correctly

**Output quality:** Worked out of the box — clear explanation that Linear uses cycles instead of traditional sprints, plus actionable corrections to my setup

**Time saved estimate:** ~45 minutes  
Avoided trial-and-error with Linear configuration and misunderstanding how sprints work in this tool

**Lessons learned:**
- Be direct and specific about the tool and goal (e.g., “Linear sprint setup” instead of generic “project management”)
- Asking for feedback on actual settings/screenshots gives much more practical answers
- Learned that Linear uses cycles (not manual sprint creation), which changes how planning should be approached
- Next time: include context about my project earlier to get even more tailored sprint planning advice

---

### Entry 6

**Date:** 2/4/2026 21:09

**Tool used:** ChatGPT — Debugging Git branch mismatch and history issues

**Prompt / input:**
> I accidentally pushed to master and not main, and they have entirely different commit histories (it was the first commit). What to do?

**Output quality:** Worked with clarification. The initial solution assumed different histories, but after inspecting logs, the issue was simpler (branches pointed to the same commit). The final solution was accurate after iteration.

**Time saved estimate:** ~45 minutes  
Without AI, I would have:
- tried unnecessary merges
- risked breaking history
- spent time searching for inconsistent solutions online

**Lessons learned:**
- Always verify repo state first (`git log --graph --all`) before applying fixes
- Don’t assume “different histories” — Git output shows the truth
- For first commits, force pushing can be the cleanest fix
- Providing real command outputs leads to much better guidance


---

### Entry 7

**Date:** 2/4/2026 21:20

**Tool used:** ChatGPT — Designing Git branching strategy and protection rules

**Prompt / input:**
> Well, I have two branches develop and main should I go with a branch ruleset or with a classic branch protection rule? Develop is where we, of course, test, but having things break isn't the worst. The main is where we only merge if we are confident everything is alright.

**Output quality:** Worked out of the box. Clear recommendation (branch rulesets) with a structured setup for both `main` and `develop`.

**Time saved estimate:** ~1–2 hours  
Without AI, I would have:
- guessed configuration settings
- overcomplicated branch protections
- it lacked a clear workflow between branches

**Lessons learned:**
- Use branch rulesets instead of classic protection rules
- Clearly separate responsibilities:
    - `develop` = fast iteration and testing
    - `main` = stable, production-ready code
- Avoid enabling every protection rule — configure based on current needs
- Start simple and introduce CI/status checks later instead of overengineering early  

---

### Entry 8

**Date:** 3/4/2026 17:24

**Tool used:** ChatGPT — Fixing Markdown heading and line break formatting

**Prompt / input:**
> How to break a line after a ### heading without it messing up formatting in Markdown

**Output quality:** Worked out of the box — provided multiple correct approaches with clear explanations

**Time saved estimate:** ~20 minutes — avoided trial-and-error with Markdown quirks and testing different fixes

**Lessons learned:**
- Markdown headings (`###`) should be followed by a blank line for proper rendering
- Two spaces at the end of a line force a line break without starting a new paragraph
- `<br>` can be used when precise control is needed
- Simpler formatting (avoiding unnecessary headings) often prevents issues altogether

---

### Entry 9

**Date:** 4/4/2026 18:50

**Tool used:** ChatGPT — Designed a scalable invitation flow for handling user onboarding (existing versus non-existing users)

**Prompt / input:**
> Asked how to implement an invitation system where landlords can invite users via email, handling both users who already have accounts and those who don’t, including redirecting new users to signup and continuing the invite flow.

**Output quality:** Worked well with minor clarification needed. The core solution (token-based invitation system) was solid and aligned with industry practices, but required a deeper breakdown to fully understand flow across all scenarios.

**Time saved estimate:** ~2–3 hours — avoided trial-and-error designing multiple flawed approaches (e.g., checking user existence first, splitting flows between notifications and invites). Got a clean, scalable architecture immediately.

**Lessons learned:**
- Always prefer a **single unified flow** over branching logic (simpler, fewer bugs).
- Use **token-based systems** as the source of truth instead of relying on user existence checks.
- Design flows around **state transitions (invitation lifecycle)** rather than user conditions.
- Ask follow-up questions to clarify edge cases (login state, signup continuation, token persistence).
- Next time: start by asking for **full flow breakdown + edge cases upfront** to reduce back-and-forth.

---

### Entry 10

**Date:** 4/4/2026 14:53

**Tool used:** Claude — Compared PM platforms to determine the best fit for a 3-person software development team.

**Prompt / input:**
> Asked which project management platform — Jira, Linear, or Notion — is best suited for a small 3-person software development team, including pros, cons, and a direct recommendation.

**Output quality:** Worked well out of the box. The comparison was well-structured with a clear recommendation (Linear) backed by reasoning specific to small team dynamics. <br> 
No clarification needed — including team size in the prompt was enough to get a tailored, actionable answer rather than a generic feature breakdown. <br>

**Time saved estimate:** ~45 min–1 hour — avoided reading through individual product docs, pricing pages, and scattered Reddit/blog comparisons for three separate tools. <br>
Got a consolidated, opinionated answer immediately that accounted for team size constraints.<br>

**Lessons learned:**
- Always include **team size and context** in comparison prompts — it forces the AI to filter out irrelevant use cases and give a grounded recommendation.
- Ask for a **direct verdict**, not just a list — "which is best for X" outperforms "compare X, Y, Z" for actionable output.
- **Jira's complexity only pays off at scale** — confirmed what was suspected but hadn't validated.
- Next time: ask for **migration considerations** in case the team grows and needs to switch tools later.

---

### Entry 11

**Date:** 4/4/2026 14:59

**Tool used:** Claude — Evaluated Figma alternatives to determine if any offer meaningful advantages for prototyping.

**Prompt / input:**
> Asked for prototyping tools other than Figma, including an honest assessment of whether any of them are actually better than Figma and in what specific scenarios.

**Output quality:** Worked well out of the box. Covered 7 alternatives (Penpot, Framer, Sketch, Adobe XD, Axure, Marvel, Uizard) with direct comparisons against Figma per tool.<br>
Particularly valuable was the callout that Adobe XD is effectively discontinued and that Framer genuinely outperforms Figma for interactive prototyping. No follow-up needed.

**Time saved estimate:** ~1–1.5 hours — evaluating 7 tools individually across feature lists, community sentiment, and pricing would have required significant cross-referencing.<br> 
Got a synthesized, ranked view with honest tradeoffs in one shot.

**Lessons learned:**
- Phrasing **"are they better?"** instead of "list alternatives" pushes the AI to make comparative judgments — far more useful than passive descriptions.
- **Framer is worth a serious look** for teams where prototype interactivity matters more than design system completeness.
- **Adobe XD should be avoided entirely** for new projects — this wasn't obvious without prior research.
- Next time: specify **what the prototypes are for** (user testing, dev handoff, stakeholder demos) to get even more targeted recommendations.

---

### Entry 12
**Date:** 4/4/2026 15:01

**Tool used:** Claude — Compared Zustand and Redux to decide on the right state management solution for a small React team.

**Prompt / input:**
> Asked for a comparison between Zustand and Redux for React state management, including code examples, tradeoffs, and a recommendation suited to a small development team.

**Output quality:** Worked well out of the box despite a short prompt. Delivered side-by-side code examples, a comparison table, and a clear recommendation (Zustand) with <br>
a bonus pointer toward pairing it with TanStack Query for server state. The answer correctly distinguished between Redux and Redux Toolkit, which is an important nuance often missed.

**Time saved estimate:** ~30 min–1 hour — avoided reading multiple blog posts that tend to present both tools as equally valid without giving a real recommendation. <br>
Got a direct, context-aware verdict with working code immediately.

**Lessons learned:**
- **Zustand is the right default** for small teams — Redux's structure only pays off at scale with many developers touching shared state.
- **Separating server state from client state** (Zustand + TanStack Query) is a cleaner architecture than forcing everything into one store.
- Even a **short prompt returns strong output** when the topic is technically well-defined — no need to over-engineer the question.
- Next time: include **the specific async complexity of the project** upfront — that detail would immediately determine whether RTK Query becomes relevant.

### Entry 13

**Date:** 6/4/2026 16:47

**Tool used:** Claude — asked for advice on whether to store the AI log as a .md file or Google Doc

**Prompt / input:**
> "Should I make the AI logs a .md file or a Google Docs file?"

**Output quality:** Worked out of the box. Got a clear recommendation with reasoning — .md in the repo was recommended due to version control, no login friction, and it being standard practice. <br>
Also suggested a folder structure like `logs/m1-ai-log.md`.

**Time saved estimate:** ~15 minutes. Would have had to think through the tradeoffs myself or ask a teammate.

**Lessons learned:** A short, direct question got a well-structured answer. No special prompting is needed for opinion/advice questions.

---

### Entry 14

**Date:** 6/4//2026 12:04

**Tool used:** Claude — asked it to replace example placeholder text in the log template with generic fill-in prompts

**Prompt / input:**
> "Can you copy this and instead of an example have like 'Put date here' etc"
 
**Output quality:** Worked out of the box. Produced a clean Markdown template with bracketed placeholders for every field.

**Time saved estimate:** ~10 minutes. Small but tedious task to do manually across multiple fields.

**Lessons learned:** Very simple instruction, very clean output. Short prompts work well for straightforward editing tasks.