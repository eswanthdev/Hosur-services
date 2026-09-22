import type { WidgetSpec } from "../widgets/types";

const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/chat`;

export function askViaRest(question: string): Promise<WidgetSpec> {
  return fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  })
    .then((r) => r.json())
    .then((body) => body.widget as WidgetSpec);
}

export function connectChatSocket(onWidget: (w: WidgetSpec) => void): WebSocket {
  const socket = new WebSocket(WS_URL);
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "widget") onWidget(msg.widget as WidgetSpec);
  };
  return socket;
}
