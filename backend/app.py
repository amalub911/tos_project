import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from nlp_service import analyze_document, load_nlp_model
from utils import fetch_text_from_url_sync

# --- FORENSIC LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [SENTINEL-CORE] - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Singleton Model Initialization
logger.info("SYSTEM: Booting Neural Engine...")
model_loaded = load_nlp_model()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    if not model_loaded:
        return jsonify({"error": "Forensic Engine Offline. Check local model weights."}), 503
    
    data = request.get_json() if request.is_json else {}
    text = data.get("text", "")
    url = data.get("url", "")

    # Priority 1: Website Scraper
    if url:
        logger.info(f"FORENSICS: Target URL Identified -> {url}")
        scraped_text = fetch_text_from_url_sync(url)
        if isinstance(scraped_text, dict) and "error" in scraped_text:
            return jsonify(scraped_text), 400
        text = scraped_text

    # Priority 2: Sentence Analysis
    if not text or len(text.strip()) < 10:
        return jsonify({"error": "Insufficient data. Provide more text/valid URL."}), 400

    try:
        results = analyze_document(text)
        return jsonify(results)
    except Exception as e:
        logger.error(f"SYSTEM FAILURE: {str(e)}")
        return jsonify({"error": "Internal Forensic Processing Error."}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
