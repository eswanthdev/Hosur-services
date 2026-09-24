import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRegistration } from "./ProviderRegistration";
import { ProviderApplications } from "./ProviderApplications";
import { App } from "./App";
import { registrationText, registrationLanguages } from "./registrationText";
import { registrationServiceLabels } from "./registrationServices";
import type { HosurState, ProviderApplication, RegistrationLanguage } from "./api/hosur";

const services = [
  { id: "plumber", name: "Plumber", tamil: "பிளம்பர்", category: "Home repair" },
  { id: "electrician", name: "Electrician", tamil: "எலக்ட்ரீஷியன்", category: "Home repair" },
];
const state: HosurState = { services, providerCatalog: {}, reviewsByProvider: {}, newsItems: [], feedPosts: [], askedFor: [] };
const application: ProviderApplication = {
  id: "application-1", name: "Test provider", phone: "+919876543210", serviceIds: ["plumber"], area: "Test locality",
  experience: "", language: "ta", consent: true, status: "pending", createdAt: "2026-09-23T08:00:00Z", reviewedAt: null,
};
const approvedProvider = { id: "approved-provider", name: application.name, phone: application.phone, serviceId: "plumber", experience: "", area: application.area, rating: null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockBackend(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(
    url === "/api/state" ? json(state) : url === "/api/updates" ? json({ shutdowns: [], chargingStations: [], civicAlerts: [] }) : handler(url, init),
  ));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillForm(language: RegistrationLanguage = "en", name = application.name) {
  const text = registrationText[language];
  fireEvent.change(await screen.findByLabelText(text.name), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(text.phone), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText(text.area), { target: { value: application.area } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Plumber/ }));
  fireEvent.click(screen.getByLabelText(text.consent));
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "#register?lang=en");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("provider registration", () => {
  it.each([
    ["en", "Test provider"], ["ta", "குமார்"], ["te", "కుమార్"], ["kn", "ಕುಮಾರ್"],
  ] as const)("submits a pending application in %s without caching applicant details", async (language, name) => {
    window.history.replaceState(null, "", `#register?lang=${language}`);
    const fetchMock = mockBackend(() => json({ id: "receipt-1", status: "pending", createdAt: application.createdAt }, 201));
    render(<ProviderRegistration />);
    await fillForm(language, name);
    fireEvent.click(screen.getByRole("checkbox", { name: /Electrician/ }));
    fireEvent.click(screen.getByRole("button", { name: registrationText[language].submit }));
    expect(await screen.findByRole("heading", { name: registrationText[language].success })).toBeTruthy();
    expect(screen.getByText(registrationText[language].pending)).toBeTruthy();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/provider-applications")!;
    expect(JSON.parse(String(init?.body))).toEqual({
      name, phone: "9876543210", area: application.area, experience: "", language, consent: true, serviceIds: ["plumber", "electrician"],
    });
    expect(window.localStorage.length).toBe(0);
  });

  it("preserves entered details while switching language and translates service labels", async () => {
    mockBackend(() => json({}));
    render(<ProviderRegistration />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: "తెలుగు" }));
    expect((screen.getByLabelText(registrationText.te.name) as HTMLInputElement).value).toBe(application.name);
    expect((screen.getByRole("checkbox", { name: /Plumber/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(registrationServiceLabels.plumber.te)).toBeTruthy();
    expect(window.location.hash).toBe("#register?lang=te");
    fireEvent.click(screen.getByRole("button", { name: "ಕನ್ನಡ" }));
    expect(screen.getByText(registrationServiceLabels.plumber.kn)).toBeTruthy();
  });

  it.each([
    [409, "duplicate"], [422, "invalid"], [500, "failed"],
  ] as const)("shows a localized error for HTTP %s and retains details for retry", async (status, key) => {
    const fetchMock = mockBackend(() => json({ detail: "Server error" }, status));
    render(<ProviderRegistration />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.submit }));
    expect((await screen.findByRole("alert")).textContent).toBe(registrationText.en[key]);
    expect((screen.getByLabelText(registrationText.en.name) as HTMLInputElement).value).toBe(application.name);
    expect(screen.queryByText(registrationText.en.success)).toBeNull();
    fetchMock.mockImplementation((url) => Promise.resolve(url === "/api/state" ? json(state) : json({ id: "retry", status: "pending", createdAt: application.createdAt }, 201)));
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.submit }));
    expect(await screen.findByText(registrationText.en.success)).toBeTruthy();
  });

  it("reports network failure without claiming success", async () => {
    mockBackend(() => Promise.reject(new TypeError("Network unavailable")));
    render(<ProviderRegistration />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.submit }));
    expect((await screen.findByRole("alert")).textContent).toBe(registrationText.en.failed);
    expect(screen.queryByText(registrationText.en.success)).toBeNull();
  });

  it("validates phone and requires service selection before making a request", async () => {
    const fetchMock = mockBackend(() => json({}));
    render(<ProviderRegistration />);
    await fillForm();
    fireEvent.change(screen.getByLabelText(registrationText.en.phone), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.submit }));
    expect(screen.getByRole("alert").textContent).toBe(registrationText.en.phoneError);
    fireEvent.click(screen.getByRole("checkbox", { name: /Plumber/ }));
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.submit }));
    expect(screen.getByRole("alert").textContent).toBe(registrationText.en.missing);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/provider-applications")).toBe(false);
  });

  it("requires a loaded server catalog and lets the user retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Offline"));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProviderRegistration />);
    expect(await screen.findByText(registrationText.en.loadError)).toBeTruthy();
    expect(screen.queryByRole("button", { name: registrationText.en.submit })).toBeNull();
    fetchMock.mockResolvedValue(json(state));
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.retry }));
    expect(await screen.findByLabelText(registrationText.en.name)).toBeTruthy();
  });

  it("prevents multiple requests while submitting", async () => {
    let complete!: (response: Response) => void;
    const fetchMock = mockBackend(() => new Promise<Response>((resolve) => { complete = resolve; }));
    render(<ProviderRegistration />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: registrationText.en.submit }));
    const button = screen.getByRole("button", { name: registrationText.en.saving });
    fireEvent.click(button);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/provider-applications")).toHaveLength(1);
    await act(async () => complete(json({ id: "receipt", status: "pending", createdAt: application.createdAt }, 201)));
    expect(screen.getByText(registrationText.en.success)).toBeTruthy();
  });

  it("offers a shareable Services link and supports direct navigation", async () => {
    window.history.replaceState(null, "", "#");
    mockBackend(() => json([]));
    const first = render(<App />);
    const link = screen.getByRole("link", { name: "Register as a service provider" });
    expect(link.getAttribute("href")).toBe("#register?lang=en");
    expect(screen.getByRole("link", { name: "தமிழில் பதிவு செய்ய" }).getAttribute("href")).toBe("#register?lang=ta");
    expect(screen.getByRole("link", { name: "తెలుగులో నమోదు చేసుకోండి" }).getAttribute("href")).toBe("#register?lang=te");
    expect(screen.getByRole("link", { name: "ಕನ್ನಡದಲ್ಲಿ ನೋಂದಾಯಿಸಿ" }).getAttribute("href")).toBe("#register?lang=kn");
    await act(async () => { window.location.hash = link.getAttribute("href")!; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(await screen.findByLabelText(registrationText.en.name)).toBeTruthy();
    first.unmount();
    render(<App />);
    expect(await screen.findByLabelText(registrationText.en.name)).toBeTruthy();
    expect(registrationLanguages).toHaveLength(4);
  });
});

