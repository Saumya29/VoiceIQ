const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = envBaseUrl ? envBaseUrl.replace(/\/+$/, '') : '';

export function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
