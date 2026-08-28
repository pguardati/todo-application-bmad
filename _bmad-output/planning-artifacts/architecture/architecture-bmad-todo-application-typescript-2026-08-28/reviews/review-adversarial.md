# Review — adversarial: two conforming units that still diverge

**Verdict:** CHANGES REQUIRED — six divergence pairs found; all closed in the spine.

## Critical

**A1 — Rollback granularity (AD-6).** Two stories both obey "restore the pre-call snapshot": one snapshots the whole list, one snapshots the affected row. Under two overlapping mutations (toggle then delete), the whole-list restore silently reverts the other mutation's committed change. *Closed:* AD-6 now mandates per-item rollback and forbids whole-list restore.

**A2 — Commit timing (AD-9).** "Commit once at the end of the request, in the session dependency" places the commit after FastAPI has serialized the response. A builder who follows it literally serializes uncommitted or expired instances; a builder who commits in the repository is non-conforming but correct. *Closed:* AD-9 now specifies repository functions `flush`+`refresh` and never commit; the dependency commits on success and rolls back on exception.

## High

**A3 — Who owns error copy (AD-4).** The envelope is fixed but the client side is not: one builder renders the server `message`, another switches on `error` with its own strings. Same API, two divergent UX vocabularies. *Closed:* AD-4 now requires the client to render the server `message` verbatim, with exactly one local fallback for a no-response network failure.

**A4 — Who partitions TODO vs DONE (AD-6).** `useTodos` owns state, but nothing says who splits the list. FR-2 and FR-5 could each filter independently, in different places, with different tie-breaks. *Closed:* AD-6 now requires `useTodos` to expose pre-partitioned `active` and `completed` arrays.

**A5 — E2E isolation (AD-11).** The `test` profile has one shared database. One spec assumes a clean slate, another assumes its predecessor's rows. Order-dependent, flaky under `--workers`. *Closed:* AD-11 now requires every spec to be order-independent and to reset state through the API.

## Medium

**A6 — Coverage denominators (AD-13).** "coverage gate 70%" over an unstated scope: a combined number lets a well-tested backend mask an untested client. *Closed:* AD-13 now fixes ≥70% line coverage on each side independently, enforced by the tool, with E2E excluded.

**A7 — Ports appear only in a diagram.** 5173 / 8080 / 8000 are shown but not binding, so `Makefile`, `vite.config.ts`, compose, and `playwright.config.ts` could each pick their own. *Closed:* added as a Consistency Convention row.
