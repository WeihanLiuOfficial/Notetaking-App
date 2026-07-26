# Milestone 3 Architecture & Implementation Blueprint: Offline SQLite Storage & Multi-page Notebook Persistence

## 1. Executive Summary & Scope Definition

Milestone 3 (M3) establishes offline persistence, multi-notebook hierarchy, multi-page layout management, vector stroke serialization, backup export/import capabilities, and a full UI navigation suite for the Native iPadOS Notetaking App.

### Core Objectives:
1. **Relational Database Schema & Fallback Repository Pattern**: Construct a robust SQLite relational schema (`notebooks`, `pages`, `strokes`) with foreign key cascade relationships, ordering indexes, and a cross-environment repository fallback architecture (`IDatabaseRepository` with native `expo-sqlite` driver and in-memory fallback driver for Jest test execution and Web environments).
2. **Storage Service API (`src/services/storage/database.ts`)**: Implement asynchronous CRUD operations for notebooks, pages (with transactional reordering and automatic index re-gap adjustment), vector stroke JSON serialization/deserialization, structured JSON notebook export/import backup engine, and vector SVG page exporter.
3. **Notebook UI Component Hierarchy (`src/components/Notebook/`)**: Develop `NotebookManager.tsx` sidebar (notebook creation, selection, rename, deletion, page count indicators) and `PageNavigator.tsx` top bar / drawer (page switching, add page, delete page, template switching, page thumbnail reorder interface).
4. **Seamless Canvas State Integration (`App.tsx` & `useCanvasState.ts`)**: Integrate stroke auto-saving on page change, history stack reset, active page template synchronization, and main workspace state binding.
5. **Comprehensive Unit Testing Suite (`src/services/storage/__tests__/database.test.ts`)**: Construct Jest unit tests validating repository initialization, CRUD, transactional page reordering, stroke serialization fidelity, backup import/export, and SVG generation.
6. **Technical Recap Blueprint (`agent_memory/m3_storage_persistence_recap.md`)**: Define the structure for documenting the implementation according to project rules in `.agents/AGENTS.md`.

---

## 2. Codebase & Architecture Baseline Analysis

### Existing Files & Dependencies:
- **`package.json`**:
  - `expo-sqlite`: `~14.0.3` (Expo SDK 51). Supports native `SQLite.openDatabaseSync` and `SQLite.openDatabaseAsync` APIs on iOS and Android.
  - `@react-native-async-storage/async-storage`: `1.23.1`. Available for secondary configuration storage.
  - `jest`: `^29.7.0`, `jest-expo`: `~51.0.0`. Node execution environment during unit testing requires an in-memory database fallback strategy since native SQLite C bindings are not natively loaded in standard Node Jest test runner without mocks.
- **`src/types/storage.ts`**:
  - Contains basic `Notebook` (`id`, `title`, `createdAt`, `updatedAt`) and `Page` (`id`, `notebookId`, `pageIndex`, `template`, `createdAt`, `updatedAt`) interfaces.
  - Needs extension to include `NotebookExportData` interface for backup JSON serialization.
- **`src/types/canvas.ts`**:
  - Defines `Point`, `Stroke` (`id`, `tool`, `color`, `size`, `points`, `skiaPathSvg`, `createdAt`), `TemplateType` ('blank' | 'lined' | 'grid' | 'cornell'), and `CanvasState`.
- **`src/services/storage/database.ts`**:
  - Currently an stub class (`DatabaseService`) with in-memory `Map` placeholders.
- **`src/components/Canvas/useCanvasState.ts`**:
  - Manages `strokes`, `undoStack`, `redoStack`, `currentTemplate`, `activeTool`, `activeColor`, `strokeWidth`.
  - Lacks explicit `loadStrokes(strokes: Stroke[])` and `resetCanvasHistory()` methods necessary for loading stored stroke data when switching pages.
