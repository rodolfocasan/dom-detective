// content/network-panel.js





let networkPanel = null;
let refreshInterval = null;
let currentTabId = null;
let isCapturing = false;
let currentOpenRequestId = null;
let lastRequestsCount = 0;
let isFullscreen = false;
let confirmModal = null;


async function initAfterReload() {
    const result = await chrome.storage.local.get(['panelShouldBeOpen']);
    if (result.panelShouldBeOpen) {
        await chrome.storage.local.remove('panelShouldBeOpen');

        setTimeout(() => {
            openNetworkPanel();
            chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (response) => {
                if (response && response.tabId) {
                    currentTabId = response.tabId;
                    startRefreshing();
                    displayRequests();
                }
            });
        }, 1000);
    }
}
initAfterReload();


function openNetworkPanel() {
    if (networkPanel) {
        closeNetworkPanel();
    }

    createNetworkPanel();
    checkMonitoringState();
}


async function checkMonitoringState() {
    chrome.runtime.sendMessage({ action: 'isMonitoring' }, (response) => {
        if (response && response.isMonitoring) {
            chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, (tabResponse) => {
                if (tabResponse && tabResponse.tabId) {
                    currentTabId = tabResponse.tabId;
                    isCapturing = true;
                    startRefreshing();
                    displayRequests();
                }
            });
        } else {
            showInitialState();
        }
    });
}


function createNetworkPanel() {
    networkPanel = document.createElement('div');
    networkPanel.className = 'dd-network-panel';
    networkPanel.innerHTML = getNetworkPanelHTML();

    document.body.appendChild(networkPanel);
    attachEventListeners();
}


function getNetworkPanelHTML() {
    return `
        <div class="dd-network-header">
            <h2 class="dd-network-title">Fetch & XHR Monitor</h2>
            <div class="dd-network-header-controls">
                <button class="dd-network-maximize" id="dd-maximize-panel" title="Maximizar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    </svg>
                </button>
                <button class="dd-network-close" id="dd-close-panel">×</button>
            </div>
        </div>
        <div class="dd-network-content" id="dd-network-content">
        </div>
    `;
}


function showInitialState() {
    const content = document.getElementById('dd-network-content');
    if (!content) return;

    content.innerHTML = `
        <div class="dd-network-empty">
            <p class="dd-network-empty-text">Presiona "Iniciar análisis" para capturar todas las solicitudes de red de esta página</p>
            <button class="dd-network-start-btn" id="dd-start-monitoring">Iniciar análisis</button>
        </div>
    `;

    const startBtn = document.getElementById('dd-start-monitoring');
    if (startBtn) {
        startBtn.addEventListener('click', startAnalysis);
    }
}


async function startAnalysis() {
    const content = document.getElementById('dd-network-content');
    content.innerHTML = `
        <div class="dd-network-empty">
            <p class="dd-network-empty-text">Iniciando captura de red...</p>
        </div>
    `;

    chrome.runtime.sendMessage({ action: 'getCurrentTabId' }, async (response) => {
        if (!response || !response.tabId) {
            content.innerHTML = `
                <div class="dd-network-empty">
                    <p class="dd-network-empty-text" style="color: #fca5a5;">Error al obtener información del tab</p>
                    <button class="dd-network-start-btn" id="dd-start-monitoring">Reintentar</button>
                </div>
            `;
            const retryBtn = document.getElementById('dd-start-monitoring');
            if (retryBtn) {
                retryBtn.addEventListener('click', startAnalysis);
            }
            return;
        }

        currentTabId = response.tabId;

        chrome.runtime.sendMessage({ action: 'clearNetworkRequests' });

        chrome.runtime.sendMessage({
            action: 'startNetworkMonitoring',
            tabId: currentTabId
        }, async (response) => {
            if (response && response.success) {
                console.log('[DOM Detective] Monitoreo iniciado correctamente');

                await chrome.storage.local.set({ panelShouldBeOpen: true });

                content.innerHTML = `
                    <div class="dd-network-empty">
                        <p class="dd-network-empty-text">Recargando página para iniciar captura...</p>
                    </div>
                `;

                setTimeout(() => {
                    location.reload();
                }, 800);
            } else {
                content.innerHTML = `
                    <div class="dd-network-empty">
                        <p class="dd-network-empty-text" style="color: #fca5a5;">Error al iniciar el monitoreo. Intenta de nuevo.</p>
                        <button class="dd-network-start-btn" id="dd-start-monitoring">Reintentar</button>
                    </div>
                `;

                const retryBtn = document.getElementById('dd-start-monitoring');
                if (retryBtn) {
                    retryBtn.addEventListener('click', startAnalysis);
                }
            }
        });
    });
}


