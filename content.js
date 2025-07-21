let opciones = {};
let debounceTimer;

function cargarOpciones() {
    chrome.storage.sync.get(['color', 'posicionPanel', 'whitelist', 'blacklist'], (datos) => {
        opciones = datos;
    });
}

chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje.tipo === 'actualizarPreferencias') {
        cargarOpciones();
        document.querySelectorAll('[data-anomalia-riesgo]').forEach(el => {
            el.classList.remove('anomalia-peligroso', 'anomalia-dudoso', 'anomalia-seguro');
            el.removeAttribute('data-anomalia-riesgo');
            el.removeAttribute('data-anomalia-processed');
        });
        procesarEnlaces();
    }
});

const NIVEL_RIESGO = {
    SEGURO: 'seguro',
    DUDOSO: 'dudoso',
    PELIGROSO: 'peligroso'
};

function evaluarRiesgo(href) {
    try {
        const url = new URL(href);
        const hostname = url.hostname;

        const whitelist = opciones.whitelist || [];
        const blacklist = opciones.blacklist || [];
        if (whitelist.some(d => hostname.endsWith(d))) return NIVEL_RIESGO.SEGURO;
        
        // Si está en la lista negra, lo registramos y devolvemos peligroso
        if (blacklist.some(d => hostname.endsWith(d))) {
            chrome.runtime.sendMessage({ tipo: 'logEvent', eventType: 'detection', riesgo: 'peligroso', domain: hostname });
            return NIVEL_RIESGO.PELIGROSO;
        }

        const dominiosSeguros = [
            'google.com', 'microsoft.com', 'live.com', 'outlook.com', 'apple.com',
            'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com',
            'amazon.com', 'ebay.com', 'paypal.com', 'mercadolibre.com', 'github.com',
            'policiacordoba.gov.ar'
        ];
        if (dominiosSeguros.some(d => hostname.endsWith(d))) return NIVEL_RIESGO.SEGURO;

        // Lógica de detección automática
        let riesgoDetectado = NIVEL_RIESGO.SEGURO;
        
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) riesgoDetectado = NIVEL_RIESGO.PELIGROSO;
        else if ((hostname.match(/\./g) || []).length > 4) riesgoDetectado = NIVEL_RIESGO.PELIGROSO;
        else if (/[-\._]login[-\._]/.test(hostname) || /[-\._]verify[-\._]/.test(hostname)) riesgoDetectado = NIVEL_RIESGO.PELIGROSO;
        else if ([/bit\.ly/, /t\.co/, /goo\.gl/, /tinyurl\.com/].some(p => p.test(hostname))) riesgoDetectado = NIVEL_RIESGO.DUDOSO;
        else if (['.xyz', '.top', '.loan', '.zip', '.review', '.party', '.click', '.link', '.fun', '.online', '.site', '.tech'].some(tld => hostname.endsWith(tld))) riesgoDetectado = NIVEL_RIESGO.DUDOSO;
        else if (url.searchParams.has('redirect_url') || url.searchParams.has('redirect')) riesgoDetectado = NIVEL_RIESGO.DUDOSO;

        // Si se detecta un riesgo, lo registramos para las estadísticas
        if (riesgoDetectado !== NIVEL_RIESGO.SEGURO) {
            chrome.runtime.sendMessage({ tipo: 'logEvent', eventType: 'detection', riesgo: riesgoDetectado, domain: hostname });
        }

        return riesgoDetectado;

    } catch (e) {
        return NIVEL_RIESGO.SEGURO;
    }
}