- **`App.tsx`**:
  - Holds layout placeholders for `sidebarPlaceholder` (left) and `sidecarPlaceholder` (right). Needs real `NotebookManager` sidebar and `PageNavigator` bar integration.

---

## 3. Milestone 3 System Architecture & Blueprint

### 3.1 Relational SQLite Database Schema & Migration Strategy

#### Database Name: `notetaking_app.db`

#### Schema Definition (DDL):

```sql
-- Enable Foreign Key constraints in SQLite
PRAGMA foreign_keys = ON;

-- 1. Notebooks Table
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Pages Table
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY NOT NULL,
  notebook_id TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  template TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE
);

-- 3. Strokes Table
CREATE TABLE IF NOT EXISTS strokes (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL,
  stroke_index INTEGER NOT NULL,
  tool TEXT NOT NULL,
  color TEXT NOT NULL,
  size REAL NOT NULL,
  points_json TEXT NOT NULL,
  skia_path_svg TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE
);

-- 4. High-Performance Secondary Indexes
CREATE INDEX IF NOT EXISTS idx_pages_notebook_id ON pages(notebook_id);
CREATE INDEX IF NOT EXISTS idx_pages_notebook_order ON pages(notebook_id, page_index);
CREATE INDEX IF NOT EXISTS idx_strokes_page_id ON strokes(page_id);
CREATE INDEX IF NOT EXISTS idx_strokes_page_order ON strokes(page_id, stroke_index);
```

#### Key Schema Features:
- **Cascade Deletion (`ON DELETE CASCADE`)**: Deleting a notebook automatically removes all associated pages and strokes in SQLite.
- **Z-Index Ordering (`stroke_index`)**: Preserves visual drawing layering order within a page.
- **Ordered Page Indexing (`page_index`)**: 0-based index defining the sequential order of pages within a notebook.

---

### 3.2 Fallback Repository Pattern & Cross-Environment Strategy

To guarantee robust execution across iOS/Android native devices (`expo-sqlite`), Web browsers, and Jest test runner environments (Node.js), we establish a **Repository Strategy Pattern**.

```
                           +----------------------+
                           |   DatabaseService    |
                           +----------+-----------+
                                      |
                                      v
                        +----------------------------+
                        |    IDatabaseRepository     |
                        +-------------+--------------+
                                      |
              +-----------------------+-----------------------+
              |                                               |
              v                                               v
+---------------------------+                   +---------------------------+
|  SQLiteStorageRepository  |                   | InMemoryStorageRepository |
|      (expo-sqlite)        |                   | (Jest Node / Web Fallback)|
+---------------------------+                   +---------------------------+
```

#### Repository Interface (`IDatabaseRepository`):

```typescript
export interface IDatabaseRepository {
  initDatabase(): Promise<void>;
  
  // Notebook CRUD
  createNotebook(title: string): Promise<Notebook>;
  getNotebooks(): Promise<Notebook[]>;
  getNotebookById(id: string): Promise<Notebook | null>;
  updateNotebook(id: string, updates: Partial<Pick<Notebook, 'title'>>): Promise<Notebook>;
  deleteNotebook(id: string): Promise<void>;

  // Page CRUD & Reordering
  createPage(notebookId: string, template?: TemplateType, targetIndex?: number): Promise<Page>;
  getPagesByNotebookId(notebookId: string): Promise<Page[]>;
  getPageById(id: string): Promise<Page | null>;
  updatePageTemplate(pageId: string, template: TemplateType): Promise<Page>;
  reorderPages(notebookId: string, pageIdsInOrder: string[]): Promise<Page[]>;
  deletePage(pageId: string): Promise<void>;

  // Stroke Persistence
  saveStrokesForPage(pageId: string, strokes: Stroke[]): Promise<void>;
  getStrokesByPageId(pageId: string): Promise<Stroke[]>;

  // Backup & Export
  exportNotebookToJson(notebookId: string): Promise<string>;
  importNotebookFromJson(jsonContent: string): Promise<Notebook>;
  exportPageAsSvg(pageId: string, width?: number, height?: number): Promise<string>;
}
```

