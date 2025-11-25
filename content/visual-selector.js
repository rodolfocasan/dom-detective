// content/visual-selector.js





let visualSelectorActive = false;
let currentHighlightedElement = null;
let highlightOverlay = null;
let selectorButtons = null;
let selectedColor = '#ff0000';
let controlPanel = null;





async function initVisualSelector() {
    const result = await chrome.storage.local.get(['visualSelectorColor']);
    if (result.visualSelectorColor) {
        selectedColor = result.visualSelectorColor;
    }
}
initVisualSelector();


function activateVisualSelector() {
    if (visualSelectorActive) return;

    visualSelectorActive = true;
    createControlPanel();
    createHighlightOverlay();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleElementClick, true);

    console.log('[DOM Detective] Selector visual activado');
}


function deactivateVisualSelector() {
    if (!visualSelectorActive) return;

    visualSelectorActive = false;
    removeControlPanel();
    removeHighlightOverlay();
    removeSelectorButtons();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleElementClick, true);
    currentHighlightedElement = null;

    console.log('[DOM Detective] Selector visual desactivado');
}


function createControlPanel() {
    if (controlPanel) return;

    controlPanel = document.createElement('div');
    controlPanel.className = 'dd-vs-control-panel';
    controlPanel.innerHTML = `
        <div class="dd-vs-panel-header">
            <h3 class="dd-vs-panel-title">Selector Visual</h3>
            <button class="dd-vs-panel-close" id="dd-vs-close">×</button>
        </div>
        <div class="dd-vs-panel-content">
            <div class="dd-vs-panel-row">
                <label class="dd-vs-panel-label">Color de resaltado:</label>
                <input type="color" class="dd-vs-color-input" id="dd-vs-color-picker" value="${selectedColor}">
            </div>
            <div class="dd-vs-panel-instructions">
                <p>Mueve el cursor sobre cualquier elemento para resaltarlo.</p>
                <p>Haz clic para seleccionar y copiar selectores.</p>
            </div>
        </div>
    `;

    document.body.appendChild(controlPanel);

    const closeBtn = document.getElementById('dd-vs-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            deactivateVisualSelector();
            chrome.storage.local.set({ visualSelectorActive: false });
        });
    }

    const colorPicker = document.getElementById('dd-vs-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', (event) => {
            updateOverlayColor(event.target.value);
        });
    }
}


function removeControlPanel() {
    if (controlPanel && controlPanel.parentNode) {
        controlPanel.remove();
        controlPanel = null;
    }
}


