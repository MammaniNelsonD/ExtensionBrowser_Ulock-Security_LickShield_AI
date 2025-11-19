// --- INICIALIZACIÓN DE ESTADÍSTICAS ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get('stats', (data) => {
        if (!data.stats) {
            chrome.storage.local.set({
                stats: {
                    detections: [], // { type: 'peligroso'/'dudoso', domain: '..', date: timestamp }
                    aiAnalyses: []  // { date: timestamp }
                }
            });
        }
    });

    // --- CORRECCIÓN CLAVE ---
    // Establecer el icono por defecto al instalar y añadir un callback vacío para evitar el error.
    chrome.action.setIcon({
        path: {
            "16": "icons/icon16.png",
            "48": "icons/icon48.png",
            "128": "icons/icon128.png"
        }
    }, () => { 
        if (chrome.runtime.lastError) {
            // Error esperado en ciertos contextos, se puede ignorar de forma segura.
        }
    });
});

// --- MANEJO DE MENSAJES ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.tipo === 'analizarConGemini') {
        const { url, apiKey } = request;
        if (!apiKey) {
            sendResponse({ error: 'No has configurado tu API Key de Gemini.' });
            return true;
        }
        // --- CORRECCIÓN ---
        // 1. Usar el nombre completo del modelo para asegurar compatibilidad.
        // 2. Usar 'v1beta' que es el endpoint correcto para los modelos más recientes como gemini-1.5-flash.
        // --- CORRECCIÓN FINAL ---
        // Usamos el nombre del modelo del 'curl' que te funcionó.
        const model = 'gemini-2.0-flash';
        const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `Analiza la siguiente URL y dime si es segura o peligrosa, en base a su estructura. Explica los riesgos potenciales en un lenguaje muy sencillo y directo para un usuario no técnico. Tu respuesta debe ser concisa. Dame una recomendación clara de si debo hacer clic o no. La URL es: ${url}`;
        fetch(apiURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        })
        .then(async (response) => {
            if (!response.ok) {
                // --- CORRECCIÓN ---
                // Leemos el cuerpo del error para obtener más detalles del 404.
                // Google a menudo envía un JSON con información útil aquí.
                let errorDetails = `Error HTTP: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.error?.message || JSON.stringify(errorData);
                } catch (e) {
                    // No hacer nada si el cuerpo del error no es JSON.
                }
                throw new Error(errorDetails);
            }
            return response.json();
        })
        .then(data => {
            const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (analysis) {
                sendResponse({ analysis });
            } else {
                throw new Error('La respuesta de la IA fue bloqueada o no tuvo el formato esperado.');
            }
        })
        .catch(error => {
            sendResponse({ error: `No se pudo contactar con la IA. Detalles: ${error.message}` });
        });
        return true;

    } else if (request.tipo === 'logEvent') {
        chrome.storage.local.get('stats', (data) => {
            const stats = data.stats;
            if (request.eventType === 'detection') {
                stats.detections.push({ type: request.riesgo, domain: request.domain, date: Date.now() });
            } else if (request.eventType === 'ai_analysis') {
                stats.aiAnalyses.push({ date: Date.now() });
            }
            chrome.storage.local.set({ stats });
        });
        return true;

    } else if (request.tipo === 'getStats') {
        chrome.storage.local.get('stats', (data) => {
            const stats = processStats(data.stats || { detections: [], aiAnalyses: [] }, request.period);
            sendResponse(stats);
        });
        return true;

    } else if (request.tipo === 'resetStats') {
        chrome.storage.local.set({
            stats: { detections: [], aiAnalyses: [] }
        }, () => sendResponse({ success: true }));
        return true;
    }
});

function processStats(stats, period) {
    const now = new Date();
    let startTime;
    if (period === 'week') startTime = new Date(now.setDate(now.getDate() - 7));
    else if (period === 'month') startTime = new Date(now.setMonth(now.getMonth() - 1));
    else if (period === 'year') startTime = new Date(now.setFullYear(now.getFullYear() - 1));
    else startTime = new Date(0);

    const filteredDetections = stats.detections.filter(d => new Date(d.date) >= startTime);
    const filteredAiAnalyses = stats.aiAnalyses.filter(a => new Date(a.date) >= startTime);

    const detectionsCount = { peligroso: 0, dudoso: 0 };
    const domainCounts = {};
    filteredDetections.forEach(d => {
        detectionsCount[d.type]++;
        domainCounts[d.domain] = (domainCounts[d.domain] || 0) + 1;
    });

    const topDomains = Object.entries(domainCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([domain, count]) => ({ domain, count }));

    const totalDetections = detectionsCount.peligroso + detectionsCount.dudoso;
    const analyzedCount = filteredAiAnalyses.length;
    const score = totalDetections > 0 ? Math.round((analyzedCount / totalDetections) * 100) : 100;

    return {
        detections: detectionsCount,
        topDomains: topDomains,
        carefulness: {
            score: score,
            analyzed: analyzedCount,
            notAnalyzed: Math.max(0, totalDetections - analyzedCount)
        }
    };
}