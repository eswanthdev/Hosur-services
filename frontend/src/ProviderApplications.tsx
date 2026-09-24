import { useEffect, useRef, useState } from "react";
import { hosurApi, type Provider, type ProviderApplication, type Service } from "./api/hosur";
import { registrationLanguages } from "./registrationText";
import "./registration.css";

export function ProviderApplications({ services, onApproved, readyToApprove = true }: { services: Service[]; onApproved: (providers: Provider[]) => void; readyToApprove?: boolean }) {
  const [applications, setApplications] = useState<ProviderApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const reviewing = useRef(false);
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<ProviderApplication["status"]>("pending");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    hosurApi.getProviderApplications().then((items) => {
      if (!Array.isArray(items)) throw new Error("Invalid application queue response");
      if (!cancelled) setApplications(items);
    }).catch((failure: unknown) => {
      if (!cancelled) setError(`Could not load applications. ${failure instanceof Error ? failure.message : "Please retry."}`);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refresh]);

  async function review(application: ProviderApplication, approve: boolean) {
    if (reviewing.current) return;
    if (approve && !readyToApprove) {
      setError("Wait for the initial service catalogue request to finish before approving.");
      return;
    }
    if (approve && !verifiedIds.includes(application.id)) {
      setError("Confirm that you have verified this provider before approving.");
      return;
    }
    if (!approve && !window.confirm(`Reject ${application.name}'s application? They will not be listed.`)) return;
    reviewing.current = true;
    setBusyId(application.id);
    setError(""); setMessage("");
    try {
      let saved: ProviderApplication;
      if (approve) {
        const result = await hosurApi.approveProviderApplication(application.id);
        if (result.application.status !== "approved" || !Array.isArray(result.providers) || !result.providers.length) throw new Error("Approval was not confirmed. Refresh the queue.");
        saved = result.application;
        onApproved(result.providers);
      } else {
        saved = await hosurApi.rejectProviderApplication(application.id);
        if (saved.status !== "rejected") throw new Error("Rejection was not confirmed. Refresh the queue.");
      }
      setApplications((current) => current.map((item) => item.id === saved.id ? saved : item));
      setVerifiedIds((current) => current.filter((id) => id !== saved.id));
      setMessage(approve ? `${saved.name} approved and listed.` : `${saved.name} rejected and not listed.`);
    } catch (failure) {
      setError(`Could not confirm this decision. ${failure instanceof Error ? failure.message : "Please retry."} Refresh the queue before retrying.`);
    } finally {
      reviewing.current = false;
      setBusyId(null);
    }
  }

  const visible = applications.filter((item) => item.status === filter);
  return <section className="admin-card" aria-label="Provider applications">
    <div className="admin-card-header"><h2>Provider applications</h2><button className="secondary" disabled={loading || !!busyId} onClick={() => { setMessage(""); setRefresh((current) => current + 1); }}>Refresh applications</button></div>
    <p>Call the applicant to verify their services and details. Pending and rejected applications are not public.</p>
    {!readyToApprove && <p>Loading the service catalogue before enabling approvals...</p>}
    <p className="registration-error">Local prototype only: this admin portal is not authenticated. Keep it private until AWS Cognito access control is added.</p>
    <a href="#register">Open provider registration</a>
    <div className="registration-filters" aria-label="Application status">
      {(["pending", "approved", "rejected"] as const).map((status) => <button type="button" key={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status[0].toUpperCase() + status.slice(1)} ({applications.filter((item) => item.status === status).length})</button>)}
    </div>
    {error && <p role="alert" className="registration-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {loading ? <p>Loading applications...</p> : visible.length ? <div className="application-list">{visible.map((item) => <article key={item.id} className="application-card">
      <h3>{item.name}</h3>
      <dl>
        <dt>Phone / WhatsApp</dt><dd><a href={`tel:${item.phone}`}>{item.phone}</a></dd>
        <dt>Services</dt><dd>{item.serviceIds.map((id) => services.find((service) => service.id === id)?.name ?? id).join(", ")}</dd>
        <dt>Based in</dt><dd>{item.area}</dd>
        <dt>Experience</dt><dd>{item.experience || "Not provided"}</dd>
        <dt>Preferred language</dt><dd>{registrationLanguages.find((language) => language.id === item.language)?.label ?? item.language}</dd>
        <dt>Submitted</dt><dd>{new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</dd>
        <dt>Consent</dt><dd>{item.consent ? "Agreed to contact and public listing after approval" : "Not given"}</dd>
      </dl>
      {item.status === "pending" && <>
        <label className="registration-check"><input type="checkbox" disabled={!!busyId} checked={verifiedIds.includes(item.id)} onChange={(event) => setVerifiedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>I have verified {item.name}'s details and services.</span></label>
        <div className="application-actions">
          <button className="primary" disabled={!readyToApprove || !!busyId || !verifiedIds.includes(item.id)} onClick={() => review(item, true)}>{busyId === item.id ? "Saving..." : `Approve ${item.name}`}</button>
          <button className="danger-button" disabled={!!busyId} onClick={() => review(item, false)}>Reject {item.name}</button>
        </div>
      </>}
    </article>)}</div> : !error && <p>No {filter} applications.</p>}
  </section>;
}
