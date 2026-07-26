# Milestone 1 (M1) Technical Analysis & Implementation Blueprint

## 1. Executive Summary & Scope

**Milestone Target**: M1: Native iPadOS Expo Project Setup & Infrastructure  
**Primary Objective**: Establish the foundational Expo React Native codebase configured natively for iPadOS tablet orientation (`ios.supportsTablet: true`), TypeScript type checking, essential dependencies (`@shopify/react-native-skia`, `react-native-gesture-handler`, `expo-sqlite`, `@react-native-async-storage/async-storage`, `react-native-reanimated`), modular directory structure (`src/components/`, `src/services/`, `src/types/`, `src/utils/`, `agent_memory/`), and a clean starter `App.tsx`.

---

## 2. Existing Project Inventory & Gap Analysis

An examination of `e:\Projects\Notetaking App` reveals the following state:

| Item / Directory | Status | Notes |
|---|---|---|
| `PROJECT.md` | Present | Defines overall architecture, milestone breakdown, and interface contracts. |
| `README.md` | Present | Minimal stub. |
| `.git/` | Present | Version control initialized. |
| `.agents/` | Present | Agent metadata and subagent state directory. |
| `package.json` | **Missing** | Required to define dependencies, Expo SDK, scripts (`start`, `typecheck`, `test`). |
| `app.json` | **Missing** | Required for Expo app manifest and iPadOS configuration (`ios.supportsTablet: true`). |
| `tsconfig.json` | **Missing** | Required for TypeScript compiler configuration and path aliases (`@/*`). |
| `babel.config.js` | **Missing** | Required for Expo Babel setup and `react-native-reanimated/plugin`. |
| `App.tsx` | **Missing** | App entry point. |
| `src/` | **Missing** | Modular source code directory. |
| `agent_memory/` | **Missing** | Required by `AGENTS.md` workspace rules for technical recaps. |

---

## 3. Recommended Package Version Matrix

The following dependency versions are selected for Expo SDK 51/52 compatibility:

### Dependencies (`dependencies`):
| Package | Recommended Version | Purpose / Architectural Role |
|---|---|---|
| `expo` | `~51.0.0` | Core Expo framework & native runtime harness |
| `react` | `18.2.0` | React core library |
| `react-native` | `0.74.5` | React Native framework |
| `@shopify/react-native-skia` | `^1.2.3` | Hardware-accelerated 2D vector stroke rendering engine |
| `react-native-gesture-handler` | `~2.16.1` | Low-latency touch & Apple Pencil gesture handling |
| `expo-sqlite` | `~14.0.3` | Relational offline storage engine for Notebooks, Pages & Strokes |
| `@react-native-async-storage/async-storage` | `1.23.1` | Fast key-value persistence for settings & study profiles |
| `react-native-reanimated` | `~3.10.1` | High-performance UI/canvas animations & panel transitions |
| `expo-status-bar` | `~1.12.1` | Native iPad status bar management |

### Development Dependencies (`devDependencies`):
| Package | Recommended Version | Purpose / Architectural Role |
|---|---|---|
| `typescript` | `^5.3.3` | Static type safety |
| `@types/react` | `~18.2.79` | TypeScript definitions for React |
| `@types/react-native` | `^0.72.8` | TypeScript definitions for React Native |
| `@babel/core` | `^7.24.0` | Babel transpiler core |
| `babel-preset-expo` | `~11.0.0` | Babel preset for Expo React Native |
| `jest` | `^29.7.0` | JavaScript unit testing framework |
| `jest-expo` | `~51.0.0` | Jest preset configured for Expo environment |
| `react-test-renderer` | `18.2.0` | React rendering harness for unit testing |

---

## 4. Required Configuration File Specifications

### 4.1 `app.json`
Specifies iPadOS tablet configuration via `ios.supportsTablet: true` and `orientation: "default"` (allowing full landscape & portrait rotation on iPad).

```json
{
  "expo": {
    "name": "iPadOS Notetaking App",
    "slug": "notetaking-app",
    "version": "1.0.0",
    "orientation": "default",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.notetaking.ipadosapp",
      "infoPlist": {
        "UIRequiresFullScreen": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-sqlite"
    ]
  }
}
```

### 4.2 `package.json`
Includes standard scripts for running, typechecking, and testing.

```json
{
  "name": "notetaking-app",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "1.23.1",
    "@shopify/react-native-skia": "^1.2.3",
    "expo": "~51.0.0",
    "expo-sqlite": "~14.0.3",
    "expo-status-bar": "~1.12.1",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "react-native-gesture-handler": "~2.16.1",
    "react-native-reanimated": "~3.10.1"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "@types/react-native": "^0.72.8",
    "babel-preset-expo": "~11.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~51.0.0",
    "react-test-renderer": "18.2.0",
    "typescript": "^5.3.3"
  },
  "private": true
}
```