async function displayRequests() {
    const content = document.getElementById('dd-network-content');
    if (!content) return;

    chrome.runtime.sendMessage({ action: 'getNetworkRequests' }, (response) => {
        if (!response || !response.requests) {
            return;
        }

        const requests = response.requests;

        if (requests.length === 0) {
            lastRequestsCount = 0;
            removeContentEventListener(); // Limpiar listeners antes de cambiar contenido

            content.innerHTML = `
                <div class="dd-network-empty">
                    <p class="dd-network-empty-text">Capturando solicitudes de red...</p>
                    <p class="dd-network-empty-subtext">Esperando actividad en la página</p>
                    <button class="dd-network-stop-btn" id="dd-stop-monitoring">Detener análisis</button>
                </div>
            `;

            const stopBtn = document.getElementById('dd-stop-monitoring');
            if (stopBtn) {
                stopBtn.addEventListener('click', showStopConfirmation);
            }
            return;
        }

        if (isCapturing && requests.length === lastRequestsCount) {
            return;
        }

        lastRequestsCount = requests.length;

        const scrollPosition = content.scrollTop;

        // Limpiar listeners antes de actualizar el contenido
        if (!isCapturing) {
            removeContentEventListener();
        }

        let html = '<div class="dd-network-controls">';

        if (isCapturing) {
            html += '<button class="dd-network-stop-btn" id="dd-stop-monitoring">Detener análisis</button>';
        } else {
            html += '<button class="dd-network-restart-btn" id="dd-restart-monitoring">Volver a iniciar análisis</button>';
        }

        html += `<span class="dd-network-count">${requests.length} solicitudes capturadas</span>`;
        html += '</div>';

        html += '<div class="dd-network-requests">';

        requests.forEach(request => {
            const statusClass = request.status >= 200 && request.status < 300 ? 'success' :
                request.status >= 400 ? 'error' : 'warning';

            const isOpen = currentOpenRequestId === request.id;

            html += `
                <div class="dd-request-item" data-request-id="${request.id}">
                    <div class="dd-request-header ${!isCapturing ? 'dd-clickable' : ''}" data-toggle-id="${request.id}">
                        <div class="dd-request-info">
                            <div class="dd-request-url">${escapeHTML(request.url)}</div>
                            <div class="dd-request-meta">
                                <span class="dd-request-method">${request.method}</span>
                                ${request.status ? `<span class="dd-request-status ${statusClass}">${request.status}</span>` : ''}
                                ${request.duration ? `<span>${request.duration}ms</span>` : ''}
                                <span>${request.type.toUpperCase()}</span>
                            </div>
                        </div>
                        ${!isCapturing ? '<span class="dd-request-toggle">▼</span>' : '<span class="dd-request-capturing">Capturando...</span>'}
                    </div>
                    ${!isCapturing ? `<div class="dd-request-details ${isOpen ? 'active' : ''}" id="dd-details-${request.id}">${getRequestDetailsHTML(request)}</div>` : ''}
                </div>
            `;
        });

        html += '</div>';
        content.innerHTML = html;

        content.scrollTop = scrollPosition;

        const stopBtn = document.getElementById('dd-stop-monitoring');
        if (stopBtn) {
            stopBtn.addEventListener('click', showStopConfirmation);
        }

        const restartBtn = document.getElementById('dd-restart-monitoring');
        if (restartBtn) {
            restartBtn.addEventListener('click', restartAnalysis);
        }

        if (!isCapturing) {
            attachRequestToggleListeners();
        }
    });
}


// Variable global para manejar el listener de delegación
let contentEventListener = null;