#### Automatic Fallback Logic in `DatabaseService`:
During `initDatabase()`, the service attempts to initialize `SQLiteStorageRepository`. If `expo-sqlite` native module is unavailable (e.g. throwing `SQLite native module not found` in Jest or Web), it seamlessly falls back to `InMemoryStorageRepository` without breaking the application runtime or test execution.

---

### 3.3 Storage Service Methods & API Specification (`src/services/storage/database.ts`)

#### 1. Notebook CRUD Operations
- **`createNotebook(title: string)`**:
  - Generates unique UUID for `notebookId`.
  - Creates notebook record.
  - Automatically creates initial Page 0 with default template `'lined'`.
  - Returns created `Notebook`.
- **`getNotebooks()`**:
  - Fetches all notebooks sorted by `updated_at DESC`.
- **`getNotebookById(id: string)`**:
  - Retrieves notebook by ID or returns `null`.
- **`updateNotebook(id: string, updates)`**:
  - Updates `title` and updates `updated_at = Date.now()`.
- **`deleteNotebook(id: string)`**:
  - Deleting notebook cascades deletion to all associated pages and strokes.

#### 2. Page CRUD & Reordering Operations
- **`createPage(notebookId: string, template: TemplateType = 'lined', targetIndex?: number)`**:
  - Retrieves current pages for notebook.
  - Calculates `page_index`. If `targetIndex` is specified, shifts all subsequent pages (`page_index >= targetIndex`) by +1.
  - Inserts new page at `targetIndex` (or end of array).
  - Updates notebook `updated_at`.
- **`getPagesByNotebookId(notebookId: string)`**:
  - Returns pages for notebook ordered by `page_index ASC`.
- **`updatePageTemplate(pageId: string, template: TemplateType)`**:
  - Updates `template` for specified page and updates `updated_at`.
- **`reorderPages(notebookId: string, pageIdsInOrder: string[])`**:
  - Accepts array of `pageId`s in desired order.
  - Updates each page's `page_index` to match its array index (0..N-1) within a transaction.
- **`deletePage(pageId: string)`**:
  - Fetches page details.
  - Deletes page (cascading strokes).
  - Re-indexes all remaining pages in the same notebook to close index gaps (ensuring continuous `0..N-1` order).

#### 3. Stroke Vector Serialization & Deserialization
- **`saveStrokesForPage(pageId: string, strokes: Stroke[])`**:
  - Begins transaction for `pageId`.
  - Deletes existing strokes associated with `pageId`.
  - Inserts new array of strokes with `stroke_index = index`.
  - Point Serialization: Converts `Point[]` array to JSON string (`points_json = JSON.stringify(stroke.points)`).
- **`getStrokesByPageId(pageId: string)`**:
  - Queries `strokes` where `page_id = pageId` ordered by `stroke_index ASC`.
  - Point Deserialization: Parses `points_json` back to `Point[]` objects.

#### 4. Backup Export / Import Engine & Vector SVG Exporter
- **`exportNotebookToJson(notebookId: string)`**:
  - Retrieves Notebook, all associated Pages, and all Strokes per page.
  - Constructs `NotebookExportData`:
    ```typescript
    export interface NotebookExportData {
      version: '1.0';
      exportedAt: number;
      notebook: Notebook;
      pages: Page[];
      strokesByPage: Record<string, Stroke[]>;
    }
    ```
  - Returns formatted JSON string (`JSON.stringify(data, null, 2)`).
- **`importNotebookFromJson(jsonContent: string)`**:
  - Parses JSON content and validates structure version.
  - Generates new IDs (or preserves imported IDs) and inserts notebook, pages, and strokes into storage.
  - Returns the restored `Notebook`.
