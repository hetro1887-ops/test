from pydantic import BaseModel, Field
from typing import Optional


class PredictionRequest(BaseModel):
    description: str = Field(
        ..., min_length=1, max_length=500, description="Transaction description text"
    )
    amount: Optional[float] = Field(None, description="Transaction amount (positive)")
    merchant_name: Optional[str] = Field(
        None, description="Merchant name if available"
    )


class BatchPredictionRequest(BaseModel):
    transactions: list[PredictionRequest] = Field(
        ..., min_length=1, max_length=100
    )


class PredictionResponse(BaseModel):
    category: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    subcategory: Optional[str] = None
    all_scores: dict[str, float]


class BatchPredictionResponse(BaseModel):
    predictions: list[PredictionResponse]
    processing_time_ms: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    version: str
    inference_time_ms: Optional[float] = None
