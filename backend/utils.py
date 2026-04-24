import re
import socket
import ipaddress
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

def is_safe_url(url):
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]: return False
        h = (parsed.hostname or "").lower()
        if not h or h in ["localhost", "127.0.0.1", "0.0.0.0"]: return False
        try:
            addr = socket.getaddrinfo(h, None)
            for _, _, _, _, s in addr:
                ip = ipaddress.ip_address(s[0])
                if ip.is_private or ip.is_loopback: return False
        except: return False
        return True
    except: return False

def fetch_text_from_url_sync(url):
    if not is_safe_url(url): return {"error": "Target security violation."}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            page = ctx.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            
            # Deep Extraction Logic
            text = page.evaluate("""() => {
                const garbage = document.querySelectorAll('nav, footer, header, script, style, aside, iframe, .ads, .popup, .cookie-banner');
                garbage.forEach(g => g.remove());
                return document.body.innerText;
            }""")
            browser.close()
            return text if len(text.strip()) > 100 else {"error": "No meaningful legal text found."}
    except Exception as e:
        return {"error": f"Scraper failure: {str(e)}"}

def split_clauses(text):
    """SENTENCE SPLITTER v4.0 (Legal-Grade)"""
    # 1. Standardize Whitespace & Unicode
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 2. ADVANCED REGEX: 
    # Splits on [.!?] followed by a space, 
    # but accounts for closing quotes or brackets (e.g., ." or .])
    # AND ensures the next character is Capitalized.
    sentences = re.split(r'(?<=[.!?]["\'\)\s])\s+(?=[A-Z])', text)
    
    # 3. Fallback for generic splits if regex is too strict
    if len(sentences) <= 1:
        sentences = re.split(r'(?<=[.!?])\s+', text)

    # 4. Final filter: Remove fragments shorter than 25 chars (Forensic noise)
    return [s.strip() for s in sentences if len(s.strip()) > 25]
