# Project: Native iPadOS Page-Based Digital Notetaking App

## Architecture
- **Framework**: React Native with Expo (iPadOS support `ios.supportsTablet: true`)
- **Canvas Engine**: `@shopify/react-native-skia` + `react-native-gesture-handler` for hardware-accelerated 2D vector stroke rendering and low-latency touch/Apple Pencil handling.
- **Storage Layer**: `expo-sqlite` for structured offline relational storage of Notebooks, Pages, Vector Stroke Data, and Study Profiles.
- **AI Agentic Harness**: `StudyAgentHarness` local engine managing user study profile, topic indexing, automated note recaps, and interactive sidecar assistant UI.
- **Rules Compliance**: All phases produce structured technical recaps in `e:\Projects\Notetaking App\agent_memory\`.

## Code Layout
```
e:\Projects\Notetaking App\
├── app.json                  # Expo config with supportsTablet: true
├── package.json              # App dependencies & scripts
├── App.tsx                   # Main iPadOS App entry point & layout
├── src/
│   ├── components/
│   │   ├── Canvas/           # Skia Drawing Canvas, Stroke Renderer, Tool Palette
│   │   ├── Templates/        # Paper Template Renderers (Cornell, Grid, Lined, Blank)
│   │   ├── Notebook/         # Notebook Manager, Page Navigation, Page Reordering
│   │   └── Sidecar/          # AI Study Assistant Drawer / Panel
│   ├── services/
│   │   ├── storage/          # SQLite database schema, repositories, export/import
│   │   └── ai/               # StudyAgentHarness, profile manager, recap engine
│   ├── types/                # TypeScript definitions (Strokes, Tools, Notebooks, AI)
│   └── utils/                # Geometry, Skia path conversions, pressure scaling
└── agent_memory/             # Technical recaps per workspace rules
```

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Expo iPadOS Setup | Initialize Expo project, package.json, app.json (supportsTablet: true), TypeScript config, directory structure | None | DONE |
| 2 | M2: Skia Drawing Engine | Build hardware-accelerated Skia canvas, Apple Pencil pressure/tilt support, Pen/Highlighter/Eraser/Lasso tools, Paper templates | M1 | DONE |
| 3 | M3: Storage & Persistence | Implement expo-sqlite DB layer for notebooks, multi-page state, vector stroke serialization, JSON export/import | M1, M2 | DONE |
| 4 | M4: AI Study Agent Harness | Build StudyAgentHarness, local study profile memory, recap generator, topic indexer, and Sidecar UI panel | M1, M3 | DONE |
| 5 | M5: Integration & Recaps | Integrate full app workflow, run build/type verification, generate structured technical recaps in agent_memory/ | M1, M2, M3, M4 | DONE |

## Interface Contracts

### Canvas & Stroke Data (`src/types/canvas.ts`)
```typescript
export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'lasso';

export type TemplateType = 'blank' | 'lined' | 'grid' | 'cornell';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  tilt?: number;
  timestamp?: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  points: Point[];
  skiaPathSvg?: string;
  createdAt: number;
}
```

### Storage Repository (`src/services/storage/database.ts`)
```typescript
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
```

### AI Study Harness (`src/services/ai/StudyAgentHarness.ts`)
```typescript
export interface UserStudyProfile {
  subjectTags: string[];
  studyHabits: string[];
  preferredSummaryFormat: 'bullet' | 'executive' | 'flashcard';
}

export interface StudyRecap {
  notebookId: string;
  summaryText: string;
  keyConcepts: string[];
  actionItems: string[];
  generatedAt: number;
}
```