describe("provider approval queue", () => {
  it("waits for startup hydration so an older snapshot cannot overwrite approved providers", async () => {
    window.history.replaceState(null, "", "#admin");
    let hydrate!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/state") return new Promise<Response>((resolve) => { hydrate = resolve; });
      if (url === "/api/updates") return Promise.resolve(json({ shutdowns: [], chargingStations: [], civicAlerts: [] }));
      if (url.endsWith("/approve")) return Promise.resolve(json({ application: { ...application, status: "approved" }, providers: [approvedProvider] }));
      return Promise.resolve(json([application]));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /I have verified/ }));
    const approve = screen.getByRole("button", { name: `Approve ${application.name}` });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(approve);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/approve"))).toBe(false);
    await act(async () => hydrate(json(state)));
    expect((approve as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(approve);
    expect(await screen.findByText(`${application.name} approved and listed.`)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Customer view/ })));
    fireEvent.click(screen.getByRole("button", { name: /Book Plumber/ }));
    expect(screen.getByRole("heading", { name: application.name })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("hosur-home-services-state")!).providerCatalog.plumber).toEqual([approvedProvider]);
  });

  it("requires verification and publishes only after the server confirms approval", async () => {
    let complete!: (response: Response) => void;
    mockBackend((url) => url.endsWith("/approve") ? new Promise<Response>((resolve) => { complete = resolve; }) : json([application]));
    const onApproved = vi.fn();
    render(<ProviderApplications services={services} onApproved={onApproved} />);
    const approve = await screen.findByRole("button", { name: `Approve ${application.name}` });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I have verified/ }));
    fireEvent.click(approve);
    expect(onApproved).not.toHaveBeenCalled();
    await act(async () => complete(json({ application: { ...application, status: "approved" }, providers: [approvedProvider] })));
    expect(onApproved).toHaveBeenCalledWith([approvedProvider]);
    expect(screen.getByText("No pending applications.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approved (1)" }));
    expect(screen.getByText(application.name)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approve / })).toBeNull();
  });

  it("does not publish or remove an application when approval fails", async () => {
    mockBackend((url) => url.endsWith("/approve") ? json({ detail: "Already reviewed; refresh" }, 409) : json([application]));
    const onApproved = vi.fn();
    render(<ProviderApplications services={services} onApproved={onApproved} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /I have verified/ }));
    fireEvent.click(screen.getByRole("button", { name: `Approve ${application.name}` }));
    expect((await screen.findByRole("alert")).textContent).toContain("Already reviewed");
    expect(onApproved).not.toHaveBeenCalled();
    expect(screen.getByText(application.name)).toBeTruthy();
  });

  it("confirms rejection and keeps rejected applicants unpublished", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = mockBackend((url) => url.endsWith("/reject") ? json({ ...application, status: "rejected" }) : json([application]));
    const onApproved = vi.fn();
    render(<ProviderApplications services={services} onApproved={onApproved} />);
    const reject = await screen.findByRole("button", { name: `Reject ${application.name}` });
    fireEvent.click(reject);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/reject"))).toBe(false);
    confirm.mockReturnValue(true);
    fireEvent.click(reject);
    expect(await screen.findByText("No pending applications.")).toBeTruthy();
    expect(onApproved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rejected (1)" }));
    expect(screen.getByText(application.name)).toBeTruthy();
  });

  it("surfaces queue load errors and retries", async () => {
    const fetchMock = mockBackend(() => json({ detail: "Offline" }, 503));
    render(<ProviderApplications services={services} onApproved={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load applications");
    fetchMock.mockResolvedValue(json([application]));
    fireEvent.click(screen.getByRole("button", { name: "Refresh applications" }));
    expect(await screen.findByText(application.name)).toBeTruthy();
  });

  it("wires approval to customer listings and displays real review averages", async () => {
    window.history.replaceState(null, "", "#admin");
    mockBackend((url) => url.endsWith("/approve") ? json({ application: { ...application, status: "approved" }, providers: [approvedProvider] }) : json([application]));
    render(<App />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /I have verified/ }));
    fireEvent.click(screen.getByRole("button", { name: `Approve ${application.name}` }));
    expect(await screen.findByText(`${application.name} approved and listed.`)).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Customer view/ })));
    fireEvent.click(screen.getByRole("button", { name: /Book Plumber/ }));
    expect(screen.getByText("New provider - no reviews yet")).toBeTruthy();
    expect(screen.getByText(`Based in: ${application.area}`)).toBeTruthy();
    const publicCache = JSON.parse(window.localStorage.getItem("hosur-home-services-state")!);
    expect(publicCache.providerCatalog.plumber).toEqual([approvedProvider]);
    expect(publicCache.applications).toBeUndefined();
    cleanup();
    publicCache.reviewsByProvider = {
      [approvedProvider.id]: [
        { id: "r1", providerId: approvedProvider.id, userName: "Customer A", rating: 4, comment: "Good", createdAt: application.createdAt },
        { id: "r2", providerId: approvedProvider.id, userName: "Customer B", rating: 5, comment: "Great", createdAt: application.createdAt },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ ...state, providerCatalog: publicCache.providerCatalog, reviewsByProvider: publicCache.reviewsByProvider })));
    render(<App />);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("hosur-home-services-state")!).reviewsByProvider[approvedProvider.id]).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: /Book Plumber/ }));
    expect(screen.getByText("★ 4.5 (2 reviews)")).toBeTruthy();
  });
});
