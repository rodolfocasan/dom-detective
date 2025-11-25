// popup/popup.js





document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Detective popup cargado');

    const fetchXhrBtn = document.getElementById('fetch-xhr-btn');
    const visualSelectorBtn = document.getElementById('visual-selector-btn');

    fetchXhrBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'openNetworkPanel'
            });
            window.close();
        });
    });

    visualSelectorBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleVisualSelector'
            });
            window.close();
        });
    });
});