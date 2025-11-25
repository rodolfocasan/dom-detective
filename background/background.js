// background/background.js





let contextMenuItems = [
    { id: 'dd-rel-xpath', title: 'Copiar XPath Relativo' },
    { id: 'dd-abs-xpath', title: 'Copiar XPath Absoluto' },
    { id: 'dd-css-selector', title: 'Copiar CSS Selector' },
    { id: 'dd-id', title: 'Copiar ID' },
    { id: 'dd-name', title: 'Copiar Name' },
    { id: 'dd-class', title: 'Copiar Class' }
];

let debuggerAttached = false;
let monitoringTabId = null;
let networkRequests = new Map();





// Inicializar desde storage al iniciar el service worker
(async function initializeFromStorage() {
    try {
        const result = await chrome.storage.local.get(['networkRequests', 'debuggerAttached', 'monitoringTabId']);
        
        if (result.networkRequests && Array.isArray(result.networkRequests)) {
            networkRequests = new Map(result.networkRequests.map(req => [req.id, req]));
            console.log('[DOM Detective] Solicitudes restauradas desde storage:', networkRequests.size);
        }
        
        if (result.debuggerAttached) {
            debuggerAttached = result.debuggerAttached;
        }
        
        if (result.monitoringTabId) {
            monitoringTabId = result.monitoringTabId;
        }
    } catch (error) {
        console.error('[DOM Detective] Error al inicializar desde storage:', error);
    }
})();


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'dd-parent',
        title: 'DOM Detective',
        contexts: ['all']
    });

    contextMenuItems.forEach(item => {
        chrome.contextMenus.create({
            id: item.id,
            title: item.title,
            parentId: 'dd-parent',
            contexts: ['all']
        });
    });
});


