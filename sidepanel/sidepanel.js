window.currentInspectedElement = null;
let currentInspectData = null;
let currentTailwindClasses = '';
let currentRefactoredTailwind = '';
let currentBuildPrompt = '';
let pendingAIAction = null;

// Helper: Get active web tab reliably across sidepanel and main window
async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs && tabs.length > 0) return tabs[0];
    const currentWinTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return currentWinTabs ? currentWinTabs[0] : null;
  } catch (err) {
    console.warn('Error querying active tab:', err);
    return null;
  }
}

// Helper: Send message to tab with automatic programmatic injection fallback
async function sendTabMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      }).catch(() => {});

      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });

      return await chrome.tabs.sendMessage(tabId, message);
    } catch (injectErr) {
      console.warn('Script injection failed (page may be restricted like chrome://):', injectErr);
      throw err;
    }
  }
}

// Format computed telemetry into CSS rule block
function generateCSSRules(d) {
  if (!d) return '';
  const rules = [];
  if (d.fontFamily) rules.push(`font-family: ${d.fontFamily};`);
  if (d.fontSize) rules.push(`font-size: ${d.fontSize};`);
  if (d.fontWeight) rules.push(`font-weight: ${d.fontWeight};`);
  if (d.lineHeight && d.lineHeight !== 'normal') rules.push(`line-height: ${d.lineHeight};`);
  if (d.letterSpacing && d.letterSpacing !== 'normal' && d.letterSpacing !== '0px') rules.push(`letter-spacing: ${d.letterSpacing};`);
  if (d.textAlign && d.textAlign !== 'start') rules.push(`text-align: ${d.textAlign};`);
  if (d.color) rules.push(`color: ${d.color};`);
  if (d.backgroundColor && d.backgroundColor !== 'rgba(0, 0, 0, 0)' && d.backgroundColor !== 'transparent') rules.push(`background-color: ${d.backgroundColor};`);
  if (d.padding) rules.push(`padding: ${d.padding};`);
  if (d.margin && d.margin !== '0px 0px 0px 0px') rules.push(`margin: ${d.margin};`);
  if (d.borderRadius && d.borderRadius !== '0px') rules.push(`border-radius: ${d.borderRadius};`);
  if (d.border && !d.border.includes('0px none')) rules.push(`border: ${d.border};`);
  if (d.boxShadow && d.boxShadow !== 'none') rules.push(`box-shadow: ${d.boxShadow};`);
  if (d.display) rules.push(`display: ${d.display};`);
  if (d.flexDirection && d.display && d.display.includes('flex')) rules.push(`flex-direction: ${d.flexDirection};`);
  if (d.justifyContent && d.display && d.display.includes('flex')) rules.push(`justify-content: ${d.justifyContent};`);
  if (d.alignItems && d.display && d.display.includes('flex')) rules.push(`align-items: ${d.alignItems};`);
  if (d.gap && d.gap !== 'normal' && d.gap !== '0px') rules.push(`gap: ${d.gap};`);
  if (d.gridTemplateColumns && d.display && d.display.includes('grid')) rules.push(`grid-template-columns: ${d.gridTemplateColumns};`);
  return rules.join('\n');
}

// Initialize Side Panel
document.addEventListener('DOMContentLoaded', () => {
  loadApiKey();
  setupEventListeners();
  loadTechStack();
});

// Load saved API key from chrome.storage.local
function loadApiKey() {
  chrome.storage.local.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      const input = document.getElementById('api-key-input');
      if (input) input.value = result.geminiApiKey;
    }
  });
}

