from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hosur.api import router as hosur_router

app = FastAPI(title="Hosur Services API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before anything beyond local dev
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hosur_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
