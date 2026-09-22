import { useState } from "react";

interface Message {
  role: "user" | "agent";
  text: string;
}

export function ChatPanel({ onAsk }: { onAsk: (question: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", text: "Ask me a FinOps question, e.g. \"What is my savings plan coverage?\"" },
  ]);
  const [input, setInput] = useState("");

  const submit = () => {
    const question = input.trim();
    if (!question) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    onAsk(question);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              textAlign: m.role === "user" ? "right" : "left",
              margin: "0.5rem 0",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                background: m.role === "user" ? "#2563eb" : "#f1f5f9",
                color: m.role === "user" ? "#fff" : "#111",
                maxWidth: "80%",
              }}
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", padding: "1rem", borderTop: "1px solid #e5e7eb" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask a FinOps question..."
          style={{ flex: 1, padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button onClick={submit} style={{ padding: "0.5rem 1rem", borderRadius: 6 }}>
          Send
        </button>
      </div>
    </div>
  );
}
