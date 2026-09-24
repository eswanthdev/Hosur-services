import { FormEvent, useState } from "react";
import { hosurApi, type CivicAlert, type CivicCategory } from "./api/hosur";
import { formatUpdateTime, inputTime, UpdateVerification, VerificationFields } from "./UpdateDetails";

type Props = {
  admin: boolean; areas: string[]; language: "en" | "ta"; now: number;
  alerts: CivicAlert[]; saving: boolean;
  persist: (action: () => Promise<void>) => Promise<void>;
  onError: (message: string) => void;
  onAlertSaved: (item: CivicAlert) => void; onAlertRemoved: (id: string) => void;
};

const categories: { id: CivicCategory; en: string; ta: string }[] = [
  { id: "water", en: "Water supply", ta: "குடிநீர் விநியோகம்" },
  { id: "traffic", en: "Traffic & roadworks", ta: "போக்குவரத்து மற்றும் சாலைப் பணிகள்" },
  { id: "waste", en: "Waste collection", ta: "குப்பை சேகரிப்பு" },
];

export function CivicUpdates({ admin, areas, language, now, alerts, saving, persist, onError, onAlertSaved, onAlertRemoved }: Props) {
  const [editingAlert, setEditingAlert] = useState<CivicAlert | null>(null);
  const [category, setCategory] = useState<CivicCategory>("water");
  const t = (en: string, ta: string) => language === "ta" ? ta : en;
  const visibleAlerts = alerts.filter((item) => admin || Date.parse(item.expiresAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

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

  return <div className="civic-updates">
    <h2>{t("Everyday updates", "அன்றாட அறிவிப்புகள்")}</h2>
    <p>{t("Water supply timings and interruptions, road diversions, and waste collection schedules. Expired notices are hidden from the customer view.", "குடிநீர் விநியோக நேரங்கள் மற்றும் தடைகள், சாலை மாற்றங்கள், குப்பை சேகரிப்பு அட்டவணைகள். காலாவதியான அறிவிப்புகள் வாடிக்கையாளர் பக்கத்தில் காட்டப்படாது.")}</p>
    {admin && <section className="admin-card">
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
    </section>}
    <div className="civic-notice-grid">
      {categories.map((section) => {
        const items = visibleAlerts.filter((item) => item.category === section.id);
        return <section key={section.id} aria-label={t(section.en, section.ta)}>
          <h3>{t(section.en, section.ta)} <span className="update-count">{items.length}</span></h3>
          <p>{t("Notices from across Hosur.", "ஹோசூரின் அனைத்துப் பகுதிகளின் அறிவிப்புகள்.")}</p>
          {!items.length && <p className="update-empty">{t("No current or upcoming verified notices published. This is not confirmation of normal service.", "தற்போதைய அல்லது வரவிருக்கும் சரிபார்க்கப்பட்ட அறிவிப்புகள் இல்லை. இது வழக்கமான சேவைக்கான உறுதிப்படுத்தல் அல்ல.")}</p>}
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
  </div>;
}
