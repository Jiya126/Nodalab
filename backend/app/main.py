from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import shapes, validate, execute, export

app = FastAPI(
    title="Nodalab API",
    description="Backend API for Nodalab visual neural network builder",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shapes.router)
app.include_router(validate.router)
app.include_router(execute.router)
app.include_router(export.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nodalab-api"}
