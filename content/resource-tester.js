// content/resource-tester.js





let testerModal = null;
let currentTestRequest = null;
let testerEventListeners = [];


window.initResourceTester = function (request) {
    if (!request) {
        console.error('[DOM Detective] No se proporcionó un request válido');
        return;
    }

    console.log('[DOM Detective] Inicializando tester con request:', request);

    // Clonar profundamente el objeto
    currentTestRequest = JSON.parse(JSON.stringify(request));

    console.log('[DOM Detective] currentTestRequest asignado:', currentTestRequest);

    // Pasar el request directamente a openTesterModal
    openTesterModal(currentTestRequest);
};


function openTesterModal(requestData) {
    closeTesterModal();

    // Asegurar que currentTestRequest tenga el valor correcto
    if (requestData) {
        currentTestRequest = requestData;
    }

    console.log('[DOM Detective] openTesterModal - currentTestRequest:', currentTestRequest);

    setTimeout(() => {
        createTesterModal();
        populateTesterForm(currentTestRequest);
    }, 50);
}


function createTesterModal() {
    if (testerModal && testerModal.parentNode) {
        testerModal.remove();
    }

    testerModal = document.createElement('div');
    testerModal.className = 'dd-tester-modal';
    testerModal.innerHTML = getTesterModalHTML();

    document.body.appendChild(testerModal);

    attachTesterEventListeners();
}