function attachRequestToggleListeners() {
    // Remover listener previo si existe
    removeContentEventListener();

    const content = document.getElementById('dd-network-content');
    if (!content) return;

    // Usar delegación de eventos en el contenedor principal
    contentEventListener = function (e) {
        try {
            if (!e || !e.target) return;

            // Verificar que el evento viene de nuestro panel
            if (!e.target.closest || !e.target.closest('#dd-network-content')) {
                return;
            }

            // Manejar click en botón de experimentar
            const testButton = e.target.closest('.dd-test-resource-btn[data-resource-id]');
            if (testButton) {
                e.stopPropagation();
                e.preventDefault();
                const requestId = testButton.getAttribute('data-resource-id');
                console.log('[DOM Detective] Click en Experimentar recurso, ID:', requestId);
                if (requestId) {
                    openResourceTester(requestId);
                }
                return;
            }

            // Manejar click en tab
            const tab = e.target.closest('.dd-tab[data-tab-id]');
            if (tab) {
                e.stopPropagation();
                e.preventDefault();
                const requestId = tab.getAttribute('data-tab-id');
                const tabName = tab.getAttribute('data-tab-name');
                if (requestId && tabName) {
                    switchTab(requestId, tabName);
                }
                return;
            }

            // Manejar click en header para toggle
            const header = e.target.closest('.dd-request-header.dd-clickable');
            if (header) {
                // Verificar que no se hizo click en elementos internos
                if (e.target.closest('.dd-test-resource-btn') ||
                    e.target.closest('.dd-tab') ||
                    e.target.closest('.dd-request-actions')) {
                    return;
                }

                const requestId = header.getAttribute('data-toggle-id');
                if (requestId) {
                    toggleRequestDetails(requestId);
                }
                return;
            }
        } catch (error) {
            console.error('[DOM Detective] Error en event listener:', error);
        }
    };

    content.addEventListener('click', contentEventListener, true);
    console.log('[DOM Detective] Event listener de delegación adjuntado');
}

function removeContentEventListener() {
    const content = document.getElementById('dd-network-content');
    if (content && contentEventListener) {
        content.removeEventListener('click', contentEventListener, true);
        contentEventListener = null;
        console.log('[DOM Detective] Event listener de delegación removido');
    }
}


