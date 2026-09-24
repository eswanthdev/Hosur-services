import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, hosurApi, type ApplicationReceipt, type RegistrationLanguage, type Service } from "./api/hosur";
import { registrationLanguages, registrationText } from "./registrationText";
import { registrationServiceLabels } from "./registrationServices";
import "./registration.css";

function initialLanguage(): RegistrationLanguage {
  const value = new URLSearchParams(window.location.hash.split("?")[1]).get("lang");
  return registrationLanguages.find((item) => item.id === value)?.id ?? "ta";
}

export function ProviderRegistration() {
  const [language, setLanguage] = useState(initialLanguage);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [experience, setExperience] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<"missing" | "phoneError" | "tooMany" | "duplicate" | "invalid" | "failed" | null>(null);
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);
  const text = registrationText[language];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    hosurApi.getState().then((state) => {
      if (!Array.isArray(state.services)) throw new Error("Missing service catalog");
      if (!cancelled) setServices(state.services);
    }).catch(() => {
      if (!cancelled) setLoadFailed(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [attempt]);

  function serviceName(service: Service) {
    if (language === "en") return service.name;
    if (language === "ta") return service.tamil || service.name;
    return registrationServiceLabels[service.id]?.[language] ?? service.name;
  }

  function changeLanguage(next: RegistrationLanguage) {
    setLanguage(next);
    setSearch("");
    window.history.replaceState(null, "", `#register?lang=${next}`);
  }

  function toggleService(id: string) {
    if (!serviceIds.includes(id) && serviceIds.length >= 10) {
      setError("tooMany");
      return;
    }
    setServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!name.trim() || !area.trim() || !serviceIds.length || !consent) {
      setError("missing");
      return;
    }
    if (!/^(?:\+?91)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
      setError("phoneError");
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const saved = await hosurApi.registerProvider({ name: name.trim(), phone: phone.trim(), area: area.trim(), experience: experience.trim(), serviceIds, language, consent: true });
      if (!saved.id || saved.status !== "pending") throw new Error("Registration was not confirmed");
      setReceipt(saved);
      setName(""); setPhone(""); setArea(""); setExperience(""); setServiceIds([]); setConsent(false);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409 ? "duplicate" : failure instanceof ApiError && failure.status === 422 ? "invalid" : "failed");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const visibleServices = services.filter((service) =>
    `${serviceName(service)} ${service.name} ${service.tamil}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  return <main className="registration-page" lang={language}>
    <a className="text-button registration-back" href="#">{text.back}</a>
    <section className="registration-card">
      <p className="eyebrow">HOSUR SERVICES</p>
      <fieldset className="registration-languages">
        <legend>{text.language}</legend>
        {registrationLanguages.map((item) => <button key={item.id} type="button" lang={item.id} aria-pressed={language === item.id} onClick={() => changeLanguage(item.id)}>{item.label}</button>)}
      </fieldset>
      {receipt ? <div className="registration-success" role="status">
        <h1>{text.success}</h1><p>{text.pending}</p>
        <p>{text.reference}: <strong>{receipt.id}</strong></p>
      </div> : <>
        <h1>{text.title}</h1><p>{text.intro}</p><p className="fine-print">{text.noFee}</p>
        {loading ? <p role="status">{text.loading}</p> : loadFailed ? <div role="alert"><p>{text.loadError}</p><button className="secondary" onClick={() => setAttempt((current) => current + 1)}>{text.retry}</button></div> : !services.length ? <p role="status">{text.noServices}</p> :
          <form className="registration-form" onSubmit={submit}>
            <fieldset disabled={saving} className="registration-fields">
              <label>{text.name}<input autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label>{text.phone}<input type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} aria-describedby="registration-phone-help" /></label>
              <p id="registration-phone-help" className="fine-print">{text.phoneHelp}</p>
              <fieldset className="registration-service-field">
                <legend>{text.services}</legend>
                <p className="fine-print">{text.serviceHelp}</p>
                <label>{text.search}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <p>{text.selected}: {serviceIds.length}/10{serviceIds.length > 0 && ` - ${services.filter((service) => serviceIds.includes(service.id)).map(serviceName).join(", ")}`}</p>
                <div className="registration-service-options">
                  {visibleServices.map((service) => <label key={service.id} className="registration-check">
                    <input type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} />
                    <span>{serviceName(service)}{language !== "en" && serviceName(service) !== service.name && <small lang="en">{service.name}</small>}</span>
                  </label>)}
                  {!visibleServices.length && <p>{text.noMatches}</p>}
                </div>
              </fieldset>
              <label>{text.area}<input required maxLength={120} value={area} onChange={(event) => setArea(event.target.value)} aria-describedby="registration-area-help" /></label>
              <p id="registration-area-help" className="fine-print">{text.areaHelp}</p>
              <label>{text.experience}<input maxLength={200} value={experience} placeholder={text.experienceHint} onChange={(event) => setExperience(event.target.value)} /></label>
              <label className="registration-check registration-consent"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{text.consent}</span></label>
              <button className="primary" type="submit">{saving ? text.saving : text.submit}</button>
            </fieldset>
            {error && <p className="registration-error" role="alert">{text[error]}</p>}
          </form>}
      </>}
    </section>
  </main>;
}
