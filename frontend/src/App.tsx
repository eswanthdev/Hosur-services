import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";

type Service = { id: string; name: string; tamil: string; category: string };
type Provider = { id: string; name: string; phone: string; rating: number; experience: string; serviceId: string };
type Review = { id: string; providerId: string; userName: string; rating: number; comment: string; createdAt: string };
type UserProfile = { name: string; phone: string; address: string };

const areas = ["Hosur Town", "Bagalur", "Bagalur Road", "Nallur", "Mathigiri", "Zuzuvadi", "SIPCOT", "Mookandapalli", "Shanthi Nagar", "Avalapalli", "Thally Road", "Attibele"];
const loggedInUser: UserProfile = { name: "Ravi Kumar", phone: "9876543210", address: "12, 2nd Cross, SIPCOT, Hosur" };
const initialProviderCatalog: Record<string, Provider[]> = {};
const initialReviews: Record<string, Review[]> = {};

const initialServices: Service[] = [
  ["plumber", "Plumber", "பிளம்பர்", "Home repair"], ["electrician", "Electrician", "எலக்ட்ரீஷியன்", "Home repair"], ["carpenter", "Carpenter", "தச்சர்", "Home repair"], ["painter", "Painter", "பெயிண்டர்", "Home repair"], ["mason-tile", "Mason & tile work", "கொத்தனார் மற்றும் டைல்ஸ்", "Home repair"], ["welding", "Welding & grill work", "வெல்டிங் மற்றும் கிரில் வேலை", "Home repair"],
  ["ac-service", "AC service", "ஏசி சர்வீஸ்", "Appliances"], ["fridge-repair", "Fridge repair", "ஃப்ரிட்ஜ் ரிப்பேர்", "Appliances"], ["washing-machine", "Washing machine repair", "வாஷிங் மெஷின் ரிப்பேர்", "Appliances"], ["ro-purifier", "RO purifier", "RO ப்யூரிஃபையர்", "Appliances"], ["inverter-ups", "Inverter & UPS", "இன்வெர்ட்டர் மற்றும் UPS", "Appliances"], ["water-heater", "Water heater", "வாட்டர் ஹீட்டர்", "Appliances"], ["solar-water-heater", "Solar water heater", "சோலார் வாட்டர் ஹீட்டர்", "Appliances"], ["tv-repair", "TV repair", "டிவி ரிப்பேர்", "Appliances"], ["mobile-laptop", "Mobile & laptop repair", "மொபைல் மற்றும் லேப்டாப் ரிப்பேர்", "Appliances"],
  ["deep-clean", "Full home deep cleaning", "வீடு முழு சுத்தம்", "Home cleaning"], ["bathroom-clean", "Bathroom cleaning", "குளியலறை சுத்தம்", "Home cleaning"], ["kitchen-clean", "Kitchen cleaning", "சமையலறை சுத்தம்", "Home cleaning"], ["sofa-carpet", "Sofa & carpet cleaning", "சோபா மற்றும் கார்பெட் சுத்தம்", "Home cleaning"], ["water-tank", "Water tank cleaning", "தண்ணீர் தொட்டி சுத்தம்", "Home cleaning"], ["pest-control", "Pest control", "பூச்சி கட்டுப்பாடு", "Home cleaning"],
  ["gardening", "Gardening", "தோட்ட பராமரிப்பு", "Outdoors"], ["mosquito-net", "Mosquito net fitting", "கொசு வலை பொருத்துதல்", "Outdoors"], ["rainwater", "Rainwater harvesting", "மழைநீர் சேகரிப்பு", "Outdoors"], ["borewell", "Borewell & motor", "போர்வெல் மற்றும் மோட்டார்", "Outdoors"], ["cctv", "CCTV", "CCTV", "Outdoors"], ["solar-panel", "Solar panel", "சோலார் பேனல்", "Outdoors"], ["waterproofing", "Terrace waterproofing", "மாடி நீர் கசிவு தடுப்பு", "Outdoors"],
  ["car-wash", "Doorstep car wash", "வீட்டிற்கே கார் வாஷ்", "Vehicles"], ["puncture", "Bike & car puncture", "பைக் மற்றும் கார் பஞ்சர்", "Vehicles"], ["car-ac", "Car AC cleaning", "கார் ஏசி கிளீனிங்", "Vehicles"], ["driver", "Acting driver", "தற்காலிக டிரைவர்", "Vehicles"], ["mini-truck", "Mini truck for shifting", "ஷிஃப்டிங்கிற்கு மினி டிரக்", "Vehicles"],
  ["maid", "Housemaid", "வீட்டு வேலை உதவியாளர்", "Care at home"], ["cook", "Cook", "சமையல்காரர்", "Care at home"], ["babysitter", "Babysitter", "குழந்தை பராமரிப்பாளர்", "Care at home"], ["elder-care", "Elder care", "முதியோர் பராமரிப்பு", "Care at home"], ["tuition", "Home tuition", "வீட்டில் டியூஷன்", "Care at home"],
  ["pet-grooming", "Pet grooming", "செல்லப்பிராணி அழகுபடுத்தல்", "Pets"], ["pet-cleaner", "Pet cleaner", "செல்லப்பிராணி சுத்தம்", "Pets"], ["dog-walking", "Dog walking", "நாய் நடைப்பயிற்சி", "Pets"],
].map(([id, name, tamil, category]) => ({ id, name, tamil, category }));