function showStopConfirmation() {
    if (confirmModal && confirmModal.parentNode) {
        confirmModal.remove();
    }

    confirmModal = document.createElement('div');
    confirmModal.className = 'dd-confirm-modal';
    confirmModal.innerHTML = `
        <div class="dd-confirm-overlay"></div>
        <div class="dd-confirm-container">
            <div class="dd-confirm-header">
                <h3 class="dd-confirm-title">Confirmar detención</h3>
            </div>
            <div class="dd-confirm-body">
                <p>¿Está seguro que desea detener el análisis?</p>
                <p class="dd-confirm-warning">Se interrumpirá la captura actual y solo se quedarán los datos registrados hasta ahora.</p>
            </div>
            <div class="dd-confirm-footer">
                <button class="dd-confirm-btn dd-confirm-cancel" id="dd-confirm-cancel">Cancelar</button>
                <button class="dd-confirm-btn dd-confirm-accept" id="dd-confirm-accept">Aceptar</button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);

    const cancelBtn = document.getElementById('dd-confirm-cancel');
    const acceptBtn = document.getElementById('dd-confirm-accept');
    const overlay = confirmModal.querySelector('.dd-confirm-overlay');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeConfirmModal);
    }

    if (overlay) {
        overlay.addEventListener('click', closeConfirmModal);
    }

    if (acceptBtn) {
        acceptBtn.addEventListener('click', async () => {
            closeConfirmModal();
            await stopAnalysis();
        });
    }
}


function closeConfirmModal() {
    if (confirmModal && confirmModal.parentNode) {
        confirmModal.remove();
        confirmModal = null;
    }
}


async function stopAnalysis() {
    await chrome.storage.local.remove('panelShouldBeOpen');

    if (currentTabId) {
        chrome.runtime.sendMessage({
            action: 'stopNetworkMonitoring',
            tabId: currentTabId
        });
    }

    stopRefreshing();
    isCapturing = false;

    // Limpiar listeners antes de mostrar las requests detenidas
    removeContentEventListener();

    displayRequests();
}


async function restartAnalysis() {
    currentOpenRequestId = null;
    lastRequestsCount = 0;
    await chrome.storage.local.set({ panelShouldBeOpen: true });
    location.reload();
}


function getRequestDetailsHTML(request) {
    return `
        <div class="dd-tabs">
            <button class="dd-tab active" data-tab-id="${request.id}" data-tab-name="headers">Headers</button>
            <button class="dd-tab" data-tab-id="${request.id}" data-tab-name="payload">Payload</button>
            <button class="dd-tab" data-tab-id="${request.id}" data-tab-name="preview">Preview</button>
            <button class="dd-tab" data-tab-id="${request.id}" data-tab-name="response">Response</button>
            <button class="dd-tab" data-tab-id="${request.id}" data-tab-name="cookies">Cookies</button>
        </div>
        
        <div class="dd-tab-content active" id="dd-tab-headers-${request.id}">
            ${getHeadersTabContent(request)}
        </div>
        
        <div class="dd-tab-content" id="dd-tab-payload-${request.id}">
            ${getPayloadTabContent(request)}
        </div>
        
        <div class="dd-tab-content" id="dd-tab-preview-${request.id}">
            ${getPreviewTabContent(request)}
        </div>
        
        <div class="dd-tab-content" id="dd-tab-response-${request.id}">
            ${getResponseTabContent(request)}
        </div>
        
        <div class="dd-tab-content" id="dd-tab-cookies-${request.id}">
            ${getCookiesTabContent(request)}
        </div>
        
        <div class="dd-request-actions">
            <button class="dd-test-resource-btn" data-resource-id="${request.id}">
                Experimentar recurso
            </button>
        </div>
    `;
}


function getHeadersTabContent(request) {
    let html = '';

    html += '<div class="dd-info-section">';
    html += '<div class="dd-section-title">General</div>';

    html += '<div class="dd-info-group">';
    html += '<div class="dd-info-label">Request URL</div>';
    html += `<div class="dd-info-value">${escapeHTML(request.url)}</div>`;
    html += '</div>';

    html += '<div class="dd-info-group">';
    html += '<div class="dd-info-label">Request Method</div>';
    html += `<div class="dd-info-value">${request.method}</div>`;
    html += '</div>';

    if (request.status) {
        html += '<div class="dd-info-group">';
        html += '<div class="dd-info-label">Status Code</div>';
        html += `<div class="dd-info-value">${request.status} ${request.statusText || ''}</div>`;
        html += '</div>';
    }

    if (request.remoteAddress) {
        html += '<div class="dd-info-group">';
        html += '<div class="dd-info-label">Remote Address</div>';
        html += `<div class="dd-info-value">${escapeHTML(request.remoteAddress)}</div>`;
        html += '</div>';
    }

    if (request.referrerPolicy) {
        html += '<div class="dd-info-group">';
        html += '<div class="dd-info-label">Referrer Policy</div>';
        html += `<div class="dd-info-value">${request.referrerPolicy}</div>`;
        html += '</div>';
    }

    html += '</div>';

    if (Object.keys(request.responseHeaders || {}).length > 0) {
        html += '<div class="dd-info-section">';
        html += '<div class="dd-section-title">Response Headers</div>';
        html += '<div class="dd-headers-list">';
        Object.entries(request.responseHeaders).sort().forEach(([key, value]) => {
            html += `
                <div class="dd-header-item">
                    <div class="dd-header-key">${escapeHTML(key)}</div>
                    <div class="dd-header-value">${escapeHTML(String(value))}</div>
                </div>
            `;
        });
        html += '</div>';
        html += '</div>';
    }

    if (Object.keys(request.requestHeaders || {}).length > 0) {
        html += '<div class="dd-info-section">';
        html += '<div class="dd-section-title">Request Headers</div>';
        html += '<div class="dd-headers-list">';
        Object.entries(request.requestHeaders).sort().forEach(([key, value]) => {
            html += `
                <div class="dd-header-item">
                    <div class="dd-header-key">${escapeHTML(key)}</div>
                    <div class="dd-header-value">${escapeHTML(String(value))}</div>
                </div>
            `;
        });
        html += '</div>';
        html += '</div>';
    }

    return html;
}


function getPayloadTabContent(request) {
    let html = '';

    if (Object.keys(request.queryParams || {}).length > 0) {
        html += '<div class="dd-info-section">';
        html += '<div class="dd-section-title">Query String Parameters</div>';
        html += '<div class="dd-headers-list">';
        Object.entries(request.queryParams).forEach(([key, value]) => {
            html += `
                <div class="dd-header-item">
                    <div class="dd-header-key">${escapeHTML(key)}</div>
                    <div class="dd-header-value">${escapeHTML(String(value))}</div>
                </div>
            `;
        });
        html += '</div>';
        html += '</div>';
    }

    if (request.requestBody) {
        html += '<div class="dd-info-section">';
        html += '<div class="dd-section-title">Request Payload</div>';

        try {
            const parsed = typeof request.requestBody === 'string' ?
                JSON.parse(request.requestBody) : request.requestBody;

            if (typeof parsed === 'object') {
                html += '<div class="dd-headers-list">';
                Object.entries(parsed).forEach(([key, value]) => {
                    html += `
                        <div class="dd-header-item">
                            <div class="dd-header-key">${escapeHTML(key)}</div>
                            <div class="dd-header-value">${escapeHTML(JSON.stringify(value))}</div>
                        </div>
                    `;
                });
                html += '</div>';
            } else {
                html += `<div class="dd-json-viewer">${formatJSON(request.requestBody)}</div>`;
            }
        } catch {
            html += `<div class="dd-json-viewer">${escapeHTML(request.requestBody)}</div>`;
        }

        html += '</div>';
    }

    if (!request.requestBody && Object.keys(request.queryParams || {}).length === 0) {
        html = '<p class="dd-network-empty-text">No hay datos de payload</p>';
    }

    return html;
}


function getPreviewTabContent(request) {
    if (!request.responseData) {
        return '<p class="dd-network-empty-text">No hay vista previa disponible</p>';
    }

    let html = '<div class="dd-info-section">';

    if (typeof request.responseData === 'object') {
        html += '<div class="dd-json-preview">';
        html += formatJSONPreview(request.responseData);
        html += '</div>';
    } else {
        html += `<div class="dd-json-viewer">${escapeHTML(String(request.responseData))}</div>`;
    }

    html += '</div>';
    return html;
}


function getResponseTabContent(request) {
    if (request.error) {
        return `<p class="dd-network-empty-text" style="color: #fca5a5;">Error: ${escapeHTML(request.error)}</p>`;
    }

    if (!request.responseData) {
        return '<p class="dd-network-empty-text">Esperando respuesta...</p>';
    }

    return `<div class="dd-json-viewer">${formatJSON(request.responseData)}</div>`;
}


function getCookiesTabContent(request) {
    if (!request.cookies || request.cookies.length === 0) {
        return '<p class="dd-network-empty-text">No hay cookies asociadas a esta solicitud</p>';
    }

    let html = '<div class="dd-info-section">';
    html += '<div class="dd-cookies-table">';

    html += `
        <div class="dd-cookie-header">
            <div class="dd-cookie-cell">Name</div>
            <div class="dd-cookie-cell">Value</div>
            <div class="dd-cookie-cell">Domain</div>
            <div class="dd-cookie-cell">Path</div>
            <div class="dd-cookie-cell">Expires</div>
            <div class="dd-cookie-cell">HttpOnly</div>
            <div class="dd-cookie-cell">Secure</div>
        </div>
    `;

    request.cookies.forEach(cookie => {
        const expires = cookie.expires ? new Date(cookie.expires * 1000).toLocaleString() : 'Session';
        html += `
            <div class="dd-cookie-row">
                <div class="dd-cookie-cell">${escapeHTML(cookie.name)}</div>
                <div class="dd-cookie-cell">${escapeHTML(cookie.value)}</div>
                <div class="dd-cookie-cell">${escapeHTML(cookie.domain)}</div>
                <div class="dd-cookie-cell">${escapeHTML(cookie.path)}</div>
                <div class="dd-cookie-cell">${expires}</div>
                <div class="dd-cookie-cell">${cookie.httpOnly ? 'Yes' : 'No'}</div>
                <div class="dd-cookie-cell">${cookie.secure ? 'Yes' : 'No'}</div>
            </div>
        `;
    });

    html += '</div>';
    html += '</div>';

    return html;
}


function formatJSON(data) {
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            return escapeHTML(data);
        }
    }

    if (typeof data === 'object') {
        return escapeHTML(JSON.stringify(data, null, 2));
    }

    return escapeHTML(String(data));
}


function formatJSONPreview(data, level = 0) {
    if (level > 3) return escapeHTML(JSON.stringify(data));

    let html = '<div class="dd-json-tree">';

    if (Array.isArray(data)) {
        html += `<span class="dd-json-bracket">[</span>`;
        data.forEach((item, index) => {
            html += '<div class="dd-json-item">';
            html += `<span class="dd-json-key">${index}:</span> `;
            if (typeof item === 'object') {
                html += formatJSONPreview(item, level + 1);
            } else {
                html += `<span class="dd-json-value">${escapeHTML(JSON.stringify(item))}</span>`;
            }
            html += '</div>';
        });
        html += `<span class="dd-json-bracket">]</span>`;
    } else if (typeof data === 'object' && data !== null) {
        html += `<span class="dd-json-bracket">{</span>`;
        Object.entries(data).forEach(([key, value]) => {
            html += '<div class="dd-json-item">';
            html += `<span class="dd-json-key">${escapeHTML(key)}:</span> `;
            if (typeof value === 'object' && value !== null) {
                html += formatJSONPreview(value, level + 1);
            } else {
                html += `<span class="dd-json-value">${escapeHTML(JSON.stringify(value))}</span>`;
            }
            html += '</div>';
        });
        html += `<span class="dd-json-bracket">}</span>`;
    }

    html += '</div>';
    return html;
}


function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}


function toggleRequestDetails(requestId) {
    if (currentOpenRequestId && currentOpenRequestId !== requestId) {
        const prevDetails = document.getElementById(`dd-details-${currentOpenRequestId}`);
        if (prevDetails) {
            prevDetails.classList.remove('active');
        }
    }

    const details = document.getElementById(`dd-details-${requestId}`);
    if (details) {
        const isOpening = !details.classList.contains('active');
        details.classList.toggle('active');
        currentOpenRequestId = isOpening ? requestId : null;
    }
}


function switchTab(requestId, tabName) {
    const detailsContainer = document.getElementById(`dd-details-${requestId}`);
    if (!detailsContainer) return;

    const tabs = detailsContainer.querySelectorAll('.dd-tab');
    const contents = detailsContainer.querySelectorAll('.dd-tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const activeTab = detailsContainer.querySelector(`.dd-tab[data-tab-name="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    const targetContent = document.getElementById(`dd-tab-${tabName}-${requestId}`);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}


function openResourceTester(requestId) {
    if (!requestId) {
        console.error('[DOM Detective] requestId no proporcionado');
        showNotification('[DOM Detective] Error: ID de solicitud no válido');
        return;
    }

    console.log('[DOM Detective] Abriendo tester para request ID:', requestId);

    chrome.runtime.sendMessage({ action: 'getNetworkRequests' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[DOM Detective] Error de runtime:', chrome.runtime.lastError);
            showNotification('[DOM Detective] Error de comunicación con el background');
            return;
        }

        if (!response) {
            console.error('[DOM Detective] No se recibió respuesta del background');
            showNotification('[DOM Detective] Error: Sin respuesta del background');
            return;
        }

        if (!response.requests || !Array.isArray(response.requests)) {
            console.error('[DOM Detective] Formato de respuesta inválido:', response);
            showNotification('[DOM Detective] Error: Datos de solicitudes inválidos');
            return;
        }

        console.log('[DOM Detective] Solicitudes recibidas:', response.requests.length);

        const request = response.requests.find(r => String(r.id) === String(requestId));

        if (!request) {
            console.error('[DOM Detective] No se encontró la solicitud con ID:', requestId);
            console.log('[DOM Detective] IDs disponibles:', response.requests.map(r => r.id));
            showNotification('[DOM Detective] No se encontró el recurso solicitado');
            return;
        }

        console.log('[DOM Detective] Request encontrado:', request);

        try {
            // Hacer una copia profunda limpia del request
            const requestCopy = {
                id: request.id,
                type: request.type,
                method: request.method,
                url: request.url,
                status: request.status,
                statusText: request.statusText,
                requestHeaders: request.requestHeaders ? JSON.parse(JSON.stringify(request.requestHeaders)) : {},
                responseHeaders: request.responseHeaders ? JSON.parse(JSON.stringify(request.responseHeaders)) : {},
                requestBody: request.requestBody,
                responseData: request.responseData,
                queryParams: request.queryParams ? JSON.parse(JSON.stringify(request.queryParams)) : {},
                cookies: request.cookies ? JSON.parse(JSON.stringify(request.cookies)) : [],
                duration: request.duration,
                timestamp: request.timestamp
            };

            console.log('[DOM Detective] Request copiado para tester:', requestCopy);

            // Usar setTimeout para asegurar que el contexto esté limpio
            setTimeout(() => {
                if (typeof window.initResourceTester === 'function') {
                    window.initResourceTester(requestCopy);
                } else {
                    console.error('[DOM Detective] initResourceTester no está disponible');
                    showNotification('[DOM Detective] Error al inicializar el experimentador');
                }
            }, 10);

        } catch (error) {
            console.error('[DOM Detective] Error al procesar el request:', error);
            showNotification('[DOM Detective] Error al procesar los datos');
        }
    });
}


function attachEventListeners() {
    const closeBtn = document.getElementById('dd-close-panel');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNetworkPanel);
    }

    const maximizeBtn = document.getElementById('dd-maximize-panel');
    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', toggleFullscreen);
    }
}