### 4.3 `tsconfig.json`
Extends `expo/tsconfig.base` and specifies path mapping (`@/*` -> `./src/*`).

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### 4.4 `babel.config.js`
Configures Babel with `babel-preset-expo` and registers `react-native-reanimated/plugin` (which MUST be listed last).

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
```

---

## 5. Project Directory Hierarchy Blueprint

The implementation agent will create the following folder structure under `e:\Projects\Notetaking App\`:

```
e:\Projects\Notetaking App\
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── App.tsx
├── agent_memory/
│   └── .gitkeep
└── src/
    ├── components/
    │   ├── Canvas/
    │   │   └── index.ts
    │   ├── Templates/
    │   │   └── index.ts
    │   ├── Notebook/
    │   │   └── index.ts
    │   └── Sidecar/
    │       └── index.ts
    ├── services/
    │   ├── storage/
    │   │   └── database.ts
    │   └── ai/
    │       └── StudyAgentHarness.ts
    ├── types/
    │   ├── canvas.ts
    │   ├── storage.ts
    │   ├── ai.ts
    │   └── index.ts
    └── utils/
        ├── geometry.ts
        └── pressure.ts
```

### 5.1 Interface Contracts (`src/types/`)

#### `src/types/canvas.ts`
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

#### `src/types/storage.ts`
```typescript
import { TemplateType } from './canvas';

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

#### `src/types/ai.ts`
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

---

## 6. Starter `App.tsx` Implementation Blueprint

The entry point `App.tsx` will wrap the layout inside `GestureHandlerRootView` (required by `react-native-gesture-handler`), rendering a responsive iPadOS application shell.

```tsx
import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const isIPadOS = Platform.OS === 'ios' && Platform.isPad;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Native iPadOS Notetaking App</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isIPadOS ? 'iPadOS Native Tablet Mode' : 'Tablet Mode Enabled'}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.sidebarPlaceholder}>
            <Text style={styles.sectionTitle}>Notebooks</Text>
            <Text style={styles.subText}>SQLite Storage Ready</Text>
          </View>

          <View style={styles.canvasPlaceholder}>
            <Text style={styles.sectionTitle}>Skia Canvas Workspace</Text>
            <Text style={styles.subText}>
              @shopify/react-native-skia & Gesture Handler Initialized
            </Text>
          </View>

          <View style={styles.sidecarPlaceholder}>
            <Text style={styles.sectionTitle}>AI Sidecar</Text>
            <Text style={styles.subText}>StudyAgentHarness Ready</Text>
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
  },
  badge: {
    backgroundColor: '#E7F5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#74C0FC',
  },
  badgeText: {
    color: '#1C7ED6',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  sidebarPlaceholder: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  canvasPlaceholder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidecarPlaceholder: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343A40',
    marginBottom: 6,
  },
  subText: {
    fontSize: 12,
    color: '#868E96',
  },
});
```

---

## 7. Verification & Build Validation Strategy

To verify Milestone 1 completion, the implementer will execute:

1. **Static Type Validation**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: 0 TypeScript errors.

2. **Expo Manifest & iPadOS Verification**:
   Inspect `app.json` to confirm `"ios": { "supportsTablet": true }`.

3. **Directory Compliance Check**:
   Verify presence of all `src/` modules (`components`, `services`, `types`, `utils`) and `agent_memory/`.

4. **Technical Recap Creation**:
   As required by `e:\Projects\Notetaking App\.agents\AGENTS.md`, write `e:\Projects\Notetaking App\agent_memory\m1_setup_recap.md` documenting procedure, goals, file lists, dependencies, and test results.

---

## 8. Step-by-Step Implementation Blueprint for Implementer

| Step | Target Action | Files Modified / Created |
|---|---|---|
| **Step 1** | Create directory tree | `src/components/{Canvas,Templates,Notebook,Sidecar}`, `src/services/{storage,ai}`, `src/types`, `src/utils`, `agent_memory` |
| **Step 2** | Write Expo App Manifest | `app.json` (`ios.supportsTablet: true`) |
| **Step 3** | Write Package Configuration | `package.json` |
| **Step 4** | Write TypeScript Configuration | `tsconfig.json` |
| **Step 5** | Write Babel Configuration | `babel.config.js` |
| **Step 6** | Write Type Definitions | `src/types/canvas.ts`, `src/types/storage.ts`, `src/types/ai.ts`, `src/types/index.ts` |
| **Step 7** | Write Starter Component Exports | `src/components/*/index.ts`, `src/services/*/index.ts`, `src/utils/index.ts` |
| **Step 8** | Write iPadOS Starter UI | `App.tsx` |
| **Step 9** | Execute Type Verification | Run `npx tsc --noEmit` |
| **Step 10** | Produce Technical Recap | `agent_memory/m1_setup_recap.md` |
