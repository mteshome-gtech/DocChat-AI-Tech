from fastapi import FastAPI
from dotenv import load_dotenv


load_dotenv()

app = FastAPI(
    title="DocChat AI API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "DocChat AI backend running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }