import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic editor history hook with debounced snapshotting.
 * Keeps a LIFO stack of past states (up to `capacity`, default 10).
 *
 * Usage:
 *   const { undo, canUndo } = useEditorHistory(state, applySnapshot);
 *
 * - `state`: an object representing the consolidated editor state.
 * - `onApplySnapshot`: invoked with a previous snapshot when undo() runs.
 *
 * To avoid pushing the undo application itself to history, callers should
 * set `isApplyingUndoRef.current = true` around the setX calls (the hook
 * also debounces, so a single applied frame is collapsed).
 */
export function useEditorHistory<T extends Record<string, unknown>>(
  state: T,
  onApplySnapshot: (snapshot: T) => void,
  options?: { capacity?: number; debounceMs?: number; enabled?: boolean },
) {
  const capacity = options?.capacity ?? 10;
  const debounceMs = options?.debounceMs ?? 400;
  const enabled = options?.enabled ?? true;

  const stackRef = useRef<string[]>([]); // serialized snapshots
  const lastSerializedRef = useRef<string | null>(null);
  const skipNextRef = useRef<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Initialize baseline once enabled.
  useEffect(() => {
    if (!enabled) return;
    if (lastSerializedRef.current === null) {
      try {
        lastSerializedRef.current = JSON.stringify(state);
      } catch {
        lastSerializedRef.current = "";
      }
    }
  }, [enabled, state]);

  // Track changes with debounce.
  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      let serialized = "";
      try {
        serialized = JSON.stringify(state);
      } catch {
        return;
      }
      if (serialized === lastSerializedRef.current) return;

      if (skipNextRef.current) {
        // The change came from undo application — just sync baseline.
        skipNextRef.current = false;
        lastSerializedRef.current = serialized;
        return;
      }

      // Push the previous baseline onto the stack.
      if (lastSerializedRef.current) {
        stackRef.current.push(lastSerializedRef.current);
        if (stackRef.current.length > capacity) {
          stackRef.current.splice(0, stackRef.current.length - capacity);
        }
        setCanUndo(stackRef.current.length > 0);
      }
      lastSerializedRef.current = serialized;
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, enabled, capacity, debounceMs]);

  const undo = useCallback(() => {
    const prev = stackRef.current.pop();
    setCanUndo(stackRef.current.length > 0);
    if (!prev) return;
    try {
      const parsed = JSON.parse(prev) as T;
      skipNextRef.current = true;
      lastSerializedRef.current = prev;
      onApplySnapshot(parsed);
    } catch {
      // ignore corrupt snapshot
    }
  }, [onApplySnapshot]);

  return { undo, canUndo };
}
