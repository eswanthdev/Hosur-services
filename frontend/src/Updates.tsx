import { FormEvent, useEffect, useState } from "react";
import { hosurApi, type ChargingStation, type LocalUpdates, type PowerShutdown } from "./api/hosur";
import { CivicUpdates } from "./CivicUpdates";
import { formatUpdateTime, inputTime, UpdateVerification, VerificationFields } from "./UpdateDetails";
import "./updates.css";

type Props = { admin?: boolean; areas: string[]; language: "en" | "ta" };

export function Updates({ admin = false, areas, language }: Props) {
  const [data, setData] = useState<LocalUpdates | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [shutdown, setShutdown] = useState<PowerShutdown | null>(null);
  const [station, setStation] = useState<ChargingStation | null>(null);
  const t = (en: string, ta: string) => language === "ta" ? ta : en;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    hosurApi.getUpdates().then((result) => {
      if (!cancelled) setData(result);
    }, () => {
      if (!cancelled) setError(language === "ta" ? "அறிவிப்புகளை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்." : "Could not load updates. Please retry; notices and directory information are unavailable.");
    });
    return () => { cancelled = true; };
  }, [reload, language]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function persist(action: () => Promise<void>) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(t("Saved to the server.", "சேமிக்கப்பட்டது."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not save. Please retry.", "சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்."));
    } finally {
      setSaving(false);
    }
  }

  function saveShutdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const startsAt = `${values.get("startsAt")}:00+05:30`;
    const endsAt = `${values.get("endsAt")}:00+05:30`;
    const selectedAreas = values.getAll("areas").map(String);
    if (!selectedAreas.length || new Date(endsAt) <= new Date(startsAt)) {
      setError("Select at least one affected area and an end time after the start time.");
      return;
    }
    const item: PowerShutdown = {
      id: shutdown?.id ?? crypto.randomUUID(), title: String(values.get("title")).trim(),
      areas: selectedAreas, startsAt, endsAt, reason: String(values.get("reason")).trim(),
      sourceUrl: String(values.get("sourceUrl")).trim(), verifiedAt: String(values.get("verifiedAt")),
    };
    void persist(async () => {
      const saved = await hosurApi.saveShutdown(item, shutdown !== null);
      setData((previous) => previous && { ...previous, shutdowns: [...previous.shutdowns.filter((entry) => entry.id !== saved.id), saved] });
      setShutdown(null);
      form.reset();
    });
  }

  function saveStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const item: ChargingStation = {
      id: station?.id ?? crypto.randomUUID(), name: String(values.get("name")).trim(),
      area: String(values.get("area")), address: String(values.get("address")).trim(),
      connectors: String(values.get("connectors")).trim(), hours: String(values.get("hours")).trim(),
      sourceUrl: String(values.get("sourceUrl")).trim(), verifiedAt: String(values.get("verifiedAt")),
    };
    void persist(async () => {
      const saved = await hosurApi.saveChargingStation(item, station !== null);
      setData((previous) => previous && { ...previous, chargingStations: [...previous.chargingStations.filter((entry) => entry.id !== saved.id), saved] });
      setStation(null);
      form.reset();
    });
  }

  const shutdowns = (data?.shutdowns ?? []).filter((item) => admin || new Date(item.endsAt).getTime() > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const stations = [...(data?.chargingStations ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name));

  return <section className={admin ? "updates-admin" : "updates-page"}>
    <div className="updates-intro">
      <p className="eyebrow">{t("KNOW YOUR NEIGHBOURHOOD", "உங்கள் பகுதியின் தகவல்கள்")}</p>
      <h1>{admin ? "Manage local updates" : t("Hosur Updates", "ஹோசூர் அறிவிப்புகள்")}</h1>
      <p>{t("Power, water, traffic and waste notices, and EV charging stations, checked and published by the admin.", "மின்தடை, குடிநீர், போக்குவரத்து, குப்பை சேகரிப்பு அறிவிப்புகள் மற்றும் மின்வாகன சார்ஜிங் நிலையங்கள். நிர்வாகியால் சரிபார்க்கப்பட்ட தகவல்கள்.")}</p>
      {!admin && <p>{t("Updates from across Hosur. Locations and affected routes are shown on each listing.", "ஹோசூரின் அனைத்துப் பகுதிகளின் அறிவிப்புகள். இடங்கள் மற்றும் பாதிக்கப்பட்ட வழித்தடங்கள் ஒவ்வொரு பதிவிலும் காட்டப்படும்.")}</p>}
      <p className="updates-disclaimer">{t("Not a live status feed. Schedules can change; check the source before relying on a listing. All notice times are in IST.", "இது நேரடி தகவல் அல்ல. நேரங்கள் மாறலாம்; ஆதாரத்தைச் சரிபார்க்கவும். நேரங்கள் இந்திய நேரப்படி.")}</p>
    </div>
    {error && <p className="sync-warning" role="alert">{error} {!data && <button type="button" className="secondary" onClick={() => setReload((value) => value + 1)}>{t("Retry", "மீண்டும் முயற்சி")}</button>}</p>}
    {message && <p role="status">{message}</p>}
    {!data && !error && <p aria-live="polite">{t("Loading verified updates...", "அறிவிப்புகள் ஏற்றப்படுகின்றன...")}</p>}
    {data && <>
      {admin && <div className="updates-editors">
        <section className="admin-card">
          <h2>{shutdown ? "Edit power shutdown" : "Add power shutdown"}</h2>
          <form key={shutdown?.id ?? "new-shutdown"} onSubmit={saveShutdown} className="update-form" aria-label="Power shutdown form">
            <fieldset disabled={saving}>
              <label>Notice title<input name="title" required defaultValue={shutdown?.title} /></label>
              <fieldset className="update-areas"><legend>Affected areas (choose at least one)</legend>{areas.map((name) => <label key={name}><input type="checkbox" name="areas" value={name} defaultChecked={shutdown?.areas.includes(name)} />{name}</label>)}</fieldset>
              <label>Starts at (IST)<input type="datetime-local" name="startsAt" required defaultValue={shutdown ? inputTime(shutdown.startsAt) : ""} /></label>
              <label>Ends at (IST)<input type="datetime-local" name="endsAt" required defaultValue={shutdown ? inputTime(shutdown.endsAt) : ""} /></label>
              <label>Reason / affected streets<textarea name="reason" required defaultValue={shutdown?.reason} /></label>
              <VerificationFields item={shutdown} now={now} />
              <div className="update-actions"><button className="primary">Save shutdown</button>{shutdown && <button type="button" className="secondary" onClick={() => setShutdown(null)}>Cancel shutdown edit</button>}</div>
            </fieldset>
          </form>
        </section>
        <section className="admin-card">
          <h2>{station ? "Edit EV charging station" : "Add EV charging station"}</h2>
          <form key={station?.id ?? "new-station"} onSubmit={saveStation} className="update-form" aria-label="Charging station form">
            <fieldset disabled={saving}>
              <label>Station name<input name="name" required defaultValue={station?.name} /></label>
              <label>Station area<select name="area" required defaultValue={station?.area ?? ""}><option value="">Choose area</option>{areas.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>Full address<textarea name="address" required defaultValue={station?.address} /></label>
              <label>Connectors / charging power<input name="connectors" required placeholder="List verified connectors and kW, or Not confirmed" defaultValue={station?.connectors} /></label>
              <label>Opening hours<input name="hours" required placeholder="Verified hours, or Contact operator" defaultValue={station?.hours} /></label>
              <VerificationFields item={station} now={now} />
              <div className="update-actions"><button className="primary">Save charging station</button>{station && <button type="button" className="secondary" onClick={() => setStation(null)}>Cancel station edit</button>}</div>
            </fieldset>
          </form>
        </section>
      </div>}
      <div className="updates-columns">
        <section aria-label={t("Power shutdowns", "மின்தடைகள்")}>
          <h2>{t("Power shutdowns", "மின்தடைகள்")} <span className="update-count">{shutdowns.length}</span></h2>
          <p>{t("Notices from all areas. See each notice for affected locations.", "அனைத்துப் பகுதிகளின் அறிவிப்புகள். பாதிக்கப்படும் இடங்களை ஒவ்வொரு அறிவிப்பிலும் காணவும்.")}</p>
          {!shutdowns.length && <p className="update-empty">{t("No upcoming verified shutdown notices published. This does not guarantee uninterrupted power.", "வரவிருக்கும் சரிபார்க்கப்பட்ட மின்தடை அறிவிப்புகள் இல்லை. இது தடையில்லா மின்சாரத்திற்கான உத்தரவாதம் அல்ல.")}</p>}
          {shutdowns.map((item) => <article className="update-card" key={item.id}>
            <span className="update-badge">{Date.parse(item.endsAt) <= now ? t("Past notice", "கடந்த அறிவிப்பு") : Date.parse(item.startsAt) <= now ? t("Scheduled window in progress", "திட்டமிட்ட நேரம் நடைபெறுகிறது") : t("Upcoming scheduled shutdown", "வரவிருக்கும் திட்டமிட்ட மின்தடை")}</span>
            <h3>{item.title}</h3><p>{item.areas.join(", ")}</p>
            <p className="update-time"><time dateTime={item.startsAt}>{formatUpdateTime(item.startsAt, language)}</time><br />{t("to", "முதல்")} <time dateTime={item.endsAt}>{formatUpdateTime(item.endsAt, language)}</time> (IST)</p>
            <p>{item.reason}</p><UpdateVerification item={item} language={language} />
            {admin && <div className="update-actions">
              <button className="secondary" disabled={saving} onClick={() => { setShutdown(item); setMessage(""); }}>Edit {item.title}</button>
              <button className="danger-button" disabled={saving} onClick={() => {
                if (window.confirm(`Remove shutdown "${item.title}"?`)) void persist(async () => {
                  await hosurApi.removeShutdown(item.id);
                  setData((previous) => previous && { ...previous, shutdowns: previous.shutdowns.filter((entry) => entry.id !== item.id) });
                  if (shutdown?.id === item.id) setShutdown(null);
                });
              }}>Remove {item.title}</button>
            </div>}
          </article>)}
        </section>
        <section aria-label={t("EV charging stations", "மின்வாகன சார்ஜிங் நிலையங்கள்")}>
          <h2>{t("EV charging stations", "மின்வாகன சார்ஜிங் நிலையங்கள்")} <span className="update-count">{stations.length}</span></h2>
          <p>{t("Confirm connector compatibility, pricing and availability with the operator before travelling.", "பயணிக்கும் முன் இணைப்பான் பொருத்தம், கட்டணம் மற்றும் கிடைக்கும் தன்மையை நிலைய நிர்வாகியிடம் உறுதிப்படுத்தவும்.")}</p>
          {!stations.length && <p className="update-empty">{t("No verified charging stations listed yet.", "சரிபார்க்கப்பட்ட சார்ஜிங் நிலையங்கள் இன்னும் பட்டியலிடப்படவில்லை.")}</p>}
          {stations.map((item) => <article className="update-card" key={item.id}>
            <span className="update-badge charging-badge">{item.area}</span><h3>{item.name}</h3><p>{item.address}</p>
            <dl><dt>{t("Connectors / power", "இணைப்பான்கள் / திறன்")}</dt><dd>{item.connectors}</dd><dt>{t("Opening hours", "திறந்திருக்கும் நேரம்")}</dt><dd>{item.hours}</dd></dl>
            <UpdateVerification item={item} language={language} />
            <a className="update-directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${item.address}, ${item.area}, Hosur`)}`} target="_blank" rel="noopener noreferrer">{t("Find on map", "வரைபடத்தில் காண்க")}</a>
            {admin && <div className="update-actions">
              <button className="secondary" disabled={saving} onClick={() => { setStation(item); setMessage(""); }}>Edit {item.name}</button>
              <button className="danger-button" disabled={saving} onClick={() => {
                if (window.confirm(`Remove charging station "${item.name}"?`)) void persist(async () => {
                  await hosurApi.removeChargingStation(item.id);
                  setData((previous) => previous && { ...previous, chargingStations: previous.chargingStations.filter((entry) => entry.id !== item.id) });
                  if (station?.id === item.id) setStation(null);
                });
              }}>Remove {item.name}</button>
            </div>}
          </article>)}
        </section>
      </div>
      <CivicUpdates admin={admin} areas={areas} language={language} now={now}
        alerts={data.civicAlerts} saving={saving} persist={persist} onError={setError}
        onAlertSaved={(saved) => setData((previous) => previous && { ...previous, civicAlerts: [...previous.civicAlerts.filter((item) => item.id !== saved.id), saved] })}
        onAlertRemoved={(id) => setData((previous) => previous && { ...previous, civicAlerts: previous.civicAlerts.filter((item) => item.id !== id) })}
      />
    </>}
  </section>;
}
