from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any
from .detector import AnomalyDetector
import time

app = FastAPI(
  title="Finance Anomaly Detection Service",
  description="Exposes Isolation Forest + Rule-based transaction anomaly checks",
  version="1.0.0"
)

class TransactionItem(BaseModel):
  id: Optional[str] = None
  amount: float
  date: str
  category_name: Optional[str] = Field(None, alias="categoryName")
  locationCountry: Optional[str] = "US"
  merchantName: Optional[str] = None

  class Config:
    populate_by_name = True

class SingleAnomalyRequest(BaseModel):
  transaction: TransactionItem
  history: list[TransactionItem] = []

class BatchAnomalyRequest(BaseModel):
  transactions: list[TransactionItem]

class AnomalyResponse(BaseModel):
  is_anomaly: bool
  score: float
  severity: str
  reasons: list[str]

class BatchAnomalyResponse(BaseModel):
  anomalies: list[AnomalyResponse]
  processing_time_ms: float

@app.get("/health")
def health():
  return {"status": "healthy", "service": "anomaly-detection"}

@app.post("/detect", response_model=AnomalyResponse)
def detect_single(request: SingleAnomalyRequest):
  try:
    txn_dict = request.transaction.model_dump(by_alias=True)
    history_dicts = [t.model_dump(by_alias=True) for t in request.history]
    
    detector = AnomalyDetector()
    if history_dicts:
      detector.fit(history_dicts)
      
    res = detector.check_transaction(txn_dict, history_dicts)
    return AnomalyResponse(
      is_anomaly=res["is_anomaly"],
      score=res["score"],
      severity=res["severity"],
      reasons=res["reasons"]
    )
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/batch", response_model=BatchAnomalyResponse)
def detect_batch(request: BatchAnomalyRequest):
  start_time = time.perf_counter()
  try:
    txns = [t.model_dump(by_alias=True) for t in request.transactions]
    detector = AnomalyDetector()
    detector.fit(txns)
    
    anomalies = []
    for txn in txns:
      res = detector.check_transaction(txn, txns)
      anomalies.append(AnomalyResponse(
        is_anomaly=res["is_anomaly"],
        score=res["score"],
        severity=res["severity"],
        reasons=res["reasons"]
      ))
      
    duration = (time.perf_counter() - start_time) * 1000
    return BatchAnomalyResponse(
      anomalies=anomalies,
      processing_time_ms=round(duration, 2)
    )
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
