// content/fragment-inspector.js





let fragmentInspectorPanel = null;
let selectedFragmentElement = null;
let fragmentEventListeners = [];

window.initFragmentInspector = function () {
    console.log('[DOM Detective] Inicializando Inspector de Fragmento');

    // Exponer la función de manejo en el scope global como respaldo
    window.handleFragmentElementSelection = handleFragmentSelection;

    // Activar selector visual en modo auxiliar para Inspector de Fragmento
    if (typeof window.activateVisualSelector === 'function') {
        window.activateVisualSelector(true, handleFragmentSelection);
    } else {
        console.error('[DOM Detective] activateVisualSelector no está disponible');
        showNotification('[DOM Detective] Error al activar el selector visual');
    }
};

function handleFragmentSelection(element) {
    if (!element) {
        console.error('[DOM Detective] Elemento no válido para inspección');
        return;
    }

    console.log('[DOM Detective] Elemento seleccionado para inspección:', element);
    console.log('[DOM Detective] Abriendo panel de inspector...');

    // Guardar el elemento ANTES de cualquier operación
    selectedFragmentElement = element;

    // Usar setTimeout para asegurar que el panel se abra después de la desactivación del selector
    setTimeout(() => {
        openFragmentInspectorPanel(element);
    }, 100);
}

function openFragmentInspectorPanel(element) {
    // Si se pasa un elemento como parámetro, usarlo
    if (element) {
        selectedFragmentElement = element;
    }

    if (!selectedFragmentElement) {
        console.error('[DOM Detective] No hay elemento seleccionado');
        showNotification('[DOM Detective] Error: No hay elemento seleccionado');
        return;
    }

    console.log('[DOM Detective] Abriendo panel con elemento:', selectedFragmentElement);

    // Cerrar panel anterior SI EXISTE, pero SIN limpiar selectedFragmentElement
    if (fragmentInspectorPanel && fragmentInspectorPanel.parentNode) {
        removeFragmentEventListeners();
        fragmentInspectorPanel.remove();
        fragmentInspectorPanel = null;
    }

    fragmentInspectorPanel = document.createElement('div');
    fragmentInspectorPanel.className = 'dd-fragment-panel';
    fragmentInspectorPanel.innerHTML = getFragmentPanelHTML();

    document.body.appendChild(fragmentInspectorPanel);

    attachFragmentEventListeners();

    // Usar setTimeout para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
        displayFragmentHTML();
    }, 50);
}

function getFragmentPanelHTML() {
    return `
        <div class="dd-fragment-header">
            <h2 class="dd-fragment-title">Inspector de Fragmento</h2>
            <div class="dd-fragment-header-controls">
                <button class="dd-fragment-maximize" id="dd-fragment-maximize" title="Maximizar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    </svg>
                </button>
                <button class="dd-fragment-close" id="dd-fragment-close">×</button>
            </div>
        </div>
        <div class="dd-fragment-tabs">
            <button class="dd-fragment-tab active" data-fragment-tab="html">HTML</button>
            <button class="dd-fragment-tab" data-fragment-tab="css">CSS</button>
            <button class="dd-fragment-tab" data-fragment-tab="javascript">JavaScript</button>
        </div>
        <div class="dd-fragment-content" id="dd-fragment-content">
            <div class="dd-fragment-tab-content active" id="dd-fragment-html">
                <div class="dd-fragment-loading">Cargando HTML...</div>
            </div>
            <div class="dd-fragment-tab-content" id="dd-fragment-css">
                <div class="dd-fragment-loading">Cargando CSS...</div>
            </div>
            <div class="dd-fragment-tab-content" id="dd-fragment-javascript">
                <div class="dd-fragment-loading">Cargando JavaScript...</div>
            </div>
        </div>
    `;
}

function attachFragmentEventListeners() {
    removeFragmentEventListeners();

    const closeBtn = document.getElementById('dd-fragment-close');
    const maximizeBtn = document.getElementById('dd-fragment-maximize');

    const closeBtnHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeFragmentInspectorPanel();
    };

    const maximizeBtnHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFragmentFullscreen();
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeBtnHandler);
        fragmentEventListeners.push({ element: closeBtn, event: 'click', handler: closeBtnHandler });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', maximizeBtnHandler);
        fragmentEventListeners.push({ element: maximizeBtn, event: 'click', handler: maximizeBtnHandler });
    }

    const tabs = document.querySelectorAll('.dd-fragment-tab[data-fragment-tab]');
    tabs.forEach(tab => {
        const tabHandler = function (e) {
            e.preventDefault();
            e.stopPropagation();
            const tabName = this.getAttribute('data-fragment-tab');
            if (tabName) {
                switchFragmentTab(tabName);
            }
        };

        tab.addEventListener('click', tabHandler);
        fragmentEventListeners.push({ element: tab, event: 'click', handler: tabHandler });
    });
}

