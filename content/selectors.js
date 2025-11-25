// content/selectors.js





// Elimina saltos de línea y espacios innecesarios
function deleteLineGap(text) {
    if (!text) return '';
    text = text.split('\n')[0].length > 0 ? text.split('\n')[0] : text.split('\n')[1];
    return text || '';
}


// Genera XPath absoluto para un elemento
function generateAbsoluteXPath(element) {
    if (element.tagName.toLowerCase() === 'html') {
        return '/html[1]';
    }
    if (element.tagName.toLowerCase() === 'body') {
        return '/html[1]/body[1]';
    }

    let ix = 0;
    let siblings = element.parentNode.childNodes;

    for (let i = 0; i < siblings.length; i++) {
        let sibling = siblings[i];
        if (sibling === element) {
            return generateAbsoluteXPath(element.parentNode) +
                '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 &&
            sibling.tagName.toLowerCase() === element.tagName.toLowerCase()) {
            ix++;
        }
    }
}


// Genera XPath relativo para un elemento
function generateRelativeXPath(element) {
    let tagName = element.tagName.toLowerCase();

    // Si tiene ID único, usarlo
    if (element.id) {
        let id = deleteLineGap(element.id);
        return `//${tagName}[@id='${id}']`;
    }

    // Si tiene atributos útiles
    let attributes = {};
    for (let i = 0; i < element.attributes.length; i++) {
        let attr = element.attributes[i];
        if (attr.value && attr.name !== 'class') {
            attributes[attr.name] = attr.value;
        }
    }

    // Intentar con name
    if (attributes.name) {
        return `//${tagName}[@name='${attributes.name}']`;
    }

    // Intentar con placeholder
    if (attributes.placeholder) {
        return `//${tagName}[@placeholder='${attributes.placeholder}']`;
    }

    // Intentar con texto interno
    let text = element.textContent?.trim();
    if (text && text.length < 50 && text.length > 0) {
        if (!text.includes("'")) {
            return `//${tagName}[text()='${text}']`;
        }
    }

    // Si no hay nada mejor, usar el xpath absoluto
    return generateAbsoluteXPath(element);
}


// Genera CSS Selector para un elemento
function generateCSSSelector(element) {
    // Si tiene ID
    if (element.id) {
        return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();

    // Si tiene clases
    if (element.className && typeof element.className === 'string') {
        let classes = element.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
            selector += '.' + classes.join('.');
        }
    }

    // Si tiene atributos útiles
    if (element.name) {
        selector += `[name="${element.name}"]`;
    } else if (element.getAttribute('placeholder')) {
        selector += `[placeholder="${element.getAttribute('placeholder')}"]`;
    }

    return selector;
}


// Obtiene el ID del elemento
function getElementId(element) {
    return element.id || 'El elemento no tiene ID';
}


// Obtiene el name del elemento
function getElementName(element) {
    return element.name || element.getAttribute('name') || 'El elemento no tiene atributo name';
}


// Obtiene las clases del elemento
function getElementClasses(element) {
    if (element.className && typeof element.className === 'string') {
        let classes = element.className.trim().split(/\s+/).filter(c => c);
        return classes.join(' ') || 'El elemento no tiene clases';
    }
    return 'El elemento no tiene clases';
}