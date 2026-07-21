let currentInspectData = null;
let currentTailwindClasses = '';

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

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'TOGGLE_INSPECTOR',
            isInspecting: newState,
            enabled: newState
          });
          if (response && response.techStack) {
            renderTechStack(response.techStack);
          }
        } catch (err) {
          console.warn('Could not communicate with tab:', err);
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TECH_STACK' });
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

  showAIOutput('🧠 Analyzing with Gemini AI... Please wait...', false, true);

  let prompt = '';
  if (actionType === 'ANALYZE') {
    prompt = `You are an expert Senior UI/UX Designer.
Analyze this inspected UI element and explain the design choices in 4 concise bullet points:

Element Data:
- Tag: <${currentInspectData.tagName}>
- Typography: ${currentInspectData.fontFamily} (${currentInspectData.fontSize}, Weight: ${currentInspectData.fontWeight})
- Colors: Text ${currentInspectData.color}, Background ${currentInspectData.backgroundColor}
- Padding: ${currentInspectData.padding}
- Margin: ${currentInspectData.margin || 'N/A'}
- Border Radius: ${currentInspectData.borderRadius} (${currentInspectData.tailwindRadius || ''})
- Tailwind Classes: ${currentInspectData.tailwindClasses ? currentInspectData.tailwindClasses.join(' ') : 'N/A'}

Provide 4 quick bullet points:
1. Visual Hierarchy & Typography choice
2. Color Contrast & Mood
3. Spacing & Padding System
4. 1 UX Improvement Suggestion`;
  } else {
    prompt = `You are a Frontend Architect. Create a production-ready AI prompt to recreate this component in React + Tailwind CSS:

Inspected Component Data:
- Tag: <${currentInspectData.tagName}>
- Typography: ${currentInspectData.fontFamily} (${currentInspectData.fontSize})
- Text Color: ${currentInspectData.color}
- Background: ${currentInspectData.backgroundColor}
- Padding: ${currentInspectData.padding}
- Border Radius: ${currentInspectData.borderRadius}
- Converted Tailwind: ${currentInspectData.tailwindClasses ? currentInspectData.tailwindClasses.join(' ') : 'N/A'}

Format output as a structured prompt for v0/Cursor/Claude:
- "Build a React component using Tailwind CSS..."
- Specify exact colors, padding, typography, hover effects, and responsive layout instructions.`;
  }

  try {
    const resultText = await callGeminiAPI(apiKey, prompt);
    showAIOutput(resultText, false);
  } catch (err) {
    showAIOutput(`❌ API Error: ${err.message}`, true);
  }
}

// Auto-discovering Gemini API Call Engine with Fallback Loop
async function callGeminiAPI(apiKey, promptText) {
  let availableModels = [];

  // 1. Retrieve exact list of models enabled for this API key
  try {
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      availableModels = (modelsData.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name);
    }
  } catch (e) {
    console.warn('Could not list models, falling back to default list.', e);
  }

  // Fallback defaults if list fetch fails
  if (availableModels.length === 0) {
    availableModels = [
      'models/gemini-1.5-flash-latest',
      'models/gemini-2.0-flash',
      'models/gemini-2.5-flash',
      'models/gemini-1.5-pro'
    ];
  }

  let lastError = null;

  // 2. Try each available model until one succeeds
  for (const modelName of availableModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        lastError = new Error(data.error?.message || `HTTP ${response.status}`);
        // If deprecated or quota 0 on this specific model, try next model in list
        continue;
      }

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (text) {
        return text; // Success! Return AI response.
      }
    } catch (err) {
      lastError = err;
    }
  }

  // If all models in the key's list failed, throw error
  throw lastError || new Error('Unable to generate content with any available Gemini model.');
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
