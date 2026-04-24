import os
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from utils import split_clauses

# --- PRODUCTION CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "tos_model")
MAX_LENGTH = 250  
THRESHOLD = 0.42 # Optimized for Sentence-Level Precision

tokenizer = None
model = None

def load_nlp_model():
    global tokenizer, model
    if model is not None: return True
    try:
        if os.path.exists(MODEL_PATH):
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
            model.eval()
            return True
    except Exception as e:
        print(f"BOOT ERROR: {e}")
    return False

def get_risk_reason(text):
    t = text.lower()
    if any(x in t for x in ["sell", "monetize", "third part", "advertise"]): return "DATA RISK: Personal information monetization."
    if any(x in t for x in ["arbitration", "waive", "jury", "class action"]): return "LEGAL RISK: Constitutional rights waiver."
    if any(x in t for x in ["terminate", "suspend", "without notice"]): return "CONTRACT RISK: Discretionary account seizure."
    if any(x in t for x in ["not liable", "no liability", "immunity"]): return "LIABILITY RISK: Corporate immunity clause."
    return "CAUTION: One-sided restrictive clause."

def analyze_document(text):
    if model is None: return {"error": "Engine Offline"}
    sentences = split_clauses(text)
    if not sentences: return {"risk_score": 0, "risk_level": "Low", "total_clauses": 0, "unfair_count": 0, "results": []}

    processed = []
    unfair_scores = []

    # Granular Neural Sweep
    batch_size = 16
    for i in range(0, len(sentences), batch_size):
        batch = sentences[i:i + batch_size]
        inputs = tokenizer(batch, return_tensors="pt", truncation=True, padding=True, max_length=MAX_LENGTH)
        with torch.no_grad():
            logits = model(**inputs).logits
        probs = F.softmax(logits, dim=1)
        
        for idx, p in enumerate(probs):
            conf = p[1].item()
            is_unfair = conf > THRESHOLD
            if is_unfair: unfair_scores.append(conf)
            processed.append({
                "text": batch[idx],
                "label": "Unfair" if is_unfair else "Fair",
                "confidence": round(conf * 100, 2),
                "reason": get_risk_reason(batch[idx]) if is_unfair else ""
            })

    # --- SCORING ENGINE v5.1 ---
    # Final Score = (Max Anomaly * 0.85) + (Frequency Bonus * 0.15)
    if not unfair_scores:
        score = 0
    else:
        max_v = max(unfair_scores) * 100
        freq = (len(unfair_scores) / len(sentences)) * 100
        score = min(100, (max_v * 0.85) + (freq * 0.15))

    score = round(score, 1)
    level = "High Risk" if score > 75 else "Medium Risk" if score > 25 else "Low Risk"

    return {
        "risk_score": score,
        "risk_level": level,
        "total_clauses": len(sentences),
        "unfair_count": len(unfair_scores),
        "results": processed
    }
