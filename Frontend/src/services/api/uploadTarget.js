import { API_BASE_URL } from "./config.js";

export const UPLOAD_TARGETS = {
  DEFAULT: "default",
  VPS: "vps",
};

export const UPLOAD_TARGET_STORAGE_KEY = "tuggo_upload_target";
export const UPLOAD_TARGET_CHANGED_EVENT = "uploadTargetChanged";

const rawVpsUploadBaseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_VPS_UPLOAD_API_BASE_URL
    ? String(import.meta.env.VITE_VPS_UPLOAD_API_BASE_URL).trim()
    : "";

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

export const getConfiguredVpsUploadApiBaseUrl = () => normalizeBaseUrl(rawVpsUploadBaseUrl);
export const isVpsUploadTargetAvailable = () => Boolean(getConfiguredVpsUploadApiBaseUrl());

export const getUploadTarget = () => {
  if (typeof window === "undefined") return UPLOAD_TARGETS.DEFAULT;
  const stored = localStorage.getItem(UPLOAD_TARGET_STORAGE_KEY);
  return stored === UPLOAD_TARGETS.VPS ? UPLOAD_TARGETS.VPS : UPLOAD_TARGETS.DEFAULT;
};

export const setUploadTarget = (target) => {
  if (typeof window === "undefined") return UPLOAD_TARGETS.DEFAULT;
  const nextTarget = target === UPLOAD_TARGETS.VPS ? UPLOAD_TARGETS.VPS : UPLOAD_TARGETS.DEFAULT;

  if (nextTarget === UPLOAD_TARGETS.DEFAULT) {
    localStorage.removeItem(UPLOAD_TARGET_STORAGE_KEY);
  } else {
    localStorage.setItem(UPLOAD_TARGET_STORAGE_KEY, nextTarget);
  }

  window.dispatchEvent(
    new CustomEvent(UPLOAD_TARGET_CHANGED_EVENT, {
      detail: {
        target: nextTarget,
        baseUrl: getUploadApiBaseUrl(nextTarget),
      },
    }),
  );

  return nextTarget;
};

export const getUploadApiBaseUrl = (target = getUploadTarget()) => {
  if (target === UPLOAD_TARGETS.VPS && isVpsUploadTargetAvailable()) {
    return getConfiguredVpsUploadApiBaseUrl();
  }
  return normalizeBaseUrl(API_BASE_URL) || "/api/v1";
};

export const joinApiUrl = (baseUrl, path) => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
};

export const getUploadAuthToken = () => {
  if (typeof window === "undefined") return null;
  const candidateKeys = [
    "admin_accessToken",
    "restaurant_accessToken",
    "delivery_accessToken",
    "user_accessToken",
    "accessToken",
  ];

  for (const key of candidateKeys) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }

  return null;
};

export const getUploadAuthHeaders = () => {
  const token = getUploadAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