const categories = ["Home repair", "Appliances", "Home cleaning", "Outdoors", "Vehicles", "Care at home", "Pets"];
const storageKey = "hosur-home-services-state";

function readStoredState() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [language, setLanguage] = useState<"en" | "ta">("en");
  const [area, setArea] = useState(areas[0]);
  const [services, setServices] = useState<Service[]>(() => readStoredState()?.services ?? initialServices);
  const [providerCatalog, setProviderCatalog] = useState<Record<string, Provider[]>>(() => readStoredState()?.providerCatalog ?? initialProviderCatalog);
  const [reviewsByProvider, setReviewsByProvider] = useState<Record<string, Review[]>>(() => readStoredState()?.reviewsByProvider ?? initialReviews);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [view, setView] = useState<"home" | "admin">(() => (typeof window !== "undefined" && window.location.hash === "#admin" ? "admin" : "home"));
  const [bookingSent, setBookingSent] = useState(false);
  const [askedFor, setAskedFor] = useState<string[]>(() => readStoredState()?.askedFor ?? []);

  useEffect(() => {
    const syncViewFromHash = () => {
      const nextView = window.location.hash === "#admin" ? "admin" : "home";
      setView(nextView);
    };

    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify({ services, providerCatalog, reviewsByProvider, askedFor }));
  }, [askedFor, providerCatalog, reviewsByProvider, services]);
  const [userProfile] = useState<UserProfile>(loggedInUser);
  const [reviewDraft, setReviewDraft] = useState({ name: userProfile.name, rating: 5, comment: "" });

  const text = language === "ta"
    ? { brand: "ஹோசூர் ஹோம் சர்வீசஸ்", subtitle: "உங்கள் பகுதியில் நம்பகமான சேவைகள்", find: "சேவையைத் தேர்ந்தெடுக்கவும்", area: "உங்கள் பகுதி", book: "பதிவு செய்யுங்கள்", admin: "நிர்வாகம்" }
    : { brand: "Hosur Home Services", subtitle: "Local services for your area", find: "Choose a service", area: "Your area", book: "Book a provider", admin: "Admin" };

  const filtered = useMemo(() => services.filter((service) =>
    (category === "All" || service.category === category) &&
    `${service.name} ${service.tamil}`.toLowerCase().includes(query.toLowerCase()),
  ), [category, query, services]);

  const liveProviders = useMemo(
    () => Object.values(providerCatalog).flatMap((providers) => providers),
    [providerCatalog],
  );

  const providersForSelectedService = selectedService ? (providerCatalog[selectedService.id] ?? []) : [];

  function handleBookProvider(provider: Provider) {
    setSelectedProvider(provider);
    setBookingSent(false);
  }

  function requestBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider || !selectedService) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? userProfile.name).trim() || userProfile.name;
    const phone = String(form.get("phone") ?? userProfile.phone).trim() || userProfile.phone;
    const address = String(form.get("address") ?? userProfile.address).trim() || userProfile.address;
    const details = String(form.get("details") ?? "").trim();
    const mediaFile = form.get("mediaFile");
    const mediaName = mediaFile && typeof mediaFile !== "string" ? mediaFile.name : "";
    const problemText = details || (mediaName ? "Customer attached audio/video proof for the issue." : "Customer wants to discuss the repair issue.");
    const message = `Hi ${selectedProvider.name}, I need a ${selectedService.name.toLowerCase()} service request.\nCustomer: ${name}\nPhone: ${phone}\nArea: ${area}\nAddress: ${address}\nProblem: ${problemText}${mediaName ? `\nAttachment: ${mediaName}` : ""}`;
    const whatsappUrl = `https://wa.me/${selectedProvider.phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setBookingSent(true);
  }

  function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const serviceCategory = String(form.get("category") ?? "");
    if (!name || !serviceCategory) return;
    setServices((current) => [...current, { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, name, tamil: name, category: serviceCategory }]);
    event.currentTarget.reset();
  }

  function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceId = String(form.get("providerService") ?? "").trim();
    const name = String(form.get("providerName") ?? "").trim();
    const phone = String(form.get("providerPhone") ?? "").trim();
    const experience = String(form.get("providerExperience") ?? "").trim();
    const ratingValue = Number(form.get("providerRating") ?? 5);
    if (!serviceId || !name || !phone || !experience) return;

    const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
    const duplicateExists = Object.values(providerCatalog).some((providers) =>
      providers.some((provider) => provider.serviceId === serviceId && provider.name.toLowerCase() === name.toLowerCase()),
    );

    if (duplicateExists) {
      return;
    }

    const newProvider: Provider = {
      id: `${serviceId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name,
      phone: normalizedPhone,
      rating: Number.isFinite(ratingValue) ? Math.min(5, Math.max(1, ratingValue)) : 5,
      experience,
      serviceId,
    };

    setProviderCatalog((current) => ({
      ...current,
      [serviceId]: [...(current[serviceId] ?? []), newProvider],
    }));

    event.currentTarget.reset();
  }

  function removeProvider(providerId: string) {
    setProviderCatalog((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([serviceId, providers]) => [serviceId, providers.filter((provider) => provider.id !== providerId)]),
      );

      return Object.fromEntries(
        Object.entries(next).filter(([, providers]) => providers.length > 0),
      );
    });
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider) return;
    const comment = reviewDraft.comment.trim();
    if (!comment) return;

    const newReview: Review = {
      id: `${selectedProvider.id}-${Date.now()}`,
      providerId: selectedProvider.id,
      userName: reviewDraft.name.trim() || userProfile.name,
      rating: Math.min(5, Math.max(1, reviewDraft.rating)),
      comment,
      createdAt: new Date().toISOString(),
    };

    setReviewsByProvider((current) => ({
      ...current,
      [selectedProvider.id]: [newReview, ...(current[selectedProvider.id] ?? [])],
    }));

    setReviewDraft((current) => ({ ...current, comment: "", rating: 5 }));
  }

  function openCustomerView() {
    window.location.hash = "";
    setView("home");
  }

  function openAdminView() {
    window.location.hash = "#admin";
    setView("admin");
  }

  if (view === "admin") {
    return <main className="app-shell">
      <header className="topbar"><button className="brand" onClick={openCustomerView}>{text.brand}</button><button className="text-button" onClick={openCustomerView}>← Customer view</button></header>
      <section className="admin-page">
        <p className="eyebrow">FOUNDER DESK</p><h1>Start with verified providers.</h1>
        <p className="intro">Only approved providers appear in the customer portal. Add the verified details here and they will instantly become available for booking.</p>
        <div className="stat-grid"><article><strong>{liveProviders.length}</strong><span>Live providers</span></article><article><strong>{askedFor.length}</strong><span>Bookings requested</span></article><article><strong>{services.length}</strong><span>Active services</span></article></div>

        <section className="admin-card"><h2>Add a service</h2><form onSubmit={addService} className="add-service"><label>Service name<input required name="name" placeholder="e.g. Curtain fitting" /></label><label>Category<select required name="category"><option value="">Choose category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary">Add service</button></form></section>

        <section className="admin-card"><h2>Add a verified provider</h2><form onSubmit={addProvider} className="add-service"><label>Service<select required name="providerService"><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>Provider name<input required name="providerName" placeholder="e.g. Karthik Plumbing" /></label><label>Phone number<input required name="providerPhone" placeholder="9876543210" inputMode="tel" /></label><label>Experience<input required name="providerExperience" placeholder="8 years" /></label><label>Rating<select required name="providerRating" defaultValue={5}><option value={5}>5.0</option><option value={4.9}>4.9</option><option value={4.8}>4.8</option><option value={4.7}>4.7</option><option value={4.6}>4.6</option></select></label><button className="primary">Save verified provider</button></form></section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Live providers</h2>
            <span>{liveProviders.length} active</span>
          </div>
          {liveProviders.length ? (
            <div className="provider-table">
              <div className="provider-table-row header-row">
                <span>Provider</span>
                <span>Service</span>
                <span>Rating</span>
                <span>Phone</span>
                <span>Action</span>
              </div>
              {liveProviders.map((provider) => {
                const serviceName = services.find((service) => service.id === provider.serviceId)?.name ?? provider.serviceId;
                return (
                  <div className="provider-table-row" key={provider.id}>
                    <span><strong>{provider.name}</strong><small>{provider.experience}</small></span>
                    <span>{serviceName}</span>
                    <span>★ {provider.rating.toFixed(1)}</span>
                    <span>{provider.phone}</span>
                    <button className="danger-button" type="button" onClick={() => removeProvider(provider.id)}>Remove</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No approved providers have been added yet.</p>
          )}
        </section>

        <section className="admin-card"><h2>Asked-for list</h2>{askedFor.length ? <ul>{askedFor.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No unmatched searches recorded yet.</p>}</section>
      </section>
    </main>;
  }

  const currentProviderReviews = selectedProvider ? reviewsByProvider[selectedProvider.id] ?? [] : [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { setSelectedService(null); setSelectedProvider(null); setBookingSent(false); }}>{text.brand}</button>
        <div className="header-actions"><button className="language" onClick={() => setLanguage(language === "en" ? "ta" : "en")}>{language === "en" ? "தமிழ்" : "English"}</button></div>
      </header>

      {!selectedService ? (
        <>
          <section className="hero">
            <div className="hero-card">
              <div className="hero-content">
                <p className="eyebrow">HOSUR • LOCAL • DIRECT</p>
                <h1>{text.subtitle}</h1>
                <p>Compare verified local providers by their rate cards. Pay your provider directly after the work.</p>
                <label className="area-picker">{text.area}<select value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
            </div>
          </section>

          <section className="services">
            <div className="section-title">
              <div><p className="eyebrow">{area.toUpperCase()}</p><h2>{text.find}</h2></div>
              <input aria-label="Search services" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a service" />
            </div>
            <div className="chips">
              <button className={category === "All" ? "active" : ""} onClick={() => setCategory("All")}>All</button>
              {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <div className="service-grid">
              {filtered.map((service) => (
                <button className="service-card" key={service.id} onClick={() => { setSelectedService(service); setSelectedProvider(null); setBookingSent(false); }}>
                  <span>{service.category}</span>
                  <strong>{language === "en" ? service.name : service.tamil}</strong>
                  <small>{language === "en" ? service.tamil : service.name}</small>
                  <b>Book {language === "en" ? service.name : service.tamil} →</b>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <div className="empty">
                <h3>We do not have this service listed yet.</h3>
                <p>We have saved your request so the founder can review it this week.</p>
                <button className="primary" onClick={() => { if (query.trim()) setAskedFor((current) => [...current, query.trim()]); }}>Save request</button>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="booking-page">
          <button className="back" onClick={() => { setSelectedService(null); setSelectedProvider(null); setBookingSent(false); }}>← All services</button>
          <p className="eyebrow">{selectedService.category.toUpperCase()} · {area.toUpperCase()}</p>
          <h1>{language === "en" ? selectedService.name : selectedService.tamil}</h1>
          <p className="intro">Providers choose their own visit charge, job prices, and hourly rates. Phone numbers are shared only after a provider accepts your request.</p>

          {!bookingSent ? (
            <>
              {!selectedProvider ? (
                <div className="provider-list">
                  {providersForSelectedService.length ? providersForSelectedService.map((provider) => (
                    <article className="provider-card" key={provider.id}>
                      <div className="provider-top">
                        <div><h2>{provider.name}</h2><p>{provider.experience} experience</p></div>
                        <span className="rating">★ {provider.rating.toFixed(1)}</span>
                      </div>
                      <div className="provider-meta"><span>{area}</span><span>Verified local</span></div>
                      <button className="primary" type="button" onClick={() => handleBookProvider(provider)}>Book {provider.name}</button>
                    </article>
                  )) : (
                    <section className="no-providers">
                      <span>!</span>
                      <div>
                        <h2>No verified providers are live in {area} yet.</h2>
                        <p>Your request will be recorded for the founder to match when an approved provider is available.</p>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="booking-stack">
                  <form className="booking-form" onSubmit={requestBooking}>
                    <h2>Book {selectedProvider.name}</h2>
                    <label>Your name<input readOnly name="name" defaultValue={userProfile.name} /></label>
                    <label>Phone number<input readOnly name="phone" inputMode="tel" defaultValue={userProfile.phone} pattern="[0-9]{10}" /></label>
                    <label>Address in {area}<textarea readOnly name="address" defaultValue={userProfile.address} /></label>
                    <label className="upload-field"><span>Describe the problem</span><input type="file" name="mediaFile" accept="audio/*,video/*,.txt,.doc,.docx" /></label>
                    <label>Text note<textarea name="details" placeholder="Describe the issue in text, or attach audio/video above" /></label>
                    <button className="primary" type="submit">Send WhatsApp request</button>
                    <button className="secondary back-button" type="button" onClick={() => setSelectedProvider(null)}>Choose another technician</button>
                    <p className="fine-print">Your profile details are auto-filled. You can send a text note or attach an audio/video file with the request.</p>
                  </form>

                  <aside className="review-panel">
                    <div className="review-header">
                      <h3>Customer reviews</h3>
                      <span>{currentProviderReviews.length} reviews</span>
                    </div>

                    {currentProviderReviews.length ? (
                      <div className="review-list">
                        {currentProviderReviews.map((review) => (
                          <article key={review.id} className="review-item">
                            <div className="review-meta">
                              <strong>{review.userName}</strong>
                              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="stars">{"★".repeat(Math.round(review.rating))}{"☆".repeat(5 - Math.round(review.rating))}</div>
                            <p>{review.comment}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-review">No reviews yet. Be the first to leave feedback for this provider.</p>
                    )}

                    <form className="review-form" onSubmit={submitReview}>
                      <label>Name<input value={reviewDraft.name} onChange={(event) => setReviewDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                      <label>Rating<select value={reviewDraft.rating} onChange={(event) => setReviewDraft((current) => ({ ...current, rating: Number(event.target.value) }))}><option value={5}>5 - Excellent</option><option value={4}>4 - Good</option><option value={3}>3 - Fair</option><option value={2}>2 - Average</option><option value={1}>1 - Poor</option></select></label>
                      <label>Review<textarea value={reviewDraft.comment} onChange={(event) => setReviewDraft((current) => ({ ...current, comment: event.target.value }))} placeholder="Share your experience with this technician" required /></label>
                      <button className="secondary" type="submit">Submit review</button>
                    </form>
                  </aside>
                </div>
              )}
            </>
          ) : (
            <section className="confirmation">
              <div className="check">✓</div>
              <p className="eyebrow">WHATSAPP REQUEST SENT</p>
              <h2>Your request is shared with {selectedProvider?.name}.</h2>
              <p>The technician was notified on WhatsApp with your job details. If they do not respond, you can return and pick another provider.</p>
              <button className="secondary" onClick={() => { setSelectedProvider(null); setBookingSent(false); }}>Choose another provider</button>
            </section>
          )}
        </section>
      )}

      <footer>Hosur Home Services is a local connection service. Providers set their own prices. Customers pay providers directly.</footer>
    </main>
  );
}
