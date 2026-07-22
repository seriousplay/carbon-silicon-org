type ApiError = { error?: string };

export async function readApiResponse<T extends object>(
  response: Response,
  fallbackMessage: string,
): Promise<T & ApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json() as T & ApiError;
    } catch {
      return { error: fallbackMessage } as T & ApiError;
    }
  }

  if (response.status === 504) {
    return {
      error: "请求等待超时，方案可能仍在后台生成。请稍后刷新页面查看结果。",
    } as T & ApiError;
  }

  return {
    error: response.ok ? fallbackMessage : `服务暂时不可用（HTTP ${response.status}），请稍后重试。`,
  } as T & ApiError;
}
