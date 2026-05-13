const LOCK_PATCH_FLAG = "__posicionaAuthLockPatchApplied__";

type NavigatorWithOptionalLocks = Navigator & { locks?: LockManager };

const applySupabaseAuthLockPatch = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if ((window as unknown as Record<string, boolean>)[LOCK_PATCH_FLAG]) return;

  const nav = navigator as NavigatorWithOptionalLocks;
  if (!nav.locks) return;

  const ownDescriptor = Object.getOwnPropertyDescriptor(nav, "locks");
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "locks");
  const restore = () => {
    try {
      if (ownDescriptor) {
        Object.defineProperty(nav, "locks", ownDescriptor);
      } else if (prototypeDescriptor) {
        delete (nav as { locks?: LockManager }).locks;
      }
    } catch {
      // If the browser blocks restoration, keeping Web Locks disabled is safer for auth than deadlocking login.
    }
  };

  try {
    Object.defineProperty(nav, "locks", {
      configurable: true,
      get: () => undefined,
    });
    (window as unknown as Record<string, boolean>)[LOCK_PATCH_FLAG] = true;
    queueMicrotask(restore);
  } catch {
    // If the property is not configurable, the installed auth client timeout still protects the UI.
  }
};

applySupabaseAuthLockPatch();