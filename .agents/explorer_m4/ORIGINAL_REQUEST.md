## 2026-07-24T22:04:08Z
You are teamwork_preview_explorer investigating Milestone 4 (M4: AI Study Agent Harness & Sidecar UI Panel).

Working Directory: e:\Projects\Notetaking App\.agents\explorer_m4
(Create this directory if needed, and write metadata/handoff files ONLY here).

Scope & Goal:
Examine the current codebase at e:\Projects\Notetaking App, specifically:
- `PROJECT.md`
- `src/types/` (including `canvas.ts` or `index.ts` if present)
- `src/services/storage/database.ts`
- `src/components/` (Canvas, Templates, Notebook)
- `App.tsx`
- `agent_memory/`

Design a clear, step-by-step implementation strategy for M4:
1. `StudyAgentHarness` service (`src/services/ai/StudyAgentHarness.ts`):
   - UserStudyProfile management (subjectTags, studyHabits, preferredSummaryFormat).
   - Local DB / storage integration for UserStudyProfile & StudyRecaps (add SQLite tables or storage methods in `database.ts` if needed).
   - Topic Indexer (`indexNotebookTopics` / `extractTopics`): parses notebook content/pages/strokes to extract topics and key concepts.
   - Study Recap Generator (`generateRecap`): generates structured `StudyRecap` with summaryText, keyConcepts, actionItems, generatedAt based on profile preferences.
2. Sidecar UI Drawer Panel (`src/components/Sidecar/SidecarPanel.tsx`):
   - Collapsible panel component tailored for iPadOS multi-column layout.
   - User profile management UI (add/remove subject tags, pick preferred recap format: bullet/executive/flashcard).
   - Recap generator view with trigger button & formatted summary card display (bullet points, key concepts, action items).
   - Topic search & navigation list.
3. App.tsx Integration:
   - Floating / toolbar button to toggle Sidecar drawer.
   - Pass current active notebook/pages state to SidecarPanel and StudyAgentHarness.
4. Unit Tests / Verification:
   - Create unit tests for `StudyAgentHarness` (`src/services/ai/__tests__/StudyAgentHarness.test.ts`).
5. Technical Recap File:
   - Specify requirements for creating `agent_memory/m4_ai_harness_recap.md` adhering to `RULE[e:\Projects\Notetaking App\.agents\AGENTS.md]`.

Write your detailed strategy report to `e:\Projects\Notetaking App\.agents\explorer_m4\analysis.md` and complete a soft handoff in `e:\Projects\Notetaking App\.agents\explorer_m4\handoff.md`.
Run build/typecheck commands (`npx tsc --noEmit` or `npm test` if available) to verify current project status.
Report back when finished.
