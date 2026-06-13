# AI Implementation in Pinpoint: Brainstorm / Discovery Notes
Date: 2026-06-06 · Goal: Stress-test and map out how Louis plans to implement AI in his business, Pinpoint

## Summary / key decisions
(running synthesis, updated as we go)

## Q&A log

### Q1 — What is Pinpoint?
- Asked: What is Pinpoint — SaaS, agency, marketplace, something else?
- Captured:
  - Managed automation agency — like a virtual back-office assistant, but built on automations (Make.com, Airtable, SMS)
  - Primary niche: roofers in Flanders, Belgium — but designed to extend to other trades
  - Early stage: no official clients yet, still in development/product thinking phase
  - Core goal: free up the roofer's time, protect leads, become indispensable ("can't work without it")
  - **Basic tier features:**
    - Missed call text back
    - Intake process (keeps leads from going to competitors)
    - SMS with lead info sent to roofer
    - Reminder SMS if intake form isn't filled by the caller
    - Monthly report showing how Pinpoint helped the business
  - **Pro tier features (on top of Basic):**
    - Quote follow-up automation
    - No-show prevention
    - Review request automation
- Flags: none

## Summary / key decisions
- Pinpoint = done-for-you automation stack for roofers (Flanders), with Basic and Pro tiers
- Stack: Make.com + Airtable + SMS
- North star: become a daily habit the roofer can't drop
- Business model: setup fee + monthly retainer, location-independent, zero per-client ongoing work after setup
- AI direction: embedded intelligence inside automations (not customer-facing), behind the scenes
- Architecture: Master Template base per roofer + PinPoint-Config for routing — sound design, P1 fix needed
- Hard blocker before client #1: test dynamic base ID in live Make.com execution

## Stack & product opinion (independent assessment)
**Strengths:**
- Make.com + Airtable + SMS is proven, fast to iterate, no-code friendly
- "Done for you" positioning is strong — roofer learns nothing, just receives value
- Full lead lifecycle covered: first call → intake → quote → appointment → job done → review
- Master Template + PinPoint-Config routing is architecturally smart

**Risks:**
1. **Make.com operations cost at scale** — every SMS, Airtable lookup, AI call burns operations. At 30 clients × 10 scenarios with AI, the monthly Make.com bill could hit €500–1000+, eating into margin significantly. Model this before finalizing pricing.
2. **Roofer churn** — if the roofer doesn't feel the ROI, he cancels. The monthly report is currently the main retention mechanism. It needs to be undeniably good. AI-written narratives (not just stats) help here.
3. **No roofer-facing dashboard** — right now the roofer gets SMS notifications but has no "home base" view of his business. The Telegram bot idea directly addresses this gap and is probably the right call.
4. **Untested multi-client architecture** — the whole "set once, runs forever" promise rests on dynamic base ID working in practice. One test run could validate or break this assumption.

**Alternative worth knowing:**
- n8n (self-hosted on a €10/mo VPS) replaces Make.com entirely — zero per-operation cost, same logic. More technical to maintain, but at 20+ clients the economics become very compelling. Not urgent now, but worth tracking as the business scales.

**Overall verdict:** The product concept is solid and the niche is well-chosen. The gap is not features — it's (1) AI to make it autonomous and differentiated, (2) a roofer-facing touchpoint (Telegram bot) to make it feel like a real assistant, and (3) the monthly report as the "proof of value" that kills churn.

### Q2 — Where does AI fit?
- Asked: AI receptionist vs. smarter automations vs. something else?
- Captured:
  - AI receptionist is off the table for now — Belgian market not ready for it culturally
  - Direction: embed AI inside existing automations to make them smarter, not as a customer-facing voice/chat layer
  - Goal: AI works behind the scenes, improving outcomes for the roofer without the end customer necessarily knowing
- Flags: none

### Q11 — Full blueprint audit (Missed Call scenario)
- Asked: Blueprint JSON provided — what's hardcoded, what needs fixing?
- Captured:
  - **Module 29** (Config lookup → PinPoint-Config base): `"base": "appOPbJm1o0SGRSIV"` — ✅ CORRECTLY hardcoded, always Config base
  - **Module 38** (Search Leads): `"base": "{{29.airtable_base_id}}"`, `"table": "Leads"` — ✅ ALREADY DYNAMIC, map toggle worked
  - **Modules 76, 107, 108, 112, 113, 116** (Create/Update leads): `"base": "appzh2K0IVPdmAIR8"`, `"table": "tblugK61w2wCUt0Ls"` — ❌ BOTH HARDCODED, need fix
  - **Good news:** `useColumnId: false` on all action modules means Make.com sends field **names** (not IDs) to Airtable API. Field ID keys in the mapper (fldXXX) are just Make.com UI metadata. Since client bases are duplicated from Master Template, field names match → multi-tenant fix will work.
  - **Fix needed in Make.com UI** for each of the 6 modules:
    1. Map toggle on Base field → type `{{29.airtable_base_id}}`
    2. Table field becomes text input → type `Leads`
  - **Bonus finding:** Modules 107/108/116 show `"label": "Lead Management System"` in restore metadata (vs module 76 which shows "PinPoint - Master Template") — harmless label inconsistency, no functional impact
- Flags: none — fix is clear and actionable

### Q10 — Dynamic base ID validation + stack/product opinion requested
- Asked: Is the dynamic base ID actually tested? Also: honest opinion on stack and product?
- Captured:
  - [Certain] Action modules (Search, Update, Create) support dynamic base IDs ✓
  - [Likely] Trigger modules (Watch Records) do NOT — base ID is hardcoded at build time ✗
  - [Certain] Most/all of the 9 scenarios are probably webhook or schedule triggered — so Watch trigger limitation likely doesn't apply
  - [Untested] Whether any of the 9 scenarios uses an Airtable Watch trigger as entry point — if none do, P1 fix is viable; if any do, there's an architectural problem
  - [Untested] Actually mapping a variable into Base ID in a live Make.com execution — only assumed to work, never confirmed
  - Louis asked for independent product + stack opinion → see notes in Summary section
