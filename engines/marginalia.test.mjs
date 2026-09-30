import assert from "node:assert/strict";
import test from "node:test";

test("Marginalia builds the API request and maps results", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  let requestUrl;
  let requestInit;

  const results = await engine.executeSearch("open source search", 2, "any", {
    fetch: async (url, init) => {
      requestUrl = new URL(url);
      requestInit = init;
      return {
        ok: true,
        async json() {
          return {
            license: "test",
            query: "open source search",
            results: [
              {
                title: "Marginalia Search",
                url: "https://marginalia.nu/",
                description: "An independent search engine.",
                quality: 1,
                format: "html",
                details: "",
              },
              { title: "", url: "https://example.test/no-title" },
              { title: "ignored" },
            ],
          };
        },
      };
    },
  });

  assert.equal(module.type, "web");
  assert.equal(engine.bangShortcut, "mar");
  assert.equal(requestUrl.origin, "https://api2.marginalia-search.com");
  assert.equal(requestUrl.pathname, "/search");
  assert.equal(requestUrl.searchParams.get("query"), "open source search");
  assert.equal(requestUrl.searchParams.get("page"), "2");
  assert.equal(requestUrl.searchParams.get("count"), "20");
  assert.equal(requestUrl.searchParams.get("nsfw"), "0");
  assert.equal(requestInit.headers.Accept, "application/json");
  assert.equal(requestInit.headers["API-Key"], "test-key");
  assert.ok(requestInit.signal instanceof AbortSignal);
  assert.deepEqual(results, [
    {
      title: "Marginalia Search",
      url: "https://marginalia.nu/",
      snippet: "An independent search engine.",
      source: "Marginalia",
    },
    {
      title: "https://example.test/no-title",
      url: "https://example.test/no-title",
      snippet: "",
      source: "Marginalia",
    },
  ]);
});

test("Marginalia accepts a configurable base URL and filter", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({
    apiKey: "test-key",
    baseUrl: "https://mirror.example.test/",
    filterName: "myfilter",
  });
  let requestUrl;

  const results = await engine.executeSearch("marginalia", 1, "any", {
    fetch: async (url) => {
      requestUrl = new URL(url);
      return {
        ok: true,
        async json() {
          return {
            results: [
              {
                title: "Wrapped result",
                url: "https://example.test/result",
                description: "Wrapped description",
              },
            ],
          };
        },
      };
    },
  });

  assert.equal(requestUrl.origin, "https://mirror.example.test");
  assert.equal(requestUrl.pathname, "/search");
  assert.equal(requestUrl.searchParams.get("filter"), "myfilter");
  assert.equal(results[0].snippet, "Wrapped description");
});

test("Marginalia skips blank searches without fetching", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  let fetchCalls = 0;

  assert.deepEqual(
    await engine.executeSearch("   ", 1, "any", {
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("blank queries must not reach Marginalia");
      },
    }),
    [],
  );
  assert.equal(fetchCalls, 0);
});

test("Marginalia requires an API key", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  await assert.rejects(
    engine.executeSearch("query", 1, "any", {
      fetch: async () => ({ ok: true, json: async () => ({ results: [] }) }),
    }),
    /requires an API key/,
  );
});

test("Marginalia reports HTTP failures through sentinel", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  const failure = new Error("rate limited");
  let sentinelCall;

  await assert.rejects(
    engine.executeSearch("test query", 1, "any", {
      fetch: async () => ({ ok: false, status: 429 }),
      sentinel(response, engineName) {
        sentinelCall = { response, engineName };
        throw failure;
      },
    }),
    failure,
  );

  assert.equal(sentinelCall.response.status, 429);
  assert.equal(sentinelCall.engineName, engine.name);
});

test("Marginalia reports invalid JSON as a parse error", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  const parseFailure = new Error("parse failure");
  let engineErrorCall;

  await assert.rejects(
    engine.executeSearch("test query", 1, "any", {
      fetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          throw new SyntaxError("invalid json");
        },
      }),
      engineError(status, message, options) {
        engineErrorCall = { status, message, options };
        return parseFailure;
      },
    }),
    parseFailure,
  );

  assert.equal(engineErrorCall.status, "parse_error");
  assert.equal(engineErrorCall.options.httpStatus, 200);
  assert.equal(engineErrorCall.options.engine, engine.name);
});

test("Marginalia propagates network failures", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  const networkFailure = new Error("connection refused");

  await assert.rejects(
    engine.executeSearch("test query", 1, "any", {
      fetch: async () => {
        throw networkFailure;
      },
    }),
    networkFailure,
  );
});

test("Marginalia aborts a stalled upstream request", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  engine.requestTimeoutMs = 5;
  const timeoutFailure = new Error("timed out");
  let capturedSignal;
  let engineErrorCall;

  await assert.rejects(
    engine.executeSearch("test query", 1, "any", {
      fetch: async (_url, init) => {
        capturedSignal = init.signal;
        return await new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason),
            { once: true },
          );
        });
      },
      engineError(status, message, options) {
        engineErrorCall = { status, message, options };
        return timeoutFailure;
      },
    }),
    timeoutFailure,
  );

  assert.equal(capturedSignal.aborted, true);
  assert.equal(engineErrorCall.status, "timeout");
  assert.equal(engineErrorCall.options.engine, engine.name);
});

test("Marginalia forwards host cancellation", async () => {
  const module = await import("./marginalia/index.js");
  const engine = new module.default();
  engine.configure({ apiKey: "test-key" });
  const parent = new AbortController();
  const cancellation = new Error("search cancelled");
  let capturedSignal;

  const request = engine.executeSearch("test query", 1, "any", {
    signal: parent.signal,
    fetch: async (_url, init) => {
      capturedSignal = init.signal;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        );
      });
    },
  });
  parent.abort(cancellation);

  await assert.rejects(request, cancellation);
  assert.equal(capturedSignal.aborted, true);
  assert.equal(capturedSignal.reason, cancellation);
});
