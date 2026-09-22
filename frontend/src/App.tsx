import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";

type Service = { id: string; name: string; tamil: string; category: string };
type Provider = { id: string; name: string; phone: string; rating: number; experience: string; serviceId: string; area?: string };
type Review = { id: string; providerId: string; userName: string; rating: number; comment: string; createdAt: string };
type FeedPost = { id: string; author: string; handle: string; location: string; title: string; caption: string; accent: string; tag: string; likes: number; likedBy?: string[]; comments: number; createdAt: string };
type UserProfile = { name: string; phone: string; address: string };
type CustomerTab = "home" | "feed";

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
  ["maid", "Housemaid", "வீட்டு வேலை உதவியாளர்", "Care at home"], ["cook", "Cook", "சமையல்காரர்", "Care at home"], ["babysitter", "Babysitter", "குழந்தை பராமரிப்பாளர்", "Care at home"], ["elder-care", "Elder care", "முதியோர் பராமரிப்பு", "Care at home"], ["tuition", "Home tuition", "வீட்டில் டியூஷன்", "Tutors & coaches"],
  ["pet-grooming", "Pet grooming", "செல்லப்பிராணி அழகுபடுத்தல்", "Pets"], ["pet-cleaner", "Pet cleaner", "செல்லப்பிராணி சுத்தம்", "Pets"], ["dog-walking", "Dog walking", "நாய் நடைப்பயிற்சி", "Pets"],
].map(([id, name, tamil, category]) => ({ id, name, tamil, category }));

