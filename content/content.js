// content/content.js





document.addEventListener('contextmenu', (event) => {
    const element = event.target;
    saveContextElement(element);
}, true);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'copySelector') {
        copySelectorToClipboard(message.type);
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'checkMinimizedPanel') {
        try {
            const floatingIndicator = document.getElementById('dd-floating-indicator');
            sendResponse({ hasMinimizedPanel: floatingIndicator !== null });
        } catch (error) {
            sendResponse({ hasMinimizedPanel: false });
        }
        return false;
    }

    if (message.action === 'restoreNetworkPanel') {
        try {
            const floatingIndicator = document.getElementById('dd-floating-indicator');
            if (floatingIndicator && typeof restoreNetworkPanel === 'function') {
                restoreNetworkPanel();
            }
        } catch (error) {
            console.error('[DOM Detective] Error al restaurar panel:', error);
        }
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'openNetworkPanel') {
        try {
            openNetworkPanel();
        } catch (error) {
            console.error('[DOM Detective] Error al abrir panel:', error);
        }
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'toggleVisualSelector') {
        const isActive = window.isVisualSelectorActive();
        if (isActive) {
            window.deactivateVisualSelector();
        } else {
            window.activateVisualSelector();
        }
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'openFragmentInspector') {
        if (typeof window.initFragmentInspector === 'function') {
            window.initFragmentInspector();
        }
        sendResponse({ success: true });
        return false;
    }

    return false;
});

console.log('DOM Detective iniciado');