#!/usr/bin/env python3
"""Standalone script to train and export the ONNX transaction categorization model.

Usage:
    python scripts/export_model.py [--output ./models/categorizer.onnx]

This script:
1. Creates the default ONNX model using TransactionCategorizer.create_default_model
2. Loads the exported model and runs a quick validation
3. Benchmarks 1000 predictions and reports latency percentiles
4. Validates that p95 < 50ms
"""

import argparse
import logging
import sys
import time
import random

import numpy as np

# Allow running from the ml-service directory
sys.path.insert(0, ".")

from app.model import TransactionCategorizer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def generate_random_descriptions(n: int = 1000) -> list[str]:
    """Generate random transaction descriptions for benchmarking."""
    random.seed(123)
    samples = []
    all_keywords = []
    for keywords in TransactionCategorizer.KEYWORD_RULES.values():
        all_keywords.extend(keywords)

    prefixes = [
        "POS PURCHASE", "DEBIT CARD", "ONLINE", "RECURRING PMT",
        "CHECKCARD", "SQ *", "", "",
    ]
    suffixes = [
        "NEW YORK NY", "LOS ANGELES CA", "SEATTLE WA",
        "ONLINE", "", "", "",
    ]

    for _ in range(n):
        keyword = random.choice(all_keywords)
        prefix = random.choice(prefixes)
        suffix = random.choice(suffixes)
        parts = [p for p in [prefix, keyword.upper(), suffix] if p]
        desc = " ".join(parts)
        if random.random() > 0.5:
            desc += f" ${random.uniform(1, 999):.2f}"
        samples.append(desc)

    return samples


def main():
    parser = argparse.ArgumentParser(description="Export ONNX model")
    parser.add_argument(
        "--output",
        default="./models/categorizer.onnx",
        help="Output path for the ONNX model",
    )
    args = parser.parse_args()

    # Step 1: Create the model
    logger.info(f"Exporting model to {args.output}")
    start = time.perf_counter()
    TransactionCategorizer.create_default_model(args.output)
    export_time = time.perf_counter() - start
    logger.info(f"Model exported in {export_time:.2f}s")

    # Step 2: Load and validate
    logger.info("Loading exported model for validation...")
    categorizer = TransactionCategorizer(args.output)
    assert categorizer.session is not None, "Model failed to load"

    # Quick validation with known inputs
    test_cases = [
        ("STARBUCKS COFFEE #12345 NEW YORK NY", "Food & Dining"),
        ("AMAZON.COM AMZN.COM/BILL WA", "Shopping"),
        ("UBER TRIP HELP.UBER.COM", "Transportation"),
        ("NETFLIX.COM SUBSCRIPTION", "Entertainment"),
        ("SHELL OIL GAS STATION", "Gas & Fuel"),
    ]
    for desc, expected in test_cases:
        cat, conf, _ = categorizer.predict(desc)
        status = "✓" if cat == expected else "✗"
        logger.info(f"  {status} '{desc}' -> {cat} ({conf:.2f}) [expected: {expected}]")

    # Step 3: Benchmark
    logger.info("Running benchmark (1000 predictions)...")
    descriptions = generate_random_descriptions(1000)
    latencies = []

    # Warm-up
    for desc in descriptions[:10]:
        categorizer.predict(desc)

    # Timed run
    for desc in descriptions:
        t0 = time.perf_counter()
        categorizer.predict(desc)
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000)  # ms

    latencies_arr = np.array(latencies)
    p50 = np.percentile(latencies_arr, 50)
    p95 = np.percentile(latencies_arr, 95)
    p99 = np.percentile(latencies_arr, 99)
    mean = np.mean(latencies_arr)
    max_lat = np.max(latencies_arr)

    logger.info("=" * 50)
    logger.info("Benchmark Results (1000 predictions):")
    logger.info(f"  Mean:  {mean:.2f} ms")
    logger.info(f"  p50:   {p50:.2f} ms")
    logger.info(f"  p95:   {p95:.2f} ms")
    logger.info(f"  p99:   {p99:.2f} ms")
    logger.info(f"  Max:   {max_lat:.2f} ms")
    logger.info("=" * 50)

    # Step 4: Validate p95
    if p95 < 50:
        logger.info(f"✓ PASS: p95 latency ({p95:.2f}ms) is under 50ms target")
    else:
        logger.warning(f"✗ FAIL: p95 latency ({p95:.2f}ms) exceeds 50ms target")
        sys.exit(1)


if __name__ == "__main__":
    main()
