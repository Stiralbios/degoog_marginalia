# degoog_marginalia

A [degoog](https://github.com/degoog-org/degog) store repository that adds a **Marginalia Search** engine (web).

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

Paging and result counts follow Marginalia's API semantics (`page`, `count=20`).

## Development

Run the repository tests with:

```bash
npm test
# or, if you only have node:
node --test engines/marginalia.test.mjs
```

The test suite checks request building, result mapping, blank-query handling, missing-key handling, timeout/cancellation behavior, and JSON/HTTP error paths.

## How this repository was made

This repository was **vibe-coded**: The existing conventions in [degoog-toolkit](https://github.com/SoPat712/degoog-toolkit) and SearXNG's `marginalia.py` engine were used as references to generate the engine, tests, and packaging.
