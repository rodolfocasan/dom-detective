// popup/popup.js





document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Detective popup cargado');

    const fetchXhrBtn = document.getElementById('fetch-xhr-btn');
    const visualSelectorBtn = document.getElementById('visual-selector-btn');
    const fragmentInspectorBtn = document.getElementById('fragment-inspector-btn');

    fetchXhrBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;

            // Primero verificar si hay un panel minimizado
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'checkMinimizedPanel'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Si hay error, intentar abrir normalmente
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'openNetworkPanel'
                    });
                    return;
                }

                // Si hay un panel minimizado, solo restaurarlo
                if (response && response.hasMinimizedPanel) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'restoreNetworkPanel'
                    });
                } else {
                    // Si no hay panel minimizado, abrir normalmente
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'openNetworkPanel'
                    });
                }
            });

            // Cerrar el popup después de un breve delay
            setTimeout(() => {
                window.close();
            }, 100);
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

    fragmentInspectorBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'openFragmentInspector'
            });
            window.close();
        });
    });
});