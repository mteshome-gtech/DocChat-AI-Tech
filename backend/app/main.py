from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.upload import router as upload_router
from app.routes.chat import router as chat_router
from app.routes.analyze import router as analyze_router
from app.routes.translate import router as translate_router
from app.routes.compare import router as compare_router
from app.routes.research import router as research_router
from app.routes.billing import router as billing_router


app = FastAPI(
    title="DocChatAI API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# API ROUTES
# -----------------------------

app.include_router(
    upload_router,
    prefix="/api",
)

app.include_router(
    chat_router,
    prefix="/api",
)

app.include_router(
    analyze_router,
    prefix="/api",
)

app.include_router(
    translate_router,
    prefix="/api",
)

app.include_router(
    compare_router,
    prefix="/api",
)

app.include_router(
    research_router,
    prefix="/api",
)

app.include_router(
    billing_router, 
    prefix="/api"
)


# -----------------------------
# SYSTEM ROUTES
# -----------------------------

@app.get("/")
async def root():
    return {
        "message": "DocChatAI API is running."
    }


@app.get("/health")
async def health():
    return {
        "status": "ok"
    }