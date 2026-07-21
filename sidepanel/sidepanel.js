let currentInspectData = null;
let currentTailwindClasses = '';
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
  if (d.color) rules.push(`color: ${d.color};`);
  if (d.backgroundColor) rules.push(`background-color: ${d.backgroundColor};`);
  if (d.padding) rules.push(`padding: ${d.padding};`);
  if (d.margin) rules.push(`margin: ${d.margin};`);
  if (d.borderRadius) rules.push(`border-radius: ${d.borderRadius};`);
  if (d.border) rules.push(`border: ${d.border};`);
  if (d.display) rules.push(`display: ${d.display};`);
  if (d.flexDirection && d.display && d.display.includes('flex')) rules.push(`flex-direction: ${d.flexDirection};`);
  if (d.gap && d.gap !== 'normal' && d.gap !== '0px') rules.push(`gap: ${d.gap};`);
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
      showStatus('API Key loaded successfully!', 'success');
    }
  });
}

// Event Listeners Setup
function setupEventListeners() {
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const toggleBtn = document.getElementById('toggle-btn');
  const analyzeBtn = document.getElementById('ai-analyze-btn') || document.getElementById('analyze-btn');
  const recreateBtn = document.getElementById('ai-recreate-btn') || document.getElementById('recreate-btn');
  const copyOutputBtn = document.getElementById('copy-ai-btn') || document.getElementById('copy-output-btn');
  const copyTailwindBtn = document.getElementById('copy-tailwind-btn');
  const copyCssBtn = document.getElementById('copy-css-btn');

  const apiKeyModal = document.getElementById('api-key-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalSaveKeyBtn = document.getElementById('modal-save-key-btn');
  const modalApiKeyInput = document.getElementById('modal-api-key-input');

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

  if (recreateBtn) {
    recreateBtn.addEventListener('click', () => handleAIAction('RECREATE'));
  }

  if (copyOutputBtn) {
    copyOutputBtn.addEventListener('click', () => {
      const outputContainer = document.getElementById('ai-output-text') || document.getElementById('ai-output-content');
      const outputText = outputContainer ? outputContainer.textContent : '';
      if (outputText) {
        navigator.clipboard.writeText(outputText);
        const btnText = document.getElementById('copy-ai-text') || copyOutputBtn;
        btnText.textContent = 'Copied!';
        setTimeout(() => { btnText.textContent = 'Copy AI Output'; }, 2000);
      }
    });
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
      if (!currentInspectData) return;
      const cssRules = generateCSSRules(currentInspectData);
      if (cssRules) {
        navigator.clipboard.writeText(cssRules).then(() => {
          const copyCssText = document.getElementById('copy-css-text');
          if (copyCssText) copyCssText.textContent = 'Copied!';
          setTimeout(() => { if (copyCssText) copyCssText.textContent = 'Copy CSS'; }, 2000);
        });
      }
    });
  }
}

// Load Tech Stack from Active Tab
async function loadTechStack() {
  const tab = await getActiveTab();
  if (tab && tab.id) {
    try {
      const response = await sendTabMessage(tab.id, { type: 'GET_TECH_STACK' });
      if (response && response.techStack) {
        renderTechStack(response.techStack);
      }
    } catch (err) {
      console.warn('Could not fetch tech stack:', err);
    }
  }
}

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

    // Also reveal overlay modal
    const apiKeyModal = document.getElementById('api-key-modal');
    if (apiKeyModal) apiKeyModal.classList.remove('hidden');
    return;
  }

  if (!currentInspectData) {
    showAIOutput('⚠️ Please click "Start Inspecting" and hover over a component on the page first!', true);
    return;
  }

  showAIOutput('🧠 Processing with AI...', false, true);

  let prompt = '';
  if (actionType === 'ANALYZE') {
    prompt = `Analyze this UI element telemetry:
Tag: <${currentInspectData.tagName}>
Font: ${currentInspectData.fontFamily} (${currentInspectData.fontSize}, Weight: ${currentInspectData.fontWeight})
Colors: Text ${currentInspectData.color}, BG ${currentInspectData.backgroundColor}
Padding: ${currentInspectData.padding}, Margin: ${currentInspectData.margin || 'N/A'}
Border Radius: ${currentInspectData.borderRadius}
Tailwind Classes: ${currentInspectData.tailwindClasses ? currentInspectData.tailwindClasses.join(' ') : 'N/A'}

Provide 4 quick bullet points evaluating Visual Hierarchy, Color Contrast, Spacing System, and 1 UX Suggestion.`;
  } else {
    prompt = `Create a clean, production-ready AI prompt for v0/Cursor to recreate this UI component in React + Tailwind CSS:
Tag: <${currentInspectData.tagName}>
Font: ${currentInspectData.fontFamily} (${currentInspectData.fontSize}, Weight: ${currentInspectData.fontWeight})
Text Color: ${currentInspectData.color}
Background Color: ${currentInspectData.backgroundColor}
Padding: ${currentInspectData.padding}
Border Radius: ${currentInspectData.borderRadius}
Tailwind Utility Classes: ${currentInspectData.tailwindClasses ? currentInspectData.tailwindClasses.join(' ') : 'N/A'}

Start the response directly with: "Build a React component using Tailwind CSS..."`;
  }

  try {
    const resultText = await callGeminiAPI(apiKey, prompt);
    showAIOutput(resultText, false);
  } catch (err) {
    showAIOutput(`❌ API Error: ${err.message}`, true);
  }
}

