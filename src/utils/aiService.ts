export interface AIResponse {
  html: string;
  css: string;
}

export const generateWebsite = async (prompt: string, apiKey: string): Promise<AIResponse> => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'HydraWeb',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemma-4-31b-it:free', // Using the user's preferred reliable free model
      messages: [
        {
          role: 'system',
          content: `You are a world-class web designer. Your goal is to generate a modern, responsive, and beautiful single-page website based on the user's request.

          RULES:
          1. Return ONLY a JSON object with two keys: "html" and "css".
          2. The "html" should be a clean HTML snippet (no <html>, <head>, or <body> tags).
          3. The "css" should be standard CSS that styles the HTML provided.
          4. Use modern design principles: plenty of whitespace, elegant typography (sans-serif), and a professional color palette.
          5. Ensure the layout is responsive.
          6. Do NOT include any explanations or markdown formatting outside the JSON.

          Example Output:
          {
            "html": "<section class='hero'><h1>Hello World</h1></section>",
            "css": ".hero { padding: 50px; text-align: center; background: #f0f0f0; }"
          }`
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to generate website');
  }

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);

  if (!content.html || !content.css) {
    throw new Error('The AI failed to generate the website structure. Please try a different prompt.');
  }

  return {
    html: content.html,
    css: content.css,
  };
};
