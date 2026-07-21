let isInspecting = false;
let currentTailwindClasses = '';
let currentInspectData = null;
let currentAIOutput = '';

const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const apiKeyStatus = document.getElementById('api-key-status');

const toggleBtn = document.getElementById('toggle-btn');
const btnText = document.getElementById('btn-text');
const emptyView = document.getElementById('empty-view');
const dataView = document.getElementById('data-view');
const techBadgesEl = document.getElementById('tech-stack-badges');

const tagNameEl = document.getElementById('tag-name');
const tailwindRadiusEl = document.getElementById('tailwind-radius');
const tailwindSnippetEl = document.getElementById('tailwind-snippet');
const copyTailwindBtn = document.getElementById('copy-tailwind-btn');
const copyBtnText = document.getElementById('copy-btn-text');

const fontFamilyEl = document.getElementById('font-family');
const fontSizeEl = document.getElementById('font-size');
const fontWeightEl = document.getElementById('font-weight');
const colorValEl = document.getElementById('color-val');
const colorSwatchEl = document.getElementById('color-swatch');
const bgValEl = document.getElementById('bg-val');
const bgSwatchEl = document.getElementById('bg-swatch');
const paddingValEl = document.getElementById('padding-val');
const marginValEl = document.getElementById('margin-val');
const borderRadiusValEl = document.getElementById('border-radius-val');

const aiAnalyzeBtn = document.getElementById('ai-analyze-btn');
const aiRecreateBtn = document.getElementById('ai-recreate-btn');
const aiResultsCard = document.getElementById('ai-results-card');
const aiResponseTitle = document.getElementById('ai-response-title');
const aiLoading = document.getElementById('ai-loading');
const aiOutputText = document.getElementById('ai-output-text');
const copyAiBtn = document.getElementById('copy-ai-btn');
const copyAiText = document.getElementById('copy-ai-text');

// Load API Key on Startup
chrome.storage.local.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    apiKeyInput.value = result.geminiApiKey;
  }
});

// Save API Key
saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    apiKeyStatus.classList.remove('hidden');
    setTimeout(() => {
      apiKeyStatus.classList.add('hidden');
    }, 2500);
  });
});

// Initialize Tech Stack Detection on sidepanel open
async function loadTechStack() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TECH_STACK' });
      if (response && response.techStack) {
        renderTechStack(response.techStack);
      }
    } catch (err) {
      console.warn('Could not fetch tech stack from active tab:', err);
    }
  }
}

function renderTechStack(stack) {
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

toggleBtn.addEventListener('click', async () => {
  isInspecting = !isInspecting;
  updateToggleButtonUI();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_INSPECTOR',
        isInspecting: isInspecting
      });
      if (response && response.techStack) {
        renderTechStack(response.techStack);
      }
    } catch (err) {
      console.warn('Could not communicate with content script:', err);
    }
  }
});

function updateToggleButtonUI() {
  if (isInspecting) {
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-danger');
    btnText.textContent = 'Stop Inspecting';
  } else {
    toggleBtn.classList.remove('btn-danger');
    toggleBtn.classList.add('btn-primary');
    btnText.textContent = 'Start Inspecting';
  }
}