function removeFragmentEventListeners() {
    fragmentEventListeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
            element.removeEventListener(event, handler);
        }
    });
    fragmentEventListeners = [];
}

function displayFragmentHTML() {
    console.log('[DOM Detective] Iniciando displayFragmentHTML');
    console.log('[DOM Detective] selectedFragmentElement:', selectedFragmentElement);

    if (!selectedFragmentElement) {
        console.error('[DOM Detective] No hay elemento seleccionado');
        return;
    }

    const htmlContent = document.getElementById('dd-fragment-html');
    console.log('[DOM Detective] htmlContent encontrado:', !!htmlContent);

    if (!htmlContent) {
        console.error('[DOM Detective] No se encontró el contenedor dd-fragment-html');
        return;
    }

    try {
        const htmlCode = selectedFragmentElement.outerHTML;
        console.log('[DOM Detective] HTML obtenido, longitud:', htmlCode.length);

        const formattedHTML = formatHTML(htmlCode);
        console.log('[DOM Detective] HTML formateado');

        // Obtener información del elemento
        let elementInfo = selectedFragmentElement.tagName.toLowerCase();
        if (selectedFragmentElement.id) {
            elementInfo += '#' + selectedFragmentElement.id;
        }
        if (selectedFragmentElement.className && typeof selectedFragmentElement.className === 'string') {
            const classes = selectedFragmentElement.className.trim().split(/\s+/).join('.');
            if (classes) {
                elementInfo += '.' + classes;
            }
        }

        htmlContent.innerHTML = `
            <div class="dd-fragment-code-header">
                <span class="dd-fragment-element-info">${escapeHTML(elementInfo)}</span>
                <button class="dd-fragment-copy-btn" id="dd-copy-html">Copiar HTML</button>
            </div>
            <pre class="dd-fragment-code"><code>${escapeHTML(formattedHTML)}</code></pre>
        `;

        console.log('[DOM Detective] HTML insertado en el DOM');

        const copyBtn = document.getElementById('dd-copy-html');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyToClipboard(htmlCode);
                showNotification('[DOM Detective] HTML copiado al portapapeles');
            });
        }

        console.log('[DOM Detective] displayFragmentHTML completado exitosamente');
    } catch (error) {
        console.error('[DOM Detective] Error al mostrar HTML:', error);
        console.error('[DOM Detective] Stack trace:', error.stack);
        htmlContent.innerHTML = '<div class="dd-fragment-error">Error al obtener el HTML del fragmento: ' + escapeHTML(error.message) + '</div>';
    }
}

function switchFragmentTab(tabName) {
    const tabs = document.querySelectorAll('.dd-fragment-tab');
    const contents = document.querySelectorAll('.dd-fragment-tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const activeTab = document.querySelector(`.dd-fragment-tab[data-fragment-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    const activeContent = document.getElementById(`dd-fragment-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Cargar contenido si aún no se ha cargado
    if (tabName === 'css' && activeContent && activeContent.querySelector('.dd-fragment-loading')) {
        displayFragmentCSS();
    } else if (tabName === 'javascript' && activeContent && activeContent.querySelector('.dd-fragment-loading')) {
        displayFragmentJavaScript();
    }
}

function displayFragmentCSS() {
    if (!selectedFragmentElement) return;

    const cssContent = document.getElementById('dd-fragment-css');
    if (!cssContent) return;

    try {
        const styles = window.getComputedStyle(selectedFragmentElement);
        const relevantStyles = {};

        // Propiedades CSS más relevantes para mostrar
        const importantProps = [
            'display', 'position', 'width', 'height', 'margin', 'padding',
            'background', 'background-color', 'color', 'font-family', 'font-size',
            'font-weight', 'border', 'border-radius', 'box-shadow', 'opacity',
            'z-index', 'flex', 'grid', 'align-items', 'justify-content'
        ];

        importantProps.forEach(prop => {
            const value = styles.getPropertyValue(prop);
            if (value && value !== '' && value !== 'none' && value !== 'normal') {
                relevantStyles[prop] = value;
            }
        });

        // Obtener también las hojas de estilo aplicadas
        const stylesheets = Array.from(document.styleSheets);
        let customCSS = '';

        const elementSelector = generateCSSSelector(selectedFragmentElement);

        stylesheets.forEach(sheet => {
            try {
                const rules = Array.from(sheet.cssRules || []);
                rules.forEach(rule => {
                    if (rule.selectorText && selectedFragmentElement.matches(rule.selectorText)) {
                        customCSS += `${rule.cssText}\n\n`;
                    }
                });
            } catch (e) {
                // CORS puede bloquear algunas hojas de estilo
            }
        });

        let cssOutput = '';

        if (customCSS) {
            cssOutput += `/* Reglas CSS del documento */\n\n${customCSS}`;
        }

        cssOutput += `/* Estilos computados */\n\n${elementSelector} {\n`;
        Object.entries(relevantStyles).forEach(([prop, value]) => {
            cssOutput += `    ${prop}: ${value};\n`;
        });
        cssOutput += '}';

        cssContent.innerHTML = `
            <div class="dd-fragment-code-header">
                <span class="dd-fragment-element-info">Estilos del fragmento</span>
                <button class="dd-fragment-copy-btn" id="dd-copy-css">Copiar CSS</button>
            </div>
            <pre class="dd-fragment-code"><code>${escapeHTML(cssOutput)}</code></pre>
        `;

        const copyBtn = document.getElementById('dd-copy-css');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyToClipboard(cssOutput);
                showNotification('[DOM Detective] CSS copiado al portapapeles');
            });
        }
    } catch (error) {
        console.error('[DOM Detective] Error al obtener CSS:', error);
        cssContent.innerHTML = '<div class="dd-fragment-error">Error al obtener el CSS del fragmento</div>';
    }
}

