import { API_BASE_URL } from "../config.js";

const inFlightControllers = new Map();

export class ApiError extends Error {
  constructor({
    message,
    status = 0,
    code = "REQUEST_FAILED",
    details = null,
    url = "",
    method = "GET",
    isAbort = false,
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
    this.method = method;
    this.isAbort = isAbort;
  }
}

function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== null && entry !== undefined) {
          searchParams.append(key, String(entry));
        }
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildRequestUrl(endpoint, params = {}) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}${toQueryString(params)}`;
}

function createLinkedController(externalSignal) {
  const controller = new AbortController();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason || "external-abort");
    } else {
      externalSignal.addEventListener(
        "abort",
        () => controller.abort(externalSignal.reason || "external-abort"),
        { once: true }
      );
    }
  }

  return controller;
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  try {
    return await response.text();
  } catch (_error) {
    return null;
  }
}

function createErrorFromResponse({ response, payload, url, method }) {
  const messageFromPayload =
    payload && typeof payload === "object"
      ? payload.error || payload.message || null
      : null;

  return new ApiError({
    message: messageFromPayload || `HTTP ${response.status}`,
    status: response.status,
    code: "HTTP_ERROR",
    details: payload,
    url,
    method,
  });
}

function registerInFlight(cancelKey, controller, cancelPrevious = false) {
  if (!cancelKey) {
    return;
  }

  if (cancelPrevious && inFlightControllers.has(cancelKey)) {
    const previous = inFlightControllers.get(cancelKey);
    previous.abort("superseded");
  }

  inFlightControllers.set(cancelKey, controller);
}

function clearInFlight(cancelKey, controller) {
  if (!cancelKey) {
    return;
  }

  const current = inFlightControllers.get(cancelKey);
  if (current === controller) {
    inFlightControllers.delete(cancelKey);
  }
}

export function cancelPendingRequest(cancelKey, reason = "cancelled") {
  const controller = inFlightControllers.get(cancelKey);
  if (!controller) {
    return false;
  }

  controller.abort(reason);
  inFlightControllers.delete(cancelKey);
  return true;
}

export function createRequestController() {
  const controller = new AbortController();
  return {
    controller,
    signal: controller.signal,
    cancel: (reason = "cancelled") => controller.abort(reason),
  };
}

export async function apiRequest(endpoint, options = {}) {
  const {
    method = "GET",
    params = {},
    body,
    headers = {},
    signal,
    cancelKey,
    cancelPrevious = false,
  } = options;

  const url = buildRequestUrl(endpoint, params);
  const controller = createLinkedController(signal);

  registerInFlight(cancelKey, controller, cancelPrevious);

  try {
    const hasBody = body !== undefined && body !== null;
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      body: hasBody ? JSON.stringify(body) : undefined,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw createErrorFromResponse({ response, payload, url, method });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new ApiError({
        message: "Request aborted",
        status: 0,
        code: "ABORTED",
        details: null,
        url,
        method,
        isAbort: true,
      });
    }

    throw new ApiError({
      message: error?.message || "Network error",
      status: 0,
      code: "NETWORK_ERROR",
      details: null,
      url,
      method,
    });
  } finally {
    clearInFlight(cancelKey, controller);
  }
}

export const apiClient = {
  get(endpoint, params = {}, options = {}) {
    return apiRequest(endpoint, { ...options, method: "GET", params });
  },

  post(endpoint, body = null, params = {}, options = {}) {
    return apiRequest(endpoint, { ...options, method: "POST", params, body });
  },
};