// Tab Navigation Controller
function switchTab(tabName) {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabViews = document.querySelectorAll('.tab-view');

  tabBtns.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  tabViews.forEach(view => {
    if (view.id === `view-${tabName}`) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  if (tabName === 'build') {
    const el = window.currentInspectedElement || currentInspectData;
    renderBuildTab(el);
  }
}

// Render Build Tab Cards Reactively (0ms local synthesis)
function renderBuildTab(telemetry) {
  const elem = telemetry || window.currentInspectedElement || currentInspectData;
  console.log("Rendering Build Tab with element:", elem);

  const buildEmpty = document.getElementById('build-empty');
  const buildResults = document.getElementById('build-results');
  const promptPreviewEl = document.getElementById('prompt-preview-code');
  const reactSnippetEl = document.getElementById('react-snippet-code');
  const targetSelect = document.getElementById('prompt-target-select');

  const fallbackText = "// No element selected. Click an element on the webpage to generate code.";

  if (!elem) {
    if (buildEmpty) buildEmpty.classList.remove('hidden');
    if (buildResults) buildResults.classList.add('hidden');
    if (promptPreviewEl) promptPreviewEl.textContent = fallbackText;
    if (reactSnippetEl) reactSnippetEl.textContent = fallbackText;
    return;
  }

  if (buildEmpty) buildEmpty.classList.add('hidden');
  if (buildResults) buildResults.classList.remove('hidden');

  const targetPlatform = targetSelect ? targetSelect.value : 'v0_cursor';

  if (window.promptSynthesizer) {
    const promptText = window.promptSynthesizer.generateAIPrompt(elem, targetPlatform);
    const reactCode = window.promptSynthesizer.generateReactSnippet(elem);

    if (promptPreviewEl) promptPreviewEl.textContent = promptText || fallbackText;
    if (reactSnippetEl) reactSnippetEl.textContent = reactCode || fallbackText;
  }
}

// Event Listeners Setup
function setupEventListeners() {
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const clearKeyBtn = document.getElementById('clear-key-btn');
  const toggleBtn = document.getElementById('toggle-btn');

  const tabInspectBtn = document.getElementById('tab-inspect-btn');
  const tabUnderstandBtn = document.getElementById('tab-understand-btn');
  const tabBuildBtn = document.getElementById('tab-build-btn');

  const analyzeBtn = document.getElementById('ai-analyze-btn');
  const recreateBtn = document.getElementById('ai-recreate-btn');
  const triggerUnderstandBtn = document.getElementById('trigger-understand-btn');

  const copyTailwindBtn = document.getElementById('copy-tailwind-btn');
  const copyCssBtn = document.getElementById('copy-css-btn');
  const copyRefactoredBtn = document.getElementById('copy-refactored-btn');

  const promptTargetSelect = document.getElementById('prompt-target-select');
  const copyPromptBtn = document.getElementById('copy-prompt-btn');
  const copyReactCodeBtn = document.getElementById('copy-react-code-btn');

  const apiKeyModal = document.getElementById('api-key-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalSaveKeyBtn = document.getElementById('modal-save-key-btn');
  const modalApiKeyInput = document.getElementById('modal-api-key-input');

  // Tabs Navigation Listeners
  if (tabInspectBtn) tabInspectBtn.addEventListener('click', () => switchTab('inspect'));
  if (tabUnderstandBtn) tabUnderstandBtn.addEventListener('click', () => switchTab('understand'));
  if (tabBuildBtn) tabBuildBtn.addEventListener('click', () => switchTab('build'));

  // Build Tab Engine Selector
  if (promptTargetSelect) {
    promptTargetSelect.addEventListener('change', () => {
      renderBuildTab(window.currentInspectedElement || currentInspectData);
    });
  }

  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
      const previewEl = document.getElementById('prompt-preview-code');
      if (!previewEl || !previewEl.textContent) return;
      navigator.clipboard.writeText(previewEl.textContent).then(() => {
        const textSpan = document.getElementById('copy-prompt-text');
        if (textSpan) textSpan.textContent = 'Copied!';
        setTimeout(() => { if (textSpan) textSpan.textContent = '📋 Copy System Prompt'; }, 2000);
      });
    });
  }

  if (copyReactCodeBtn) {
    copyReactCodeBtn.addEventListener('click', () => {
      const codeEl = document.getElementById('react-snippet-code');
      if (!codeEl || !codeEl.textContent) return;
      navigator.clipboard.writeText(codeEl.textContent).then(() => {
        const textSpan = document.getElementById('copy-react-text');
        if (textSpan) textSpan.textContent = 'Copied!';
        setTimeout(() => { if (textSpan) textSpan.textContent = '📋 Copy React Code'; }, 2000);
      });
    });
  }

  // Settings Drawer Toggle
  if (settingsToggleBtn && settingsPanel) {
    settingsToggleBtn.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
      if (!settingsPanel.classList.contains('hidden')) {
        const input = document.getElementById('api-key-input');
        if (input) input.focus();
      }
    });
  }

  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
      const input = document.getElementById('api-key-input');
      const key = input ? input.value.trim() : '';
      if (!key) {
        showStatus('Please enter a valid API key.', 'error');
        return;
      }
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        showStatus('API Key saved!', 'success');
      });
    });
  }

  if (clearKeyBtn) {
    clearKeyBtn.addEventListener('click', () => {
      chrome.storage.local.remove(['geminiApiKey'], () => {
        const input = document.getElementById('api-key-input');
        if (input) input.value = '';
        if (modalApiKeyInput) modalApiKeyInput.value = '';
        showStatus('API Key Cleared', 'error');
      });
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      if (apiKeyModal) apiKeyModal.classList.add('hidden');
      pendingAIAction = null;
    });
  }

  if (modalSaveKeyBtn) {
    modalSaveKeyBtn.addEventListener('click', () => {
      const key = modalApiKeyInput ? modalApiKeyInput.value.trim() : '';
      if (!key) return;
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        const input = document.getElementById('api-key-input');
        if (input) input.value = key;
        showStatus('API Key saved!', 'success');
        if (apiKeyModal) apiKeyModal.classList.add('hidden');
        if (pendingAIAction) {
          const action = pendingAIAction;
          pendingAIAction = null;
          handleAIAction(action);
        }
      });
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      const isInspecting = toggleBtn.dataset.inspecting === 'true';
      const newState = !isInspecting;
      toggleBtn.dataset.inspecting = newState;

      const btnText = document.getElementById('btn-text');
      if (btnText) {
        btnText.textContent = newState ? 'Stop Inspecting' : 'Start Inspecting';
      } else {
        toggleBtn.textContent = newState ? 'Stop Inspecting' : 'Start Inspecting';
      }

      if (newState) {
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-danger');
      } else {
        toggleBtn.classList.remove('btn-danger');
        toggleBtn.classList.add('btn-primary');
      }

      const tab = await getActiveTab();
      if (tab && tab.id) {
        try {
          const response = await sendTabMessage(tab.id, {
            type: 'TOGGLE_INSPECTOR',
            isInspecting: newState,
            enabled: newState
          });
          if (response && response.techStack) {
            renderTechStack(response.techStack);
          }
        } catch (err) {
          showStatus('Cannot inspect this page (restricted or not loaded)', 'error');
        }
      }
    });
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => handleAIAction('ANALYZE'));
  }

  if (triggerUnderstandBtn) {
    triggerUnderstandBtn.addEventListener('click', () => handleAIAction('ANALYZE'));
  }

  if (recreateBtn) {
    recreateBtn.addEventListener('click', () => handleAIAction('RECREATE'));
  }

  if (copyTailwindBtn) {
    copyTailwindBtn.addEventListener('click', () => {
      if (!currentTailwindClasses) return;
      navigator.clipboard.writeText(currentTailwindClasses).then(() => {
        const copyBtnText = document.getElementById('copy-btn-text') || copyTailwindBtn;
        copyBtnText.textContent = 'Copied!';
        setTimeout(() => { copyBtnText.textContent = 'Copy Tailwind'; }, 2000);
      });
    });
  }

  if (copyCssBtn) {
    copyCssBtn.addEventListener('click', () => {
      const el = window.currentInspectedElement || currentInspectData;
      if (!el) return;
      const cssRules = generateCSSRules(el);
      if (cssRules) {
        navigator.clipboard.writeText(cssRules).then(() => {
          const copyCssText = document.getElementById('copy-css-text');
          if (copyCssText) copyCssText.textContent = 'Copied!';
          setTimeout(() => { if (copyCssText) copyCssText.textContent = 'Copy CSS'; }, 2000);
        });
      }
    });
  }

  if (copyRefactoredBtn) {
    copyRefactoredBtn.addEventListener('click', () => {
      if (!currentRefactoredTailwind) return;
      navigator.clipboard.writeText(currentRefactoredTailwind).then(() => {
        copyRefactoredBtn.textContent = 'Copied!';
        setTimeout(() => { copyRefactoredBtn.textContent = 'Copy Snippet'; }, 2000);
      });
    });
  }
}

