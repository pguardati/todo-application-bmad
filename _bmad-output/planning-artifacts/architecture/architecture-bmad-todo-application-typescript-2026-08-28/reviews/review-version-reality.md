# Review — version & reality check

**Verdict:** PASS with fixes applied.

Method: live queries against pypi.org, registry.npmjs.org, nodejs.org/dist/index.json, plus a web check on the nginx Docker tags. No version was asserted from training data.

| Pinned | Verified | Source | Outcome |
|---|---|---|---|
| fastapi 0.141.1 | yes | PyPI | ok |
| sqlmodel 0.0.39 | yes | PyPI | ok |
| pydantic 2.13.4 | yes | PyPI | ok |
| uvicorn 0.52.4 | yes | PyPI | ok |
| pytest 9.1.1 | yes | PyPI | ok |
| httpx 0.28.1 | yes | PyPI | ok |
| ruff 0.16.5 | yes | PyPI | ok |
| react 19.2.8 | yes | npm | ok |
| vite 8.2.2 | yes | npm | ok |
| typescript 7.0.2 | yes | npm | ok — GA native port; assumption logged with TS 5.x fallback |
| vitest 4.1.11 | yes | npm | ok |
| @playwright/test 1.62.1 | yes | npm | ok |
| @vitejs/plugin-react 6.1.1 | yes | npm | ok |
| @testing-library/react 16.3.3 | yes | npm | ok |
| uv 0.9.x | yes | PyPI — actual latest 0.12.7 | **FIXED** → 0.12.x |
| @axe-core/playwright 4.x | yes | npm — 4.13.0 | **FIXED** → 4.13.0 |
| nginx alpine 1.27 | yes | Docker Hub — stable is 1.30.4 | **FIXED** → 1.30-alpine |
| Node 24 LTS | yes | nodejs.org — Krypton v24.20.0, LTS | ok |
| Python 3.13 | n/a | deliberate conservative pin, not "latest" | ok, assumption logged |

Findings: three stale pins, all corrected in place. Everything else confirmed current as of 2026-08-28.