- **`exportPageAsSvg(pageId: string, width: number = 800, height: number = 1000)`**:
  - Retrieves page details and all vector strokes for `pageId`.
  - Generates standard SVG XML payload string:
    ```xml
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
      <!-- Background Template Grid / Lines -->
      <rect width="100%" height="100%" fill="#FFFFFF"/>
      <!-- Strokes Vector Paths -->
      <path d="M 10 10 Q 15 15 20 20..." stroke="#000000" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="1.0"/>
    </svg>
    ```

---

### 3.4 Notebook UI Architecture & Component Hierarchy

#### Directory Layout: `src/components/Notebook/`
```
src/components/Notebook/
├── NotebookManager.tsx    # Left Sidebar Notebook List & Management
├── PageNavigator.tsx      # Top Navigation Bar & Page Control Toolbar
├── PageReorderModal.tsx   # Reorder & Thumbnail Modal Component
└── index.ts               # Re-export barrel file
```

#### Component Specifications:

1. **`NotebookManager.tsx` (Sidebar Component)**
   - Replaces `styles.sidebarPlaceholder` in `App.tsx`.
   - **Props**:
     - `notebooks: Notebook[]`
     - `activeNotebookId: string | null`
     - `onSelectNotebook: (id: string) => void`
     - `onCreateNotebook: (title: string) => void`
     - `onRenameNotebook: (id: string, newTitle: string) => void`
     - `onDeleteNotebook: (id: string) => void`
     - `onExportNotebook: (id: string) => void`
     - `onImportNotebook: () => void`
   - **UI Features**:
     - Modern iPadOS sidebar listing notebooks with active highlight.
     - Title, created date, page count badge.
     - "+ New Notebook" action button with modal / inline text input.
     - Action menu / buttons per notebook item (Rename, Delete with confirmation dialog, Export JSON).
     - "Import Notebook" button at bottom of list.

2. **`PageNavigator.tsx` (Top Navigation Bar Component)**
   - Displayed above or inside `canvasWorkspace` in `App.tsx`.
   - **Props**:
     - `currentPage: Page | null`
     - `totalPages: number`
     - `currentPageIndex: number` // 0-indexed
     - `onPrevPage: () => void`
     - `onNextPage: () => void`
     - `onAddPage: () => void`
     - `onDeletePage: () => void`
     - `onSelectTemplate: (template: TemplateType) => void`
     - `onOpenReorderModal: () => void`
     - `onExportPageSvg: () => void`
   - **UI Controls**:
     - **Page Switcher**: Left/Right chevron icons with active page counter display (`Page 2 of 5`). Chevron icons auto-disable at boundaries (`index === 0` and `index === totalPages - 1`).
     - **Add Page (+)**: Adds page right after current page.
     - **Delete Page (Trash)**: Deletes current page with confirmation dialog. Disabled if `totalPages <= 1`.
     - **Template Picker**: Dropdown / segmented selector for paper templates ('blank', 'lined', 'grid', 'cornell'). Updates active page template dynamically.
     - **Reorder Pages Button**: Opens `PageReorderModal` to view page thumbnails/list and shift page order up/down.
     - **Export SVG Button**: Triggers SVG file export for active page.

3. **`useCanvasState.ts` Extension Requirement**:
   To support seamless stroke loading during page switching:
   - Add `loadStrokes(newStrokes: Stroke[]): void`: Updates state strokes and clears `undoStack` and `redoStack`.
   - Add `resetCanvasHistory(): void`: Clears undo/redo stacks.

4. **Page Change Auto-Save Persistence Strategy**:
   When user selects a new page or notebook:
   1. Auto-save current active page strokes to database: `await databaseService.saveStrokesForPage(currentPageId, canvasState.strokes)`.
   2. Transition active page ID to `newPageId`.
   3. Fetch stored strokes for new page: `const newStrokes = await databaseService.getStrokesByPageId(newPageId)`.
   4. Update canvas state: `canvasState.loadStrokes(newStrokes)`.
   5. Update template state to `newPage.template`.