function toggleFullscreen() {
    if (!networkPanel) return;

    isFullscreen = !isFullscreen;

    const maximizeBtn = document.getElementById('dd-maximize-panel');

    if (isFullscreen) {
        networkPanel.classList.add('dd-network-panel-fullscreen');
        if (maximizeBtn) {
            maximizeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                </svg>
            `;
            maximizeBtn.title = 'Minimizar';
        }
    } else {
        networkPanel.classList.remove('dd-network-panel-fullscreen');
        if (maximizeBtn) {
            maximizeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            `;
            maximizeBtn.title = 'Maximizar';
        }
    }
}


async function closeNetworkPanel() {
    await chrome.storage.local.remove('panelShouldBeOpen');

    stopRefreshing();

    // Limpiar event listeners
    removeContentEventListener();

    if (currentTabId) {
        chrome.runtime.sendMessage({
            action: 'stopNetworkMonitoring',
            tabId: currentTabId
        });
        chrome.runtime.sendMessage({ action: 'clearNetworkRequests' });
    }

    currentOpenRequestId = null;
    lastRequestsCount = 0;
    isFullscreen = false;

    if (networkPanel) {
        networkPanel.remove();
        networkPanel = null;
    }

    closeConfirmModal();
}


function startRefreshing() {
    if (refreshInterval) return;

    refreshInterval = setInterval(() => {
        if (networkPanel && isCapturing) {
            displayRequests();
        }
    }, 500);
}


function stopRefreshing() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'debuggerDetached') {
        console.log('[DOM Detective] Debugger desconectado:', message.reason);
        chrome.storage.local.remove('panelShouldBeOpen');
        if (networkPanel) {
            stopRefreshing();
            isCapturing = false;
            currentOpenRequestId = null;
            lastRequestsCount = 0;
            const content = document.getElementById('dd-network-content');
            if (content) {
                content.innerHTML = `
                <div class="dd-network-empty">
                    <p class="dd-network-empty-text" style="color: #fca5a5;">El análisis se detuvo: ${message.reason}</p>
                    <button class="dd-network-start-btn" id="dd-start-monitoring">Reiniciar análisis</button>
                </div>
            `;
                const startBtn = document.getElementById('dd-start-monitoring');
                if (startBtn) {
                    startBtn.addEventListener('click', startAnalysis);
                }
            }
        }
    }

    if (message.action === 'monitoringStarted') {
        isCapturing = true;
        startRefreshing();
        displayRequests();
    }
});