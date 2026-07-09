#!/usr/bin/env python3
"""Benchmark script for the transaction categorization model.

Usage:
    python scripts/benchmark.py [--model ./models/categorizer.onnx] [--n 1000]

This script:
1. Loads the pre-trained ONNX model
2. Generates N random transaction descriptions
3. Runs predictions and measures latency per inference
4. Reports p50, p95, p99, mean, max latency
5. Asserts p95 < 50ms
"""

import argparse
import logging
import sys
import time
import random
from pathlib import Path

import numpy as np

sys.path.insert(0, ".")

from app.model import TransactionCategorizer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# Realistic transaction description templates
SAMPLE_DESCRIPTIONS = [
    "STARBUCKS #12345 NEW YORK NY",
    "AMAZON.COM*1234567 AMZN.COM/BILL WA",
    "UBER TRIP HELP.UBER.COM",
    "NETFLIX.COM SUBSCRIPTION MONTHLY",
    "COMCAST XFINITY INTERNET BILL",
    "CVS PHARMACY #4521 BOSTON MA",
    "DELTA AIR LINES TICKET PURCHASE",
    "PAYROLL DIRECT DEPOSIT ACME CORP",
    "ZELLE PAYMENT TO JOHN DOE",
    "WHOLE FOODS MARKET #10234 SF CA",
    "SHELL OIL 57442 HIGHWAY 101 CA",
    "UDEMY ONLINE COURSE PURCHASE",
    "GREAT CLIPS HAIRCUT",
    "WALMART SUPERCENTER STORE 4211",
    "LYFT RIDE SAN FRANCISCO",
    "SPOTIFY PREMIUM SUBSCRIPTION",
    "VERIZON WIRELESS BILL PAYMENT",
    "WALGREENS PHARMACY RX",
    "MARRIOTT HOTEL RESERVATION",
    "VENMO PAYMENT RECEIVED",
    "KROGER GROCERY STORE",
    "CHEVRON GAS STATION",
    "COURSERA SUBSCRIPTION",
    "SEPHORA BEAUTY PURCHASE",
    "HOME DEPOT HARDWARE STORE",
    "CHIPOTLE MEXICAN GRILL",
    "PLANET FITNESS MEMBERSHIP",
    "SOUTHWEST AIRLINES TICKET",
    "ACH TRANSFER SAVINGS",
    "TRADER JOES GROCERY",
]


def generate_benchmark_descriptions(n: int) -> list[str]:
    """Generate N random transaction descriptions for benchmarking."""
    random.seed(42)
    descriptions = []

    # Mix of template-based and keyword-based descriptions
    all_keywords = []
    for keywords in TransactionCategorizer.KEYWORD_RULES.values():
        all_keywords.extend(keywords)

    prefixes = [
        "POS PURCHASE", "DEBIT CARD", "ONLINE PURCHASE",
        "RECURRING PMT", "CHECKCARD", "SQ *", "TST*",
        "VISA PURCHASE", "MOBILE PAYMENT", "",
    ]
    suffixes = [
        "NEW YORK NY", "LOS ANGELES CA", "CHICAGO IL",
        "HOUSTON TX", "SEATTLE WA", "ONLINE", "",
    ]
    store_nums = ["#12345", "#00987", "STORE 421", "", ""]

    for i in range(n):
        if i < len(SAMPLE_DESCRIPTIONS) and random.random() > 0.5:
            # Use a realistic template
            desc = SAMPLE_DESCRIPTIONS[i % len(SAMPLE_DESCRIPTIONS)]
        else:
            # Generate from keywords
            keyword = random.choice(all_keywords).upper()
            prefix = random.choice(prefixes)
            suffix = random.choice(suffixes)
            store = random.choice(store_nums)
            parts = [p for p in [prefix, keyword, store, suffix] if p]
            desc = " ".join(parts)

        # Occasionally add noise
        if random.random() > 0.7:
            desc += f" ${random.uniform(1, 500):.2f}"

        descriptions.append(desc)

    return descriptions


def main():
    parser = argparse.ArgumentParser(description="Benchmark ML model")
    parser.add_argument(
        "--model",
        default="./models/categorizer.onnx",
        help="Path to the ONNX model",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=1000,
        help="Number of predictions to benchmark",
    )
    args = parser.parse_args()

    model_path = args.model
    if not Path(model_path).exists():
        logger.error(
            f"Model not found at {model_path}. "
            "Run 'python scripts/export_model.py' first."
        )
        sys.exit(1)

    # Load model
    logger.info(f"Loading model from {model_path}...")
    categorizer = TransactionCategorizer(model_path)
    assert categorizer.session is not None, "ONNX session failed to load"
    logger.info("Model loaded successfully")

    # Generate test data
    descriptions = generate_benchmark_descriptions(args.n)
    logger.info(f"Generated {len(descriptions)} test descriptions")

    # Warm-up (10 iterations)
    logger.info("Warming up...")
    for desc in descriptions[:10]:
        categorizer.predict(desc)

    # Benchmark
    logger.info(f"Running {args.n} predictions...")
    latencies: list[float] = []
    category_counts: dict[str, int] = {}

    for desc in descriptions:
        t0 = time.perf_counter()
        category, confidence, _ = categorizer.predict(desc)
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000)  # ms
        category_counts[category] = category_counts.get(category, 0) + 1

    latencies_arr = np.array(latencies)
    p50 = float(np.percentile(latencies_arr, 50))
    p95 = float(np.percentile(latencies_arr, 95))
    p99 = float(np.percentile(latencies_arr, 99))
    mean = float(np.mean(latencies_arr))
    max_lat = float(np.max(latencies_arr))
    min_lat = float(np.min(latencies_arr))
    total = float(np.sum(latencies_arr))

    # Report
    print()
    print("=" * 60)
    print(f"  BENCHMARK RESULTS ({args.n} predictions)")
    print("=" * 60)
    print(f"  Total time:   {total:.2f} ms")
    print(f"  Throughput:    {args.n / (total / 1000):.0f} predictions/sec")
    print()
    print(f"  Min latency:  {min_lat:.3f} ms")
    print(f"  Mean latency: {mean:.3f} ms")
    print(f"  p50 latency:  {p50:.3f} ms")
    print(f"  p95 latency:  {p95:.3f} ms")
    print(f"  p99 latency:  {p99:.3f} ms")
    print(f"  Max latency:  {max_lat:.3f} ms")
    print()
    print("  Category Distribution:")
    for cat in sorted(category_counts, key=lambda c: -category_counts[c]):
        count = category_counts[cat]
        pct = count / args.n * 100
        bar = "█" * int(pct / 2)
        print(f"    {cat:<20s} {count:4d} ({pct:5.1f}%) {bar}")
    print("=" * 60)

    # Assert p95 < 50ms
    if p95 < 50:
        print(f"\n  ✓ PASS: p95 latency ({p95:.2f}ms) < 50ms target\n")
    else:
        print(f"\n  ✗ FAIL: p95 latency ({p95:.2f}ms) >= 50ms target\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
