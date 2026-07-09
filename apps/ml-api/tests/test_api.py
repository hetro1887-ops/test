import pytest
from fastapi.testclient import TestClient
from app.main import app
import time

client = TestClient(app)


def test_health():
    """Verify the health endpoint returns a valid status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]


def test_predict_single():
    """Verify single transaction categorization returns a valid category and confidence."""
    response = client.post("/predict", json={
        "description": "STARBUCKS COFFEE #12345",
        "amount": 5.75,
        "merchant_name": "Starbucks"
    })
    assert response.status_code == 200
    data = response.json()
    assert "category" in data
    assert "confidence" in data
    assert 0 <= data["confidence"] <= 1
    assert data["category"] in [
        "Food & Dining", "Shopping", "Transportation", "Entertainment",
        "Bills & Utilities", "Health & Fitness", "Travel", "Income",
        "Transfer", "Groceries", "Gas & Fuel", "Education", "Personal Care"
    ]


def test_predict_batch():
    """Verify batch categorization processes multiple transactions."""
    transactions = [
        {"description": "UBER TRIP", "amount": 25.00},
        {"description": "NETFLIX SUBSCRIPTION", "amount": 15.99},
        {"description": "WHOLE FOODS MARKET", "amount": 87.50},
    ]
    response = client.post("/predict/batch", json={"transactions": transactions})
    assert response.status_code == 200
    data = response.json()
    assert len(data["predictions"]) == 3
    assert data["processing_time_ms"] > 0


def test_predict_latency():
    """Verify p95 latency is within acceptable CI thresholds.

    In production with dedicated hardware, this should be <50ms.
    CI environments are slower so we use a generous 200ms threshold.
    """
    latencies = []
    for i in range(100):
        start = time.perf_counter()
        response = client.post("/predict", json={
            "description": f"TEST TRANSACTION {i} COFFEE SHOP",
            "amount": 10.00 + i
        })
        elapsed = (time.perf_counter() - start) * 1000
        latencies.append(elapsed)
        assert response.status_code == 200

    latencies.sort()
    p95 = latencies[94]
    print(f"Latency p50={latencies[49]:.1f}ms p95={p95:.1f}ms p99={latencies[98]:.1f}ms")
    # In production with dedicated hardware, this should be <50ms
    assert p95 < 200  # Generous CI threshold


def test_predict_empty_description():
    """Verify that an empty description triggers a validation error."""
    response = client.post("/predict", json={
        "description": ""
    })
    assert response.status_code == 422  # Validation error


def test_predict_categories_valid():
    """Verify known transaction descriptions map to expected categories."""
    test_cases = [
        ("UBER TRIP HELP.UBER.COM", "Transportation"),
        ("NETFLIX.COM", "Entertainment"),
        ("WHOLE FOODS MKT", "Groceries"),
        ("SHELL OIL 12345", "Gas & Fuel"),
        ("PAYROLL DIRECT DEP", "Income"),
    ]
    for description, expected_category in test_cases:
        response = client.post("/predict", json={"description": description})
        data = response.json()
        assert data["category"] == expected_category, (
            f"Expected {expected_category} for '{description}', got {data['category']}"
        )
