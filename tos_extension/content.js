function getSentenceId(text) {
    // Robust Unicode-Safe ID generation without btoa
    let hash = 0;
    const str = text.replace(/\s+/g, '').substring(0, 64);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'sentinel-' + Math.abs(hash);
}

function lockAndHighlight(results, color) {
    if (!results || !document.body) return;
    
    // Inject Neural Highlighting CSS
    if (!document.getElementById('sentinel-forensic-v4-css')) {
        const style = document.createElement('style');
        style.id = 'sentinel-forensic-v4-css';
        style.textContent = `
            .sentinel-alert-active {
                background-color: ${color}22 !important;
                border-bottom: 2px dashed ${color} !important;
                cursor: help !important;
                transition: all 0.3s ease;
                display: inline;
            }
            .sentinel-alert-active:hover { background-color: ${color}44 !important; }
            .sentinel-node-focus { 
                outline: 4px solid #3b82f6 !important; 
                background: rgba(59,130,246,0.3) !important;
                scroll-margin: 100px;
            }
        `;
        document.head.appendChild(style);
    }

    const unfairSentences = results.filter(r => r.label === 'Unfair');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let nodes = [];
    let n; while(n = walker.nextNode()) {
        const parent = n.parentNode.nodeName;
        if (!['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT'].includes(parent)) {
            nodes.push(n);
        }
    }

    unfairSentences.forEach(res => {
        const target = res.text.trim();
        if (target.length < 20) return;

        nodes.forEach(node => {
            const content = node.nodeValue;
            if (content && content.includes(target)) {
                const span = document.createElement('span');
                span.className = 'sentinel-alert-active';
                span.title = `FORENSIC ALERT: ${res.reason}`;
                span.dataset.sentinelFingerprint = getSentenceId(target);

                const fragment = document.createDocumentFragment();
                const parts = content.split(target);
                parts.forEach((p, i) => {
                    fragment.appendChild(document.createTextNode(p));
                    if (i < parts.length - 1) {
                        const s = span.cloneNode(true);
                        s.textContent = target;
                        fragment.appendChild(s);
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            }
        });
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getText") sendResponse({ text: document.body.innerText });
    if (msg.action === "highlight") lockAndHighlight(msg.results, msg.riskColor);
    if (msg.action === "scrollTo") {
        const targetId = getSentenceId(msg.text.trim());
        const el = document.querySelector(`[data-sentinel-fingerprint="${targetId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('sentinel-node-focus');
            setTimeout(() => el.classList.remove('sentinel-node-focus'), 3000);
        }
    }
    return true;
});