const additionalServices: Service[] = [
  ["packers-movers", "Packers & movers", "பேக்கர்ஸ் மற்றும் மூவர்ஸ்", "Moving & delivery"],
  ["laundry-ironing", "Laundry & ironing pickup", "துணி துவைத்தல் மற்றும் இஸ்திரி", "Home cleaning"],
  ["locksmith", "Locksmith & lock repair", "சாவி மற்றும் பூட்டு பழுது நீக்கம்", "Home repair"],
  ["gas-stove-chimney", "Gas stove & chimney servicing", "எரிவாயு அடுப்பு மற்றும் சிம்னி பராமரிப்பு", "Appliances"],
  ["bike-service", "Doorstep bike servicing", "வீட்டிற்கே பைக் சர்வீஸ்", "Vehicles"],
  ["water-tanker", "Water tanker booking", "தண்ணீர் லாரி முன்பதிவு", "Moving & delivery"],
  ["septic-drainage", "Septic tank & drainage cleaning", "கழிவுநீர் தொட்டி மற்றும் வடிகால் சுத்தம்", "Home cleaning"],
  ["wifi-setup", "Internet & Wi-Fi setup", "இணையம் மற்றும் வைஃபை அமைத்தல்", "Home repair"],
  ["appliance-installation", "Appliance installation & uninstallation", "வீட்டு உபகரணங்கள் பொருத்துதல் மற்றும் அகற்றுதல்", "Appliances"],
  ["furniture-assembly", "Furniture assembly & repair", "மரச்சாமான்கள் பொருத்துதல் மற்றும் பழுது நீக்கம்", "Home repair"],
  ["curtains-racks", "Curtain, blind & drying rack installation", "திரைச்சீலை மற்றும் துணி உலர்த்தும் கம்பி பொருத்துதல்", "Home repair"],
  ["tailoring", "Doorstep tailoring & alterations", "வீட்டிற்கே தையல் மற்றும் ஆடை திருத்தம்", "Personal services"],
  ["home-salon", "Home salon & grooming", "வீட்டிற்கே அழகு பராமரிப்பு", "Personal services"],
  ["computer-printer", "Computer & printer setup and repair", "கணினி மற்றும் பிரிண்டர் அமைத்தல் மற்றும் பழுது நீக்கம்", "Appliances"],
  ["event-support", "Event decoration, photography, catering & rentals", "விழா அலங்காரம், புகைப்படம், உணவு மற்றும் வாடகைப் பொருட்கள்", "Events"],
  ["home-nursing", "Home nursing", "வீட்டிலேயே செவிலியர் சேவை", "Health care"],
  ["physiotherapy", "Home physiotherapy", "வீட்டிலேயே இயன்முறை சிகிச்சை", "Health care"],
  ["pet-boarding", "Pet boarding & sitting", "செல்லப்பிராணி தங்குமிடம் மற்றும் பராமரிப்பு", "Pets"],
  ["ev-charger", "EV charger installation", "மின்சார வாகன சார்ஜர் பொருத்துதல்", "Vehicles"],
  ["office-maintenance", "Office & shop maintenance", "அலுவலகம் மற்றும் கடை பராமரிப்பு", "Home repair"],
  ["dslr-rental", "DSLR & mirrorless camera rental", "DSLR மற்றும் மிரர்லெஸ் கேமரா வாடகை", "Renting"],
  ["camera-lens-rental", "Camera lens rental", "கேமரா லென்ஸ் வாடகை", "Renting"],
  ["camera-accessory-rental", "Tripod & photography lighting rental", "டிரைபாட் மற்றும் புகைப்பட விளக்கு வாடகை", "Renting"],
  ["projector-rental", "Projector & screen rental", "புரொஜெக்டர் மற்றும் திரை வாடகை", "Renting"],
  ["sound-system-rental", "Speaker & microphone rental", "ஒலிபெருக்கி மற்றும் மைக்ரோஃபோன் வாடகை", "Renting"],
  ["event-furniture-rental", "Party chair & table rental", "விழா நாற்காலி மற்றும் மேசை வாடகை", "Renting"],
  ["tent-rental", "Tent & canopy rental", "கூடாரம் மற்றும் பந்தல் வாடகை", "Renting"],
  ["power-tool-rental", "Power tool rental", "மின்சார கருவிகள் வாடகை", "Renting"],
  ["skating-coach", "Skating coach", "ஸ்கேட்டிங் பயிற்சியாளர்", "Tutors & coaches"],
  ["badminton-coach", "Badminton coach", "பாட்மிண்டன் பயிற்சியாளர்", "Tutors & coaches"],
  ["swimming-coach", "Swimming coach", "நீச்சல் பயிற்சியாளர்", "Tutors & coaches"],
  ["cricket-coach", "Cricket coach", "கிரிக்கெட் பயிற்சியாளர்", "Tutors & coaches"],
  ["football-coach", "Football coach", "கால்பந்து பயிற்சியாளர்", "Tutors & coaches"],
  ["tennis-coach", "Tennis coach", "டென்னிஸ் பயிற்சியாளர்", "Tutors & coaches"],
  ["chess-coach", "Chess coach", "சதுரங்க பயிற்சியாளர்", "Tutors & coaches"],
  ["dance-tutor", "Dance tutor", "நடன ஆசிரியர்", "Tutors & coaches"],
  ["music-tutor", "Music tutor", "இசை ஆசிரியர்", "Tutors & coaches"],
  ["yoga-instructor", "Yoga instructor", "யோகா பயிற்சியாளர்", "Tutors & coaches"],
].map(([id, name, tamil, category]) => ({ id, name, tamil, category }));

