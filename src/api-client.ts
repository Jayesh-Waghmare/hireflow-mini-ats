export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const read = !options.method || options.method === "GET";
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(35000),
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw new ApiError(
          "The service returned an invalid response. Please try again.",
          response.ok ? 503 : response.status,
        );
      }
      if (!response.ok)
        throw new ApiError(
          typeof body?.error === "string"
            ? body.error
            : "The request failed. Please try again.",
          response.status,
        );
      return body as T;
    } catch (error) {
      if (
        read &&
        attempt === 0 &&
        (!(error instanceof ApiError) || error.status >= 500)
      )
        continue;
      if (error instanceof ApiError) throw error;
      throw new Error(
        "The connection was interrupted. Check your connection and try again.",
      );
    }
  }
}
