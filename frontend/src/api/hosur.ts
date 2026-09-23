// Client for the Hosur Services backend (/api, proxied to FastAPI by Vite in dev).

export type Service = { id: string; name: string; tamil: string; category: string };
export type Provider = { id: string; name: string; phone: string; rating: number; experience: string; serviceId: string; area?: string };
export type Review = { id: string; providerId: string; userName: string; rating: number; comment: string; createdAt: string };
export type NewsItem = { id: string; badge: string; area: string; title: string; summary: string };
export type FeedPost = { id: string; author: string; handle: string; location: string; title: string; caption: string; accent: string; tag: string; likes: number; likedBy?: string[]; comments: number; createdAt: string };
export type PowerShutdown = { id: string; title: string; areas: string[]; startsAt: string; endsAt: string; reason: string; sourceUrl: string; verifiedAt: string };
export type ChargingStation = { id: string; name: string; area: string; address: string; connectors: string; hours: string; sourceUrl: string; verifiedAt: string };
export type CivicCategory = "water" | "traffic" | "waste";
export type CivicAlert = { id: string; category: CivicCategory; title: string; areas: string[]; route: string; message: string; startsAt: string; expiresAt: string; sourceUrl: string; verifiedAt: string };
export type EmergencyContact = { id: string; name: string; service: string; phone: string; details: string; sourceUrl: string; verifiedAt: string };
export type LocalUpdates = { shutdowns: PowerShutdown[]; chargingStations: ChargingStation[]; civicAlerts: CivicAlert[]; emergencyContacts: EmergencyContact[] };

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
  getUpdates: async () => {
    const state = await request<LocalUpdates>("/updates");
    if (!state || !Array.isArray(state.shutdowns) || !Array.isArray(state.chargingStations) || !Array.isArray(state.civicAlerts) || !Array.isArray(state.emergencyContacts)) {
      throw new Error("The updates service returned an incomplete response. Please check the backend version and retry.");
    }
    return state;
  },
  saveShutdown: (item: PowerShutdown, editing: boolean) => request<PowerShutdown>(editing ? `/shutdowns/${encodeURIComponent(item.id)}` : "/shutdowns", editing ? "PUT" : "POST", item),
  removeShutdown: (id: string) => request<void>(`/shutdowns/${encodeURIComponent(id)}`, "DELETE"),
  saveChargingStation: (item: ChargingStation, editing: boolean) => request<ChargingStation>(editing ? `/charging-stations/${encodeURIComponent(item.id)}` : "/charging-stations", editing ? "PUT" : "POST", item),
  removeChargingStation: (id: string) => request<void>(`/charging-stations/${encodeURIComponent(id)}`, "DELETE"),
  saveCivicAlert: (item: CivicAlert, editing: boolean) => request<CivicAlert>(editing ? `/civic-alerts/${encodeURIComponent(item.id)}` : "/civic-alerts", editing ? "PUT" : "POST", item),
  removeCivicAlert: (id: string) => request<void>(`/civic-alerts/${encodeURIComponent(id)}`, "DELETE"),
  saveEmergencyContact: (item: EmergencyContact, editing: boolean) => request<EmergencyContact>(editing ? `/emergency-contacts/${encodeURIComponent(item.id)}` : "/emergency-contacts", editing ? "PUT" : "POST", item),
  removeEmergencyContact: (id: string) => request<void>(`/emergency-contacts/${encodeURIComponent(id)}`, "DELETE"),
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