// Load Tech Stack from Active Tab and Storage
async function loadTechStack() {
  chrome.storage.local.get(['currentTechStack'], async (res) => {
    if (res.currentTechStack && res.currentTechStack.length > 0) {
      renderTechStack(res.currentTechStack);
    }
    const tab = await getActiveTab();
    if (tab && tab.id) {
      try {
        const response = await sendTabMessage(tab.id, { type: 'GET_TECH_STACK' });
        if (response && response.techStack) {
          renderTechStack(response.techStack);
          chrome.storage.local.set({ currentTechStack: response.techStack });
        }
      } catch (err) {
        console.warn('Could not fetch tech stack:', err);
      }
    }
  });
}

chrome.tabs.onActivated?.addListener(() => {
  loadTechStack();
});

function renderTechStack(stack) {
  const techBadgesEl = document.getElementById('tech-stack-badges');
  if (!techBadgesEl) return;
  if (!stack || stack.length === 0) {
    techBadgesEl.innerHTML = '<span class="empty-tech">No signatures detected</span>';
    return;
  }
  techBadgesEl.innerHTML = stack.map(tech => `
    <span class="tech-badge" style="background-color: ${tech.bg}; color: ${tech.color};">
      <span>${tech.icon}</span> ${tech.name}
    </span>
  `).join('');
}

