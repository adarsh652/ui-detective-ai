/**
 * InspectUI - Gemini API Service Module
 * Handles model discovery, error handling, and structured JSON generation.
 */

export async function discoverAvailableModels(apiKey) {
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
    console.warn('Could not list Gemini models, using fallback defaults.', e);
  }

  if (availableModels.length === 0) {
    availableModels = [
      'models/gemini-1.5-flash',
      'models/gemini-2.0-flash',
      'models/gemini-1.5-flash-latest'
    ];
  }
  return availableModels;
}

export async function callGeminiStructuredAPI(apiKey, promptText, schema) {
  const availableModels = await discoverAvailableModels(apiKey);
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
            responseSchema: schema
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded (429). Please wait a moment or check your quota.');
        } else if (response.status === 400 || response.status === 403) {
          throw new Error('Invalid API Key or forbidden access. Please verify your Gemini key.');
        }
        lastError = new Error(data.error?.message || `HTTP ${response.status}`);
        continue;
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        try {
          return JSON.parse(rawText);
        } catch (jsonErr) {
          console.warn('JSON parse error from Gemini response:', jsonErr);
          return { output: rawText.trim() };
        }
      }
    } catch (err) {
      lastError = err;
      if (err.message.includes('Rate limit') || err.message.includes('Invalid API Key')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to connect to Gemini API. Please check your network connection.');
}

export async function analyzeDesignWithGemini(apiKey, telemetry) {
  const prompt = `You are a Senior UI/UX Designer and Frontend Engineer.
Analyze this inspected UI element telemetry:
Tag: <${telemetry.tagName}>
Dimensions: ${telemetry.width} x ${telemetry.height}
Font: ${telemetry.fontFamily} (${telemetry.fontSize}, Weight: ${telemetry.fontWeight})
Colors: Text ${telemetry.color}, BG ${telemetry.effectiveBgColor || telemetry.backgroundColor}
Padding: ${telemetry.padding}, Margin: ${telemetry.margin || 'N/A'}
Border Radius: ${telemetry.borderRadius}, Border: ${telemetry.border}
Display: ${telemetry.display}, FlexDir: ${telemetry.flexDirection || 'N/A'}, Gap: ${telemetry.gap || 'N/A'}
Contrast Ratio: ${telemetry.contrastRatio || 'N/A'}
Touch Target: ${telemetry.touchTarget || 'N/A'}
Tailwind Tokens: ${telemetry.tailwindClasses ? telemetry.tailwindClasses.join(' ') : 'N/A'}

Evaluate Visual Hierarchy, Color Contrast, Spacing System, and UX ergonomics. Provide a Design System Score (0-100), 2-3 key strengths, 2-3 actionable improvements, a summary, and an optimized refactored Tailwind HTML snippet for this component.`;

  const schema = {
    type: "OBJECT",
    properties: {
      summary: { type: "STRING" },
      designScore: { type: "NUMBER" },
      strengths: { type: "ARRAY", items: { type: "STRING" } },
      improvements: { type: "ARRAY", items: { type: "STRING" } },
      refactoredTailwind: { type: "STRING" }
    },
    required: ["summary", "designScore", "strengths", "improvements", "refactoredTailwind"]
  };

  return await callGeminiStructuredAPI(apiKey, prompt, schema);
}

export async function generateRecreatePromptWithGemini(apiKey, telemetry) {
  const prompt = `Create a clean, production-ready AI prompt for v0/Cursor to recreate this UI component in React + Tailwind CSS:
Tag: <${telemetry.tagName}>
Dimensions: ${telemetry.width} x ${telemetry.height}
Font: ${telemetry.fontFamily} (${telemetry.fontSize}, Weight: ${telemetry.fontWeight})
Text Color: ${telemetry.color}
Background Color: ${telemetry.effectiveBgColor || telemetry.backgroundColor}
Padding: ${telemetry.padding}
Border Radius: ${telemetry.borderRadius}
Border: ${telemetry.border}
Converted Tailwind: ${telemetry.tailwindClasses ? telemetry.tailwindClasses.join(' ') : 'N/A'}

Start the response directly with: "Build a React component using Tailwind CSS..."`;

  const schema = {
    type: "OBJECT",
    properties: {
      output: { type: "STRING" }
    },
    required: ["output"]
  };

  const res = await callGeminiStructuredAPI(apiKey, prompt, schema);
  return res.output || res;
}

if (typeof window !== 'undefined') {
  window.geminiService = {
    discoverAvailableModels,
    callGeminiStructuredAPI,
    analyzeDesignWithGemini,
    generateRecreatePromptWithGemini
  };
}
