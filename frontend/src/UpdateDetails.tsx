type Verification = { sourceUrl: string; verifiedAt: string };

export function indiaDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function inputTime(value: string) {
  const date = new Date(value);
  return `${indiaDate(date)}T${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}`;
}

export function formatUpdateTime(value: string, language: "en" | "ta") {
  return new Intl.DateTimeFormat(language === "ta" ? "ta-IN" : "en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}

export function UpdateVerification({ item, language }: { item: Verification; language: "en" | "ta" }) {
  return <div className="update-verification">
    <span>{language === "ta" ? "கடைசியாக சரிபார்க்கப்பட்டது" : "Last verified"}: <time dateTime={item.verifiedAt}>{item.verifiedAt}</time></span>
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{language === "ta" ? "ஆதாரம்" : "View source"}</a>
  </div>;
}

export function VerificationFields({ item, now }: { item?: Verification | null; now: number }) {
  return <>
    <label>Source URL<input type="url" pattern="https?://.+" name="sourceUrl" required defaultValue={item?.sourceUrl} /></label>
    <label>Last verified date<input type="date" name="verifiedAt" required max={indiaDate(new Date(now))} defaultValue={item?.verifiedAt} /></label>
    <label className="update-confirm"><input type="checkbox" required />I have checked these details against the source.</label>
  </>;
}
