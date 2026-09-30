const DEFAULT_BASE_URL = "https://api2.marginalia-search.com";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const RESULTS_PER_PAGE = 20;

function normalizeApiBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function mapResults(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.flatMap((result) => {
    if (!result || typeof result !== "object") return [];
    const url = String(result.url ?? "").trim();
    if (!url) return [];
    const title = String(result.title ?? "").trim() || url;
    const snippet = String(result.description ?? "").trim();
    return [{ title, url, snippet, source: "Marginalia" }];
  });
}

export const type = "web";
export const site = "https://marginalia.nu";
export const outgoingHosts = ["api2.marginalia-search.com"];

class MarginaliaEngine {
  name = "Marginalia";
  bangShortcut = "mar";
  baseUrl = DEFAULT_BASE_URL;
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;

  settingsSchema = [
    {
      key: "apiKey",
      label: "API key",
      type: "text",
      required: true,
      description:
        "Your Marginalia API key. Public keys are not supported; request one at https://about.marginalia-search.com/article/api/",
    },
    {
      key: "baseUrl",
      label: "Marginalia API URL",
      type: "text",
      default: DEFAULT_BASE_URL,
      description:
        "Base URL for the Marginalia API (default: https://api2.marginalia-search.com).",
    },
    {
      key: "filterName",
      label: "Custom filter",
      type: "text",
      default: "",
      description:
        "Optional name of a custom filter uploaded to your API key.",
    },
  ];

  #apiKey = "";
  #filterName = "";

  configure(settings = {}) {
    if (typeof settings.apiKey === "string") {
      this.#apiKey = settings.apiKey.trim();
    }
    const baseUrl = normalizeApiBaseUrl(settings.baseUrl);
    if (baseUrl) this.baseUrl = baseUrl;
    if (typeof settings.filterName === "string") {
      this.#filterName = settings.filterName.trim();
    }
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    const normalizedQuery = String(query ?? "").trim();
    if (!normalizedQuery) return [];
    if (!this.#apiKey) {
      throw new Error("Marginalia engine requires an API key");
    }

    const parsedPage = Number.parseInt(page, 10);
    const pageNo = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const params = new URLSearchParams({
      query: normalizedQuery,
      page: String(pageNo),
      count: String(RESULTS_PER_PAGE),
      nsfw: "0",
    });
    if (this.#filterName) params.set("filter", this.#filterName);

    const url = `${this.baseUrl}/search?${params}`;
    const doFetch = context?.fetch ?? fetch;
    const requestController = new AbortController();
    const parentSignal = context?.signal;
    const abortFromParent = () => requestController.abort(parentSignal.reason);
    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

    let timedOut = false;
    let timeoutId;
    const timeoutPromise = new Promise((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        const timeoutError = new Error(`${this.name} upstream request timed out`);
        requestController.abort(timeoutError);
        reject(timeoutError);
      }, this.requestTimeoutMs);
    });

    let response;
    try {
      response = await Promise.race([
        doFetch(url, {
          headers: {
            Accept: "application/json",
            "API-Key": this.#apiKey,
          },
          signal: requestController.signal,
        }),
        timeoutPromise,
      ]);
      if (typeof context?.sentinel === "function") {
        context.sentinel(response, this.name);
      } else if (!response.ok) {
        throw new Error(`${this.name} upstream returned HTTP ${response.status}`);
      }
      const data = await Promise.race([response.json(), timeoutPromise]);
      return mapResults(data);
    } catch (error) {
      if (timedOut) {
        if (typeof context?.engineError === "function") {
          throw context.engineError(
            "timeout",
            `${this.name} upstream request timed out`,
            { engine: this.name },
          );
        }
        throw new Error(`${this.name} upstream request timed out`, {
          cause: error,
        });
      }
      if (error?.name !== "SyntaxError") throw error;
      if (typeof context?.engineError === "function") {
        throw context.engineError(
          "parse_error",
          `${this.name} upstream returned invalid JSON`,
          { httpStatus: response?.status, engine: this.name },
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }
}

export default MarginaliaEngine;