function mostrarPanel(riesgo, href) {
    let panel = document.getElementById('anomalia-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'anomalia-panel';
        document.body.appendChild(panel);
    }
    const posicion = opciones.posicionPanel || 'top-right';
    panel.className = `anomalia-panel ${posicion}`;
    const mensajesRiesgo = {
        [NIVEL_RIESGO.PELIGROSO]: '🔴 Enlace Peligroso Detectado',
        [NIVEL_RIESGO.DUDOSO]: '🟠 Enlace Dudoso Detectado'
    };
    const mensaje = mensajesRiesgo[riesgo] || 'Análisis de Enlace';
    panel.innerHTML = `
        <button id="anomalia-close-btn" title="Cerrar">X</button>
        <div class="anomalia-section">
            <strong>${mensaje}</strong>
            <p><strong>URL:</strong> ${href}</p>
        </div>
        <div class="anomalia-actions">
            <button id="analizar-con-ia">Analizar con IA 🧠</button>
            <button id="analizar-con-vt">Ver en VirusTotal 🛡️</button>
        </div>
        <div id="ia-analysis-result" style="display:none; margin-top: 10px;"></div>
    `;
    panel.style.display = 'block';
    document.getElementById('anomalia-close-btn').addEventListener('click', ocultarPanel);
    document.getElementById('analizar-con-ia').addEventListener('click', () => analizarConGemini(href));
    
    document.getElementById('analizar-con-vt').addEventListener('click', () => {
        try {
            const target = new URL(href).hostname;
            const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
            const virusTotalUrl = isIpAddress
                ? `https://www.virustotal.com/gui/ip-address/${target}`
                : `https://www.virustotal.com/gui/domain/${target}`;
            window.open(virusTotalUrl, '_blank');
        } catch (e) {
            console.error('URL inválida para VirusTotal:', href);
        }
    });
}

function ocultarPanel() {
    const panel = document.getElementById('anomalia-panel');
    if (panel) panel.style.display = 'none';
}

function analizarConGemini(urlParaAnalizar) {
    // Registramos que el usuario ha iniciado un análisis de IA
    chrome.runtime.sendMessage({ tipo: 'logEvent', eventType: 'ai_analysis' });

    const resultDiv = document.getElementById('ia-analysis-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<em>Contactando con la IA...</em>';
    chrome.storage.sync.get('geminiApiKey', ({ geminiApiKey }) => {
        chrome.runtime.sendMessage(
            { tipo: 'analizarConGemini', url: urlParaAnalizar, apiKey: geminiApiKey },
            (response) => {
                if (chrome.runtime.lastError) {
                    resultDiv.innerHTML = `<strong style="color:red;">Error interno:</strong> ${chrome.runtime.lastError.message}`;
                    return;
                }
                if (response.error) {
                    resultDiv.innerHTML = `<strong style="color:red;">Error:</strong> ${response.error}`;
                } else if (response.analysis) {
                    resultDiv.innerHTML = `<strong>Análisis de IA:</strong><br>${response.analysis.replace(/\n/g, '<br>')}`;
                }
            }
        );
    });
}

function procesarEnlaces() {
    document.querySelectorAll('a[href]:not([data-anomalia-processed])').forEach(enlace => {
        enlace.setAttribute('data-anomalia-processed', 'true');
        const href = enlace.href;
        if (!href || !href.startsWith('http')) return;
        const riesgo = evaluarRiesgo(href);
        enlace.classList.remove('anomalia-peligroso', 'anomalia-dudoso', 'anomalia-seguro');
        enlace.classList.add(`anomalia-${riesgo}`);
        if (riesgo === NIVEL_RIESGO.DUDOSO || riesgo === NIVEL_RIESGO.PELIGROSO) {
            enlace.addEventListener('mouseenter', () => mostrarPanel(riesgo, href));
            enlace.addEventListener('mouseleave', () => {
                setTimeout(() => {
                    const panel = document.getElementById('anomalia-panel');
                    if (panel && !panel.matches(':hover')) {
                        ocultarPanel();
                    }
                }, 300);
            });
        }
    });
}

const debouncedProcess = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(procesarEnlaces, 500);
};

const observer = new MutationObserver(debouncedProcess);
observer.observe(document.body, { childList: true, subtree: true });

cargarOpciones();
debouncedProcess();