import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export const WS_URL = import.meta.env.VITE_WS_URL ?? API_URL;

export const api = axios.create({ baseURL: API_URL });
const authApi = axios.create({ baseURL: API_URL });

type AuthTokens = { accessToken: string; refreshToken: string };
type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshRequest: Promise<string> | null = null;

function clearSession() {
  localStorage.removeItem("cartparty.accessToken");
  localStorage.removeItem("cartparty.refreshToken");
  window.dispatchEvent(new Event("cartparty:session-expired"));
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cartparty.accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequest | undefined;
    const isAuthRequest = request?.url?.startsWith("/auth/");

    if (error.response?.status !== 401 || !request || request._retry || isAuthRequest) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("cartparty.refreshToken");
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    request._retry = true;

    try {
      if (!refreshRequest) {
        refreshRequest = authApi
          .post<AuthTokens>("/auth/refresh", { refreshToken })
          .then(({ data }) => {
            localStorage.setItem("cartparty.accessToken", data.accessToken);
            localStorage.setItem("cartparty.refreshToken", data.refreshToken);
            window.dispatchEvent(new CustomEvent<string>("cartparty:token-refreshed", { detail: data.accessToken }));
            return data.accessToken;
          })
          .finally(() => {
            refreshRequest = null;
          });
      }

      const accessToken = await refreshRequest;
      request.headers.Authorization = `Bearer ${accessToken}`;
      return api.request(request);
    } catch (refreshError) {
      clearSession();
      return Promise.reject(refreshError);
    }
  }
);

export type User = { id: string; name: string; email: string };
export type Workspace = {
  id: string;
  name: string;
  _count?: { products: number };
  members?: { user: User; role: string }[];
};
export type VoteType = "love" | "pass" | "favorite";
export type Product = {
  id: string;
  title: string;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeName?: string | null;
  currentPrice?: string | number | null;
  currency: string;
  notes?: string | null;
  createdAt: string;
  votes: { userId: string; voteType: VoteType }[];
  comments: Comment[];
  priceHistory: PricePoint[];
  adder: User;
};
export type Comment = { id: string; body: string; createdAt: string; user: User };
export type PricePoint = { id: string; price: string | number; recordedAt: string };
export type ActivityEvent = {
  id: string;
  eventType: "product_added" | "vote_cast" | "comment_added" | "price_dropped";
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: User;
};

export function priceLabel(value?: string | number | null, currency = "USD") {
  if (value == null) return "No price";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
}