- Flags: Live test of dynamic base ID mapping → Louis must do before first client

### Q9 — Airtable architecture + P1 blocker
- Asked: One base per roofer or shared base?
- Captured:
  - Architecture: one Airtable base per roofer, duplicated from a **Master Template**
  - Central **PinPoint-Config base** handles client routing via `client_id` (e.g. pk001)
  - **Known P1 blocker:** all Make.com Airtable modules are hardcoded to one base ID — not dynamic yet
  - Fix identified: add `airtable_base_id` to PinPoint-Config and reference it dynamically in all scenarios
  - Fix is not yet implemented — this is a hard prerequisite before onboarding client #2
- Flags: Make.com dynamic base ID — validate all Airtable module types support it → Louis to test

### Q8 — Calendly, WhatsApp, and scalability constraint
- Asked: Does the roofer use Calendly? And is WhatsApp viable?
- Captured:
  - Calendly: never a serious option — most Belgian roofers don't use it. Off the table.
  - WhatsApp Business API: technically harder + expensive. Leaning toward Telegram instead.
  - Telegram: easier to set up, free, good enough if roofer can be onboarded to it
  - **Critical business constraint:** Louis does NOT want to do per-client manual updates each month. System must be "set once, runs forever." Only acceptable ongoing work = bug fixes.
  - This means the architecture must be multi-tenant and fully self-running — zero manual intervention per client after setup.
- Flags: Multi-tenant architecture not yet confirmed → needs to be resolved before first client

### Q7 — Manual steps the roofer must do (friction map)
- Asked: What are the exact manual steps the roofer has to take for the system to work?
- Captured:
  - **One-time setup (Louis does this, not roofer):**
    - Phone routing configured for missed call detection
    - Tally form built and linked
    - Calendly connected
    - Client record created in Airtable with client_id
  - **Ongoing roofer manual steps:**
    | Trigger | What roofer must do |
    |---|---|
    | Job completed | Update a status field (Airtable or form) → triggers Review Boost |
    | Quote sent | Mark quote as sent → triggers Quote Closer sequence |
    | Appointment booked | Use Calendly (not their existing tool) → enables No-Show Prevention |
    | Missed call | Nothing — fully automatic |
    | Monthly report | Nothing — fully automatic |
  - Louis is honest: confidence on these is "likely" not "certain" — exact client-facing UX not fully nailed yet
- Flags: Exact UX for status updates not finalized → Louis to validate with first client

### Q6 — Scenario inventory + product uncertainty
- Asked: What are the 9 scenarios, and what feels incomplete?
- Captured:
  - Full scenario list:
    1. Missed call text back
    2. Intake scenario (Basic)
    3. Intake scenario (Pro / second version)
    4. Reminder to fill intake (when not completed)
    5. Lead info → synced to Quotes table + Reviews table (connector scenario)
    6. Quote closure follow-up
    7. No-show prevention — day before appointment
    8. No-show prevention — morning of appointment
    9. Review boost
    10. Monthly report (how Pinpoint helped the roofer's business)
  - No AI in any scenario yet
  - Louis feels scenarios are individually solid but the overall product picture is unclear
  - Key friction point: some scenarios need manual triggers from the roofer (e.g. marking an appointment, sending a quote) — Louis wants to minimize this effort as much as possible
  - Idea under consideration: **Telegram bot as the roofer's control center** — one place to see everything and trigger manual steps easily
  - Not committed to Telegram yet — still uncertain
- Flags: WhatsApp vs Telegram decision → Louis

### Q5 — Current build status + product completeness
- Asked: What's already built, and what feels missing?
- Captured:
  - Already built: 9 Make.com scenarios connected to Airtable + SMS provider
  - Pricing range confirmed: roughly what was estimated
  - Louis is uncertain about the total product — doesn't feel it's complete or compelling enough yet
  - Wants help defining what a full, irresistible product looks like
- Flags: Full inventory of 9 scenarios not yet mapped → Louis

### Q4 — Business model + real value filter
- Asked: Which ideas create real value vs. nice-to-have? Also: what's the business model?
- Captured:
  - Louis wants features that move the needle for the roofer, not just look cool
  - Business model: one-time setup fee + monthly retainer (location-independent income goal)
  - Ultimate goal: earn enough to be location-free and financially independent from Pinpoint
- Flags: none

### Q3 — Which automation to improve with AI first?
- Asked: Where does AI add the most value across current features?
- Captured: Louis doesn't have a clear answer yet — came here specifically to brainstorm AI ideas. Lead scoring sounds interesting but wants to explore more options.
- Flags: Decision on AI entry point still open → Louis to decide after brainstorm

## Open flags (pending input)
- Which AI use case to prioritize first → Louis (after brainstorm)
- Exact pricing for setup + retainer tiers → Louis (roughly €300–500 setup + €150–250/mo Basic; €500–800 setup + €300–400/mo Pro — needs validation once feature set is locked)
- Full list of scenarios mapped (see Q6)
- WhatsApp vs Telegram: leaning Telegram (WhatsApp API too complex + expensive)
- Multi-tenant architecture design → P1 fix in progress (dynamic base ID)
- Validate Make.com supports dynamic Airtable base IDs in all module types → Louis to test (action modules confirmed OK; trigger modules hardcoded but likely not used)
- Dynamic base ID: FIXED ✅ — script ran successfully, all 6 modules patched, fixed JSON ready to import

