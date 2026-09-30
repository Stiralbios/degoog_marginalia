# degoog_marginalia

A [degoog](https://github.com/degoog-org/degog) store repository that adds a **Marginalia Search** engine.

Marginalia is an independent, open-source search engine that favors text-heavy, non-commercial sites. This engine talks to Marginalia's JSON API and fits into degoog's engine registry like any other store engine.

## Installation

1. Open degoog **Settings > Store**
2. Add this repository URL:
   ```
   https://github.com/Stiralbios/degoog_marginalia.git
   ```
3. Install **Marginalia** from the engine list
4. Go to **Settings > Engines**, click **Configure** on Marginalia, and paste your API key

You can request an API key at https://about.marginalia-search.com/article/api/

## Settings

| Setting | Required | Default | Description |
| :------ | :------- | :------ | :---------- |
| **API key** | yes | empty | Your Marginalia API key. Public keys are **not** supported. |
| **Marginalia API URL** | no | `https://api2.marginalia-search.com` | Base URL of the Marginalia API. Change this only if you run your own instance or mirror. |
| **Custom filter** | no | empty | Name of a custom filter uploaded to your API key. Leave blank to search without a filter. |

The engine searches the `web` tab by default. Paging and result counts follow Marginalia's API semantics (`page`, `count=20`).

## Development

Run the repository tests with:

```bash
npm test
# or, if you only have node:
node --test engines/marginalia.test.mjs
```

The test suite checks request building, result mapping, blank-query handling, missing-key handling, timeout/cancellation behavior, and JSON/HTTP error paths.

## How this repository was made

This repository was **vibe-coded**: I described the goal, inspected the existing conventions in `../degoog-toolkit` and the upstream SearXNG `marginalia.py` engine, and iteratively generated the engine, tests, and packaging until the tests passed.

Process snapshot:
1. **Read the references** — looked at how `degoog-toolkit` engines declare settings, handle `context.fetch`, send `API-Key` headers, and write `*.test.mjs` tests.
2. **Mirrored SearXNG's API shape** — used the same `api2.marginalia-search.com` endpoint, query params (`query`, `page`, `count`, `nsfw`, `filter`), and JSON result fields (`title`, `url`, `description`).
3. **Implemented the engine** — wrote `engines/marginalia/index.js` with required `apiKey`, optional `baseUrl`, optional `filterName`, and degoog-style error handling.
4. **Wrote tests** — copied the testing patterns from `degoog-toolkit` (mock `fetch`, `sentinel`, `engineError`, abort/cancellation cases) and adjusted them for Marginalia's response shape.
5. **Ran and fixed** — tests failed at first due to a bad relative import path; fixed `./engines/marginalia/index.js` to `./marginalia/index.js`, reran, and all 9 tests passed.
6. **Committed and pushed** — the repository was committed and pushed to `main`.

If you find a bug, open an issue or PR. This engine is intentionally small and stays close to Marginalia's public API.
