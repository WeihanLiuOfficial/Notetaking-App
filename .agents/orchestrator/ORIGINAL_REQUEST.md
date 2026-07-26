# Original User Request

## 2026-07-24T21:48:26Z

Build a native iPadOS Page-Based Digital Notetaking application using React Native and Expo, featuring hardware-accelerated Apple Pencil drawing (Shopify Skia), low-latency pressure and tilt sensitivity, paper templates, offline SQLite storage, and an adaptive AI study agent harness.

Working directory: e:\Projects\Notetaking App
Integrity mode: development

## Requirements

### R1. Native iPadOS React Native + Expo App Setup
Initialize an Expo React Native application configured specifically for iPadOS with tablet screen orientation support enabled (`supportsTablet: true`).

### R2. Hardware-Accelerated Apple Pencil Drawing Engine
Build a high-performance 2D drawing canvas using `@shopify/react-native-skia` and `react-native-gesture-handler` supporting low-latency stylus input, pressure sensitivity scaling, tilt dynamics, palm rejection, customizable pen/highlighter/eraser tools, lasso selection, and paper templates (Cornell, Lined, Grid, Blank).

### R3. Offline Notebook & Page Persistence
Implement an offline storage layer using `expo-sqlite` / Async Storage to create, save, load, and manage multi-page digital notebooks, stroke data, paper templates, and page thumbnail previews.

### R4. Adaptive AI Agentic Harness
Implement a modular study agent harness (`StudyAgentHarness`) that maintains a local user study profile, indexes note topics, generates contextual note recaps/summaries, and provides study navigation support.

## Acceptance Criteria

### Build & Setup Verification
- [ ] Expo React Native project is successfully initialized in `e:\Projects\Notetaking App` and passes TypeScript compilation or clean Expo startup.

### Ink & Canvas Engine Verification
- [ ] Skia drawing canvas renders vector stroke paths with low latency.
- [ ] Supports pressure sensitivity, eraser, highlighter, pen, lasso selection, and template switching (Cornell, Grid, Lined, Blank).

### Storage & Persistence Verification
- [ ] Notebooks and drawn pages persist completely offline in SQLite and survive app reloads.

### AI Agentic Harness Verification
- [ ] AI Agent sidecar provides note recaps and maintains local user study profile state.

### Rules & Documentation Compliance
- [ ] Technical recap/walkthrough `.md` file is created under `e:\Projects\Notetaking App\agent_memory\` per project rules.

## 2026-07-24T21:06:50Z

You are the Project Orchestrator for the native iPadOS Notetaking App in e:\Projects\Notetaking App.

Your task is to execute Milestone 5: Full System Integration & Final QA.

Context & Current Status:
- M1 (Setup & Tablet Shell): COMPLETE (see agent_memory/m1_setup_recap.md)
- M2 (Skia Drawing Canvas & Apple Pencil Engine): COMPLETE (see agent_memory/m2_drawing_canvas_recap.md)
- M3 (SQLite Storage Persistence): COMPLETE (see agent_memory/m3_storage_persistence_recap.md)
- M4 (AI Study Agent Harness): COMPLETE (see agent_memory/m4_ai_harness_recap.md)

Milestone 5 Objective:
1. Wire together all components in App.tsx (Skia Canvas, Floating Toolbar, Page & Notebook Navigation, Offline Persistence via SQLite, and AI Sidecar Drawer).
2. Execute full automated verification and integration testing to confirm all acceptance criteria across the entire application are met.
3. Write the technical recap for Milestone 5 under agent_memory/m5_integration_recap.md following project rules in e:\Projects\Notetaking App\.agents\AGENTS.md.
4. Maintain progress in .agents/orchestrator/progress.md and plan in .agents/orchestrator/plan.md.

When Milestone 5 is completely finished, all tests pass, and m5_integration_recap.md is written, send a message to Sentinel claiming completion/victory so the mandatory Victory Audit can be performed.

