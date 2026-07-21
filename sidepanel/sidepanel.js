let isInspecting = false;
let currentTailwindClasses = '';

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UI_INSPECT_DATA' && message.data) {
    renderInspectData(message.data);
  }
});

function renderInspectData(data) {
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

// Run tech stack detection when sidepanel opens
loadTechStack();
