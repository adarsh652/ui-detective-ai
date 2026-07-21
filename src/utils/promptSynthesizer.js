/**
 * UI Detective AI - Local Client-Side Prompt Synthesizer & React JSX Code Generator
 * Generates 0ms latency system prompts for v0/Cursor and modular React + Tailwind JSX components.
 */

export function generateAIPrompt(telemetry, targetPlatform = 'v0_cursor') {
  if (!telemetry) return '';

  const tag = telemetry.tagName || 'div';
  const width = telemetry.width || 'auto';
  const height = telemetry.height || 'auto';
  const font = telemetry.fontFamily || 'sans-serif';
  const size = telemetry.fontSize || '16px';
  const weight = telemetry.fontWeight || '400';
  const color = telemetry.textColorHex || telemetry.color || '#000000';
  const bg = telemetry.bgColorHex || telemetry.effectiveBgColor || telemetry.backgroundColor || '#ffffff';
  const padding = telemetry.padding || '0px';
  const margin = telemetry.margin || '0px';
  const radius = telemetry.borderRadius || '0px';
  const border = telemetry.border || 'none';
  const shadow = telemetry.boxShadow || 'none';
  const display = telemetry.display || 'block';
  const flexDir = telemetry.flexDirection || 'row';
  const justify = telemetry.justifyContent || 'start';
  const align = telemetry.alignItems || 'stretch';
  const gap = telemetry.gap || '0px';
  const classes = telemetry.tailwindClasses ? (Array.isArray(telemetry.tailwindClasses) ? telemetry.tailwindClasses.join(' ') : telemetry.tailwindClasses) : '';
  const contrast = telemetry.contrastRatio || 'N/A';
  const touch = telemetry.touchTarget || 'N/A';

  if (targetPlatform === 'v0_cursor') {
    return `// Prompt for v0.dev / Cursor AI / ChatGPT
Build a production-grade, pixel-perfect React (Next.js) component using Tailwind CSS based on this inspected element telemetry:

Element Tag: <${tag}> (${width} × ${height})
Tailwind Classes: ${classes || 'p-4 rounded-md'}
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

export function generateReactSnippet(telemetry) {
  if (!telemetry) return '';

  const rawTag = (telemetry.tagName || 'div').toLowerCase();
  const validTags = ['div', 'button', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'input', 'img'];
  const tag = validTags.includes(rawTag) ? rawTag : 'div';

  const classes = telemetry.tailwindClasses ? (Array.isArray(telemetry.tailwindClasses) ? telemetry.tailwindClasses.join(' ') : telemetry.tailwindClasses) : 'p-4 bg-slate-900 text-white rounded-md';

  const componentName = tag.charAt(0).toUpperCase() + tag.slice(1) + 'Component';

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

  const innerContent = telemetry.hasText ? `Inspected <${tag}> Content` : `<!-- Inspected Component Content -->`;

  return `import React from 'react';

export default function ${componentName}() {
  return (
    <${tag} ${elementAttributes}>
      ${innerContent}
    </${tag}>
  );
}`;
}

if (typeof window !== 'undefined') {
  window.promptSynthesizer = {
    generateAIPrompt,
    generateReactSnippet
  };
}
