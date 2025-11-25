// content/network-monitor.js





let networkRequests = [];
let isMonitoring = false;
let originalFetch = null;
let originalXHR = null;


async function startNetworkMonitoring() {
    if (isMonitoring) return;

    isMonitoring = true;
    networkRequests = [];

    await chrome.storage.local.set({
        networkMonitoring: true,
        networkRequests: []
    });

    interceptFetch();
    interceptXHR();
}


async function stopNetworkMonitoring() {
    isMonitoring = false;
    restoreFetch();
    restoreXHR();

    await chrome.storage.local.set({ networkMonitoring: false });
}


async function saveRequest(requestData) {
    const result = await chrome.storage.local.get(['networkRequests']);
    const requests = result.networkRequests || [];
    requests.push(requestData);
    await chrome.storage.local.set({ networkRequests: requests });
    networkRequests = requests;
}


function interceptFetch() {
    if (!originalFetch) {
        originalFetch = window.fetch;
    }

    window.fetch = async function (...args) {
        const startTime = Date.now();
        const [resource, config] = args;

        const requestData = {
            id: Date.now() + Math.random(),
            type: 'fetch',
            method: config?.method || 'GET',
            url: resource.toString(),
            timestamp: new Date().toISOString(),
            requestHeaders: {},
            requestBody: null,
            startTime: startTime
        };

        if (config?.headers) {
            if (config.headers instanceof Headers) {
                config.headers.forEach((value, key) => {
                    requestData.requestHeaders[key] = value;
                });
            } else {
                requestData.requestHeaders = { ...config.headers };
            }
        }

        if (config?.body) {
            try {
                requestData.requestBody = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
            } catch {
                requestData.requestBody = String(config.body);
            }
        }

        try {
            const response = await originalFetch.apply(this, args);
            const clonedResponse = response.clone();

            requestData.status = response.status;
            requestData.statusText = response.statusText;
            requestData.responseHeaders = {};

            response.headers.forEach((value, key) => {
                requestData.responseHeaders[key] = value;
            });

            try {
                const text = await clonedResponse.text();
                try {
                    requestData.responseData = JSON.parse(text);
                } catch {
                    requestData.responseData = text;
                }
            } catch (e) {
                requestData.responseData = 'Error al leer respuesta';
            }

            requestData.duration = Date.now() - startTime;

            await saveRequest(requestData);

            return response;
        } catch (error) {
            requestData.error = error.message;
            requestData.duration = Date.now() - startTime;
            await saveRequest(requestData);
            throw error;
        }
    };
}


function interceptXHR() {
    if (!originalXHR) {
        originalXHR = {
            open: XMLHttpRequest.prototype.open,
            send: XMLHttpRequest.prototype.send,
            setRequestHeader: XMLHttpRequest.prototype.setRequestHeader
        };
    }

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._requestData = {
            id: Date.now() + Math.random(),
            type: 'xhr',
            method: method,
            url: url,
            timestamp: new Date().toISOString(),
            requestHeaders: {},
            startTime: Date.now()
        };
        return originalXHR.open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        if (this._requestData) {
            this._requestData.requestHeaders[header] = value;
        }
        return originalXHR.setRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (this._requestData) {
            if (body) {
                try {
                    this._requestData.requestBody = typeof body === 'string' ? body : JSON.stringify(body);
                } catch {
                    this._requestData.requestBody = String(body);
                }
            }

            this.addEventListener('readystatechange', async function () {
                if (this.readyState === 4) {
                    const requestData = this._requestData;
                    requestData.status = this.status;
                    requestData.statusText = this.statusText;
                    requestData.responseHeaders = {};

                    const headers = this.getAllResponseHeaders();
                    if (headers) {
                        headers.trim().split(/[\r\n]+/).forEach(line => {
                            const parts = line.split(': ');
                            const header = parts.shift();
                            const value = parts.join(': ');
                            if (header) {
                                requestData.responseHeaders[header] = value;
                            }
                        });
                    }

                    try {
                        requestData.responseData = JSON.parse(this.responseText);
                    } catch {
                        requestData.responseData = this.responseText;
                    }

                    requestData.duration = Date.now() - requestData.startTime;
                    await saveRequest(requestData);
                }
            });
        }
        return originalXHR.send.apply(this, arguments);
    };
}


function restoreFetch() {
    if (originalFetch) {
        window.fetch = originalFetch;
    }
}


function restoreXHR() {
    if (originalXHR) {
        XMLHttpRequest.prototype.open = originalXHR.open;
        XMLHttpRequest.prototype.send = originalXHR.send;
        XMLHttpRequest.prototype.setRequestHeader = originalXHR.setRequestHeader;
    }
}


async function getNetworkRequests() {
    const result = await chrome.storage.local.get(['networkRequests']);
    networkRequests = result.networkRequests || [];
    return networkRequests;
}


async function clearNetworkRequests() {
    networkRequests = [];
    await chrome.storage.local.set({ networkRequests: [] });
}


async function checkIfMonitoring() {
    const result = await chrome.storage.local.get(['networkMonitoring']);
    return result.networkMonitoring || false;
}


(async function initMonitoring() {
    const shouldMonitor = await checkIfMonitoring();
    if (shouldMonitor) {
        startNetworkMonitoring();
        console.log('[DOM Detective] Monitoreo de red reiniciado después de recarga');
    }
})();