const categories = Array.from(new Set([...initialServices, ...additionalServices].map((service) => service.category)));
const defaultNewsItems = [
  { id: "news-grt-water", badge: "Water alert", area: "GRT layout", title: "Water clog warning near GRT layout", summary: "Residents in GRT and nearby lanes are reporting slow drainage after heavy rain. Local plumbers are available for quick clearing." },
  { id: "news-attibele-pipeline", badge: "Service strike", area: "Attibele", title: "Pipeline maintenance in Attibele this week", summary: "A local water supply interruption is expected in parts of Attibele. Residents are advised to book urgent plumbing support early." },
  { id: "news-sipcot-power", badge: "Hosur update", area: "SIPCOT", title: "Power backup demand rising in SIPCOT", summary: "Several households in SIPCOT and Hosur Town are requesting urgent electrical checks and inverter support before the weekend." },
];
const defaultFeedPosts: FeedPost[] = [
  { id: "feed-1", author: "Ravi Kumar", handle: "@ravikumar", location: "Hosur Town", title: "Water issue", caption: "Water is standing near the GRT road after the rain and roads are getting slippery. Neighbors, please stay careful and share if you know a quick fix.", accent: "linear-gradient(135deg, #60a5fa 0%, #22d3ee 40%, #a78bfa 100%)", tag: "#HosurUpdate", likes: 128, comments: 24, createdAt: new Date().toISOString() },
  { id: "feed-2", author: "Meena", handle: "@meenahsr", location: "SIPCOT", title: "Streetlight issue", caption: "The streetlights near the SIPCOT lane have been off for two nights. It feels unsafe for people returning late from work.", accent: "linear-gradient(135deg, #f59e0b 0%, #f97316 40%, #ef4444 100%)", tag: "#SafetyAlert", likes: 94, comments: 18, createdAt: new Date().toISOString() },
  { id: "feed-3", author: "Arun", handle: "@arunlocal", location: "Attibele", title: "Water supply delay", caption: "Water supply has been weak in our block since morning. We are checking with the nearby residents to see if this is happening across Attibele.", accent: "linear-gradient(135deg, #34d399 0%, #10b981 40%, #0ea5e9 100%)", tag: "#CommunityNotice", likes: 210, comments: 33, createdAt: new Date().toISOString() },
];
const storageKey = "hosur-home-services-state";

