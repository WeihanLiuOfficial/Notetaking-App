## 2026-07-24T22:05:24Z

You are teamwork_preview_worker assigned to implement Milestone 4 (M4: AI Study Agent Harness & Sidecar UI Panel).

Working Directory: e:\Projects\Notetaking App\.agents\worker_m4
(Create this directory if needed, and write metadata/handoff files ONLY here).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Workspace Rules:
Per project rules (e:\Projects\Notetaking App\.agents\AGENTS.md), you MUST create a technical recap markdown file at:
`e:\Projects\Notetaking App\agent_memory\m4_ai_harness_recap.md`
containing Procedure, Goal, and Details (file lists, parameters, dependencies, validation tests).

Tasks to Perform:
1. **Storage Layer Extensions** (`src/types/storage.ts`, `src/services/storage/database.ts`):
   - Add schema/tables and repository methods for `user_study_profile` and `study_recaps`.
   - Implement methods in `IDatabaseRepository`, `InMemoryStorageRepository`, `SQLiteStorageRepository`, and `DatabaseService`:
     - `getStudyProfile()`: returns default or saved profile
     - `saveStudyProfile(profile)`: saves/updates user study profile
     - `saveStudyRecap(recap)`: saves generated recap
     - `getLatestRecapByNotebookId(notebookId)`: returns latest recap
     - `getRecapsByNotebookId(notebookId)`: returns all recaps for a notebook
2. **AI Study Harness Service** (`src/services/ai/StudyAgentHarness.ts`, `src/services/ai/index.ts`):
   - Update `StudyAgentHarness` class to accept `DatabaseService` (or fallback to default in-memory repo).
   - Implement `getUserProfile()` and `updateUserProfile(profile)`.
   - Implement `indexNotebookTopics(notebookId, pages, strokes)`: extracts topic tags, key concepts, and stroke metrics (analyzing titles, stroke counts, templates like Cornell summary/notes, tool types).
   - Implement `generateRecap(notebookId, pages, strokes)`: generates structured `StudyRecap` (`notebookId`, `summaryText`, `keyConcepts`, `actionItems`, `generatedAt`) formatted according to user profile's `preferredSummaryFormat` ('bullet' | 'executive' | 'flashcard').
   - Persist generated recaps to database via `saveStudyRecap`.
3. **Sidecar UI Drawer Panel** (`src/components/Sidecar/SidecarPanel.tsx`, `src/components/Sidecar/index.ts`):
   - Build a responsive iPadOS sidecar drawer UI component (~320px width).
   - Header with title ("AI Study Assistant") and close button.
   - Multi-tab navigation:
     - **Recap Assistant Tab**: "Generate Recap" button, recap summary card, key concepts list, action items list, summary format switcher.
     - **Topic Index Tab**: List of indexed topics/tags, search filter input, click-to-navigate page selection.
     - **Study Profile Tab**: View and edit subject tags (add tag, delete tag), study habits list, preferred summary format radio buttons.
4. **App.tsx Integration**:
   - Update `App.tsx` header toolbar to include an "AI Assistant" sidecar toggle button.
   - Add `isSidecarOpen` state.
   - Render `SidecarPanel` alongside the canvas when open.
   - Connect active notebook, page, and stroke state to `SidecarPanel` and `StudyAgentHarness`.
5. **Unit Test Suite** (`src/services/ai/__tests__/StudyAgentHarness.test.ts`, `src/services/ai/__tests__/run_tests.ts`):
   - Create unit tests verifying profile creation & update, database persistence, topic index extraction, recap generation in all 3 formats ('bullet', 'executive', 'flashcard'), and recap database retrieval.
   - Create self-contained `run_tests.ts` runner script following the pattern of `src/services/storage/__tests__/run_tests.ts`.
6. **Technical Recap File**:
   - Create `e:\Projects\Notetaking App\agent_memory\m4_ai_harness_recap.md` with full details.

When complete:
Write your handoff report to `e:\Projects\Notetaking App\.agents\worker_m4\handoff.md` summarizing files modified/created, implementation details, test results, and recap file path.
Report back when done.
