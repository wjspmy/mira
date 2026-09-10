export type TextSelection = { from: number; to: number };

export function clampTextSelection(
  docLength: number,
  selection: TextSelection | null | undefined,
): TextSelection | null {
  if (!selection) return null;
  const length = Math.max(0, docLength);
  const from = Math.min(Math.max(0, selection.from), length);
  const to = Math.min(Math.max(from, selection.to), length);
  return { from, to };
}