---

### 3.5 App Integration Plan (`App.tsx`)

#### Updated `App.tsx` State Architecture:

```typescript
// App.tsx State Hook Structure
const [notebooks, setNotebooks] = useState<Notebook[]>([]);
const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
const [pages, setPages] = useState<Page[]>([]);
const [activePageId, setActivePageId] = useState<string | null>(null);
const [isDbReady, setIsDbReady] = useState<boolean>(false);

const canvasState = useCanvasState('lined');
```

#### Lifecycle Hooks:
1. **On Mount**:
   - Call `databaseService.initDatabase()`.
   - Fetch `databaseService.getNotebooks()`.
   - If empty, auto-create "My Notebook" with initial page.
   - Set `activeNotebookId` and `activePageId`.
2. **On Page Change (`handleSwitchPage(targetPageId)`)**:
   - Save current page strokes.
   - Load target page strokes & template into `canvasState`.
   - Set `activePageId(targetPageId)`.

---

### 3.6 Unit Test Suite Plan (`src/services/storage/__tests__/database.test.ts`)

Create unit tests using Jest framework targeting `DatabaseService`:

```typescript
describe('DatabaseService (Milestone 3 Storage Engine)', () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    dbService = new DatabaseService();
    await dbService.initDatabase();
  });

  test('initDatabase should initialize database without error', async () => { ... });

  test('Notebook CRUD operations (create, get, update, delete)', async () => { ... });

  test('Page CRUD & transactional reordering (create, list, reorder, gap re-indexing on delete)', async () => { ... });

  test('Vector Stroke JSON serialization & deserialization fidelity', async () => { ... });

  test('Notebook exportToJson and importFromJson roundtrip accuracy', async () => { ... });

  test('Page exportPageAsSvg generates valid SVG string containing vector paths', async () => { ... });
});
```

---

### 3.7 Technical Recap Blueprint (`agent_memory/m3_storage_persistence_recap.md`)

Per project rules in `.agents/AGENTS.md`, the technical recap document must contain:
1. **Header & Milestone Title**: `Technical Recap: Milestone 3 — Offline SQLite Storage & Multi-page Notebook Persistence`
2. **Goal**: Business logic & technical objectives.
3. **Procedure**: Step-by-step implementation details for Database schema, Repository pattern, CRUD services, serialization, UI components, auto-save integration, unit testing.
4. **Details**:
   - Files Created & Modified list.
   - Key Parameters & Configurations (DB Name, Schema tables, PRAGMAs, Index definitions).
   - Validation & Test Execution Commands and Results (`tsc --noEmit`, `jest`).

---

## 4. Proposed Code Snippets & Diff Specifications

### 4.1 `src/types/storage.ts`

```typescript
import { TemplateType, Stroke } from './canvas';

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  notebookId: string;
  pageIndex: number;
  template: TemplateType;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookExportData {
  version: '1.0';
  exportedAt: number;
  notebook: Notebook;
  pages: Page[];
  strokesByPage: Record<string, Stroke[]>;
}
```

### 4.2 `src/components/Canvas/useCanvasState.ts` Extension

```typescript
// Proposed addition to return object of useCanvasState
const loadStrokes = useCallback((newStrokes: Stroke[]) => {
  setStrokes(newStrokes);
  setUndoStack([]);
  setRedoStack([]);
}, []);

return {
  ...
  loadStrokes,
  ...
};
```

---

## 5. Verification & Validation Protocol

1. **Type Safety Verification**:
   - Run TypeScript typecheck: `npm run typecheck` / `tsc --noEmit`. Must return 0 errors.
2. **Jest Unit Test Suite Execution**:
   - Run `npm test` or `jest src/services/storage/__tests__/database.test.ts`. Must pass 100% of test cases.
3. **Empirical Verification**:
   - Run empirical test suite to confirm stroke serialization, page reordering, and backup import/export roundtrip fidelity.