// Handle On-Demand AI Button Clicks
async function handleAIAction(actionType) {
  const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
  const inputKey = document.getElementById('api-key-input')?.value.trim();
  const apiKey = geminiApiKey || inputKey;

  const activeElement = window.currentInspectedElement || currentInspectData;

  if (!apiKey) {
    pendingAIAction = actionType;

    // Auto-open settings drawer with pulse highlight
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
      settingsPanel.classList.remove('hidden');
      settingsPanel.classList.add('pulse-highlight');
      const input = document.getElementById('api-key-input');
      if (input) input.focus();
      setTimeout(() => settingsPanel.classList.remove('pulse-highlight'), 3000);
    }

    // Reveal overlay modal
    const apiKeyModal = document.getElementById('api-key-modal');
    if (apiKeyModal) apiKeyModal.classList.remove('hidden');
    return;
  }

  if (!activeElement) {
    showStatus('Please inspect a UI element on the webpage first!', 'error');
    switchTab('inspect');
    return;
  }

  const gemini = window.geminiService;

  if (actionType === 'ANALYZE') {
    switchTab('understand');
    const understandEmpty = document.getElementById('understand-empty');
    const understandResults = document.getElementById('understand-results');
    const understandSkeleton = document.getElementById('understand-skeleton');

    if (understandEmpty) understandEmpty.classList.add('hidden');
    if (understandResults) understandResults.classList.add('hidden');
    if (understandSkeleton) understandSkeleton.classList.remove('hidden');

    try {
      const audit = await gemini.analyzeDesignWithGemini(apiKey, activeElement);

      const scoreEl = document.getElementById('design-score-badge');
      const summaryEl = document.getElementById('understand-summary');
      const strengthsEl = document.getElementById('understand-strengths');
      const improvementsEl = document.getElementById('understand-improvements');
      const snippetEl = document.getElementById('understand-refactored-snippet');

      if (scoreEl) scoreEl.textContent = `${audit.designScore || 85} / 100`;
      if (summaryEl) summaryEl.textContent = audit.summary || '';
      if (strengthsEl) {
        strengthsEl.innerHTML = (audit.strengths || []).map(s => `<li>${s}</li>`).join('');
      }
      if (improvementsEl) {
        improvementsEl.innerHTML = (audit.improvements || []).map(imp => `<li>${imp}</li>`).join('');
      }

      currentRefactoredTailwind = audit.refactoredTailwind || '';
      if (snippetEl) snippetEl.textContent = currentRefactoredTailwind;

      if (understandSkeleton) understandSkeleton.classList.add('hidden');
      if (understandResults) {
        understandResults.classList.remove('hidden');
        understandResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      if (understandSkeleton) understandSkeleton.classList.add('hidden');
      if (understandEmpty) {
        understandEmpty.classList.remove('hidden');
        showStatus(`❌ ${err.message}`, 'error');
      }
    }
  } else if (actionType === 'RECREATE') {
    switchTab('build');
    renderBuildTab(activeElement);
    const buildResults = document.getElementById('build-results');
    if (buildResults) buildResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showStatus(msg, type) {
  const statusEl = document.getElementById('api-key-status');
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden');
    statusEl.style.color = type === 'error' ? '#f87171' : '#4ade80';
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3500);
  }
}

