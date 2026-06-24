require('dotenv').config();

const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are a comedic decision engine. Always return structured JSON only.

Act as a humorous decision-making assistant. Be slightly sarcastic but helpful. Always respond, even for absurd questions.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.

The JSON must match this exact shape:
{
  "answer": "Yes | No | Maybe | Proceed with caution | Absolutely | Definitely not",
  "confidence": <integer 0-100>,
  "reasoning": "<funny, slightly sarcastic explanation tied to the question>",
  "risk": "Low | Medium | High",
  "category": "Finance | Relationships | Career | Food | Technology | General"
}

Rules:
- "answer" must be exactly one of: Yes, No, Maybe, Proceed with caution, Absolutely, Definitely not
- "confidence" must be an integer between 0 and 100
- "risk" must be exactly one of: Low, Medium, High
- "category" must be exactly one of: Finance, Relationships, Career, Food, Technology, General
- "reasoning" should be 1-3 sentences, witty and tied to the user's question`;

function extractJson(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function normalizeDecision(data) {
  const allowedAnswers = [
    'Yes',
    'No',
    'Maybe',
    'Proceed with caution',
    'Absolutely',
    'Definitely not',
  ];
  const allowedRisks = ['Low', 'Medium', 'High'];
  const allowedCategories = [
    'Finance',
    'Relationships',
    'Career',
    'Food',
    'Technology',
    'General',
  ];

  const answer = allowedAnswers.find(
    (a) => a.toLowerCase() === String(data.answer || '').toLowerCase()
  ) || 'Maybe';

  const risk = allowedRisks.find(
    (r) => r.toLowerCase() === String(data.risk || '').toLowerCase()
  ) || 'Medium';

  const category = allowedCategories.find(
    (c) => c.toLowerCase() === String(data.category || '').toLowerCase()
  ) || 'General';

  let confidence = parseInt(data.confidence, 10);
  if (Number.isNaN(confidence)) confidence = 50;
  confidence = Math.max(0, Math.min(100, confidence));

  const reasoning = String(data.reasoning || 'The universe shrugged. Classic.').trim();

  return { answer, confidence, reasoning, risk, category };
}

async function getGeminiDecision(question) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.9,
    },
  });

  const result = await model.generateContent(
    `User question: "${question}"\n\nReturn your decision as JSON only.`
  );

  const text = result.response.text();
  const parsed = extractJson(text);
  return normalizeDecision(parsed);
}

app.post('/api/decision', async (req, res) => {
  const question = (req.body?.question || '').trim();

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
  }

  try {
    const decision = await getGeminiDecision(question);
    return res.json(decision);
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return res.status(500).json({ error: 'Failed to get AI decision' });
  }
});

app.listen(PORT, () => {
  console.log(`Should I Do It? server running at http://localhost:${PORT}`);
});
