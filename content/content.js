// content/content.js





document.addEventListener('contextmenu', (event) => {
    const element = event.target;
    saveContextElement(element);
}, true);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'copySelector') {
        copySelectorToClipboard(message.type);
    }

    if (message.action === 'openNetworkPanel') {
        openNetworkPanel();
    }

    if (message.action === 'toggleVisualSelector') {
        const isActive = window.isVisualSelectorActive();
        if (isActive) {
            window.deactivateVisualSelector();
        } else {
            window.activateVisualSelector();
        }
    }

    return true;
});

console.log('DOM Detective iniciado');