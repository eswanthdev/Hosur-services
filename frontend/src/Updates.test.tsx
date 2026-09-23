import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Updates } from "./Updates";
import { App } from "./App";
import type { ChargingStation, CivicAlert, CivicCategory, EmergencyContact, LocalUpdates, PowerShutdown } from "./api/hosur";

const shutdown: PowerShutdown = {
  id: "shutdown-1", title: "Test maintenance", areas: ["Hosur Town", "SIPCOT"],
  startsAt: "2099-09-24T09:00:00+05:30", endsAt: "2099-09-24T17:00:00+05:30",
  reason: "Test affected streets", sourceUrl: "https://example.com/notice", verifiedAt: "2026-01-01",
};
const station: ChargingStation = {
  id: "station-1", name: "Test charging station", area: "Hosur Town", address: "Test address",
  connectors: "CCS2 60 kW", hours: "09:00 to 18:00", sourceUrl: "https://example.com/station", verifiedAt: "2026-01-01",
};
const props = { areas: ["Hosur Town", "SIPCOT", "Bagalur"], area: "Hosur Town", onAreaChange: vi.fn(), language: "en" as const };
const civicAlert: CivicAlert = {
  id: "water-1", category: "water", title: "Test water supply notice", areas: ["Hosur Town"], route: "",
  message: "Test timings and affected streets", startsAt: "2099-09-24T09:00:00+05:30", expiresAt: "2099-09-24T17:00:00+05:30",
  sourceUrl: "https://example.com/water", verifiedAt: "2026-01-01",
};
const emergencyContact: EmergencyContact = {
  id: "contact-1", name: "Test emergency desk", service: "Test service", phone: "+91 00000 00000",
  details: "Test contact only; not a real emergency number", sourceUrl: "https://example.com/contact", verifiedAt: "2026-01-01",
};