// Render Inspect View Metrics
function renderInspectView(d) {
  const emptyView = document.getElementById('empty-view');
  const dataView = document.getElementById('data-view');
  if (emptyView) emptyView.classList.add('hidden');
  if (dataView) dataView.classList.remove('hidden');

  // 1. Tag & Dimensions
  const tagNameEl = document.getElementById('tag-name');
  const dimensionsValEl = document.getElementById('dimensions-val');
  const tailwindRadiusEl = document.getElementById('tailwind-radius') || document.getElementById('tw-radius');

  if (tagNameEl) tagNameEl.textContent = d.tagName ? `<${d.tagName}>` : 'element';
  if (dimensionsValEl) dimensionsValEl.textContent = (d.width && d.height) ? `${d.width} × ${d.height}` : '-';
  if (tailwindRadiusEl) tailwindRadiusEl.textContent = d.tailwindRadius || 'rounded-none';

  // 2. Extracted Tailwind Tokens (Instant Offline Generation via tailwindMapper)
  const tailwindSnippetEl = document.getElementById('tailwind-snippet') || document.getElementById('tw-snippet');
  let tokens = [];
  if (window.tailwindMapper && typeof window.tailwindMapper.generateTailwindTokens === 'function') {
    tokens = window.tailwindMapper.generateTailwindTokens(d);
  } else {
    tokens = d.tailwindClasses || [];
  }
  currentTailwindClasses = tokens.join(' ');
  if (tailwindSnippetEl) {
    tailwindSnippetEl.textContent = currentTailwindClasses || 'no utility classes generated';
  }

  // 3. 📐 Layout & Alignment
  const displayValEl = document.getElementById('display-val');
  const flexDirectionValEl = document.getElementById('flex-direction-val');
  const justifyContentValEl = document.getElementById('justify-content-val');
  const alignItemsValEl = document.getElementById('align-items-val');
  const gapValEl = document.getElementById('gap-val');
  const gridColumnsValEl = document.getElementById('grid-columns-val');

  if (displayValEl) displayValEl.textContent = d.display || '-';
  if (flexDirectionValEl) flexDirectionValEl.textContent = d.flexDirection || '-';
  if (justifyContentValEl) justifyContentValEl.textContent = d.justifyContent || '-';
  if (alignItemsValEl) alignItemsValEl.textContent = d.alignItems || '-';
  if (gapValEl) gapValEl.textContent = d.gap || '-';
  if (gridColumnsValEl) gridColumnsValEl.textContent = d.gridTemplateColumns || '-';

  // 4. 📏 Dimensions & Box Model
  const paddingValEl = document.getElementById('padding-val');
  const marginValEl = document.getElementById('margin-val');
  const borderRadiusValEl = document.getElementById('border-radius-val') || document.getElementById('border-radius');
  const borderValEl = document.getElementById('border-val');
  const boxShadowValEl = document.getElementById('box-shadow-val');

  if (paddingValEl) paddingValEl.textContent = d.padding || '-';
  if (marginValEl) marginValEl.textContent = d.margin || '-';
  if (borderRadiusValEl) borderRadiusValEl.textContent = d.borderRadius || '-';
  if (borderValEl) borderValEl.textContent = d.border || '-';
  if (boxShadowValEl) boxShadowValEl.textContent = d.boxShadow || 'none';

  // 5. 🎨 Typography & Colors
  const fontEl = document.getElementById('font-family');
  const sizeEl = document.getElementById('font-size');
  const weightEl = document.getElementById('font-weight');
  const lineHeightValEl = document.getElementById('line-height-val');
  const letterSpacingValEl = document.getElementById('letter-spacing-val');
  const textAlignValEl = document.getElementById('text-align-val');
  const colorValEl = document.getElementById('color-val') || document.getElementById('text-color');
  const colorSwatchEl = document.getElementById('color-swatch');
  const bgValEl = document.getElementById('bg-val') || document.getElementById('bg-color');
  const bgSwatchEl = document.getElementById('bg-swatch');

  if (fontEl) fontEl.textContent = d.fontFamily || '-';
  if (sizeEl) sizeEl.textContent = d.fontSize || '-';
  if (weightEl) weightEl.textContent = d.fontWeight || '-';
  if (lineHeightValEl) lineHeightValEl.textContent = d.lineHeight || '-';
  if (letterSpacingValEl) letterSpacingValEl.textContent = d.letterSpacing || '-';
  if (textAlignValEl) textAlignValEl.textContent = d.textAlign || '-';

  if (colorValEl) colorValEl.textContent = d.textColorHex ? `${d.textColorHex} (${d.color})` : (d.color || '-');
  if (colorSwatchEl) colorSwatchEl.style.backgroundColor = d.color || 'transparent';
  if (bgValEl) bgValEl.textContent = d.bgColorHex ? `${d.bgColorHex} (${d.backgroundColor})` : (d.backgroundColor || '-');
  if (bgSwatchEl) bgSwatchEl.style.backgroundColor = d.backgroundColor || 'transparent';

  // 6. ♿ Accessibility & Responsiveness Audit
  const contrastValEl = document.getElementById('a11y-contrast-val');
  const targetValEl = document.getElementById('a11y-target-val');
  const readerValEl = document.getElementById('a11y-reader-val');
  const responsiveValEl = document.getElementById('a11y-responsive-val');

  let contrastRatio = d.contrastRatio;
  let touchTarget = d.touchTarget;
  let screenReader = d.screenReader;
  let responsiveStrategy = d.responsiveStrategy;

  if ((!contrastRatio || contrastRatio === '-') && window.a11yAuditor && typeof window.a11yAuditor.runFullA11yAudit === 'function') {
    const audit = window.a11yAuditor.runFullA11yAudit(d);
    contrastRatio = audit.contrastRatio;
    touchTarget = audit.touchTarget;
    screenReader = audit.screenReader;
    responsiveStrategy = audit.responsiveStrategy;
  }

  if (contrastValEl) contrastValEl.textContent = contrastRatio || '-';
  if (targetValEl) targetValEl.textContent = touchTarget || '-';
  if (readerValEl) readerValEl.textContent = screenReader || '-';
  if (responsiveValEl) responsiveValEl.textContent = responsiveStrategy || '-';
}

// Listen for incoming telemetry from content.js (Centralized Global State Sync)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TECH_STACK_UPDATED' && message.techStack) {
    renderTechStack(message.techStack);
  } else if (
    (message.type === 'UI_INSPECT_DATA' || message.type === 'ELEMENT_INSPECTED' || message.type === 'ELEMENT_SELECTED') &&
    message.data
  ) {
    window.currentInspectedElement = message.data;
    currentInspectData = message.data;

    // Instantly sync both Inspect and Build tab views
    renderInspectView(message.data);
    renderBuildTab(message.data);
  }
});