function getTesterModalHTML() {
    return `
        <div class="dd-tester-overlay" id="dd-tester-overlay"></div>
        <div class="dd-tester-container">
            <div class="dd-tester-header">
                <h3 class="dd-tester-title">Experimentar Recurso</h3>
                <button class="dd-tester-close" id="dd-tester-close">×</button>
            </div>
            
            <div class="dd-tester-content">
                <div class="dd-tester-form">
                    <div class="dd-tester-row">
                        <div class="dd-tester-field">
                            <label class="dd-tester-label">Método</label>
                            <select class="dd-tester-input dd-tester-method" id="dd-tester-method">
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                                <option value="PATCH">PATCH</option>
                            </select>
                        </div>
                        
                        <div class="dd-tester-field dd-tester-field-full">
                            <label class="dd-tester-label">URL</label>
                            <input type="text" class="dd-tester-input" id="dd-tester-url" />
                        </div>
                    </div>
                    
                    <div class="dd-tester-field">
                        <label class="dd-tester-label">Headers</label>
                        <textarea class="dd-tester-textarea" id="dd-tester-headers" rows="6"></textarea>
                    </div>
                    
                    <div class="dd-tester-field">
                        <label class="dd-tester-label">Body</label>
                        <textarea class="dd-tester-textarea" id="dd-tester-body" rows="8"></textarea>
                    </div>
                    
                    <div class="dd-tester-actions">
                        <button class="dd-tester-send-btn" id="dd-tester-send">Enviar solicitud</button>
                    </div>
                </div>
                
                <div class="dd-tester-response">
                    <div class="dd-tester-response-header">
                        <h4 class="dd-tester-response-title">Respuesta</h4>
                        <div class="dd-tester-response-status" id="dd-tester-status"></div>
                    </div>
                    
                    <div class="dd-tester-response-tabs">
                        <button class="dd-tester-tab active" data-tester-tab="body">Body</button>
                        <button class="dd-tester-tab" data-tester-tab="headers">Headers</button>
                    </div>
                    
                    <div class="dd-tester-response-content">
                        <div class="dd-tester-tab-content active" id="dd-tester-response-body">
                            <div class="dd-tester-empty">Esperando solicitud...</div>
                        </div>
                        <div class="dd-tester-tab-content" id="dd-tester-response-headers">
                            <div class="dd-tester-empty">Esperando solicitud...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}


function populateTesterForm(requestData) {
    console.log('[DOM Detective] Intentando popular formulario...');
    console.log('[DOM Detective] requestData recibido:', requestData);
    console.log('[DOM Detective] currentTestRequest actual:', currentTestRequest);

    // Usar el parámetro requestData si está disponible, sino usar currentTestRequest
    const dataToUse = requestData || currentTestRequest;

    if (!dataToUse) {
        console.error('[DOM Detective] No hay datos de request para popular');
        console.error('[DOM Detective] requestData:', requestData);
        console.error('[DOM Detective] currentTestRequest:', currentTestRequest);
        return;
    }

    console.log('[DOM Detective] Usando datos:', dataToUse);

    const methodSelect = document.getElementById('dd-tester-method');
    const urlInput = document.getElementById('dd-tester-url');
    const headersTextarea = document.getElementById('dd-tester-headers');
    const bodyTextarea = document.getElementById('dd-tester-body');

    console.log('[DOM Detective] Elementos del formulario encontrados:', {
        methodSelect: !!methodSelect,
        urlInput: !!urlInput,
        headersTextarea: !!headersTextarea,
        bodyTextarea: !!bodyTextarea
    });

    if (methodSelect) {
        if (dataToUse.method) {
            methodSelect.value = dataToUse.method;
            console.log('[DOM Detective] Method establecido:', dataToUse.method);
        }
    }

    if (urlInput) {
        if (dataToUse.url) {
            urlInput.value = dataToUse.url;
            console.log('[DOM Detective] URL establecida:', dataToUse.url);
        }
    }

    if (headersTextarea) {
        if (dataToUse.requestHeaders && Object.keys(dataToUse.requestHeaders).length > 0) {
            try {
                const headersJSON = JSON.stringify(dataToUse.requestHeaders, null, 2);
                headersTextarea.value = headersJSON;
                console.log('[DOM Detective] Headers establecidos');
            } catch (e) {
                console.error('[DOM Detective] Error al formatear headers:', e);
                headersTextarea.value = '{}';
            }
        } else {
            headersTextarea.value = '{}';
        }
    }

    if (bodyTextarea) {
        if (dataToUse.requestBody) {
            try {
                if (typeof dataToUse.requestBody === 'object') {
                    bodyTextarea.value = JSON.stringify(dataToUse.requestBody, null, 2);
                } else if (typeof dataToUse.requestBody === 'string') {
                    try {
                        const parsed = JSON.parse(dataToUse.requestBody);
                        bodyTextarea.value = JSON.stringify(parsed, null, 2);
                    } catch {
                        bodyTextarea.value = dataToUse.requestBody;
                    }
                } else {
                    bodyTextarea.value = String(dataToUse.requestBody);
                }
                console.log('[DOM Detective] Body establecido');
            } catch (e) {
                console.error('[DOM Detective] Error al formatear body:', e);
                bodyTextarea.value = '';
            }
        } else {
            bodyTextarea.value = '';
        }
    }

    console.log('[DOM Detective] Formulario del tester populado correctamente');
}


function attachTesterEventListeners() {
    removeTesterEventListeners();

    const closeBtn = document.getElementById('dd-tester-close');
    const overlay = document.getElementById('dd-tester-overlay');
    const sendBtn = document.getElementById('dd-tester-send');

    const closeBtnHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTesterModal();
    };

    const overlayHandler = (e) => {
        if (e.target === overlay) {
            e.preventDefault();
            e.stopPropagation();
            closeTesterModal();
        }
    };

    const sendBtnHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendTestRequest();
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeBtnHandler);
        testerEventListeners.push({ element: closeBtn, event: 'click', handler: closeBtnHandler });
    }

    if (overlay) {
        overlay.addEventListener('click', overlayHandler);
        testerEventListeners.push({ element: overlay, event: 'click', handler: overlayHandler });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendBtnHandler);
        testerEventListeners.push({ element: sendBtn, event: 'click', handler: sendBtnHandler });
    }

    const testerTabs = document.querySelectorAll('.dd-tester-tab[data-tester-tab]');
    testerTabs.forEach(tab => {
        const tabHandler = function (e) {
            e.preventDefault();
            e.stopPropagation();
            const tabName = this.getAttribute('data-tester-tab');
            if (tabName) {
                switchTesterTab(tabName);
            }
        };

        tab.addEventListener('click', tabHandler);
        testerEventListeners.push({ element: tab, event: 'click', handler: tabHandler });
    });
}


function removeTesterEventListeners() {
    testerEventListeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
            element.removeEventListener(event, handler);
        }
    });
    testerEventListeners = [];
}


async function sendTestRequest() {
    const methodSelect = document.getElementById('dd-tester-method');
    const urlInput = document.getElementById('dd-tester-url');
    const headersTextarea = document.getElementById('dd-tester-headers');
    const bodyTextarea = document.getElementById('dd-tester-body');
    const statusDiv = document.getElementById('dd-tester-status');

    if (!methodSelect || !urlInput) return;

    const method = methodSelect.value;
    const url = urlInput.value.trim();

    if (!url) {
        showTesterError('Por favor ingresa una URL válida');
        return;
    }

    let headers = {};
    if (headersTextarea && headersTextarea.value.trim()) {
        try {
            headers = JSON.parse(headersTextarea.value);
        } catch (e) {
            showTesterError('Error en el formato de headers. Debe ser JSON válido.');
            return;
        }
    }

    let body = null;
    if (bodyTextarea && bodyTextarea.value.trim() && method !== 'GET') {
        body = bodyTextarea.value;
    }

    if (statusDiv) {
        statusDiv.textContent = 'Enviando...';
        statusDiv.className = 'dd-tester-response-status dd-tester-loading';
    }

    const startTime = Date.now();

    try {
        const fetchOptions = {
            method: method,
            headers: headers
        };

        if (body && method !== 'GET') {
            fetchOptions.body = body;
        }

        const response = await fetch(url, fetchOptions);
        const duration = Date.now() - startTime;

        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        displayTesterResponse(response.status, response.statusText, duration, responseData, responseHeaders);

    } catch (error) {
        if (statusDiv) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'dd-tester-response-status dd-tester-error';
        }

        const bodyContent = document.getElementById('dd-tester-response-body');
        if (bodyContent) {
            bodyContent.innerHTML = `<div class="dd-tester-error-message">${escapeHTML(error.message)}</div>`;
        }
    }
}


function displayTesterResponse(status, statusText, duration, responseData, responseHeaders) {
    const statusDiv = document.getElementById('dd-tester-status');
    const bodyContent = document.getElementById('dd-tester-response-body');
    const headersContent = document.getElementById('dd-tester-response-headers');

    if (statusDiv) {
        const statusClass = status >= 200 && status < 300 ? 'dd-tester-success' :
            status >= 400 ? 'dd-tester-error' : 'dd-tester-warning';

        statusDiv.textContent = `${status} ${statusText} • ${duration}ms`;
        statusDiv.className = `dd-tester-response-status ${statusClass}`;
    }

    if (bodyContent) {
        let formattedData;
        if (typeof responseData === 'object') {
            formattedData = JSON.stringify(responseData, null, 2);
        } else {
            formattedData = responseData;
        }
        bodyContent.innerHTML = `<pre class="dd-tester-response-data">${escapeHTML(formattedData)}</pre>`;
    }

    if (headersContent) {
        let headersHTML = '<div class="dd-tester-headers-list">';
        Object.entries(responseHeaders).forEach(([key, value]) => {
            headersHTML += `
                <div class="dd-tester-header-item">
                    <div class="dd-tester-header-key">${escapeHTML(key)}</div>
                    <div class="dd-tester-header-value">${escapeHTML(value)}</div>
                </div>
            `;
        });
        headersHTML += '</div>';
        headersContent.innerHTML = headersHTML;
    }
}


function showTesterError(message) {
    const statusDiv = document.getElementById('dd-tester-status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'dd-tester-response-status dd-tester-error';
    }
}


function switchTesterTab(tabName) {
    const tabs = document.querySelectorAll('.dd-tester-tab');
    const contents = document.querySelectorAll('.dd-tester-tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const activeTab = document.querySelector(`.dd-tester-tab[data-tester-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    const activeContent = document.getElementById(`dd-tester-response-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
}


function closeTesterModal() {
    removeTesterEventListeners();

    const allModals = document.querySelectorAll('.dd-tester-modal');
    allModals.forEach(modal => {
        if (modal && modal.parentNode) {
            modal.remove();
        }
    });

    if (testerModal && testerModal.parentNode) {
        testerModal.remove();
    }

    testerModal = null;
    currentTestRequest = null;

    console.log('[DOM Detective] Modal del tester cerrado');
}


function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}