function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function backend(initial: Partial<LocalUpdates>) {
  const state: LocalUpdates = { shutdowns: [], chargingStations: [], civicAlerts: [], emergencyContacts: [], ...structuredClone(initial) };
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/updates") return response(state);
    if (path === "/api/state") return response({ services: [], providerCatalog: {}, reviewsByProvider: {}, newsItems: [], feedPosts: [], askedFor: [] });
    if (path.startsWith("/api/shutdowns")) {
      if (init?.method === "DELETE") {
        state.shutdowns = state.shutdowns.filter((item) => !path.endsWith(item.id));
        return response(null, 204);
      }
      const item: PowerShutdown = JSON.parse(String(init?.body));
      state.shutdowns = [...state.shutdowns.filter((entry) => entry.id !== item.id), item];
      return response(item);
    }
    if (path.startsWith("/api/charging-stations")) {
      if (init?.method === "DELETE") {
        state.chargingStations = state.chargingStations.filter((item) => !path.endsWith(item.id));
        return response(null, 204);
      }
      const item: ChargingStation = JSON.parse(String(init?.body));
      state.chargingStations = [...state.chargingStations.filter((entry) => entry.id !== item.id), item];
      return response(item);
    }
    if (path.startsWith("/api/civic-alerts")) {
      if (init?.method === "DELETE") {
        state.civicAlerts = state.civicAlerts.filter((item) => !path.endsWith(item.id));
        return response(null, 204);
      }
      const item: CivicAlert = JSON.parse(String(init?.body));
      state.civicAlerts = [...state.civicAlerts.filter((entry) => entry.id !== item.id), item];
      return response(item);
    }
    if (path.startsWith("/api/emergency-contacts")) {
      if (init?.method === "DELETE") {
        state.emergencyContacts = state.emergencyContacts.filter((item) => !path.endsWith(item.id));
        return response(null, 204);
      }
      const item: EmergencyContact = JSON.parse(String(init?.body));
      state.emergencyContacts = [...state.emergencyContacts.filter((entry) => entry.id !== item.id), item];
      return response(item);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, state };
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("local updates", () => {
  it("shows shutdowns across all areas while filtering stations, excluding expired notices and showing source links", async () => {
    backend({
      shutdowns: [shutdown, { ...shutdown, id: "past", title: "Expired maintenance", startsAt: "2020-01-01T09:00:00+05:30", endsAt: "2020-01-01T17:00:00+05:30" }],
      chargingStations: [station, { ...station, id: "other", name: "SIPCOT charger", area: "SIPCOT" }],
    });
    const view = render(<Updates {...props} />);
    expect(await screen.findByRole("heading", { name: shutdown.title })).toBeTruthy();
    expect(screen.queryByText("Expired maintenance")).toBeNull();
    expect(screen.queryByRole("heading", { name: "SIPCOT charger" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "View source" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Find on map" }).getAttribute("href")).toContain(encodeURIComponent("Test charging station, Test address, Hosur Town, Hosur"));
    expect(screen.getByText(/17:00|5:00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Local area"), { target: { value: "SIPCOT" } });
    expect(props.onAreaChange).toHaveBeenCalledWith("SIPCOT");
    view.rerender(<Updates {...props} area="SIPCOT" />);
    expect(screen.getByRole("heading", { name: shutdown.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "SIPCOT charger" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: station.name })).toBeNull();
    view.rerender(<Updates {...props} area="Bagalur" />);
    expect(screen.getByRole("heading", { name: shutdown.title })).toBeTruthy();
    expect(screen.getByText("Hosur Town, SIPCOT")).toBeTruthy();
    expect(screen.queryByText("Expired maintenance")).toBeNull();
    expect(screen.queryByText(/No upcoming verified/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "SIPCOT charger" })).toBeNull();
    expect(screen.queryByRole("heading", { name: station.name })).toBeNull();
    expect(screen.getByText(/No verified charging stations/)).toBeTruthy();
  });

  it("shows failed loading distinctly from empty data and retries", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce(response({ shutdowns: [], chargingStations: [], civicAlerts: [], emergencyContacts: [] }));
    vi.stubGlobal("fetch", fetch);
    render(<Updates {...props} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/No upcoming verified/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const emptyNotice = await screen.findByText(/No upcoming verified/);
    expect(emptyNotice.textContent).not.toContain("for this area");
    expect(emptyNotice.textContent).toContain("does not guarantee uninterrupted power");
  });

  it("shows an error instead of crashing or claiming no notices when the backend response is outdated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ shutdowns: [], chargingStations: [] })));
    render(<Updates {...props} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load updates");
    expect(screen.queryByText(/No upcoming verified/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Emergency contacts" })).toBeNull();
  });

  it("opens the Updates tab and supports Tamil without changing Home or Feed navigation", async () => {
    backend({ shutdowns: [], chargingStations: [] });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    expect(await screen.findByRole("heading", { name: "Hosur Updates" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Updates" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "தமிழ்" }));
    expect(await screen.findByRole("heading", { name: "ஹோசூர் அறிவிப்புகள்" })).toBeTruthy();
    expect(await screen.findByRole("region", { name: "குடிநீர் விநியோகம்" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "அவசர தொடர்புகள்" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    expect(screen.getByRole("heading", { name: "Hosur Community Feed" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByRole("heading", { name: "Hosur Community Feed" })).toBeNull();
  });

  it("creates, edits and removes a shutdown and reloads confirmed data from the server", async () => {
    const { fetch, state } = backend({ shutdowns: [], chargingStations: [] });
    const view = render(<Updates {...props} admin />);
    const form = within(await screen.findByRole("form", { name: "Power shutdown form" }));
    fireEvent.change(form.getByLabelText("Notice title"), { target: { value: shutdown.title } });
    fireEvent.click(form.getByLabelText("Hosur Town"));
    fireEvent.click(form.getByLabelText("SIPCOT"));
    fireEvent.change(form.getByLabelText("Starts at (IST)"), { target: { value: "2099-09-24T09:00" } });
    fireEvent.change(form.getByLabelText("Ends at (IST)"), { target: { value: "2099-09-24T17:00" } });
    fireEvent.change(form.getByLabelText("Reason / affected streets"), { target: { value: shutdown.reason } });
    fireEvent.change(form.getByLabelText("Source URL"), { target: { value: shutdown.sourceUrl } });
    fireEvent.change(form.getByLabelText("Last verified date"), { target: { value: shutdown.verifiedAt } });
    fireEvent.click(form.getByLabelText("I have checked these details against the source."));
    fireEvent.click(form.getByRole("button", { name: "Save shutdown" }));
    expect(await screen.findByRole("heading", { name: shutdown.title })).toBeTruthy();
    expect(state.shutdowns[0]).toMatchObject({ areas: shutdown.areas, startsAt: shutdown.startsAt, endsAt: shutdown.endsAt });
    fireEvent.click(screen.getByRole("button", { name: `Edit ${shutdown.title}` }));
    fireEvent.change(within(screen.getByRole("form", { name: "Power shutdown form" })).getByLabelText("Notice title"), { target: { value: "Updated notice" } });
    fireEvent.click(within(screen.getByRole("form", { name: "Power shutdown form" })).getByLabelText("I have checked these details against the source."));
    fireEvent.click(screen.getByRole("button", { name: "Save shutdown" }));
    expect(await screen.findByRole("heading", { name: "Updated notice" })).toBeTruthy();
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true);
    view.unmount();
    render(<Updates {...props} admin />);
    expect(await screen.findByRole("heading", { name: "Updated notice" })).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Updated notice" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Updated notice" })).toBeNull());
    expect(state.shutdowns).toEqual([]);
  });

  it("creates, edits and removes a charging station", async () => {
    const { state } = backend({ shutdowns: [], chargingStations: [] });
    render(<Updates {...props} admin />);
    const form = within(await screen.findByRole("form", { name: "Charging station form" }));
    for (const [label, value] of [
      ["Station name", station.name], ["Station area", station.area], ["Full address", station.address],
      ["Connectors / charging power", station.connectors], ["Opening hours", station.hours],
      ["Source URL", station.sourceUrl], ["Last verified date", station.verifiedAt],
    ]) fireEvent.change(form.getByLabelText(label), { target: { value } });
    fireEvent.click(form.getByLabelText("I have checked these details against the source."));
    fireEvent.click(form.getByRole("button", { name: "Save charging station" }));
    expect(await screen.findByRole("heading", { name: station.name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Edit ${station.name}` }));
    fireEvent.change(screen.getByLabelText("Station area"), { target: { value: "Bagalur" } });
    fireEvent.click(within(screen.getByRole("form", { name: "Charging station form" })).getByLabelText("I have checked these details against the source."));
    fireEvent.click(screen.getByRole("button", { name: "Save charging station" }));
    await waitFor(() => expect(state.chargingStations[0].area).toBe("Bagalur"));
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: `Remove ${station.name}` }).disabled).toBe(false));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: `Remove ${station.name}` }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: station.name })).toBeNull());
    expect(state.chargingStations).toEqual([]);
  });

  it("keeps failed writes visible as errors without removing the record or showing success", async () => {
    const { fetch } = backend({ shutdowns: [shutdown], chargingStations: [station] });
    render(<Updates {...props} admin />);
    await screen.findByRole("heading", { name: station.name });
    fetch.mockResolvedValueOnce(response({ detail: "Server unavailable" }, 503));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: `Remove ${station.name}` }));
    expect((await screen.findByRole("alert")).textContent).toContain("Server unavailable");
    expect(screen.getByRole("heading", { name: station.name })).toBeTruthy();
    expect(screen.queryByText("Saved to the server.")).toBeNull();
  });

  it("rejects shutdowns without an affected area or with reversed times before publishing", async () => {
    const { fetch } = backend({ shutdowns: [shutdown], chargingStations: [] });
    render(<Updates {...props} admin />);
    fireEvent.click(await screen.findByRole("button", { name: `Edit ${shutdown.title}` }));
    fireEvent.change(screen.getByLabelText("Ends at (IST)"), { target: { value: "2099-09-24T08:00" } });
    fireEvent.submit(screen.getByRole("form", { name: "Power shutdown form" }));
    expect(screen.getByRole("alert").textContent).toContain("end time after");
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Ends at (IST)"), { target: { value: "2099-09-24T17:00" } });
    const form = within(screen.getByRole("form", { name: "Power shutdown form" }));
    fireEvent.click(form.getByLabelText("Hosur Town"));
    fireEvent.click(form.getByLabelText("SIPCOT"));
    fireEvent.submit(screen.getByRole("form", { name: "Power shutdown form" }));
    expect(screen.getByRole("alert").textContent).toContain("at least one affected area");
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });
});

describe("community notices and emergency directory", () => {
  it("filters water and waste by area, traffic by route, and keeps emergency contacts general", async () => {
    backend({
      civicAlerts: [
        civicAlert,
        { ...civicAlert, id: "waste", category: "waste", title: "Test waste collection", areas: ["SIPCOT"] },
        { ...civicAlert, id: "traffic-a", category: "traffic", title: "Test road closure", areas: [], route: "Test route A" },
        { ...civicAlert, id: "traffic-b", category: "traffic", title: "Test diversion", areas: [], route: "Test route B" },
        { ...civicAlert, id: "expired", title: "Expired water notice", startsAt: "2020-01-01T09:00:00+05:30", expiresAt: "2020-01-01T17:00:00+05:30" },
      ],
      emergencyContacts: [emergencyContact],
    });
    const view = render(<Updates {...props} />);
    expect(await screen.findByRole("heading", { name: civicAlert.title })).toBeTruthy();
    expect(screen.queryByText("Expired water notice")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Test waste collection" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Test road closure" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Test diversion" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Traffic route"), { target: { value: "Test route B" } });
    expect(screen.queryByRole("heading", { name: "Test road closure" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Test diversion" })).toBeTruthy();
    view.rerender(<Updates {...props} area="SIPCOT" />);
    expect(screen.queryByRole("heading", { name: civicAlert.title })).toBeNull();
    expect(screen.getByRole("heading", { name: "Test waste collection" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Test diversion" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: emergencyContact.name })).toBeTruthy();
    expect(screen.getByRole("link", { name: `Call ${emergencyContact.phone}` }).getAttribute("href")).toBe("tel:+910000000000");
    expect(within(screen.getByRole("region", { name: "Emergency contacts" })).getByRole("link", { name: "View source" }).getAttribute("href")).toBe(emergencyContact.sourceUrl);
  });

  it("automatically removes a notice when it expires while the page stays open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T04:00:00Z"));
    backend({ civicAlerts: [{ ...civicAlert, startsAt: "2026-09-23T03:00:00Z", expiresAt: "2026-09-23T04:00:30Z" }] });
    await act(async () => { render(<Updates {...props} />); });
    expect(screen.getByRole("heading", { name: civicAlert.title })).toBeTruthy();
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.queryByRole("heading", { name: civicAlert.title })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Water supply" })).getByText(/No current or upcoming verified/)).toBeTruthy();
  });

  it.each<CivicCategory>(["water", "traffic", "waste"])("publishes, edits, reloads and removes a %s notice", async (category) => {
    const { state, fetch } = backend({});
    const view = render(<Updates {...props} admin />);
    const form = within(await screen.findByRole("form", { name: "Community notice form" }));
    fireEvent.change(form.getByLabelText("Notice category"), { target: { value: category } });
    if (category === "traffic") fireEvent.change(form.getByLabelText("Affected road / route"), { target: { value: "Test route" } });
    else fireEvent.click(form.getByLabelText("Hosur Town"));
    for (const [label, value] of [
      ["Notice title", `Test ${category} notice`], ["Starts at (IST)", "2099-09-24T09:00"], ["Expires at (IST)", "2099-09-24T17:00"],
      ["Notice details", civicAlert.message], ["Source URL", civicAlert.sourceUrl], ["Last verified date", civicAlert.verifiedAt],
    ]) fireEvent.change(form.getByLabelText(label), { target: { value } });
    fireEvent.click(form.getByLabelText("I have checked these details against the source."));
    fireEvent.click(form.getByRole("button", { name: "Save community notice" }));
    expect(await screen.findByRole("heading", { name: `Test ${category} notice` })).toBeTruthy();
    expect(state.civicAlerts[0]).toMatchObject({
      category, areas: category === "traffic" ? [] : ["Hosur Town"], route: category === "traffic" ? "Test route" : "",
      startsAt: civicAlert.startsAt, expiresAt: civicAlert.expiresAt,
    });
    fireEvent.click(screen.getByRole("button", { name: `Edit Test ${category} notice` }));
    const editor = within(screen.getByRole("form", { name: "Community notice form" }));
    fireEvent.change(editor.getByLabelText("Notice details"), { target: { value: "Updated instructions" } });
    fireEvent.click(editor.getByLabelText("I have checked these details against the source."));
    fireEvent.click(editor.getByRole("button", { name: "Save community notice" }));
    await waitFor(() => expect(state.civicAlerts[0].message).toBe("Updated instructions"));
    expect(fetch.mock.calls.some(([path, init]) => path.startsWith("/api/civic-alerts/") && init?.method === "PUT")).toBe(true);
    view.unmount();
    render(<Updates {...props} admin />);
    expect(await screen.findByText("Updated instructions")).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: `Remove Test ${category} notice` }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: `Test ${category} notice` })).toBeNull());
    expect(state.civicAlerts).toEqual([]);
  });

  it("publishes, edits and removes verified emergency contacts", async () => {
    const { state } = backend({});
    const view = render(<Updates {...props} admin />);
    const form = within(await screen.findByRole("form", { name: "Emergency contact form" }));
    for (const [label, value] of [
      ["Contact name", emergencyContact.name], ["Emergency service", emergencyContact.service], ["Phone / helpline", emergencyContact.phone],
      ["Contact details", emergencyContact.details], ["Source URL", emergencyContact.sourceUrl], ["Last verified date", emergencyContact.verifiedAt],
    ]) fireEvent.change(form.getByLabelText(label), { target: { value } });
    fireEvent.click(form.getByLabelText("I have checked these details against the source."));
    fireEvent.click(form.getByRole("button", { name: "Save emergency contact" }));
    expect(await screen.findByRole("heading", { name: emergencyContact.name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Edit ${emergencyContact.name}` }));
    const editor = within(screen.getByRole("form", { name: "Emergency contact form" }));
    fireEvent.change(editor.getByLabelText("Contact details"), { target: { value: "Updated test coverage" } });
    fireEvent.click(editor.getByLabelText("I have checked these details against the source."));
    fireEvent.click(editor.getByRole("button", { name: "Save emergency contact" }));
    await waitFor(() => expect(state.emergencyContacts[0].details).toBe("Updated test coverage"));
    view.unmount();
    render(<Updates {...props} admin />);
    expect(await screen.findByText("Updated test coverage")).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: `Remove ${emergencyContact.name}` }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: emergencyContact.name })).toBeNull());
    expect(state.emergencyContacts).toEqual([]);
  });

  it("retains form input and avoids publishing when the server rejects a notice", async () => {
    const { fetch, state } = backend({ civicAlerts: [civicAlert] });
    render(<Updates {...props} admin />);
    fireEvent.click(await screen.findByRole("button", { name: `Edit ${civicAlert.title}` }));
    const form = within(screen.getByRole("form", { name: "Community notice form" }));
    fireEvent.change(form.getByLabelText("Notice details"), { target: { value: "Unsaved test instructions" } });
    fireEvent.click(form.getByLabelText("I have checked these details against the source."));
    fetch.mockResolvedValueOnce(response({ detail: "Cannot save notice" }, 503));
    fireEvent.click(form.getByRole("button", { name: "Save community notice" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Cannot save notice");
    expect(form.getByDisplayValue("Unsaved test instructions")).toBeTruthy();
    expect(state.civicAlerts[0].message).toBe(civicAlert.message);
    expect(screen.queryByText("Saved to the server.")).toBeNull();
  });

  it("validates notice expiry, area, route and contact phone before sending writes", async () => {
    const { fetch } = backend({ civicAlerts: [civicAlert], emergencyContacts: [emergencyContact] });
    render(<Updates {...props} admin />);
    fireEvent.click(await screen.findByRole("button", { name: `Edit ${civicAlert.title}` }));
    const formElement = screen.getByRole("form", { name: "Community notice form" });
    const form = within(formElement);
    fireEvent.change(form.getByLabelText("Expires at (IST)"), { target: { value: "2099-09-24T08:00" } });
    fireEvent.submit(formElement);
    expect(screen.getByRole("alert").textContent).toContain("expiry time");
    fireEvent.change(form.getByLabelText("Expires at (IST)"), { target: { value: "2099-09-24T17:00" } });
    fireEvent.click(form.getByLabelText("Hosur Town"));
    fireEvent.submit(formElement);
    expect(screen.getByRole("alert").textContent).toContain("at least one affected area");
    fireEvent.change(form.getByLabelText("Notice category"), { target: { value: "traffic" } });
    fireEvent.submit(formElement);
    expect(screen.getByRole("alert").textContent).toContain("affected road or route");
    fireEvent.click(screen.getByRole("button", { name: `Edit ${emergencyContact.name}` }));
    const contactForm = screen.getByRole("form", { name: "Emergency contact form" });
    fireEvent.change(within(contactForm).getByLabelText("Phone / helpline"), { target: { value: "invalid-number" } });
    fireEvent.submit(contactForm);
    expect(screen.getByRole("alert").textContent).toContain("valid phone number");
    expect(fetch.mock.calls.some(([, init]) => init?.method === "POST" || init?.method === "PUT")).toBe(false);
  });

  it("keeps expired notices available for admin management", async () => {
    backend({ civicAlerts: [{ ...civicAlert, startsAt: "2020-01-01T09:00:00+05:30", expiresAt: "2020-01-01T17:00:00+05:30" }] });
    render(<Updates {...props} admin area="Bagalur" />);
    expect(await screen.findByRole("heading", { name: civicAlert.title })).toBeTruthy();
    expect(screen.getByText("Expired notice")).toBeTruthy();
    expect(screen.getByRole("button", { name: `Edit ${civicAlert.title}` })).toBeTruthy();
  });
});
