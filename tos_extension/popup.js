document.getElementById("analyze").addEventListener("click", async () => {
    const btn = document.getElementById("analyze");
    const spinner = document.getElementById("spinner");
    const statusDiv = document.getElementById("status");
    const resContainer = document.getElementById("result-container");
    const summaryCard = document.getElementById("summary");
    const clauseList = document.getElementById("clause-list");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        statusDiv.innerHTML = "<b style='color:#ff4d4d;'>Error:</b> System Restricted.";
        return;
    }

    // Reset UI
    btn.disabled = true;
    spinner.style.display = "block";
    statusDiv.innerText = "Extracting Sentences...";
    resContainer.style.display = "none";
    clauseList.innerHTML = "";

    try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
        const textResponse = await chrome.tabs.sendMessage(tab.id, { action: "getText" });
        if (!textResponse || !textResponse.text) throw new Error("Zero text detected.");

        statusDiv.innerText = "AI Neural Processing...";

        const apiRes = await fetch(`${CONFIG.API_BASE_URL}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: textResponse.text })
        });

        if (!apiRes.ok) throw new Error("Server Offline.");

        const data = await apiRes.json();
        spinner.style.display = "none";
        statusDiv.innerText = "ANALYSIS COMPLETE";
        resContainer.style.display = "block";

        // --- DYNAMIC RISK ENGINE ---
        let riskColor = "#22c55e"; // Green
        let riskLevel = "SECURE";
        const score = data.risk_score;

        if (score > 75) { riskColor = "#ff4d4d"; riskLevel = "CRITICAL"; }
        else if (score > 20) { riskColor = "#fbbf24"; riskLevel = "WARNING"; }

        summaryCard.innerHTML = `
            <div style="text-align:center; margin-bottom:15px; padding:10px; background:${riskColor}11; border:1px solid ${riskColor}33; border-radius:10px;">
                <p style="font-size:10px; font-weight:900; color:${riskColor}; margin:0; letter-spacing:1px; text-transform:uppercase;">Overall Assessment</p>
                <h2 style="font-size:24px; font-weight:900; color:${riskColor}; margin:5px 0;">RISK: ${riskLevel}</h2>
                <p style="font-size:11px; color:#6b7280; margin:0;">Score: <b>${score}%</b></p>
            </div>
            <div style="height:6px; width:100%; background:#e5e7eb; border-radius:3px; overflow:hidden; margin-bottom:10px;">
                <div style="height:100%; width:${score}%; background:${riskColor}; transition:width 1s;"></div>
            </div>
            <div style="font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; font-weight:700;">
                <span>${data.total_clauses} SENTENCES SCAN</span>
                <span>${data.unfair_count} ANOMALIES</span>
            </div>
        `;

        const unfair = (data.results || []).filter(r => r.label === "Unfair");
        if (unfair.length === 0) {
            clauseList.innerHTML = `<div style="text-align:center; padding:20px; color:#22c55e; font-weight:800; font-size:11px; letter-spacing:1px;">NO ANOMALIES DETECTED.</div>`;
        } else {
            unfair.forEach(item => {
                const div = document.createElement("div");
                div.className = "clause-item";
                div.style.borderLeft = `3px solid ${riskColor}`;
                div.innerHTML = `
                    <div style="color:${riskColor}; font-size:10px; font-weight:900; margin-bottom:5px; text-transform:uppercase;">Anomaly Detected</div>
                    <div class="clause-text" style="font-size:11px; color:#374151;">"${item.text}"</div>
                    <div style="margin-top:6px; font-size:9px; color:${riskColor}; font-weight:900; text-transform:uppercase;">${item.reason}</div>
                `;
                div.onclick = () => { chrome.tabs.sendMessage(tab.id, { action: "scrollTo", text: item.text }); };
                clauseList.appendChild(div);
            });
        }

        chrome.tabs.sendMessage(tab.id, { action: "highlight", results: data.results, riskColor: riskColor });

    } catch (err) {
        spinner.style.display = "none";
        statusDiv.innerHTML = `<b style="color:#ef4444;">ERROR:</b> ${err.message}`;
    } finally {
        btn.disabled = false;
    }
});
