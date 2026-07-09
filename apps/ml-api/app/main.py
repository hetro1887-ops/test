import os
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    PredictionRequest,
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    HealthResponse,
)
from .model import TransactionCategorizer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

categorizer: TransactionCategorizer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global categorizer
    model_path = os.environ.get("MODEL_PATH", "./models/categorizer.onnx")

    # Create model if it doesn't exist
    if not Path(model_path).exists():
        logger.info("No model found, creating default model...")
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        TransactionCategorizer.create_default_model(model_path)

    categorizer = TransactionCategorizer(model_path)
    logger.info("Model loaded successfully")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Finance Dashboard ML Service",
    description="Transaction categorization via ONNX-optimized model",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint — runs a quick inference to measure latency."""
    start = time.perf_counter()
    if categorizer and categorizer.session:
        categorizer.predict("test transaction starbucks coffee")
        inference_ms = (time.perf_counter() - start) * 1000
        return HealthResponse(
            status="healthy",
            model_loaded=True,
            version="1.0.0",
            inference_time_ms=round(inference_ms, 2),
        )
    return HealthResponse(
        status="degraded",
        model_loaded=False,
        version="1.0.0",
    )


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Predict the category for a single transaction."""
    if not categorizer:
        raise HTTPException(status_code=503, detail="Model not loaded")

    start = time.perf_counter()
    category, confidence, all_scores = categorizer.predict(
        request.description, request.amount, request.merchant_name
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    logger.info(
        f"Prediction: '{request.description}' -> {category} "
        f"({confidence:.2f}) in {elapsed_ms:.1f}ms"
    )

    return PredictionResponse(
        category=category,
        confidence=round(confidence, 4),
        all_scores={
            k: round(v, 4)
            for k, v in sorted(all_scores.items(), key=lambda x: -x[1])[:5]
        },
    )


@app.post("/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest):
    """Predict categories for a batch of transactions."""
    if not categorizer:
        raise HTTPException(status_code=503, detail="Model not loaded")

    start = time.perf_counter()
    predictions = []
    for txn in request.transactions:
        category, confidence, all_scores = categorizer.predict(
            txn.description, txn.amount, txn.merchant_name
        )
        predictions.append(
            PredictionResponse(
                category=category,
                confidence=round(confidence, 4),
                all_scores={
                    k: round(v, 4)
                    for k, v in sorted(
                        all_scores.items(), key=lambda x: -x[1]
                    )[:5]
                },
            )
        )

    elapsed_ms = (time.perf_counter() - start) * 1000
    return BatchPredictionResponse(
        predictions=predictions,
        processing_time_ms=round(elapsed_ms, 2),
    )
