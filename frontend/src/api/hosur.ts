// Client for the Hosur Services backend (/api, proxied to FastAPI by Vite in dev).

export type Service = { id: string; name: string; tamil: string; category: string };
export type Provider = { id: string; name: string; phone: string; rating: number; experience: string; serviceId: string; area?: string };
export type Review = { id: string; providerId: string; userName: string; rating: number; comment: string; createdAt: string };
export type NewsItem = { id: string; badge: string; area: string; title: string; summary: string };
export type FeedPost = { id: string; author: string; handle: string; location: string; title: string; caption: string; accent: string; tag: string; likes: number; likedBy?: string[]; comments: number; createdAt: string };

export type HosurState = {
  services: Service[];
  providerCatalog: Record<string, Provider[]>;
  reviewsByProvider: Record<string, Review[]>;
  newsItems: NewsItem[];
  feedPosts: FeedPost[];
  askedFor: string[];
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().then((data) => data?.detail, () => undefined);
    throw new Error(typeof detail === "string" ? detail : `${method} /api${path} failed with ${response.status}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const hosurApi = {
  getState: () => request<HosurState>("/state"),
  addService: (service: Service) => request<Service>("/services", "POST", service),
  addProvider: (provider: Provider) => request<Provider>("/providers", "POST", provider),
  updateProviderArea: (providerId: string, area: string) => request<Provider>(`/providers/${encodeURIComponent(providerId)}`, "PATCH", { area }),
  removeProvider: (providerId: string) => request<void>(`/providers/${encodeURIComponent(providerId)}`, "DELETE"),
  addReview: (review: Review) => request<Review>("/reviews", "POST", review),
  addNewsItem: (item: NewsItem) => request<NewsItem>("/news", "POST", item),
  addFeedPost: (post: FeedPost) => request<FeedPost>("/feed", "POST", post),
  likePost: (postId: string, userId: string) => request<FeedPost>(`/feed/${encodeURIComponent(postId)}/like`, "POST", { userId }),
  addAskedFor: (query: string) => request<string[]>("/asked-for", "POST", { query }),
};
