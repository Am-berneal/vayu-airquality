export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 5000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}