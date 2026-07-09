import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Optional, Any
import datetime

class AnomalyDetector:
  """
  Detects transaction anomalies using a hybrid approach:
  - Scikit-learn's Isolation Forest (to capture multivariate patterns)
  - Rule-based heuristics (to capture known high-risk scenarios)
  """
  
  def __init__(self, contamination: float = 0.03):
    self.contamination = contamination
    self.model = IsolationForest(contamination=self.contamination, random_state=42)
    self.is_trained = False
    
  def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
    """Extract numeric features from raw transactions for model consumption."""
    features = pd.DataFrame(index=df.index)
    
    # Amount
    features['amount'] = df['amount'].astype(float)
    
    # Date/Time features
    dates = pd.to_datetime(df['date'])
    features['day_of_week'] = dates.dt.dayofweek
    features['hour'] = dates.dt.hour
    features['is_weekend'] = dates.dt.dayofweek.isin([5, 6]).astype(int)
    
    # Category mapping (simple dummy variables)
    categories = df['category_name'].fillna('Other')
    for cat in ['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Bills & Utilities', 'Groceries', 'Gas & Fuel', 'Income', 'Transfer']:
      features[f'is_cat_{cat}'] = (categories == cat).astype(int)
      
    return features

  def fit(self, history: list[dict[str, Any]]):
    """Trains the Isolation Forest on transaction history."""
    if len(history) < 10:
      # Insufficient data to train Isolation Forest, will rely on rule-based checks
      self.is_trained = False
      return self
      
    df = pd.DataFrame(history)
    X = self._prepare_features(df)
    
    self.model.fit(X)
    self.is_trained = True
    return self

  def check_transaction(self, new_txn: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Evaluates a single transaction against history and rule limits.
    Returns anomaly status, score, severity, and specific reason messages.
    """
    amount = float(new_txn.get('amount', 0))
    date = pd.to_datetime(new_txn.get('date', datetime.datetime.now().isoformat()))
    cat_name = new_txn.get('categoryName', 'Other')
    location = new_txn.get('locationCountry', 'US')
    
    reasons = []
    severity = 'LOW'
    score = 0.0 # 0.0 is normal, 1.0 is highly anomalous

    # ──── 1. HEURISTIC RULE CHECKS ────
    
    # Check 1: Super high absolute amount
    if amount > 5000:
      reasons.append(f"High value transaction: {amount} USD")
      severity = 'HIGH'
      score = max(score, 0.85)

    if len(history) >= 5:
      amounts = [float(t['amount']) for t in history if float(t['amount']) > 0]
      if amounts:
        mean_amt = np.mean(amounts)
        std_amt = np.std(amounts)
        
        # Check 2: Relative amount (Standard Deviation check)
        if std_amt > 0 and amount > mean_amt + (3 * std_amt):
          reasons.append(f"Unusually high amount for user patterns (exceeds mean by 3+ stddev)")
          severity = 'MEDIUM'
          score = max(score, 0.70)
          
    # Check 3: Unusual hour (e.g. high spending at 3 AM)
    hour = date.hour
    if hour in [1, 2, 3, 4] and amount > 200:
      reasons.append(f"Transaction occurred at abnormal hours: {hour:02d}:00")
      severity = 'MEDIUM'
      score = max(score, 0.60)

    # Check 4: Cross-border transaction
    if location and location.upper() not in ['US', 'USA']:
      reasons.append(f"International transaction location: {location}")
      severity = 'HIGH'
      score = max(score, 0.80)

    # ──── 2. MACHINE LEARNING CHECKS (Isolation Forest) ────
    if self.is_trained:
      df_single = pd.DataFrame([new_txn])
      X_single = self._prepare_features(df_single)
      
      # Isolation Forest decision_function returns lower values for anomalies
      iforest_score = float(self.model.decision_function(X_single)[0])
      
      # Map decision function score (typically in [-0.5, 0.5]) to [0, 1] range where > 0.5 is anomalous
      # A negative iforest_score indicates an anomaly
      ml_score = max(0.0, min(1.0, 0.5 - (iforest_score * 2.0)))
      
      if iforest_score < 0:
        reasons.append("ML Engine: Transaction deviates from typical spending pattern combinations")
        score = max(score, ml_score)
        if severity == 'LOW':
          severity = 'MEDIUM'
          
    # Return overall findings
    is_anomaly = len(reasons) > 0 and score > 0.5
    
    return {
      "is_anomaly": is_anomaly,
      "score": float(score),
      "severity": severity,
      "reasons": reasons,
    }
