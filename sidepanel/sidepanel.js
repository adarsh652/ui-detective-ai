let currentInspectData = null;
let currentTailwindClasses = '';

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
  const saveKeyBtn = document.getElementById('save-key-btn');
  const toggleBtn = document.getElementById('toggle-btn');
  const analyzeBtn = document.getElementById('ai-analyze-btn') || document.getElementById('analyze-btn');
  const recreateBtn = document.getElementById('ai-recreate-btn') || document.getElementById('recreate-btn');
  const copyOutputBtn = document.getElementById('copy-ai-btn') || document.getElementById('copy-output-btn');
  const copyTailwindBtn = document.getElementById('copy-tailwind-btn');

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
          showStatus('Cannot inspect this page (try refreshing the page or navigating to a normal website)', 'error');
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
        setTimeout(() => { btnText.textContent = 'Copy Output'; }, 2000);
      }
    });
  }

  if (copyTailwindBtn) {
    copyTailwindBtn.addEventListener('click', () => {
      if (!currentTailwindClasses) return;
      navigator.clipboard.writeText(currentTailwindClasses).then(() => {
        const copyBtnText = document.getElementById('copy-btn-text') || copyTailwindBtn;
        copyBtnText.textContent = 'Copied!';
        setTimeout(() => { copyBtnText.textContent = 'Copy'; }, 2000);
      });
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

// Handle AI Button Clicks
async function handleAIAction(actionType) {
  const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
  const inputKey = document.getElementById('api-key-input')?.value.trim();
  const apiKey = geminiApiKey || inputKey;

  if (!apiKey) {
    showAIOutput('⚠️ Error: Please enter and save your Gemini API key at the top first.', true);
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

// Helper function to aggressively purge residual reasoning notes from LLM output
function cleanThinkingNotes(text) {
  // Step 1: If explicit <OUTPUT> tags exist, try to extract inside them first
  const outputMatch = text.match(/<OUTPUT>([\s\S]*?)(?:<\/OUTPUT>|$)/i);
  let cleaned = (outputMatch && outputMatch[1]) ? outputMatch[1] : text;

  // Step 2: Search bottom-up for the actual final prompt block
  const lines = cleaned.split('\n');
  let targetIndex = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const lineTrimmed = lines[i].trim().replace(/^['"`*#\s]+/, '');
    const lower = lineTrimmed.toLowerCase();

    if (lower.startsWith('build a react component') || lower.startsWith('build a ')) {
      // Exclude draft note lines like "Target Format: starting with..." or "? Yes"
      if (!lower.includes('starting with') &&
        !lower.includes('target format') &&
        !lower.includes('? yes') &&
        !lower.includes('(check)')) {
        targetIndex = i;
        break;
      }
    }
  }

  if (targetIndex !== -1) {
    return lines.slice(targetIndex).join('\n').trim();
  }

  // Step 3: Fallback cleaning for Design Review bullet points
  return cleaned
    .replace(/<\/?OUTPUT>/gi, '')
    // Remove typical reasoning/drafting headers and bullet lists
    .replace(/^(\s*\*?\s*(Role|Input|Goal|Target Format|Tag|Typography|Text Color|Background|Padding|Border Radius|Converted Tailwind|Constraint|Step \d|Drafting|Revised|Final Prompt|Self-Correction|Note on|Expanding|Double check|One last check|Final Polish)[\s\S]*?\n)+/gi, '')
    .replace(/\*?\s*\(Self-Correction[\s\S]*?\)/gi, '')
    .replace(/\*?\s*Drafting Section[\s\S]*?\n/gi, '')
    .trim();
}

// Display Messages
function showAIOutput(text, isError, isLoading = false) {
  const container = document.getElementById('ai-output-text') || document.getElementById('ai-output-content');
  const card = document.getElementById('ai-results-card') || document.getElementById('ai-output-card');
  const loadingEl = document.getElementById('ai-loading');
  const copyBtn = document.getElementById('copy-ai-btn') || document.getElementById('copy-output-btn');

  if (card) {
    card.classList.remove('hidden');
    card.style.display = 'block';
    card.style.borderColor = isError ? '#ef4444' : 'rgba(168, 85, 247, 0.3)';
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

// Listen for incoming telemetry from content.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UI_INSPECT_DATA' && message.data) {
    currentInspectData = message.data;
    const d = message.data;

    const emptyView = document.getElementById('empty-view');
    const dataView = document.getElementById('data-view');
    if (emptyView) emptyView.classList.add('hidden');
    if (dataView) dataView.classList.remove('hidden');

    const tagNameEl = document.getElementById('tag-name');
    const fontEl = document.getElementById('font-family');
    const sizeEl = document.getElementById('font-size');
    const weightEl = document.getElementById('font-weight');
    const colorValEl = document.getElementById('color-val') || document.getElementById('text-color');
    const colorSwatchEl = document.getElementById('color-swatch');
    const bgValEl = document.getElementById('bg-val') || document.getElementById('bg-color');
    const bgSwatchEl = document.getElementById('bg-swatch');
    const borderRadiusValEl = document.getElementById('border-radius-val') || document.getElementById('border-radius');
    const tailwindRadiusEl = document.getElementById('tailwind-radius') || document.getElementById('tw-radius');
    const paddingValEl = document.getElementById('padding-val');
    const marginValEl = document.getElementById('margin-val');
    const tailwindSnippetEl = document.getElementById('tailwind-snippet') || document.getElementById('tw-snippet');

    if (tagNameEl) tagNameEl.textContent = d.tagName || 'element';
    if (fontEl) fontEl.textContent = d.fontFamily || '-';
    if (sizeEl) sizeEl.textContent = d.fontSize || '-';
    if (weightEl) weightEl.textContent = d.fontWeight || '-';
    if (colorValEl) colorValEl.textContent = d.color || '-';
    if (colorSwatchEl) colorSwatchEl.style.backgroundColor = d.color || 'transparent';
    if (bgValEl) bgValEl.textContent = d.backgroundColor || '-';
    if (bgSwatchEl) bgSwatchEl.style.backgroundColor = d.backgroundColor || 'transparent';
    if (borderRadiusValEl) borderRadiusValEl.textContent = d.borderRadius || '-';
    if (tailwindRadiusEl) tailwindRadiusEl.textContent = d.tailwindRadius || 'rounded-none';
    if (paddingValEl) paddingValEl.textContent = d.padding || '-';
    if (marginValEl) marginValEl.textContent = d.margin || '-';

    const classesArr = d.tailwindClasses || [];
    currentTailwindClasses = classesArr.join(' ');
    if (tailwindSnippetEl) {
      tailwindSnippetEl.textContent = currentTailwindClasses || 'no utility classes generated';
    }
  }
});
