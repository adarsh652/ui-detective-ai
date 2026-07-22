/**
 * InspectUI - Local Client-Side Prompt Synthesizer & React JSX Code Generator
 * Generates 0ms latency system prompts for v0/Cursor and modular React + Tailwind JSX components.
 */

export function generateAIPrompt(data, targetPlatform = 'v0_cursor') {
  if (!data) return '';

  const tag = (data.tagName || 'div').toLowerCase();
  const width = data.width || 'auto';
  const height = data.height || 'auto';
  const font = data.fontFamily || 'sans-serif';
  const size = data.fontSize || '16px';
  const weight = data.fontWeight || '400';
  const color = data.textColorHex || data.color || '#000000';
  const bg = data.bgColorHex || data.effectiveBgColor || data.backgroundColor || '#ffffff';
  const padding = data.padding || '0px';
  const margin = data.margin || '0px';
  const radius = data.borderRadius || '0px';
  const border = data.border || 'none';
  const shadow = data.boxShadow || 'none';
  const display = data.display || 'block';
  const flexDir = data.flexDirection || 'row';
  const justify = data.justifyContent || 'start';
  const align = data.alignItems || 'stretch';
  const gap = data.gap || '0px';
  const classes = Array.isArray(data.tailwindClasses) && data.tailwindClasses.length > 0
    ? data.tailwindClasses.join(' ')
    : (data.className || (typeof data.tailwindClasses === 'string' ? data.tailwindClasses : 'p-4 rounded-lg bg-card text-card-foreground border'));
  const contrast = data.contrastRatio || 'N/A';
  const touch = data.touchTarget || 'N/A';

  if (targetPlatform === 'v0_cursor') {
    return `// Prompt for v0.dev / Cursor AI / ChatGPT
Build a production-grade, pixel-perfect React (Next.js) component using Tailwind CSS based on this inspected element telemetry:

Element Tag: <${tag}> (${width} × ${height})
Tailwind Classes: ${classes}
Design Tokens:
- Display: ${display} (direction: ${flexDir}, justify: ${justify}, align: ${align}, gap: ${gap})
- Typography: font-family ${font}, size ${size}, weight ${weight}, color ${color}
- Visuals: background ${bg}, border-radius ${radius}, border ${border}, shadow ${shadow}
- Box Model: padding ${padding}, margin ${margin}
- Accessibility Spec: WCAG Contrast ${contrast}, Touch Target ${touch}

Instructions:
1. Return clean, modular React component code (TypeScript preferred).
2. Utilize Tailwind CSS v3/v4 utility classes exclusively.
3. Ensure semantic HTML structure, proper aria labels, and responsive layout.`;
  }

  return `// Generic AI Component Prompt
Generate a React component matching this inspected design telemetry:
- Tag: <${tag}> (${width} × ${height})
- Extracted Tailwind: ${classes}
- Styles: font ${font} (${size}, ${weight}), text color ${color}, background ${bg}, padding ${padding}, margin ${margin}, radius ${radius}, border ${border}
- Layout: ${display} (gap: ${gap})
- Accessibility: Contrast ${contrast}, Target size ${touch}

Provide idiomatic JSX code with Tailwind utility styling and responsive behavior.`;
}

export function generateReactSnippet(data) {
  if (!data) return '';

  const rawTag = (data.tagName || 'div').toLowerCase();
  const validTags = ['div', 'button', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'input', 'img'];
  const tag = validTags.includes(rawTag) ? rawTag : 'div';

  const classes = Array.isArray(data.tailwindClasses) && data.tailwindClasses.length > 0
    ? data.tailwindClasses.join(' ')
    : (data.className || (typeof data.tailwindClasses === 'string' ? data.tailwindClasses : 'p-4 rounded-lg bg-card text-card-foreground border'));

  const componentName = tag.charAt(0).toUpperCase() + tag.slice(1) + 'Component';
  const text = (data.textContent || (data.hasText ? 'Inspected Component Content' : '')).trim() || 'Component Content';

  let elementAttributes = `className="${classes}"`;
  if (tag === 'button') {
    elementAttributes += ` type="button"`;
  } else if (tag === 'a') {
    elementAttributes += ` href="#"`;
  } else if (tag === 'input') {
    elementAttributes += ` type="text" placeholder="Search or type..."`;
    return `import React from 'react';

export default function ${componentName}() {
  return (
    <input ${elementAttributes} />
  );
}`;
  } else if (tag === 'img') {
    elementAttributes += ` src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" alt="Inspected visual element"`;
    return `import React from 'react';

export default function ${componentName}() {
  return (
    <img ${elementAttributes} />
  );
}`;
  }

  return `import React from 'react';

export default function ${componentName}() {
  return (
    <${tag} ${elementAttributes}>
      ${text}
    </${tag}>
  );
}`;
}

export const generateReactComponent = generateReactSnippet;

if (typeof window !== 'undefined') {
  window.promptSynthesizer = {
    generateAIPrompt,
    generateReactSnippet,
    generateReactComponent
  };
}