function createHighlightOverlay() {
    if (highlightOverlay) return;

    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'dd-visual-selector-overlay';
    highlightOverlay.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 999998;
        border: 2px solid ${selectedColor};
        background-color: ${selectedColor}33;
        transition: all 0.1s ease;
        display: none;
    `;
    document.body.appendChild(highlightOverlay);
}


function removeHighlightOverlay() {
    if (highlightOverlay && highlightOverlay.parentNode) {
        highlightOverlay.remove();
        highlightOverlay = null;
    }
}


function updateOverlayColor(color) {
    selectedColor = color;
    if (highlightOverlay) {
        highlightOverlay.style.borderColor = color;
        highlightOverlay.style.backgroundColor = color + '33';
    }
    chrome.storage.local.set({ visualSelectorColor: color });
}


function handleMouseMove(event) {
    if (!visualSelectorActive || !highlightOverlay) return;

    const element = event.target;

    if (element === highlightOverlay || element === selectorButtons || element === controlPanel) return;
    if (element.closest('#dd-visual-selector-overlay') ||
        element.closest('#dd-selector-buttons') ||
        element.closest('.dd-vs-control-panel')) return;

    currentHighlightedElement = element;

    const rect = element.getBoundingClientRect();
    highlightOverlay.style.display = 'block';
    highlightOverlay.style.top = (rect.top + window.scrollY) + 'px';
    highlightOverlay.style.left = (rect.left + window.scrollX) + 'px';
    highlightOverlay.style.width = rect.width + 'px';
    highlightOverlay.style.height = rect.height + 'px';
}


function handleElementClick(event) {
    if (!visualSelectorActive) return;

    if (event.target.closest('.dd-vs-control-panel')) return;
    if (event.target.closest('#dd-selector-buttons')) return;

    event.preventDefault();
    event.stopPropagation();

    showSelectorButtons(event);
}


function showSelectorButtons(event) {
    removeSelectorButtons();

    if (!currentHighlightedElement) return;

    saveContextElement(currentHighlightedElement);

    selectorButtons = document.createElement('div');
    selectorButtons.id = 'dd-selector-buttons';

    const buttonConfigs = [
        { id: 'dd-rel-xpath', label: 'XPath Relativo' },
        { id: 'dd-abs-xpath', label: 'XPath Absoluto' },
        { id: 'dd-css-selector', label: 'CSS Selector' },
        { id: 'dd-id', label: 'ID' },
        { id: 'dd-name', label: 'Name' },
        { id: 'dd-class', label: 'Class' }
    ];

    let buttonsHTML = '<div class="dd-selector-buttons-container">';
    buttonsHTML += '<div class="dd-selector-buttons-title">Copiar selector:</div>';
    buttonConfigs.forEach(config => {
        buttonsHTML += `<button class="dd-selector-btn" data-type="${config.id}">${config.label}</button>`;
    });
    buttonsHTML += '</div>';

    selectorButtons.innerHTML = buttonsHTML;
    document.body.appendChild(selectorButtons);

    // Obtener dimensiones del panel
    const panelWidth = 220; // Ancho aproximado del panel
    const panelHeight = 280; // Alto aproximado del panel (título + 6 botones)

    const rect = currentHighlightedElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let top, left;

    // ========== POSICIONAMIENTO VERTICAL ==========
    // Intentar posicionar debajo del elemento
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow >= panelHeight + 20) {
        // Hay suficiente espacio debajo
        top = rect.bottom + scrollY + 10;
    } else if (spaceAbove >= panelHeight + 20) {
        // No hay espacio debajo, pero sí arriba
        top = rect.top + scrollY - panelHeight - 10;
    } else {
        // No hay espacio suficiente en ningún lado
        // Posicionar en el centro vertical del viewport
        top = scrollY + (viewportHeight - panelHeight) / 2;

        // Asegurar que no se salga por arriba o por abajo
        if (top < scrollY + 10) {
            top = scrollY + 10;
        } else if (top + panelHeight > scrollY + viewportHeight - 10) {
            top = scrollY + viewportHeight - panelHeight - 10;
        }
    }

    // ========== POSICIONAMIENTO HORIZONTAL ==========
    // Intentar alinear con el borde izquierdo del elemento
    left = rect.left + scrollX;

    // Verificar si se sale por la derecha
    if (left + panelWidth > scrollX + viewportWidth - 20) {
        // Intentar alinear con el borde derecho del elemento
        left = rect.right + scrollX - panelWidth;

        // Si aún se sale por la izquierda
        if (left < scrollX + 20) {
            // Centrar horizontalmente en el viewport
            left = scrollX + (viewportWidth - panelWidth) / 2;
        }
    }

    // Verificar que no se salga por la izquierda
    if (left < scrollX + 20) {
        left = scrollX + 20;
    }

    // Verificar que no se salga por la derecha (última verificación)
    if (left + panelWidth > scrollX + viewportWidth - 20) {
        left = scrollX + viewportWidth - panelWidth - 20;
    }

    // Aplicar posición calculada
    selectorButtons.style.top = Math.max(0, top) + 'px';
    selectorButtons.style.left = Math.max(0, left) + 'px';

    // Agregar event listeners a los botones
    const buttons = selectorButtons.querySelectorAll('.dd-selector-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const type = this.getAttribute('data-type');
            copySelectorToClipboard(type);

            setTimeout(() => {
                deactivateVisualSelector();
                chrome.storage.local.set({ visualSelectorActive: false });
            }, 100);
        });
    });
}


function removeSelectorButtons() {
    if (selectorButtons && selectorButtons.parentNode) {
        selectorButtons.remove();
        selectorButtons = null;
    }
}


window.activateVisualSelector = activateVisualSelector;
window.deactivateVisualSelector = deactivateVisualSelector;
window.isVisualSelectorActive = () => visualSelectorActive;