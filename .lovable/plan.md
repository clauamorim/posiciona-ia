

## Problem

The admin user is being redirected to `/choose-plan` because of a race condition in `AuthContext`. The `checkAdmin` call is wrapped in `setTimeout(..., 0)`, which defers it. When `ProtectedRoute` renders, `isLoading` is already `false` but `isAdmin` is still `false`, so line 28 redirects the admin to `/choose-plan`.

## Solution

Ensure `isLoading` stays `true` until ALL async checks (admin role, subscription, balances) have completed. This way `ProtectedRoute` shows the loading skeleton until the full auth state is resolved.

### Changes to `src/contexts/AuthContext.tsx`

1. Remove the `setTimeout` wrapper around the async calls in `onAuthStateChange`.
2. Make the auth state change handler `await` all three checks (`checkAdmin`, `loadSubscription`, `loadBalances`) before setting `isLoading = false`.
3. In `getSession`, similarly await all checks before setting `isLoading = false`.
4. Refactor so `setIsLoading(false)` only runs **after** all parallel checks resolve.

Specifically:
- In `onAuthStateChange`: call `await Promise.all([checkAdmin(...), loadSubscription(...), loadBalances(...)])` then `setIsLoading(false)`.
- In `getSession().then(...)`: same pattern — await all checks, then set loading false.
- Make `checkAdmin`, `loadSubscription`, `loadBalances` return their promises (they already do since they're async).

This is a single-file fix (~15 lines changed) that resolves the race condition for all `requirePlan` and `requireAdmin` routes.

