document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA GENERAL Y PESTAÑAS ---
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;
            tabLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            tabContents.forEach(c => c.classList.remove('active'));
            document.getElementById(tab).classList.add('active');
            
            if (tab === 'stats') {
                loadStats();
            }
        });
    });

    // --- PESTAÑA DE CONFIGURACIÓN ---
    const colorSelect = document.getElementById('colorSelect');
    const guardarBtn = document.getElementById('guardarBtn');
    const estadoGuardado = document.getElementById('estadoGuardado');
    const positionSelect = document.getElementById('panel-position');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const whitelistInput = document.getElementById('whitelist');
    const blacklistInput = document.getElementById('blacklist');

    chrome.storage.sync.get(['color', 'posicionPanel', 'geminiApiKey', 'whitelist', 'blacklist'], datos => {
        if (datos.color) colorSelect.value = datos.color;
        if (datos.posicionPanel) positionSelect.value = datos.posicionPanel;
        if (datos.geminiApiKey) geminiApiKeyInput.value = datos.geminiApiKey;
        if (datos.whitelist) whitelistInput.value = datos.whitelist.join('\n');
        if (datos.blacklist) blacklistInput.value = datos.blacklist.join('\n');
    });

    guardarBtn.addEventListener('click', () => {
        const whitelist = whitelistInput.value.split('\n').map(d => d.trim()).filter(Boolean);
        const blacklist = blacklistInput.value.split('\n').map(d => d.trim()).filter(Boolean);
        chrome.storage.sync.set({
            color: colorSelect.value,
            posicionPanel: positionSelect.value,
            geminiApiKey: geminiApiKeyInput.value,
            whitelist,
            blacklist
        }, () => {
            estadoGuardado.textContent = 'Opciones guardadas.';
            setTimeout(() => { estadoGuardado.textContent = ''; }, 2000);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { tipo: 'actualizarPreferencias' });
            });
        });
    });

    // --- PESTAÑA DE ESTADÍSTICAS ---
    const statsPeriodSelect = document.getElementById('stats-period');
    const downloadBtn = document.getElementById('downloadStatsBtn');
    const resetBtn = document.getElementById('resetStatsBtn');
    let detectionsChart, carefulnessChart;

    function loadStats() {
        const period = statsPeriodSelect.value;
        chrome.runtime.sendMessage({ tipo: 'getStats', period }, (stats) => {
            if (stats) {
                renderDetectionsChart(stats.detections);
                renderTopDomains(stats.topDomains);
                renderCarefulnessChart(stats.carefulness);
            }
        });
    }

    function renderDetectionsChart(data) {
        const ctx = document.getElementById('detectionsChart').getContext('2d');
        if (detectionsChart) detectionsChart.destroy();
        detectionsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Peligrosos', 'Dudosos'],
                datasets: [{
                    data: [data.peligroso, data.dudoso],
                    backgroundColor: ['#d93025', '#ff8f00'],
                    borderColor: '#3c4043',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { color: '#e8eaed' } },
                    title: { display: true, text: 'Protecciones Totales', color: '#e8eaed' }
                }
            }
        });
    }

    function renderTopDomains(domains) {
        const list = document.getElementById('top-domains-list');
        list.innerHTML = '';
        if (domains.length === 0) {
            list.innerHTML = '<li>Aún no hay datos.</li>';
            return;
        }
        domains.forEach(d => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${d.domain}</span><span class="count">${d.count}</span>`;
            list.appendChild(li);
        });
    }

    function renderCarefulnessChart(data) {
        document.getElementById('carefulness-score').textContent = `Puntaje: ${data.score}`;
        const ctx = document.getElementById('carefulnessChart').getContext('2d');
        if (carefulnessChart) carefulnessChart.destroy();
        carefulnessChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Análisis Realizados', 'Detecciones sin Análisis'],
                datasets: [{
                    data: [data.analyzed, data.notAnalyzed],
                    backgroundColor: ['#4285f4', '#5f6368'],
                    borderColor: '#3c4043',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                }
            }
        });
    }

    statsPeriodSelect.addEventListener('change', loadStats);
    
    downloadBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ tipo: 'getStats', period: 'all' }, (stats) => {
            let reportContent = `Informe de Seguridad - Anomalia Gemini\n`;
            reportContent += `======================================\n\n`;
            reportContent += `Resumen Total:\n`;
            reportContent += `- Enlaces Peligrosos Detectados: ${stats.detections.peligroso}\n`;
            reportContent += `- Enlaces Dudososo Detectados: ${stats.detections.dudoso}\n`;
            reportContent += `- Nivel de Cautela (Puntaje): ${stats.carefulness.score}\n\n`;
            reportContent += `Top Dominios Bloqueados:\n`;
            stats.topDomains.forEach(d => {
                reportContent += `- ${d.domain} (${d.count} veces)\n`;
            });

            const blob = new Blob([reportContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: 'informe-anomalia-gemini.txt'
            });
        });
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar todas las estadísticas? Esta acción no se puede deshacer.')) {
            chrome.runtime.sendMessage({ tipo: 'resetStats' }, () => {
                loadStats(); // Recargar para mostrar los datos reseteados
            });
        }
    });
});