function isTutorService(service: Service) {
  return service.category === "Tutors & coaches" || service.id === "tuition";
}

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
  const [services, setServices] = useState<Service[]>(() => {
    const savedServices: Service[] = readStoredState()?.services ?? initialServices;
    const savedIds = new Set(savedServices.map((service) => service.id));
    return [...savedServices, ...additionalServices.filter((service) => !savedIds.has(service.id))]
      .map((service) => {
        if (service.id === "tuition") return { ...service, category: "Tutors & coaches" };
        if (service.id === "office-maintenance") return { ...service, category: "Home repair" };
        if (service.category === "Business services") return { ...service, category: "Renting" };
        return service;
      });
  });
  const [providerCatalog, setProviderCatalog] = useState<Record<string, Provider[]>>(() => readStoredState()?.providerCatalog ?? initialProviderCatalog);
  const [reviewsByProvider, setReviewsByProvider] = useState<Record<string, Review[]>>(() => readStoredState()?.reviewsByProvider ?? initialReviews);
  const [newsItems, setNewsItems] = useState<Array<{ id: string; badge: string; area: string; title: string; summary: string }>>(() => readStoredState()?.newsItems ?? defaultNewsItems);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(() => {
    const storedPosts = readStoredState()?.feedPosts;
    const sanitized = Array.isArray(storedPosts)
      ? storedPosts.filter((post) =>
          post &&
          typeof post.author === "string" &&
          typeof post.caption === "string" &&
          post.author !== "Karthik & Co." &&
          post.author !== "Sundar Electric" &&
          post.author !== "Asha Cleaning",
        )
      : [];

    const merged = [...sanitized, ...defaultFeedPosts];
    const unique = merged.filter((post, index, array) => array.findIndex((item) => item.id === post.id) === index);

    return unique.length ? unique : defaultFeedPosts;
  });
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [view, setView] = useState<"home" | "admin">(() => (typeof window !== "undefined" && window.location.hash === "#admin" ? "admin" : "home"));
  const [customerTab, setCustomerTab] = useState<CustomerTab>("home");
  const [bookingSent, setBookingSent] = useState(false);
  const [askedFor, setAskedFor] = useState<string[]>(() => readStoredState()?.askedFor ?? []);
  const [postDraft, setPostDraft] = useState("");
  const [providerError, setProviderError] = useState("");

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
    window.localStorage.setItem(storageKey, JSON.stringify({ services, providerCatalog, reviewsByProvider, askedFor, newsItems, feedPosts }));
  }, [askedFor, feedPosts, newsItems, providerCatalog, reviewsByProvider, services]);
  const [userProfile] = useState<UserProfile>(loggedInUser);
  const [reviewDraft, setReviewDraft] = useState({ name: userProfile.name, rating: 5, comment: "" });

  const text = language === "ta"
    ? { brand: "ஹோசூர் சர்வீசஸ்", subtitle: "உங்கள் பகுதியில் நம்பகமான சேவைகள்", find: "சேவையைத் தேர்ந்தெடுக்கவும்", area: "உங்கள் பகுதி", book: "பதிவு செய்யுங்கள்", admin: "நிர்வாகம்" }
    : { brand: "Hosur Services", subtitle: "Local services for your area", find: "Choose a service", area: "Your area", book: "Book a provider", admin: "Admin" };
  const filtered = useMemo(() => services.filter((service) =>
    (category === "All" || service.category === category) &&
    `${service.name} ${service.tamil}`.toLowerCase().includes(query.toLowerCase()),
  ), [category, query, services]);

  const liveProviders = useMemo(
    () => Object.values(providerCatalog).flatMap((providers) => providers),
    [providerCatalog],
  );

  const providersForSelectedService = useMemo(() => {
    const providers = selectedService ? (providerCatalog[selectedService.id] ?? []) : [];
    return [...providers].sort((first, second) =>
      Number(second.area === area) - Number(first.area === area),
    );
  }, [area, providerCatalog, selectedService]);
  const selectedIsTutor = selectedService ? isTutorService(selectedService) : false;
  const selectedIsRental = selectedService?.category === "Renting";
  const requirementsLabel = selectedIsRental ? "Rental requirements" : selectedIsTutor ? "Lesson requirements" : "Text note";

  function openCustomerTab(tab: CustomerTab) {
    setCustomerTab(tab);
    setSelectedService(null);
    setSelectedProvider(null);
    setBookingSent(false);
    setCategory("All");
    setQuery("");
  }

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
    const problemText = details || (selectedIsRental ? "Customer wants to discuss rental dates, availability, charges and deposit." : selectedIsTutor ? "Customer wants to discuss lessons, timings and fees." : (mediaName ? "Customer attached audio/video proof for the issue." : "Customer wants to discuss the repair issue."));
    const message = `Hi ${selectedProvider.name}, I need a ${selectedService.name.toLowerCase()} service request.\nCustomer: ${name}\nPhone: ${phone}\nArea: ${area}\nAddress: ${address}\n${selectedIsTutor || selectedIsRental ? requirementsLabel : "Problem"}: ${problemText}${mediaName ? `\nAttachment: ${mediaName}` : ""}`;
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

  function addNewsItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const badge = String(form.get("newsBadge") ?? "").trim();
    const area = String(form.get("newsArea") ?? "").trim();
    const title = String(form.get("newsTitle") ?? "").trim();
    const summary = String(form.get("newsSummary") ?? "").trim();
    if (!badge || !area || !title || !summary) return;

    const newItem = {
      id: `news-${Date.now()}`,
      badge,
      area,
      title,
      summary,
    };

    setNewsItems((current) => [newItem, ...current]);
    event.currentTarget.reset();
  }

  function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceId = String(form.get("providerService") ?? "").trim();
    const name = String(form.get("providerName") ?? "").trim();
    const phone = String(form.get("providerPhone") ?? "").trim();
    const experience = String(form.get("providerExperience") ?? "").trim();
    const providerArea = String(form.get("providerArea") ?? "");
    const ratingValue = Number(form.get("providerRating") ?? 5);
    if (!serviceId || !name || !phone || !experience) return;
    if (!areas.includes(providerArea)) {
      setProviderError("Choose a valid area for the provider.");
      return;
    }
    setProviderError("");

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
      area: providerArea,
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

  function updateProviderArea(providerId: string, providerArea: string) {
    setProviderCatalog((current) => Object.fromEntries(
      Object.entries(current).map(([serviceId, providers]) => [
        serviceId,
        providers.map((provider) => provider.id === providerId ? { ...provider, area: providerArea } : provider),
      ]),
    ));
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

  function formatCount(value: number) {
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
    return String(value);
  }

  function createFeedPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = postDraft.trim();
    if (!text) return;

    const newPost: FeedPost = {
      id: `feed-${Date.now()}`,
      author: userProfile.name,
      handle: `@${userProfile.name.toLowerCase().replace(/\s+/g, "")}`,
      location: area,
      title: "Community update",
      caption: text,
      accent: "linear-gradient(135deg, #facc15 0%, #fb7185 35%, #60a5fa 100%)",
      tag: "#LocalVoices",
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    };

    setFeedPosts((current) => [newPost, ...current]);
    setPostDraft("");
  }

  function likePost(postId: string) {
    setFeedPosts((current) => current.map((post) =>
      post.id === postId && !post.likedBy?.includes(userProfile.phone)
        ? { ...post, likes: post.likes + 1, likedBy: [...(post.likedBy ?? []), userProfile.phone] }
        : post,
    ));
  }

  function whatsappShareUrl(post: FeedPost) {
    const shareText = `${post.author} · ${post.location}\n\n${post.caption}\n\nShared from Hosur Services`;
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }

  if (view === "admin") {
    return <main className="app-shell">
      <header className="topbar"><button className="brand" onClick={openCustomerView}>{text.brand}</button><button className="text-button" onClick={openCustomerView}>← Customer view</button></header>
      <section className="admin-page">
        <p className="eyebrow">FOUNDER DESK</p><h1>Start with verified providers.</h1>
        <p className="intro">Only approved providers appear in the customer portal. Add the verified details here and they will instantly become available for booking.</p>
        <div className="stat-grid"><article><strong>{liveProviders.length}</strong><span>Live providers</span></article><article><strong>{askedFor.length}</strong><span>Bookings requested</span></article><article><strong>{services.length}</strong><span>Active services</span></article></div>

        <section className="admin-card"><h2>Add a service</h2><form onSubmit={addService} className="add-service"><label>Service name<input required name="name" placeholder="e.g. Curtain fitting" /></label><label>Category<select required name="category"><option value="">Choose category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary">Add service</button></form></section>

        <section className="admin-card"><h2>Add local news alert</h2><form onSubmit={addNewsItem} className="news-form"><label>Badge<input required name="newsBadge" placeholder="Water alert" /></label><label>Area<input required name="newsArea" placeholder="Attibele" /></label><label>Title<input required name="newsTitle" placeholder="Pipeline maintenance in Attibele" /></label><label>Summary<textarea required name="newsSummary" placeholder="Describe the local issue or update" /></label><button className="primary">Add city alert</button></form></section>

        <section className="admin-card"><h2>Add a verified provider</h2><form onSubmit={addProvider} className="add-service"><label>Service<select required name="providerService"><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>Provider name<input required name="providerName" placeholder="e.g. Karthik Plumbing" /></label><label>Phone number<input required name="providerPhone" placeholder="9876543210" inputMode="tel" /></label><label>Experience<input required name="providerExperience" placeholder="8 years" /></label><label>Provider area<select required name="providerArea" defaultValue=""><option value="">Choose area</option>{areas.map((item) => <option key={item}>{item}</option>)}</select></label><label>Rating<select required name="providerRating" defaultValue={5}><option value={5}>5.0</option><option value={4.9}>4.9</option><option value={4.8}>4.8</option><option value={4.7}>4.7</option><option value={4.6}>4.6</option></select></label><button className="primary">Save verified provider</button></form>{providerError && <p role="alert">{providerError}</p>}</section>

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
                    <div>
                      <strong>{provider.name}</strong><small>{provider.experience}</small>
                      <label className="provider-area">Area
                        <select aria-label={`Area for ${provider.name}`} value={provider.area ?? ""} onChange={(event) => updateProviderArea(provider.id, event.target.value)}>
                          <option value="">Area not set</option>
                          {areas.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </label>
                    </div>
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
        <button className="brand" onClick={() => openCustomerTab("home")}>{text.brand}</button>
        <div className="header-actions">
          <nav className="header-tabs" aria-label="Customer navigation">
            <button className={customerTab === "home" ? "tab-button active" : "tab-button"} aria-current={customerTab === "home" ? "page" : undefined} onClick={() => openCustomerTab("home")}>Home</button>
            <button className={customerTab === "feed" ? "tab-button active" : "tab-button"} aria-current={customerTab === "feed" ? "page" : undefined} onClick={() => openCustomerTab("feed")}>Feed</button>
          </nav>
          <button className="language" onClick={() => setLanguage(language === "en" ? "ta" : "en")}>{language === "en" ? "தமிழ்" : "English"}</button>
        </div>
      </header>

      {!selectedService ? (
        customerTab === "feed" ? (
          <section className="instagram-page">
            <div className="instagram-shell">
              <div className="instagram-header">
                <div>
                  <p className="eyebrow">LOCAL SOCIAL FEED</p>
                  <h1>Hosur Community Feed</h1>
                </div>
                <button className="primary" type="button">Share your view</button>
              </div>

              <form className="composer-card" onSubmit={createFeedPost}>
                <div className="composer-header-row">
                  <div className="composer-avatar">{userProfile.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
                  <div>
                    <strong>{userProfile.name}</strong>
                    <small>{userProfile.address}</small>
                  </div>
                </div>
                <textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} placeholder="What’s happening in your area today? Share your thoughts, complaint, win, or local update..." required />
                <div className="composer-actions">
                  <button className="secondary" type="button">Add photo</button>
                  <button className="primary" type="submit">Post</button>
                </div>
              </form>

              <div className="stories-row">
                {feedPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="story-item" style={{ background: post.accent }}>
                    <span>{post.author}</span>
                  </div>
                ))}
              </div>

              <div className="instagram-feed">
                {feedPosts.map((post) => (
                  <article className="insta-card" key={post.id}>
                    <div className="insta-head">
                      <div>
                        <strong>{post.author}</strong>
                        <small>{post.handle} · {post.location}</small>
                      </div>
                      <span>•••</span>
                    </div>

                    <div className="insta-visual" style={{ background: post.accent }}>
                      <span className="insta-tag">{post.tag}</span>
                    </div>

                    <div className="insta-body">
                      <div className="insta-actions">
                        <button
                          type="button"
                          className="feed-action"
                          disabled={post.likedBy?.includes(userProfile.phone) ?? false}
                          aria-label={`${post.likedBy?.includes(userProfile.phone) ? "Liked" : "Like"} post by ${post.author}, ${post.likes} likes`}
                          onClick={() => likePost(post.id)}
                        >♥ {formatCount(post.likes)}{post.likedBy?.includes(userProfile.phone) ? " · Liked" : ""}</button>
                        <a className="feed-action" href={whatsappShareUrl(post)} target="_blank" rel="noopener noreferrer" aria-label={`Share post by ${post.author} on WhatsApp`}>↗ Share to WhatsApp</a>
                      </div>
                      <p><strong>{post.author}</strong> {post.caption}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-card">
                <div className="hero-content">
                  <p className="eyebrow">HOSUR • LOCAL • DIRECT</p>
                  <h1>{text.subtitle}</h1>
                  <p>From quick fixes to new skills, find your local expert right here in Hosur.</p>
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
        )
      ) : (
        <section className="booking-page">
          <button className="back" onClick={() => { setSelectedService(null); setSelectedProvider(null); setBookingSent(false); }}>← All services</button>
          <label className="area-picker" style={{ marginBottom: 18 }}>
            {text.area}
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              {areas.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <p className="eyebrow">{selectedService.category.toUpperCase()} · {area.toUpperCase()}</p>
          <h1>{language === "en" ? selectedService.name : selectedService.tamil}</h1>
          <p className="intro">{selectedIsRental ? "Contact a rental provider to confirm equipment, dates, availability, rental charges, deposit and pickup or delivery arrangements." : selectedIsTutor ? "Contact an approved tutor or coach to discuss age groups, lesson location, timings and fees before booking." : "Providers choose their own visit charge, job prices, and hourly rates. Phone numbers are shared only after a provider accepts your request."}</p>
          {!selectedProvider && providersForSelectedService.length > 0 && (
            <p className="fine-print">{language === "ta" ? `${area} பகுதியில் உள்ளவர்கள் முதலில் காட்டப்படுவார்கள்; மற்ற பகுதிகளில் உள்ளவர்களும் கீழே உள்ளனர்.` : `Providers based in ${area} appear first. Providers from other areas are also listed below.`}</p>
          )}

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
                      <div className="provider-meta"><span>{provider.area || (language === "ta" ? "பகுதி குறிப்பிடப்படவில்லை" : "Area not set")}</span><span>Verified local</span></div>
                      <button className="primary" type="button" onClick={() => handleBookProvider(provider)}>Book {provider.name}</button>
                    </article>
                  )) : (
                    <section className="no-providers">
                      <span>!</span>
                      <div>
                        <h2>{selectedIsTutor ? `No approved tutors or coaches are listed for ${selectedService.name} yet.` : `No verified providers are live in ${area} yet.`}</h2>
                        <p>{selectedIsTutor ? "Please check back after an approved tutor or coach has been added." : "Your request will be recorded for the founder to match when an approved provider is available."}</p>
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
                    <label className="upload-field"><span>{selectedIsRental ? "Rental details (optional attachment)" : selectedIsTutor ? "Learning goals (optional attachment)" : "Describe the problem"}</span><input type="file" name="mediaFile" accept="audio/*,video/*,.txt,.doc,.docx" /></label>
                    <label>{requirementsLabel}<textarea name="details" placeholder={selectedIsRental ? "Equipment or model, quantity, rental dates and pickup or delivery preference" : selectedIsTutor ? "Learner's age, experience level, preferred timings and learning goals" : "Describe the issue in text, or attach audio/video above"} /></label>
                    <button className="primary" type="submit">Send WhatsApp request</button>
                    <button className="secondary back-button" type="button" onClick={() => setSelectedProvider(null)}>{selectedIsRental ? "Choose another rental provider" : selectedIsTutor ? "Choose another tutor or coach" : "Choose another technician"}</button>
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
                      <label>Review<textarea value={reviewDraft.comment} onChange={(event) => setReviewDraft((current) => ({ ...current, comment: event.target.value }))} placeholder={selectedIsRental ? "Share your experience with this rental provider" : selectedIsTutor ? "Share your experience with this tutor or coach" : "Share your experience with this technician"} required /></label>
                      <button className="secondary" type="submit">Submit review</button>
                    </form>
                  </aside>
                </div>
              )}
            </>
          ) : (
            <section className="confirmation">
              <div className="check">✓</div>
              <p className="eyebrow">{selectedIsTutor || selectedIsRental ? "CONTINUE IN WHATSAPP" : "WHATSAPP REQUEST SENT"}</p>
              <h2>{selectedIsTutor || selectedIsRental ? `Complete your request to ${selectedProvider?.name} in WhatsApp.` : `Your request is shared with ${selectedProvider?.name}.`}</h2>
              <p>{selectedIsTutor || selectedIsRental ? "Send the prepared message in WhatsApp to discuss your requirements. If you selected a file, attach it there before sending." : "The technician was notified on WhatsApp with your job details. If they do not respond, you can return and pick another provider."}</p>
              <button className="secondary" onClick={() => { setSelectedProvider(null); setBookingSent(false); }}>Choose another provider</button>
            </section>
          )}
        </section>
      )}

      <footer>Hosur Services is a local connection service. Providers set their own prices. Customers pay providers directly.</footer>
    </main>
  );
}
