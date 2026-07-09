from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from .forecaster import TFTForecaster
import time

app = FastAPI(
  title="Finance Forecasting Service",
  description="Exposes Temporal Fusion Transformer (TFT) style cash flow forecasting and simulations",
  version="1.0.0"
)

class TransactionItem(BaseModel):
  amount: float
  date: str
  categoryName: Optional[str] = "Other"

class ForecastRequest(BaseModel):
  history: list[TransactionItem]
  exclude_keywords: list[str] = []

class ForecastQuantiles(BaseModel):
  p10: list[float]
  p50: list[float]
  p90: list[float]

class ForecastResponse(BaseModel):
  days: int
  forecast: ForecastQuantiles
  processing_time_ms: float

class SimulationScenario(BaseModel):
  name: str
  exclude_keywords: list[str]

class SimulateRequest(BaseModel):
  history: list[TransactionItem]
  scenarios: list[SimulationScenario]

class ScenarioComparison(BaseModel):
  name: str
  forecast: ForecastQuantiles
  cumulative_savings: float

class SimulateResponse(BaseModel):
  baseline: ForecastQuantiles
  scenarios: list[ScenarioComparison]
  processing_time_ms: float

@app.get("/health")
def health():
  return {"status": "healthy", "service": "forecasting"}

@app.post("/predict", response_model=ForecastResponse)
def predict(request: ForecastRequest):
  start_time = time.perf_counter()
  try:
    history_dicts = [t.model_dump() for t in request.history]
    
    forecaster = TFTForecaster()
    forecaster.fit(history_dicts)
    predictions = forecaster.predict(exclude_keywords=request.exclude_keywords)
    
    duration = (time.perf_counter() - start_time) * 1000
    return ForecastResponse(
      days=90,
      forecast=ForecastQuantiles(
        p10=predictions["p10"],
        p50=predictions["p50"],
        p90=predictions["p90"]
      ),
      processing_time_ms=round(duration, 2)
    )
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate", response_model=SimulateResponse)
def simulate(request: SimulateRequest):
  start_time = time.perf_counter()
  try:
    history_dicts = [t.model_dump() for t in request.history]
    
    # 1. Baseline
    forecaster = TFTForecaster()
    forecaster.fit(history_dicts)
    baseline = forecaster.predict()
    
    # 2. Scenarios
    scenarios_comparisons = []
    baseline_cumulative = sum(baseline["p50"])
    
    for scenario in request.scenarios:
      scenario_preds = forecaster.predict(exclude_keywords=scenario.exclude_keywords)
      scenario_cumulative = sum(scenario_preds["p50"])
      savings = max(0.0, baseline_cumulative - scenario_cumulative)
      
      scenarios_comparisons.append(ScenarioComparison(
        name=scenario.name,
        forecast=ForecastQuantiles(
          p10=scenario_preds["p10"],
          p50=scenario_preds["p50"],
          p90=scenario_preds["p90"]
        ),
        cumulative_savings=round(savings, 2)
      ))
      
    duration = (time.perf_counter() - start_time) * 1000
    return SimulateResponse(
      baseline=ForecastQuantiles(
        p10=baseline["p10"],
        p50=baseline["p50"],
        p90=baseline["p90"]
      ),
      scenarios=scenarios_comparisons,
      processing_time_ms=round(duration, 2)
    )
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