function displayFragmentJavaScript() {
    console.log('[DOM Detective] Iniciando displayFragmentJavaScript');

    const jsContent = document.getElementById('dd-fragment-javascript');
    if (!jsContent) {
        console.error('[DOM Detective] No se encontró el contenedor dd-fragment-javascript');
        return;
    }

    if (!selectedFragmentElement) {
        console.error('[DOM Detective] No hay elemento seleccionado');
        return;
    }

    try {
        let jsOutput = '/* Información JavaScript del fragmento */\n\n';

        // Propiedades básicas del elemento
        jsOutput += '// ===== PROPIEDADES DEL ELEMENTO =====\n';
        jsOutput += `// Tipo: ${selectedFragmentElement.tagName.toLowerCase()}\n`;
        jsOutput += `// ID: ${selectedFragmentElement.id || '(sin id)'}\n`;
        jsOutput += `// Clases: ${selectedFragmentElement.className || '(sin clases)'}\n`;
        jsOutput += `// Name: ${selectedFragmentElement.name || selectedFragmentElement.getAttribute('name') || '(sin name)'}\n\n`;

        // Atributos data-*
        const dataAttrs = {};
        Array.from(selectedFragmentElement.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                dataAttrs[attr.name] = attr.value;
            }
        });

        if (Object.keys(dataAttrs).length > 0) {
            jsOutput += '// ===== ATRIBUTOS DATA-* =====\n';
            Object.entries(dataAttrs).forEach(([key, value]) => {
                jsOutput += `// ${key} = "${value}"\n`;
            });
            jsOutput += '\n';
        } else {
            jsOutput += '// ===== ATRIBUTOS DATA-* =====\n';
            jsOutput += '// (ninguno)\n\n';
        }

        // Event handlers inline
        jsOutput += '// ===== EVENT HANDLERS INLINE =====\n';
        let hasInlineHandlers = false;

        const inlineEventAttrs = ['onclick', 'onchange', 'onsubmit', 'oninput', 'onfocus',
            'onblur', 'onmouseenter', 'onmouseleave', 'onload',
            'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup'];

        inlineEventAttrs.forEach(attr => {
            const attrValue = selectedFragmentElement.getAttribute(attr);
            if (attrValue) {
                jsOutput += `// ${attr}:\n`;
                jsOutput += `${attrValue}\n\n`;
                hasInlineHandlers = true;
            }
        });

        if (!hasInlineHandlers) {
            jsOutput += '// (ninguno detectado)\n\n';
        }

        // Propiedades JavaScript relevantes
        jsOutput += '// ===== PROPIEDADES JAVASCRIPT =====\n';

        if (selectedFragmentElement.value !== undefined) {
            jsOutput += `// value: "${selectedFragmentElement.value}"\n`;
        }

        if (selectedFragmentElement.checked !== undefined) {
            jsOutput += `// checked: ${selectedFragmentElement.checked}\n`;
        }

        if (selectedFragmentElement.disabled !== undefined) {
            jsOutput += `// disabled: ${selectedFragmentElement.disabled}\n`;
        }

        if (selectedFragmentElement.href) {
            jsOutput += `// href: "${selectedFragmentElement.href}"\n`;
        }

        if (selectedFragmentElement.src) {
            jsOutput += `// src: "${selectedFragmentElement.src}"\n`;
        }

        jsOutput += '\n';

        // Scripts en el elemento o sus hijos
        jsOutput += '// ===== SCRIPTS INTERNOS =====\n';
        const scripts = selectedFragmentElement.querySelectorAll('script');
        if (scripts.length > 0) {
            jsOutput += `// Se encontraron ${scripts.length} tag(s) <script> dentro del fragmento:\n\n`;
            scripts.forEach((script, index) => {
                jsOutput += `// --- Script ${index + 1} ---\n`;
                if (script.src) {
                    jsOutput += `// Fuente externa: ${script.src}\n\n`;
                } else if (script.textContent.trim()) {
                    jsOutput += `${script.textContent.trim()}\n\n`;
                } else {
                    jsOutput += `// (script vacío)\n\n`;
                }
            });
        } else {
            jsOutput += '// (no se encontraron scripts internos)\n\n';
        }

        // Nota informativa
        jsOutput += '// ===== NOTA IMPORTANTE =====\n';
        jsOutput += '// Los event listeners agregados con addEventListener() no son\n';
        jsOutput += '// directamente accesibles desde content scripts por seguridad.\n';
        jsOutput += '// Solo se muestran:\n';
        jsOutput += '// - Handlers inline (onclick, onchange, etc.)\n';
        jsOutput += '// - Atributos data-*\n';
        jsOutput += '// - Scripts dentro del fragmento\n';
        jsOutput += '// - Propiedades JavaScript del elemento';

        jsContent.innerHTML = `
            <div class="dd-fragment-code-header">
                <span class="dd-fragment-element-info">JavaScript del fragmento</span>
                <button class="dd-fragment-copy-btn" id="dd-copy-js">Copiar</button>
            </div>
            <pre class="dd-fragment-code"><code>${escapeHTML(jsOutput)}</code></pre>
        `;

        console.log('[DOM Detective] JavaScript mostrado correctamente');

        const copyBtn = document.getElementById('dd-copy-js');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyToClipboard(jsOutput);
                showNotification('[DOM Detective] JavaScript copiado al portapapeles');
            });
        }

    } catch (error) {
        console.error('[DOM Detective] Error al obtener JavaScript:', error);
        console.error('[DOM Detective] Stack trace:', error.stack);
        jsContent.innerHTML = '<div class="dd-fragment-error">Error al obtener el JavaScript del fragmento: ' + escapeHTML(error.message) + '</div>';
    }
}