copyTailwindBtn.addEventListener('click', () => {
  if (!currentTailwindClasses) return;
  navigator.clipboard.writeText(currentTailwindClasses).then(() => {
    copyBtnText.textContent = 'Copied!';
    setTimeout(() => {
      copyBtnText.textContent = 'Copy';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy classes:', err);
  });
});

copyAiBtn.addEventListener('click', () => {
  if (!currentAIOutput) return;
  navigator.clipboard.writeText(currentAIOutput).then(() => {
    copyAiText.textContent = 'Copied!';
    setTimeout(() => {
      copyAiText.textContent = 'Copy AI Output';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy AI output:', err);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UI_INSPECT_DATA' && message.data) {
    renderInspectData(message.data);
  }
});

function renderInspectData(data) {
  currentInspectData = data;
  emptyView.classList.add('hidden');
  dataView.classList.remove('hidden');

  tagNameEl.textContent = data.tagName || 'element';
  tailwindRadiusEl.textContent = data.tailwindRadius || 'rounded-none';
  
  const classesArr = data.tailwindClasses || [];
  currentTailwindClasses = classesArr.join(' ');
  tailwindSnippetEl.textContent = currentTailwindClasses || 'no utility classes generated';

  fontFamilyEl.textContent = data.fontFamily || '-';
  fontSizeEl.textContent = data.fontSize || '-';
  fontWeightEl.textContent = data.fontWeight || '-';

  colorValEl.textContent = data.color || '-';
  colorSwatchEl.style.backgroundColor = data.color || 'transparent';

  bgValEl.textContent = data.backgroundColor || '-';
  bgSwatchEl.style.backgroundColor = data.backgroundColor || 'transparent';

  paddingValEl.textContent = data.padding || '-';
  if (marginValEl) marginValEl.textContent = data.margin || '-';
  borderRadiusValEl.textContent = data.borderRadius || '-';
}

// Call Gemini API
async function callGeminiAPI(promptText) {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    aiResultsCard.classList.remove('hidden');
    aiLoading.classList.add('hidden');
    copyAiBtn.classList.add('hidden');
    aiOutputText.textContent = '⚠️ Please enter and save your Gemini API Key in the AI Configuration section above.';
    return;
  }

  aiResultsCard.classList.remove('hidden');
  aiLoading.classList.remove('hidden');
  aiOutputText.textContent = '';
  copyAiBtn.classList.add('hidden');

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error('No content returned from Gemini API.');
    }

    currentAIOutput = resultText;
    aiOutputText.textContent = resultText;
    copyAiBtn.classList.remove('hidden');
  } catch (error) {
    console.error('Gemini API Error:', error);
    aiOutputText.textContent = `❌ API Error: ${error.message}`;
  } finally {
    aiLoading.classList.add('hidden');
  }
}

// AI Action: Analyze Design
aiAnalyzeBtn.addEventListener('click', () => {
  if (!currentInspectData) return;

  aiResponseTitle.textContent = 'Design Analysis';
  const promptText = `You are an expert UX/UI designer and front-end developer. Analyze this inspected HTML element's design metrics and return a concise 4-bullet UX/UI review highlighting:
1. Design Hierarchy
2. Color Contrast & Accessibility
3. Spacing System Insights
4. Overall Design Choice & Improvement Suggestion

Inspected Element Data:
- HTML Tag: <${currentInspectData.tagName}>
- Tailwind Classes: ${currentTailwindClasses || 'N/A'}
- Font Family: ${currentInspectData.fontFamily}
- Font Size: ${currentInspectData.fontSize}
- Font Weight: ${currentInspectData.fontWeight}
- Text Color: ${currentInspectData.color}
- Background Color: ${currentInspectData.backgroundColor}
- Padding: ${currentInspectData.padding}
- Margin: ${currentInspectData.margin}
- Border Radius: ${currentInspectData.borderRadius} (${currentInspectData.tailwindRadius})`;

  callGeminiAPI(promptText);
});

// AI Action: Generate Recreate Prompt
aiRecreateBtn.addEventListener('click', () => {
  if (!currentInspectData) return;

  aiResponseTitle.textContent = 'Recreate Prompt';
  const promptText = `Construct a clear, highly detailed prompt for AI coding tools (such as v0.dev, Cursor, or Claude) to recreate this UI component using React, Lucide Icons, and Tailwind CSS based on these exact inspected element metrics:

- HTML Tag: <${currentInspectData.tagName}>
- Tailwind Utility Classes: ${currentTailwindClasses || 'N/A'}
- Typography: Font Family "${currentInspectData.fontFamily}", Size ${currentInspectData.fontSize}, Weight ${currentInspectData.fontWeight}
- Colors: Text Color ${currentInspectData.color}, Background Color ${currentInspectData.backgroundColor}
- Spacing & Layout: Padding ${currentInspectData.padding}, Margin ${currentInspectData.margin}
- Border Radius: ${currentInspectData.borderRadius} (${currentInspectData.tailwindRadius})

Format the prompt cleanly so a developer can copy-paste it directly into an AI assistant.`;

  callGeminiAPI(promptText);
});

// Run tech stack detection when sidepanel opens
loadTechStack();
