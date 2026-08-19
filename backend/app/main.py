import os
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from pydantic import BaseModel

from . import analytics, csv_processor
from .db import get_analytics_collection, get_business, get_db

app = FastAPI(title="Metrivo Analytics Service")
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


def require_service_token(authorization: str | None = Header(default=None)):
    expected = os.environ.get("ANALYTICS_SERVICE_TOKEN")
    if not expected:
        if os.environ.get("METRIVO_ENV", "development") == "production":
            raise HTTPException(status_code=503, detail="Analytics service authentication is not configured")
        return

    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not supplied or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid service credential")


def _business_or_404(business_id):
    biz = get_business(business_id)
    if biz is None:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse", dependencies=[Depends(require_service_token)])
async def parse_file(file: UploadFile):
    data = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")
    try:
        return csv_processor.process_csv(data)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc


@app.get("/analytics/{business_id}", dependencies=[Depends(require_service_token)])
def get_analytics(business_id: str, month: str | None = None):
    biz = _business_or_404(business_id)
    if month:
        return analytics.compute_analytics(get_db(), business_id, biz, month=month)
    col = get_analytics_collection()
    doc = col.find_one({"businessId": business_id})
    if doc is None:
        doc = _compute_and_store(business_id, biz)
    else:
        doc.pop("_id", None)
    return doc


class AnalyzeBody(BaseModel):
    force: bool = False


@app.post("/analyze/{business_id}", dependencies=[Depends(require_service_token)])
def analyze(business_id: str, body: AnalyzeBody | None = None):
    biz = _business_or_404(business_id)
    return _compute_and_store(business_id, biz)


def _compute_and_store(business_id, biz):
    db = get_db()
    doc = analytics.compute_analytics(db, business_id, biz)
    col = get_analytics_collection()
    col.replace_one({"businessId": business_id}, doc, upsert=True)
    return doc


@app.get("/forecast/{business_id}", dependencies=[Depends(require_service_token)])
def get_forecast(business_id: str):
    doc = get_analytics(business_id)
    return doc.get("forecast", {})


@app.get("/anomalies/{business_id}", dependencies=[Depends(require_service_token)])
def get_anomalies(business_id: str):
    doc = get_analytics(business_id)
    return doc.get("anomalies", [])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=int(os.environ.get("PORT", 8000)), reload=True)