function formatHTML(html) {
    try {
        let formatted = '';
        let indent = 0;
        const tab = '    ';

        // Separar por tags
        const tags = html.split(/(<[^>]+>)/g).filter(part => part.trim());

        tags.forEach(tag => {
            if (!tag.startsWith('<')) {
                // Es texto entre tags
                const trimmed = tag.trim();
                if (trimmed) {
                    formatted += tab.repeat(indent) + trimmed + '\n';
                }
            } else if (tag.startsWith('</')) {
                // Tag de cierre
                indent = Math.max(0, indent - 1);
                formatted += tab.repeat(indent) + tag + '\n';
            } else if (tag.endsWith('/>') || tag.match(/<(br|img|input|hr|meta|link)[^>]*>/i)) {
                // Tag auto-cerrado
                formatted += tab.repeat(indent) + tag + '\n';
            } else {
                // Tag de apertura
                formatted += tab.repeat(indent) + tag + '\n';
                indent++;
            }
        });

        return formatted.trim();
    } catch (error) {
        console.error('[DOM Detective] Error al formatear HTML:', error);
        return html; // Retornar HTML sin formatear si hay error
    }
}

function toggleFragmentFullscreen() {
    if (!fragmentInspectorPanel) return;

    const isFullscreen = fragmentInspectorPanel.classList.contains('dd-fragment-panel-fullscreen');
    const maximizeBtn = document.getElementById('dd-fragment-maximize');

    if (isFullscreen) {
        fragmentInspectorPanel.classList.remove('dd-fragment-panel-fullscreen');
        if (maximizeBtn) {
            maximizeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            `;
            maximizeBtn.title = 'Maximizar';
        }
    } else {
        fragmentInspectorPanel.classList.add('dd-fragment-panel-fullscreen');
        if (maximizeBtn) {
            maximizeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                </svg>
            `;
            maximizeBtn.title = 'Minimizar';
        }
    }
}

function closeFragmentInspectorPanel() {
    removeFragmentEventListeners();

    if (fragmentInspectorPanel && fragmentInspectorPanel.parentNode) {
        fragmentInspectorPanel.remove();
    }

    fragmentInspectorPanel = null;
    selectedFragmentElement = null;

    console.log('[DOM Detective] Inspector de Fragmento cerrado');
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}