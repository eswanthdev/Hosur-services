import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const storageKey = "hosur-home-services-state";
const addedIds = [
  "packers-movers", "laundry-ironing", "locksmith", "gas-stove-chimney",
  "bike-service", "water-tanker", "septic-drainage", "wifi-setup",
  "appliance-installation", "furniture-assembly", "curtains-racks", "tailoring",
  "home-salon", "computer-printer", "event-support", "home-nursing",
  "physiotherapy", "pet-boarding", "ev-charger", "office-maintenance",
  "skating-coach", "badminton-coach", "swimming-coach", "cricket-coach",
  "football-coach", "tennis-coach", "chess-coach", "dance-tutor",
  "music-tutor", "yoga-instructor",
  "dslr-rental", "camera-lens-rental", "camera-accessory-rental", "projector-rental",
  "sound-system-rental", "event-furniture-rental", "tent-rental", "power-tool-rental",
];

describe("renting category", () => {
  it("replaces the old category for saved data without losing services or providers", () => {
    const services = [
      { id: "office-maintenance", name: "Office & shop maintenance", tamil: "Office", category: "Business services" },
      { id: "custom-rental", name: "Custom equipment", tamil: "Equipment", category: "Business services" },
    ];
    const providerCatalog = { "office-maintenance": [{ id: "office-provider", name: "Existing provider", phone: "+919999999999", rating: 5, experience: "3 years", serviceId: "office-maintenance" }] };
    window.localStorage.setItem(storageKey, JSON.stringify({ services, providerCatalog }));
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Renting" }));
    expect(first.container.querySelectorAll(".service-card")).toHaveLength(9);
    expect(screen.getByRole("button", { name: /Book DSLR & mirrorless camera rental/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Business services" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Home repair" }));
    expect(screen.getByRole("button", { name: /Book Office & shop maintenance/ })).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem(storageKey)!);
    expect(saved.providerCatalog).toEqual(providerCatalog);
    expect(saved.services.find((service: { id: string }) => service.id === "custom-rental").category).toBe("Renting");
    first.unmount();
    render(<App />);
    expect(JSON.parse(window.localStorage.getItem(storageKey)!).services).toEqual(saved.services);
  });

  it("collects rental requirements and includes them in the WhatsApp request", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    window.localStorage.setItem(storageKey, JSON.stringify({
      providerCatalog: { "dslr-rental": [{ id: "test-rental", name: "Test camera rental", phone: "+919999999999", rating: 5, experience: "3 years", serviceId: "dslr-rental", area: "Hosur Town" }] },
    }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Renting" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search services" }), { target: { value: "DSLR" } });
    fireEvent.click(screen.getByRole("button", { name: /Book DSLR & mirrorless camera rental/ }));
    fireEvent.click(screen.getByRole("button", { name: "Book Test camera rental" }));
    const requirements = "One camera, 2 days from 1 October, pickup";
    fireEvent.change(screen.getByRole("textbox", { name: "Rental requirements" }), { target: { value: requirements } });
    expect(screen.getByRole("button", { name: "Choose another rental provider" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send WhatsApp request" }));
    expect(open).toHaveBeenCalledOnce();
    const url = new URL(String(open.mock.calls[0][0]));
    expect(url.searchParams.get("text")).toContain(`Rental requirements: ${requirements}`);
    expect(screen.getByRole("heading", { name: /Complete your request to Test camera rental/ })).toBeTruthy();
  });
});

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
  // Unless a test provides a backend, behave as if the server is unreachable.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("backend sync", () => {
  const serverState = {
    services: [{ id: "plumber", name: "Plumber", tamil: "பிளம்பர்", category: "Home repair" }],
    providerCatalog: { plumber: [{ id: "server-provider", name: "Server plumber", phone: "+919999999999", rating: 4.9, experience: "7 years", serviceId: "plumber", area: "Hosur Town" }] },
    reviewsByProvider: {},
    newsItems: [],
    feedPosts: [{ id: "feed-1", author: "Ravi Kumar", handle: "@ravikumar", location: "Hosur Town", title: "Water issue", caption: "Hi", accent: "red", tag: "#HosurUpdate", likes: 140, likedBy: ["someone"], comments: 0, createdAt: "2026-09-01T00:00:00Z" }],
    askedFor: ["drone repair"],
  };

  function mockBackend(handle: (path: string, init?: RequestInit) => Response = () => jsonResponse({})) {
    const fetchMock = vi.fn((path: string, init?: RequestInit) =>
      Promise.resolve(path === "/api/state" ? jsonResponse(serverState) : handle(path, init)));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("shows services and providers loaded from the server", async () => {
    mockBackend();
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelectorAll(".service-card")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /Book Plumber/ }));
    expect(screen.getByRole("heading", { name: "Server plumber" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(storageKey)!).askedFor).toEqual(["drone repair"]);
  });

  it("sends admin-added providers to the server", async () => {
    const fetchMock = mockBackend((_, init) => jsonResponse(JSON.parse(String(init?.body)), 201));
    window.location.hash = "#admin";
    render(<App />);
    await waitFor(() => expect(screen.getByText("1 active")).toBeTruthy());
    fireEvent.change(screen.getByRole("combobox", { name: "Service" }), { target: { value: "plumber" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Provider name" }), { target: { value: "New plumber" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Experience" }), { target: { value: "2 years" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Provider area" }), { target: { value: "Nallur" } });
    fireEvent.click(screen.getByRole("button", { name: "Save verified provider" }));
    const [path, init] = fetchMock.mock.calls.find(([url]) => url === "/api/providers")!;
    expect(path).toBe("/api/providers");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ name: "New plumber", phone: "+919876543210", serviceId: "plumber", area: "Nallur" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("uses the server's like count, which includes other people's likes", async () => {
    mockBackend(() => jsonResponse({ ...serverState.feedPosts[0], likes: 145, likedBy: ["someone", "9876543210"] }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.click(await screen.findByRole("button", { name: "Like post by Ravi Kumar, 140 likes" }));
    expect(await screen.findByRole("button", { name: "Liked post by Ravi Kumar, 145 likes" })).toBeTruthy();
  });

  it("warns the admin when the server is unreachable", async () => {
    window.location.hash = "#admin";
    render(<App />);
    expect((await screen.findByRole("status")).textContent).toContain("saved on this device only");
  });
});

describe("feed actions", () => {
  function openFeed() {
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
  }

  it("allows only one like on a post and preserves it after reload", () => {
    const first = render(<App />);
    openFeed();
    const like = screen.getByRole<HTMLButtonElement>("button", { name: "Like post by Ravi Kumar, 128 likes" });
    fireEvent.click(like);
    expect(like.disabled).toBe(true);
    fireEvent.click(like);
    expect(screen.getByRole("button", { name: "Liked post by Ravi Kumar, 129 likes" })).toBeTruthy();
    first.unmount();
    render(<App />);
    openFeed();
    const savedLike = screen.getByRole<HTMLButtonElement>("button", { name: "Liked post by Ravi Kumar, 129 likes" });
    expect(savedLike.disabled).toBe(true);
    fireEvent.click(savedLike);
    expect(savedLike.getAttribute("aria-label")).toBe("Liked post by Ravi Kumar, 129 likes");
  });

  it("does not block the current user when a different user has liked the post", () => {
    const first = render(<App />);
    const state = JSON.parse(window.localStorage.getItem(storageKey)!);
    first.unmount();
    state.feedPosts[0].likes = 131;
    state.feedPosts[0].likedBy = ["another-user"];
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    render(<App />);
    openFeed();
    fireEvent.click(screen.getByRole("button", { name: "Like post by Ravi Kumar, 131 likes" }));
    const saved = JSON.parse(window.localStorage.getItem(storageKey)!);
    expect(saved.feedPosts[0].likes).toBe(132);
    expect(saved.feedPosts[0].likedBy).toHaveLength(2);
    expect(saved.feedPosts[1].likes).toBe(94);
  });

  it("removes comment counts and shares the complete post using a WhatsApp link", () => {
    const first = render(<App />);
    const state = JSON.parse(window.localStorage.getItem(storageKey)!);
    first.unmount();
    const caption = "Water & power?\nUpdate #Hosur + details";
    state.feedPosts[0].caption = caption;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    const { container } = render(<App />);
    openFeed();
    expect(container.querySelector(".insta-actions")?.textContent).not.toContain(String.fromCodePoint(0x1f4ac));
    const link = screen.getByRole<HTMLAnchorElement>("link", { name: "Share post by Ravi Kumar on WhatsApp" });
    const url = new URL(link.href);
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toContain(caption);
    expect(url.searchParams.get("text")).toContain("Ravi Kumar");
    expect(url.searchParams.get("text")).toContain("Hosur Town");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(screen.queryByText("Shared", { exact: true })).toBeNull();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.location.hash = "";
});

describe("expanded service catalogue", () => {
  it("adds all new services for new visitors without creating providers", () => {
    const { container } = render(<App />);
    const state = JSON.parse(window.localStorage.getItem(storageKey)!);
    expect(container.querySelectorAll(".service-card")).toHaveLength(79);
    expect(state.services.map((service: { id: string }) => service.id)).toEqual(expect.arrayContaining(addedIds));
    expect(state.providerCatalog).toEqual({});
    expect(state.services.every((service: { tamil: string }) => service.tamil.length > 0)).toBe(true);
  });

  it("preserves saved services and provider data without duplicating additions on reload", () => {
    const custom = { id: "custom", name: "Custom service", tamil: "Custom", category: "Home repair" };
    const existing = { id: "locksmith", name: "Existing locksmith", tamil: "Existing", category: "Home repair" };
    const providers = { custom: [{ id: "provider-1", name: "Saved provider", phone: "+919876543210", rating: 5, experience: "5 years", serviceId: "custom" }] };
    window.localStorage.setItem(storageKey, JSON.stringify({ services: [custom, existing], providerCatalog: providers }));
    const first = render(<App />);
    const saved = JSON.parse(window.localStorage.getItem(storageKey)!);
    expect(saved.services).toHaveLength(39);
    expect(saved.services.slice(0, 2)).toEqual([custom, existing]);
    expect(saved.providerCatalog).toEqual(providers);
    first.unmount();
    render(<App />);
    expect(JSON.parse(window.localStorage.getItem(storageKey)!).services).toEqual(saved.services);
  });

  it("supports search, category filtering, and the booking entry point", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Health care" }));
    expect(container.querySelectorAll(".service-card")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search services" }), { target: { value: "locksmith" } });
    expect(container.querySelectorAll(".service-card")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Book Locksmith/ }));
    expect(screen.getByRole("heading", { name: "Locksmith & lock repair" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /No verified providers/ })).toBeTruthy();
  });

  it("makes new services and categories available in the admin forms", () => {
    window.location.hash = "#admin";
    render(<App />);
    const services = screen.getByRole<HTMLSelectElement>("combobox", { name: "Service" });
    expect(Array.from(services.options, (option) => option.value)).toEqual(expect.arrayContaining(addedIds));
    const categories = screen.getByRole<HTMLSelectElement>("combobox", { name: "Category" });
    expect(Array.from(categories.options, (option) => option.value)).toEqual(expect.arrayContaining([
      "Moving & delivery", "Personal services", "Events", "Health care", "Renting", "Tutors & coaches",
    ]));
    expect(Array.from(categories.options, (option) => option.value)).not.toContain("Business services");
  });

  describe("tutors and coaches", () => {
    it("filters home tuition and coaches within the services catalogue, without a separate tab", () => {
      const { container } = render(<App />);
      expect(screen.getByRole("navigation", { name: "Customer navigation" }).querySelectorAll("button")).toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "Tutors & coaches" }));
      expect(container.querySelectorAll(".service-card")).toHaveLength(11);
      expect(screen.getByRole("button", { name: /Book Home tuition/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Book Plumber/ })).toBeNull();
      fireEvent.change(screen.getByRole("textbox", { name: "Search services" }), { target: { value: "skating" } });
      expect(container.querySelectorAll(".service-card")).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: /Book Skating coach/ }));
      expect(screen.getByRole("heading", { name: /No approved tutors or coaches/ })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /All services/ }));
      expect(screen.getByRole("heading", { name: "Choose a service" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Home" }));
      expect(container.querySelectorAll(".service-card")).toHaveLength(79);
    });

    it("books an admin-added coach using lesson-specific fields", () => {
      window.location.hash = "#admin";
      render(<App />);
      fireEvent.change(screen.getByRole("combobox", { name: "Service" }), { target: { value: "badminton-coach" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Provider name" }), { target: { value: "Test badminton coach" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "9999999999" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Experience" }), { target: { value: "4 years" } });
      fireEvent.change(screen.getByRole("combobox", { name: "Provider area" }), { target: { value: "SIPCOT" } });
      fireEvent.click(screen.getByRole("button", { name: "Save verified provider" }));
      fireEvent.click(screen.getByRole("button", { name: /Customer view/ }));
      fireEvent.click(screen.getByRole("button", { name: "Tutors & coaches" }));
      fireEvent.click(screen.getByRole("button", { name: /Book Badminton coach/ }));
      fireEvent.click(screen.getByRole("button", { name: "Book Test badminton coach" }));
      expect(screen.getByRole("textbox", { name: "Lesson requirements" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Send WhatsApp request" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Choose another tutor or coach" })).toBeTruthy();
      expect(JSON.parse(window.localStorage.getItem(storageKey)!).providerCatalog["badminton-coach"][0].area).toBe("SIPCOT");
    });

    describe("area-prioritized providers", () => {
      const providers = [
        { id: "a", name: "Attibele provider", area: "Attibele", serviceId: "plumber", phone: "+919999999999", rating: 5, experience: "3 years" },
        { id: "b", name: "Hosur provider", area: "Hosur Town", serviceId: "plumber", phone: "+919999999998", rating: 4.8, experience: "4 years" },
        { id: "c", name: "Legacy provider", serviceId: "plumber", phone: "+919999999997", rating: 4.7, experience: "5 years" },
        { id: "d", name: "Second Hosur provider", area: "Hosur Town", serviceId: "plumber", phone: "+919999999996", rating: 4.9, experience: "6 years" },
      ];

      it("puts matching areas first, preserves other providers, and displays their real areas", () => {
        window.localStorage.setItem(storageKey, JSON.stringify({ providerCatalog: { plumber: providers } }));
        const { container } = render(<App />);
        fireEvent.change(screen.getByRole("combobox", { name: "Your area" }), { target: { value: "Attibele" } });
        fireEvent.click(screen.getByRole("button", { name: /Book Plumber/ }));
        const names = () => Array.from(container.querySelectorAll(".provider-card h2"), (element) => element.textContent);
        expect(names()).toEqual(["Attibele provider", "Hosur provider", "Legacy provider", "Second Hosur provider"]);
        fireEvent.change(screen.getByRole("combobox", { name: "Your area" }), { target: { value: "Hosur Town" } });
        expect(names()).toEqual(["Hosur provider", "Second Hosur provider", "Attibele provider", "Legacy provider"]);
        expect(Array.from(container.querySelectorAll(".provider-meta span:first-child"), (element) => element.textContent))
          .toEqual(["Hosur Town", "Hosur Town", "Attibele", "Area not set"]);
        fireEvent.change(screen.getByRole("combobox", { name: "Your area" }), { target: { value: "Bagalur" } });
        expect(names()).toEqual(providers.map((provider) => provider.name));
        expect(JSON.parse(window.localStorage.getItem(storageKey)!).providerCatalog.plumber).toEqual(providers);
      });

      it("lets admin assign an existing provider's area and persists its sorting after reload", () => {
        window.localStorage.setItem(storageKey, JSON.stringify({ providerCatalog: { plumber: providers } }));
        window.location.hash = "#admin";
        const first = render(<App />);
        fireEvent.change(screen.getByRole("combobox", { name: "Area for Legacy provider" }), { target: { value: "SIPCOT" } });
        expect(JSON.parse(window.localStorage.getItem(storageKey)!).providerCatalog.plumber[2].area).toBe("SIPCOT");
        first.unmount();
        window.location.hash = "";
        const { container } = render(<App />);
        fireEvent.change(screen.getByRole("combobox", { name: "Your area" }), { target: { value: "SIPCOT" } });
        fireEvent.click(screen.getByRole("button", { name: /Book Plumber/ }));
        expect(container.querySelector(".provider-card h2")?.textContent).toBe("Legacy provider");
        expect(container.querySelectorAll(".provider-card")).toHaveLength(4);
      });
    });
  });
});
