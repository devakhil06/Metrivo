let refreshInFlight: Promise<boolean> | null = null;

function withSecurityHeader(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("X-Metrivo-Request", "1");
  return { ...init, headers };
}

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", withSecurityHeader({ method: "POST" }))
      .then(async (response) => {
        if (response.ok) return true;
        if (response.status !== 409) return false;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        const retry = await fetch("/api/auth/refresh", withSecurityHeader({ method: "POST" }));
        return retry.ok;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = withSecurityHeader(init);
  let response = await fetch(input, request);
  const url = String(input);
  const isAuthAction = /\/api\/auth\/(login|register|logout|refresh)$/.test(url);

  if (response.status !== 401 || isAuthAction) {
    return response;
  }

  if (!(await refreshSession())) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    return response;
  }
  response = await fetch(input, request);
  return response;
}
