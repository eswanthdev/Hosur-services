import { FormEvent, useState } from "react";
import { hosurApi, type CivicAlert, type CivicCategory, type EmergencyContact } from "./api/hosur";
import { formatUpdateTime, inputTime, UpdateVerification, VerificationFields } from "./UpdateDetails";

type Props = {
  admin: boolean; areas: string[]; area: string; language: "en" | "ta"; now: number;
  alerts: CivicAlert[]; contacts: EmergencyContact[]; saving: boolean;
  persist: (action: () => Promise<void>) => Promise<void>;
  onError: (message: string) => void;
  onAlertSaved: (item: CivicAlert) => void; onAlertRemoved: (id: string) => void;
  onContactSaved: (item: EmergencyContact) => void; onContactRemoved: (id: string) => void;
};

const categories: { id: CivicCategory; en: string; ta: string }[] = [
  { id: "water", en: "Water supply", ta: "குடிநீர் விநியோகம்" },
  { id: "traffic", en: "Traffic & roadworks", ta: "போக்குவரத்து மற்றும் சாலைப் பணிகள்" },
  { id: "waste", en: "Waste collection", ta: "குப்பை சேகரிப்பு" },
];

export function CivicUpdates({ admin, areas, area, language, now, alerts, contacts, saving, persist, onError, onAlertSaved, onAlertRemoved, onContactSaved, onContactRemoved }: Props) {
  const [editingAlert, setEditingAlert] = useState<CivicAlert | null>(null);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [category, setCategory] = useState<CivicCategory>("water");
  const [route, setRoute] = useState("");
  const t = (en: string, ta: string) => language === "ta" ? ta : en;
  const visibleAlerts = alerts.filter((item) => admin || Date.parse(item.expiresAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const routes = [...new Set(visibleAlerts.filter((item) => item.category === "traffic").map((item) => item.route))].sort();
  const selectedRoute = routes.includes(route) ? route : "";

  function saveAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const startsAt = `${values.get("startsAt")}:00+05:30`;
    const expiresAt = `${values.get("expiresAt")}:00+05:30`;
    const selectedAreas = category === "traffic" ? [] : values.getAll("areas").map(String);
    const routeName = category === "traffic" ? String(values.get("route") ?? "").trim() : "";
    if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(startsAt)) {
      onError("Choose an expiry time after the notice start time.");
      return;
    }
    if (category === "traffic" ? !routeName : !selectedAreas.length) {
      onError(category === "traffic" ? "Enter the affected road or route." : "Select at least one affected area.");
      return;
    }
    const item: CivicAlert = {
      id: editingAlert?.id ?? crypto.randomUUID(), category, title: String(values.get("title")).trim(),
      areas: selectedAreas, route: routeName, startsAt, expiresAt,
      message: String(values.get("message")).trim(), sourceUrl: String(values.get("sourceUrl")).trim(),
      verifiedAt: String(values.get("verifiedAt")),
    };
    void persist(async () => {
      const saved = await hosurApi.saveCivicAlert(item, editingAlert !== null);
      onAlertSaved(saved);
      setEditingAlert(null);
      setCategory("water");
      form.reset();
    });
  }

  function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const phone = String(values.get("phone")).trim();
    if (!/^\+?[\d ()-]+$/.test(phone) || !/^\d{3,15}$/.test(phone.replace(/\D/g, ""))) {
      onError("Enter a valid phone number or short helpline (3 to 15 digits).");
      return;
    }
    const item: EmergencyContact = {
      id: editingContact?.id ?? crypto.randomUUID(), name: String(values.get("name")).trim(),
      service: String(values.get("service")).trim(), phone, details: String(values.get("details")).trim(),
      sourceUrl: String(values.get("sourceUrl")).trim(), verifiedAt: String(values.get("verifiedAt")),
    };
    void persist(async () => {
      const saved = await hosurApi.saveEmergencyContact(item, editingContact !== null);
      onContactSaved(saved);
      setEditingContact(null);
      form.reset();
    });
  }

  return <div className="civic-updates">
    <h2>{t("Everyday updates", "அன்றாட அறிவிப்புகள்")}</h2>
    <p>{t("Water supply timings and interruptions, road diversions, and waste collection schedules. Expired notices are hidden from the customer view.", "குடிநீர் விநியோக நேரங்கள் மற்றும் தடைகள், சாலை மாற்றங்கள், குப்பை சேகரிப்பு அட்டவணைகள். காலாவதியான அறிவிப்புகள் வாடிக்கையாளர் பக்கத்தில் காட்டப்படாது.")}</p>
    {admin && <div className="updates-editors">
      <section className="admin-card">
        <h3>{editingAlert ? "Edit community notice" : "Add community notice"}</h3>
        <form key={editingAlert?.id ?? "new-alert"} className="update-form" aria-label="Community notice form" onSubmit={saveAlert}>
          <fieldset disabled={saving}>
            <label>Notice category<select name="category" value={category} onChange={(event) => {
              const selected = categories.find((item) => item.id === event.target.value);
              if (selected) setCategory(selected.id);
            }}>{categories.map((item) => <option key={item.id} value={item.id}>{item.en}</option>)}</select></label>
            <label>Notice title<input name="title" required defaultValue={editingAlert?.title} /></label>
            {category === "traffic"
              ? <label>Affected road / route<input name="route" required placeholder="Enter the verified road or route name" defaultValue={editingAlert?.route} /></label>
              : <fieldset className="update-areas"><legend>Affected areas (choose at least one)</legend>{areas.map((name) => <label key={name}><input type="checkbox" name="areas" value={name} defaultChecked={editingAlert?.areas.includes(name)} />{name}</label>)}</fieldset>}
            <label>Starts at (IST)<input name="startsAt" type="datetime-local" required defaultValue={editingAlert ? inputTime(editingAlert.startsAt) : ""} /></label>
            <label>Expires at (IST)<input name="expiresAt" type="datetime-local" required defaultValue={editingAlert ? inputTime(editingAlert.expiresAt) : ""} /></label>
            <label>Notice details<textarea name="message" required placeholder="Include timings, affected streets, alternate routes or collection instructions." defaultValue={editingAlert?.message} /></label>
            <VerificationFields item={editingAlert} now={now} />
            <div className="update-actions"><button className="primary">Save community notice</button>{editingAlert && <button className="secondary" type="button" onClick={() => { setEditingAlert(null); setCategory("water"); }}>Cancel notice edit</button>}</div>
          </fieldset>
        </form>
      </section>
      <section className="admin-card">
        <h3>{editingContact ? "Edit emergency contact" : "Add emergency contact"}</h3>
        <form key={editingContact?.id ?? "new-contact"} className="update-form" aria-label="Emergency contact form" onSubmit={saveContact}>
          <fieldset disabled={saving}>
            <label>Contact name<input name="name" required defaultValue={editingContact?.name} /></label>
            <label>Emergency service<input name="service" required placeholder="e.g. Ambulance, fire, police or municipal helpline" defaultValue={editingContact?.service} /></label>
            <label>Phone / helpline<input name="phone" type="tel" required defaultValue={editingContact?.phone} /></label>
            <label>Contact details<textarea name="details" required placeholder="Verified coverage, opening hours and calling instructions." defaultValue={editingContact?.details} /></label>
            <VerificationFields item={editingContact} now={now} />
            <div className="update-actions"><button className="primary">Save emergency contact</button>{editingContact && <button className="secondary" type="button" onClick={() => setEditingContact(null)}>Cancel contact edit</button>}</div>
          </fieldset>
        </form>
      </section>
    </div>}
    <div className="civic-notice-grid">
      {categories.map((section) => {
        const items = visibleAlerts.filter((item) => item.category === section.id && (admin || (section.id === "traffic" ? !selectedRoute || item.route === selectedRoute : item.areas.includes(area))));
        return <section key={section.id} aria-label={t(section.en, section.ta)}>
          <h3>{t(section.en, section.ta)} <span className="update-count">{items.length}</span></h3>
          <p>{section.id === "traffic" ? t("Road and route notices across Hosur.", "ஹோசூரின் சாலை மற்றும் வழித்தட அறிவிப்புகள்.") : `${t("Selected area", "தேர்ந்தெடுத்த பகுதி")}: ${admin ? t("All areas", "அனைத்துப் பகுதிகள்") : area}`}</p>
          {!admin && section.id === "traffic" && <label className="area-picker">{t("Traffic route", "போக்குவரத்து வழித்தடம்")}
            <select value={selectedRoute} onChange={(event) => setRoute(event.target.value)}>
              <option value="">{t("All routes", "அனைத்து வழித்தடங்கள்")}</option>{routes.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>}
          {!items.length && <p className="update-empty">{t("No current or upcoming verified notices published for this selection. This is not confirmation of normal service.", "இந்த தேர்விற்கு தற்போதைய அல்லது வரவிருக்கும் சரிபார்க்கப்பட்ட அறிவிப்புகள் இல்லை. இது வழக்கமான சேவைக்கான உறுதிப்படுத்தல் அல்ல.")}</p>}
          {items.map((item) => <article className={`update-card civic-${section.id}`} key={item.id}>
            <span className="update-badge">{Date.parse(item.expiresAt) <= now ? t("Expired notice", "காலாவதியான அறிவிப்பு") : Date.parse(item.startsAt) > now ? t("Upcoming notice", "வரவிருக்கும் அறிவிப்பு") : t("Within published notice period", "வெளியிடப்பட்ட அறிவிப்பு காலத்தில்")}</span>
            <h4>{item.title}</h4>
            <p>{section.id === "traffic" ? item.route : item.areas.join(", ")}</p>
            <p className="update-time"><time dateTime={item.startsAt}>{formatUpdateTime(item.startsAt, language)}</time><br />
              {t("Until", "வரை")} <time dateTime={item.expiresAt}>{formatUpdateTime(item.expiresAt, language)}</time> (IST)</p>
            <p className="update-message">{item.message}</p><UpdateVerification item={item} language={language} />
            {admin && <div className="update-actions">
              <button className="secondary" disabled={saving} onClick={() => { setEditingAlert(item); setCategory(item.category); }}>Edit {item.title}</button>
              <button className="danger-button" disabled={saving} onClick={() => {
                if (window.confirm(`Remove notice "${item.title}"?`)) void persist(async () => {
                  await hosurApi.removeCivicAlert(item.id);
                  onAlertRemoved(item.id);
                  if (editingAlert?.id === item.id) { setEditingAlert(null); setCategory("water"); }
                });
              }}>Remove {item.title}</button>
            </div>}
          </article>)}
        </section>;
      })}
    </div>
    <section className="emergency-directory" aria-label={t("Emergency contacts", "அவசர தொடர்புகள்")}>
      <p className="eyebrow">{t("USEFUL DIRECTORY", "பயனுள்ள தொடர்புப் பட்டியல்")}</p>
      <h2>{t("Emergency contacts", "அவசர தொடர்புகள்")} <span className="update-count">{contacts.length}</span></h2>
      <p>{t("General contacts for Hosur, not filtered by area. Check coverage and operating hours. Calling opens your phone app; this website does not dispatch emergency services.", "பகுதி தேர்வால் மாறாத ஹோசூரின் பொதுவான தொடர்புகள். சேவைப் பகுதி மற்றும் நேரங்களைச் சரிபார்க்கவும். அழைப்பது உங்கள் தொலைபேசி செயலியைத் திறக்கும்; இந்த இணையதளம் அவசர சேவைகளை அனுப்பாது.")}</p>
      {!contacts.length && <p className="update-empty">{t("No verified emergency contacts published yet. Do not wait for this directory in an emergency; use official emergency channels you know.", "சரிபார்க்கப்பட்ட அவசர தொடர்புகள் இன்னும் வெளியிடப்படவில்லை. அவசரத்தில் இந்தப் பட்டியலுக்காக காத்திருக்க வேண்டாம்; உங்களுக்குத் தெரிந்த அதிகாரப்பூர்வ அவசர சேவைகளைத் தொடர்புகொள்ளவும்.")}</p>}
      <div className="updates-columns">
        {[...contacts].sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name)).map((item) => <article className="update-card" key={item.id}>
          <span className="update-badge contact-badge">{item.service}</span><h3>{item.name}</h3>
          <p className="update-message">{item.details}</p>
          <a className="update-call" href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}>{t("Call", "அழைக்கவும்")} {item.phone}</a>
          <UpdateVerification item={item} language={language} />
          {admin && <div className="update-actions">
            <button className="secondary" disabled={saving} onClick={() => setEditingContact(item)}>Edit {item.name}</button>
            <button className="danger-button" disabled={saving} onClick={() => {
              if (window.confirm(`Remove emergency contact "${item.name}"?`)) void persist(async () => {
                await hosurApi.removeEmergencyContact(item.id);
                onContactRemoved(item.id);
                if (editingContact?.id === item.id) setEditingContact(null);
              });
            }}>Remove {item.name}</button>
          </div>}
        </article>)}
      </div>
    </section>
  </div>;
}
