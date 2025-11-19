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
    const extensionEnabledCheckbox = document.getElementById('extension-enabled');

    chrome.storage.sync.get(['color', 'posicionPanel', 'geminiApiKey', 'whitelist', 'blacklist', 'extensionEnabled'], datos => {
        if (datos.color) colorSelect.value = datos.color;
        if (datos.posicionPanel) positionSelect.value = datos.posicionPanel;
        if (datos.geminiApiKey) geminiApiKeyInput.value = datos.geminiApiKey;
        if (datos.whitelist) whitelistInput.value = datos.whitelist.join('\n');
        if (datos.blacklist) blacklistInput.value = datos.blacklist.join('\n');
        extensionEnabledCheckbox.checked = datos.extensionEnabled !== false; // Activado por defecto
    });

    guardarBtn.addEventListener('click', () => {
        const whitelist = whitelistInput.value.split('\n').map(d => d.trim()).filter(Boolean);
        const blacklist = blacklistInput.value.split('\n').map(d => d.trim()).filter(Boolean);
        chrome.storage.sync.set({
            color: colorSelect.value,
            posicionPanel: positionSelect.value,
            geminiApiKey: geminiApiKeyInput.value,
            extensionEnabled: extensionEnabledCheckbox.checked,
            whitelist, // Mantener whitelist y blacklist
            blacklist
        }, () => {
            estadoGuardado.textContent = 'Opciones guardadas.';
            setTimeout(() => { estadoGuardado.textContent = ''; }, 2000);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { tipo: 'actualizarPreferencias' });
            });
        });
    });

    // --- CORRECCIÓN: Guardar estado del interruptor al cambiar ---
    extensionEnabledCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ extensionEnabled: extensionEnabledCheckbox.checked }, () => {
            // Notificar a las pestañas activas sobre el cambio de estado
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { tipo: 'actualizarPreferencias' }).catch(() => {}));
            });
        });
    });

    // --- PESTAÑA DE ESTADÍSTICAS ---
    const statsPeriodSelect = document.getElementById('stats-period');
    const downloadTxtBtn = document.getElementById('downloadStatsBtn');
    const downloadImageBtn = document.getElementById('downloadImageBtn');
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
                animation: false, // <-- Desactivar animación
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
                animation: false, // <-- Desactivar animación
                plugins: {
                    legend: { display: false },
                }
            }
        });
    }

    statsPeriodSelect.addEventListener('change', loadStats);
    
    downloadTxtBtn.addEventListener('click', () => {
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

    // --- NUEVO ENFOQUE: COMPOSICIÓN MANUAL DE IMAGEN (MÁS ROBUSTO) ---
    downloadImageBtn.addEventListener('click', () => {
        // 1. Crear un canvas temporal para construir la imagen
        const canvas = document.createElement('canvas');
        const statsTab = document.getElementById('stats');
        const width = statsTab.offsetWidth;
        const height = statsTab.offsetHeight; // Usamos la altura completa de la pestaña
        canvas.width = width * 2; // Aumentar resolución para mejor calidad
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2); // Escalar el contexto

        // 2. Dibujar el fondo
        ctx.fillStyle = '#202124';
        ctx.fillRect(0, 0, width, height);

        // 3. Dibujar los gráficos
        const detectionsImg = new Image();
        const carefulnessImg = new Image();
        detectionsImg.src = detectionsChart.toBase64Image();
        carefulnessImg.src = carefulnessChart.toBase6_4Image();

        // 4. Esperar a que las imágenes de los gráficos carguen
        const promises = [
            new Promise(resolve => detectionsImg.onload = resolve),
            new Promise(resolve => carefulnessImg.onload = resolve)
        ];

        Promise.all(promises).then(() => {
            // 5. Dibujar todo en el canvas temporal
            ctx.fillStyle = '#e8eaed';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Resumen de Actividad', width / 2, 30);

            const detectionsCanvas = document.getElementById('detectionsChart');
            ctx.drawImage(detectionsImg, detectionsCanvas.offsetLeft, detectionsCanvas.offsetTop, detectionsCanvas.width, detectionsCanvas.height);

            ctx.font = '14px sans-serif';
            ctx.fillText('Top Dominios Detectados', width / 2, 230);
            
            const topDomainsList = document.getElementById('top-domains-list');
            const domainItems = topDomainsList.querySelectorAll('li');
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            domainItems.forEach((item, index) => {
                ctx.fillText(item.innerText.replace('\t', ' - '), 60, 260 + (index * 20));
            });

            const carefulnessCanvas = document.getElementById('carefulnessChart');
            ctx.drawImage(carefulnessImg, carefulnessCanvas.offsetLeft, carefulnessCanvas.offsetTop, carefulnessCanvas.width, carefulnessCanvas.height);

            // 6. Descargar la imagen final
            chrome.downloads.download({ url: canvas.toDataURL('image/png'), filename: 'informe-estadisticas-ulock.png' });
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