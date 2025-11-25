// content/inspector.js





let currentContextElement = null;
let contextSelectors = {};





// Guarda el elemento del contexto actual
function saveContextElement(element) {
    currentContextElement = element;
    generateAllSelectors(element);
}

// Genera todos los selectores para un elemento
function generateAllSelectors(element) {
    try {
        contextSelectors = {
            relXpath: generateRelativeXPath(element),
            absXpath: generateAbsoluteXPath(element),
            cssSelector: generateCSSSelector(element),
            id: getElementId(element),
            name: getElementName(element),
            class: getElementClasses(element)
        };
    } catch (error) {
        console.error('[DOM Detective] Error generando selectores:', error);
        contextSelectors = {};
    }
}

// Copia un selector al portapapeles
function copySelectorToClipboard(type) {
    let value = '';

    switch (type) {
        case 'dd-rel-xpath':
            value = contextSelectors.relXpath;
            break;
        case 'dd-abs-xpath':
            value = contextSelectors.absXpath;
            break;
        case 'dd-css-selector':
            value = contextSelectors.cssSelector;
            break;
        case 'dd-id':
            value = contextSelectors.id;
            break;
        case 'dd-name':
            value = contextSelectors.name;
            break;
        case 'dd-class':
            value = contextSelectors.class;
            break;
    }

    if (value && !value.includes('no tiene')) {
        copyToClipboard(value);
        showNotification('[DOM Detective] Copiado: ' + value);
    } else {
        showNotification('[DOM Detective] No disponible: ' + value);
    }
}

// Copia texto al portapapeles
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// Muestra una notificación temporal
function showNotification(message) {
    // Remover notificación anterior si existe
    let existingNotif = document.getElementById('dd-notification');
    if (existingNotif) {
        existingNotif.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'dd-notification';
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}