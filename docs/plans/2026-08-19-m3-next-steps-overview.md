# M3 后续工作总览 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining M3 productivity work: add source mode, add custom CSS, and keep the editor responsive and easy to recover.

**Architecture:** Keep the current Tiptap WYSIWYG editor as the default path, then add a parallel Markdown source editor for the same document data. Move appearance preferences into a small settings store so source mode, theme, and custom CSS can be loaded once and reused everywhere.

**Tech Stack:** Vue 3, Tiptap/ProseMirror, CodeMirror 6, Pinia, Tauri 2/Rust, TypeScript, CSS.

---

## Phases

### Phase 1: Source Mode
- Add a toggle between WYSIWYG and raw Markdown editing.
- Reuse the same document/session model so switching modes does not lose content.
- Make source mode the fallback path for very large documents.

### Phase 2: Custom CSS
- Add a persisted custom CSS path.
- Load and inject user CSS after the built-in styles.
- Keep the injection scoped so chrome stays stable.

### Phase 3: Polish and Hardening
- Add regression tests for mode switching, persistence, and CSS loading.
- Update docs and roadmap status.
- Validate the whole flow with manual testing.

---

## Risks

- Mode switching can accidentally desync Markdown text and the editor state.
- Custom CSS can affect layout if it is injected too broadly.
- Large documents can make source-mode rendering or syncing feel sluggish if updates are not throttled.

---

## Exit Criteria

- Users can toggle source mode without losing edits.
- Source mode opens large files cleanly.
- Custom CSS loads from a saved path and survives restart.
- Existing M0-M3 behavior still passes regression checks.