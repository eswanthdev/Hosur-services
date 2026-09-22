from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agent.supervisor import run_agent

app = FastAPI(title="FinOps Agent - Visualization Layer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before anything beyond local dev
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ask")
async def ask(payload: dict):
    """REST fallback: { "question": "..." } -> widget spec JSON."""
    question = payload.get("question", "")
    widget_spec = await run_agent(question)
    return {"widget": widget_spec}


@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            question = await websocket.receive_text()
            widget_spec = await run_agent(question)
            await websocket.send_json({"type": "widget", "widget": widget_spec})
    except WebSocketDisconnect:
        pass