chrome.contextMenus.onClicked.addListener((info, tab) => {
    chrome.tabs.sendMessage(tab.id, {
        action: 'copySelector',
        type: info.menuItemId
    });
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'log') {
        console.log('DOM Detective:', message.data);
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'getCurrentTabId') {
        if (sender.tab && sender.tab.id) {
            sendResponse({ tabId: sender.tab.id });
        } else {
            sendResponse({ tabId: null });
        }
        return false;
    }

    if (message.action === 'isMonitoring') {
        sendResponse({
            isMonitoring: debuggerAttached,
            tabId: monitoringTabId
        });
        return false;
    }

    if (message.action === 'startNetworkMonitoring') {
        startDebugger(message.tabId).then(success => {
            sendResponse({ success });
            if (success) {
                chrome.tabs.sendMessage(message.tabId, {
                    action: 'monitoringStarted'
                }).catch(() => { });
            }
        }).catch(error => {
            console.error('[DOM Detective] Error en startDebugger:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (message.action === 'stopNetworkMonitoring') {
        stopDebugger(message.tabId).then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            console.error('[DOM Detective] Error en stopDebugger:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (message.action === 'getNetworkRequests') {
        (async () => {
            try {
                // Primero intentar desde memoria
                let requests = Array.from(networkRequests.values());
                
                // Si no hay datos en memoria, cargar desde storage
                if (requests.length === 0) {
                    const result = await chrome.storage.local.get(['networkRequests']);
                    if (result.networkRequests && Array.isArray(result.networkRequests)) {
                        networkRequests = new Map(result.networkRequests.map(req => [req.id, req]));
                        requests = result.networkRequests;
                        console.log('[DOM Detective] Requests cargadas desde storage:', requests.length);
                    }
                }
                
                const serializedRequests = requests.map(req => ({
                    id: req.id,
                    type: req.type,
                    method: req.method,
                    url: req.url,
                    status: req.status,
                    statusText: req.statusText,
                    requestHeaders: req.requestHeaders || {},
                    responseHeaders: req.responseHeaders || {},
                    requestBody: req.requestBody || null,
                    responseData: req.responseData || null,
                    queryParams: req.queryParams || {},
                    cookies: req.cookies || [],
                    duration: req.duration,
                    timestamp: req.timestamp,
                    remoteAddress: req.remoteAddress,
                    referrerPolicy: req.referrerPolicy,
                    error: req.error
                }));

                sendResponse({ requests: serializedRequests });
            } catch (error) {
                console.error('[DOM Detective] Error al serializar requests:', error);
                sendResponse({ requests: [] });
            }
        })();
        return true; // Mantener el canal abierto para respuesta asíncrona
    }

    if (message.action === 'clearNetworkRequests') {
        (async () => {
            networkRequests.clear();
            await chrome.storage.local.set({ networkRequests: [] });
            sendResponse({ success: true });
        })();
        return true;
    }

    return false;
});


async function startDebugger(tabId) {
    try {
        if (debuggerAttached && monitoringTabId === tabId) {
            return true;
        }

        if (debuggerAttached && monitoringTabId !== tabId) {
            await stopDebugger(monitoringTabId);
        }

        await chrome.debugger.attach({ tabId }, '1.3');

        await chrome.debugger.sendCommand({ tabId }, 'Network.enable');

        debuggerAttached = true;
        monitoringTabId = tabId;
        networkRequests.clear();

        // Persistir estado en storage
        await chrome.storage.local.set({
            debuggerAttached: true,
            monitoringTabId: tabId,
            networkRequests: []
        });

        console.log('[DOM Detective] Debugger adjunto al tab', tabId);
        return true;
    } catch (error) {
        console.error('[DOM Detective] Error al adjuntar debugger:', error);
        debuggerAttached = false;
        monitoringTabId = null;
        await chrome.storage.local.set({
            debuggerAttached: false,
            monitoringTabId: null
        });
        return false;
    }
}


async function stopDebugger(tabId) {
    try {
        if (debuggerAttached && tabId) {
            await chrome.debugger.detach({ tabId });
            debuggerAttached = false;
            monitoringTabId = null;
            
            // Limpiar estado en storage
            await chrome.storage.local.set({
                debuggerAttached: false,
                monitoringTabId: null
            });
            
            console.log('[DOM Detective] Debugger desconectado del tab', tabId);
        }
    } catch (error) {
        console.error('[DOM Detective] Error al detener debugger:', error);
        debuggerAttached = false;
        monitoringTabId = null;
        await chrome.storage.local.set({
            debuggerAttached: false,
            monitoringTabId: null
        });
    }
}


// Función auxiliar para persistir requests en storage
async function persistNetworkRequests() {
    try {
        const requestsArray = Array.from(networkRequests.values());
        await chrome.storage.local.set({ networkRequests: requestsArray });
    } catch (error) {
        console.error('[DOM Detective] Error al persistir requests:', error);
    }
}

chrome.debugger.onEvent.addListener(async (source, method, params) => {
    if (!debuggerAttached || source.tabId !== monitoringTabId) return;
    
    if (method === 'Network.requestWillBeSent') {
        const request = params.request;
        const requestId = params.requestId;

        const isXHRorFetch = params.type === 'XHR' || params.type === 'Fetch';

        if (isXHRorFetch || request.url.includes('/api/') || request.url.includes('.json')) {

            const url = new URL(request.url);
            const queryParams = {};
            url.searchParams.forEach((value, key) => {
                queryParams[key] = value;
            });

            networkRequests.set(requestId, {
                id: requestId,
                type: params.type || 'unknown',
                method: request.method,
                url: request.url,
                requestHeaders: request.headers || {},
                requestBody: request.postData || null,
                queryParams: queryParams,
                referrerPolicy: params.referrerPolicy || 'no-referrer-when-downgrade',
                timestamp: new Date(params.timestamp * 1000).toISOString(),
                startTime: params.timestamp,
                initiator: params.initiator
            });
            
            // Persistir inmediatamente
            await persistNetworkRequests();
        }
    }

    if (method === 'Network.responseReceived') {
        const requestId = params.requestId;
        const response = params.response;

        if (networkRequests.has(requestId)) {
            const request = networkRequests.get(requestId);
            request.status = response.status;
            request.statusText = response.statusText;
            request.responseHeaders = response.headers || {};
            request.mimeType = response.mimeType;
            request.remoteAddress = response.remoteIPAddress + ':' + (response.remotePort || '');
            request.protocol = response.protocol;
            request.fromCache = response.fromDiskCache || response.fromServiceWorker;
            request.timing = response.timing;
            
            // Persistir cambios
            await persistNetworkRequests();
        }
    }

    if (method === 'Network.loadingFinished') {
        const requestId = params.requestId;

        if (networkRequests.has(requestId)) {
            const request = networkRequests.get(requestId);
            request.endTime = params.timestamp;
            request.duration = Math.round((params.timestamp - request.startTime) * 1000);
            request.encodedDataLength = params.encodedDataLength;

            chrome.debugger.sendCommand(
                { tabId: monitoringTabId },
                'Network.getResponseBody',
                { requestId },
                async (result) => {
                    if (chrome.runtime.lastError) {
                        console.log('[DOM Detective] No se pudo obtener el body:', chrome.runtime.lastError.message);
                        return;
                    }

                    if (result && result.body) {
                        try {
                            if (result.base64Encoded) {
                                request.responseData = atob(result.body);
                            } else {
                                request.responseData = result.body;
                            }

                            try {
                                request.responseData = JSON.parse(request.responseData);
                            } catch {
                                // No es JSON, mantener como string
                            }
                        } catch (error) {
                            console.error('[DOM Detective] Error decodificando respuesta:', error);
                        }
                    }
                    
                    // Persistir después de obtener el body
                    await persistNetworkRequests();
                }
            );

            chrome.debugger.sendCommand(
                { tabId: monitoringTabId },
                'Network.getCookies',
                { urls: [request.url] },
                async (result) => {
                    if (result && result.cookies) {
                        request.cookies = result.cookies;
                    }
                    
                    // Persistir después de obtener las cookies
                    await persistNetworkRequests();
                }
            );
        }
    }

    if (method === 'Network.loadingFailed') {
        const requestId = params.requestId;

        if (networkRequests.has(requestId)) {
            const request = networkRequests.get(requestId);
            request.error = params.errorText;
            request.canceled = params.canceled;
            request.blockedReason = params.blockedReason;
            
            // Persistir errores
            await persistNetworkRequests();
        }
    }
});


chrome.debugger.onDetach.addListener(async (source, reason) => {
    if (source.tabId === monitoringTabId) {
        console.log('[DOM Detective] Debugger desconectado:', reason);
        debuggerAttached = false;
        monitoringTabId = null;
        
        // Actualizar estado en storage
        await chrome.storage.local.set({
            debuggerAttached: false,
            monitoringTabId: null
        });
        
        chrome.tabs.sendMessage(source.tabId, {
            action: 'debuggerDetached',
            reason: reason
        }).catch(() => { });
    }
});


chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (tabId === monitoringTabId) {
        await stopDebugger(tabId);
        networkRequests.clear();
        await chrome.storage.local.set({ networkRequests: [] });
    }
});