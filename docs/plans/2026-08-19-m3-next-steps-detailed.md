# M3 后续工作实施明细 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver source mode and custom CSS as the next M3 milestone, with safe persistence, clean toggles, and regression coverage.

**Architecture:** Keep the current Tiptap editor as the default. Introduce a dedicated CodeMirror-based source editor that binds to the same document text and session lifecycle, then add a lightweight settings store for appearance preferences and custom CSS injection.

**Tech Stack:** Vue 3, Tiptap/ProseMirror, CodeMirror 6, Pinia, Tauri 2/Rust, TypeScript, Vitest, CSS.

---

### Task 1: Add editor mode state and toggle commands

**Files:**
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/shortcuts/registry.ts`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/menus/appMenu.ts`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/App.vue`
- Create: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/stores/editor-mode.ts`
- Test: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/test/editor-mode.test.ts`

**Step 1: Write the failing test**

```ts
it("toggles source mode and remembers the active mode", () => {
  // expect default WYSIWYG, toggle to source, then persist and reload
});
```

**Step 2: Run test to verify it fails**

Run: `npm.cmd exec -- vitest run test/editor-mode.test.ts --environment node`
Expected: FAIL because the store and toggle do not exist yet.

**Step 3: Write minimal implementation**

- Add a Pinia store for editor mode.
- Add a command id such as `toggleSourceMode`.
- Wire the menu item and shortcut to the store.

**Step 4: Run test to verify it passes**

Run: `npm.cmd exec -- vitest run test/editor-mode.test.ts --environment node`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/shortcuts/registry.ts src/menus/appMenu.ts src/App.vue src/stores/editor-mode.ts test/editor-mode.test.ts
git commit -m "feat: add editor mode toggle"
```

---

### Task 2: Build the CodeMirror source editor path

**Files:**
- Create: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/components/SourceEditor.vue`
- Create: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/editor/source-editor.ts`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/App.vue`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/styles/editor.css`
- Test: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/test/source-editor.test.ts`

**Step 1: Write the failing test**

```ts
it("keeps Markdown text stable when switching between visual and source editors", () => {
  // round-trip a sample doc through source mode and back
});
```

**Step 2: Run test to verify it fails**

Run: `npm.cmd exec -- vitest run test/source-editor.test.ts --environment node`
Expected: FAIL because the component/helpers do not exist yet.

**Step 3: Write minimal implementation**

- Render CodeMirror from the current Markdown text.
- Emit text changes back to the same document state.
- Preserve cursor/scroll if practical.

**Step 4: Run test to verify it passes**

Run: `npm.cmd exec -- vitest run test/source-editor.test.ts --environment node`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/SourceEditor.vue src/editor/source-editor.ts src/App.vue src/styles/editor.css test/source-editor.test.ts
git commit -m "feat: add source editor"
```

---

### Task 3: Add custom CSS loading and persistence

**Files:**
- Create: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/stores/settings.ts`
- Create: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/editor/custom-css.ts`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/App.vue`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/components/ShortcutSettings.vue`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/src/styles/editor.css`
- Test: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/test/settings.test.ts`

**Step 1: Write the failing test**

```ts
it("loads custom css path from settings and injects it after the base theme", () => {
  // verify persisted path + loader behavior
});
```

**Step 2: Run test to verify it fails**

Run: `npm.cmd exec -- vitest run test/settings.test.ts --environment node`
Expected: FAIL because settings and loader do not exist yet.

**Step 3: Write minimal implementation**

- Add a settings store with a persisted custom CSS path.
- Load user CSS on startup and when the path changes.
- Scope injection so it does not break the chrome.

**Step 4: Run test to verify it passes**

Run: `npm.cmd exec -- vitest run test/settings.test.ts --environment node`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/stores/settings.ts src/editor/custom-css.ts src/App.vue src/components/ShortcutSettings.vue src/styles/editor.css test/settings.test.ts
git commit -m "feat: add custom css support"
```

---

### Task 4: Update docs and verify the whole package

**Files:**
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/README.md`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/docs/design.md`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/docs/plans/2026-08-19-m3-next-steps-overview.md`
- Modify: `C:/Users/Administrator.DESKTOP-GE3BNNM/mira/docs/plans/2026-08-19-m3-next-steps-detailed.md`

**Checks:**
1. Run `npm.cmd test`.
2. Run `npm.cmd run build`.
3. Run `cargo check` in `src-tauri`.
4. Manually verify mode switching, custom CSS loading, restart persistence, and unchanged M0-M3 behavior.
5. Commit and push only after user verification.

---

## Implementation Status

- [x] Task 1 implemented: persisted editor-mode state, configurable toggle shortcut, and View menu entry.
- [x] Task 1 user manual testing.
- [x] Task 2: CodeMirror source editor — committed scope accepted with known follow-up: 源码切回所见即所得后的光标/选区恢复仍待后续修复。
- [ ] Task 3: Custom CSS loading and persistence.
- [ ] Task 4: Documentation and final regression.