// Dynamic Model Discovery & API Call with Native Structured JSON Generation
async function callGeminiAPI(apiKey, promptText) {
  let availableModels = [];

  try {
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      availableModels = (modelsData.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name);
    }
  } catch (e) {
    console.warn('Could not list models, falling back to defaults.', e);
  }

  if (availableModels.length === 0) {
    availableModels = [
      'models/gemini-1.5-flash',
      'models/gemini-2.0-flash',
      'models/gemini-1.5-flash-latest'
    ];
  }

  let lastError = null;

  for (const modelName of availableModels) {
    if (modelName.includes('2.5')) continue;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                output: { type: "STRING" }
              },
              required: ["output"]
            }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        lastError = new Error(data.error?.message || `HTTP ${response.status}`);
        continue;
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && parsed.output) {
            return parsed.output.trim();
          }
        } catch (jsonErr) {
          return rawText.trim();
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Unable to generate content with available Gemini models.');
}

// Display Messages with Skeleton Loader & Auto-Scroll
function showAIOutput(text, isError, isLoading = false) {
  const container = document.getElementById('ai-output-text') || document.getElementById('ai-output-content');
  const card = document.getElementById('ai-results-card') || document.getElementById('ai-output-card');
  const loadingEl = document.getElementById('ai-loading');
  const copyBtn = document.getElementById('copy-ai-btn') || document.getElementById('copy-output-btn');

  if (card) {
    card.classList.remove('hidden');
    card.style.display = 'block';
    card.style.borderColor = isError ? '#ef4444' : 'rgba(168, 85, 247, 0.3)';
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  if (loadingEl) {
    if (isLoading) {
      loadingEl.classList.remove('hidden');
    } else {
      loadingEl.classList.add('hidden');
    }
  }

  if (container) {
    container.textContent = isLoading ? '' : text;
  }

  if (copyBtn) {
    if (isError || isLoading) {
      copyBtn.classList.add('hidden');
    } else {
      copyBtn.classList.remove('hidden');
    }
  }
}

function showStatus(msg, type) {
  const statusEl = document.getElementById('api-key-status') || document.getElementById('status-msg');
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden');
    statusEl.style.color = type === 'error' ? '#f87171' : '#4ade80';
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Listen for incoming telemetry from content.js (Local-First Offline Rendering)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UI_INSPECT_DATA' && message.data) {
    currentInspectData = message.data;
    const d = message.data;

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

    // 3. Typography
    const fontEl = document.getElementById('font-family');
    const sizeEl = document.getElementById('font-size');
    const weightEl = document.getElementById('font-weight');
    const lineHeightValEl = document.getElementById('line-height-val');
    const letterSpacingValEl = document.getElementById('letter-spacing-val');

    if (fontEl) fontEl.textContent = d.fontFamily || '-';
    if (sizeEl) sizeEl.textContent = d.fontSize || '-';
    if (weightEl) weightEl.textContent = d.fontWeight || '-';
    if (lineHeightValEl) lineHeightValEl.textContent = d.lineHeight || '-';
    if (letterSpacingValEl) letterSpacingValEl.textContent = d.letterSpacing || '-';

    // 4. Colors
    const colorValEl = document.getElementById('color-val') || document.getElementById('text-color');
    const colorSwatchEl = document.getElementById('color-swatch');
    const bgValEl = document.getElementById('bg-val') || document.getElementById('bg-color');
    const bgSwatchEl = document.getElementById('bg-swatch');

    if (colorValEl) colorValEl.textContent = d.color || '-';
    if (colorSwatchEl) colorSwatchEl.style.backgroundColor = d.color || 'transparent';
    if (bgValEl) bgValEl.textContent = d.backgroundColor || '-';
    if (bgSwatchEl) bgSwatchEl.style.backgroundColor = d.backgroundColor || 'transparent';

    // 5. Box Model & Borders
    const paddingValEl = document.getElementById('padding-val');
    const marginValEl = document.getElementById('margin-val');
    const borderRadiusValEl = document.getElementById('border-radius-val') || document.getElementById('border-radius');
    const borderValEl = document.getElementById('border-val');

    if (paddingValEl) paddingValEl.textContent = d.padding || '-';
    if (marginValEl) marginValEl.textContent = d.margin || '-';
    if (borderRadiusValEl) borderRadiusValEl.textContent = d.borderRadius || '-';
    if (borderValEl) borderValEl.textContent = d.border || '-';

    // 6. Layout & Position
    const displayValEl = document.getElementById('display-val');
    const flexDirectionValEl = document.getElementById('flex-direction-val');
    const gapValEl = document.getElementById('gap-val');

    if (displayValEl) displayValEl.textContent = d.display || '-';
    if (flexDirectionValEl) flexDirectionValEl.textContent = d.flexDirection || '-';
    if (gapValEl) gapValEl.textContent = d.gap || '-';
  }
});
