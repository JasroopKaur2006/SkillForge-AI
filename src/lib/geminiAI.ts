import type { QuestionFeedback } from '../types';
import { generateSmartAnswer as localGenerateAnswer, evaluateAnswer as localEvaluateAnswer } from './interviewAI';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-flash-latest';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

/**
 * Calls Google Gemini REST API with model fallback
 */
async function callGeminiApi(
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[],
  systemInstruction?: string
): Promise<string | null> {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const payload: any = { contents };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(`Gemini API call to ${model} returned HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];

      if (candidate?.content?.parts) {
        const textParts = candidate.content.parts
          .map((p: any) => p.text)
          .filter(Boolean)
          .join('\n');

        if (textParts.trim()) {
          return textParts.trim();
        }
      }
    } catch (err) {
      console.warn(`Error calling Gemini model ${model}:`, err);
    }
  }

  return null;
}

/**
 * Intelligent local conversational fallback when offline or rate-limited
 */
function localConversationalFallback(prompt: string, history: ChatMessage[]): string {
  const p = prompt.toLowerCase().trim();

  // Greetings and Casual
  if (p === 'how are you' || p === 'how are you?' || p === "how're you" || p === 'how are you doing' || p === 'how are you doing?') {
    return "I'm doing great, thank you for asking! How are you doing today? How can I help you?";
  }
  if (p === 'hi' || p === 'hello' || p === 'hey' || p === 'greetings' || p === 'good morning' || p === 'good afternoon' || p === 'good evening') {
    return "Hello! How can I help you today?";
  }
  if (p.includes('who are you') || p.includes('what are you') || p.includes('what can you do')) {
    return "I'm SkillForge Copilot, your AI assistant. I can help you with technical questions, coding problems, conceptual explanations, interview preparation, career questions, or just chat. What would you like to explore?";
  }
  if (p === 'thank you' || p === 'thanks' || p === 'thx' || p === 'thank you so much') {
    return "You're very welcome! Let me know if you need anything else.";
  }
  if (p.includes('tell me a joke') || p.includes('joke')) {
    return "Why do programmers prefer dark mode?\n\nBecause light attracts bugs!";
  }

  // Technical definitions
  if (p.includes('what is a database') || p.includes('explain database')) {
    return `A **database** is an organized collection of structured information or data stored electronically in a computer system.

### Key Types:
1. **Relational Databases (SQL):** Store data in structured tables with rows and columns (e.g., PostgreSQL, MySQL). They enforce strict schemas and relational integrity through foreign keys and ACID transactions.
2. **Non-Relational Databases (NoSQL):** Store unstructured or semi-structured data like JSON documents, key-value pairs, or graphs (e.g., MongoDB, Redis, Cassandra). They prioritize flexible schemas and horizontal scalability.

### Why Databases Matter:
Unlike simple files, databases provide concurrent multi-user access, high-speed indexing, backup mechanisms, and transactional guarantees so data isn't lost during server crashes.`;
  }

  if (p.includes('what is an api') || p.includes('explain api')) {
    return `An **API (Application Programming Interface)** is a set of rules and protocols that allows two software applications to communicate with each other.

### A Real-World Analogy:
Think of an API like a waiter in a restaurant. You (the client application) look at the menu and place an order. The waiter (the API) takes your request to the kitchen (the server/database), and brings back your food (the data response).

### Common Example:
When a weather app on your phone shows tomorrow's forecast, it sends an HTTP request to a weather service API and receives the temperature data back in JSON format.`;
  }

  if (p.includes('what is docker') || p.includes('explain docker') || p.includes('container')) {
    return `**Docker** is an open-source platform that packages applications and all their dependencies into lightweight, isolated environments called **containers**.

- **The Problem It Solves:** It eliminates the classic *"it works on my machine"* problem by ensuring the exact same code, runtime, libraries, and OS settings run identically in development and production.
- **Container vs. Virtual Machine:** VMs virtualize an entire operating system (heavy), while Docker containers share the host OS kernel (extremely lightweight and boots in seconds).`;
  }

  if (p.includes('what is git') || p.includes('explain git')) {
    return `**Git** is a distributed version control system that tracks changes in source code during software development.

- **Version History:** It allows developers to record revisions, revert to previous code states, and trace who changed what.
- **Branching:** Teams can work on separate features in parallel branches without interfering with the main production codebase, then merge changes through Pull Requests (PRs).`;
  }

  // Coding Help
  if (p.includes('center a div') || (p.includes('center') && p.includes('div'))) {
    return `The most modern and reliable way to center a \`div\` in CSS:

\`\`\`css
/* Method 1: Flexbox (Recommended) */
.parent {
  display: flex;
  justify-content: center; /* Horizontally center */
  align-items: center;     /* Vertically center */
  min-height: 100vh;
}

/* Method 2: CSS Grid */
.parent {
  display: grid;
  place-items: center;
  min-height: 100vh;
}
\`\`\``;
  }

  if (p.includes('reverse a string') && p.includes('python')) {
    return `In Python, the cleanest and most Pythonic way to reverse a string is using slicing:

\`\`\`python
# Slicing: [start:stop:step]
text = "hello"
reversed_text = text[::-1]
print(reversed_text)  # Output: "olleh"
\`\`\`

Alternatively, using \`reversed()\`:
\`\`\`python
reversed_text = "".join(reversed(text))
\`\`\``;
  }

  // Check last message for context
  const lastUserMsg = history.filter((m) => m.sender === 'user').slice(-2, -1)[0]?.text.toLowerCase() || '';
  if (p.includes('example') || p.includes('give me an example') || p.includes('show an example')) {
    if (lastUserMsg.includes('database')) {
      return `Here is a concrete database example:

Imagine an e-commerce store with two tables:
1. **Users Table:** \`id\`, \`name\`, \`email\`
2. **Orders Table:** \`id\`, \`user_id\`, \`total_price\`, \`created_at\`

Using SQL, you can join them:
\`\`\`sql
SELECT users.name, orders.total_price 
FROM users 
JOIN orders ON users.id = orders.user_id 
WHERE orders.total_price > 100;
\`\`\`
This query fetches all customers who placed an order over $100.`;
    }
    if (lastUserMsg.includes('api')) {
      return `Here is a concrete API example using JavaScript \`fetch\`:

\`\`\`javascript
// Fetch user details from a public REST API
fetch("https://jsonplaceholder.typicode.com/users/1")
  .then((response) => response.json())
  .then((userData) => {
    console.log("User Name:", userData.name);
    console.log("Email:", userData.email);
  });
\`\`\`
The server responds with a JSON payload containing the requested user object.`;
    }
  }

  return `I understand you're asking about "${prompt}". 

Could you specify what aspect of this you'd like to dive into? I can provide code examples, architectural breakdowns, pros & cons, or practical explanations.`;
}

/**
 * Conversational Copilot powered by Gemini with full history and context
 */
export async function generateCopilotResponse(
  prompt: string,
  history: ChatMessage[],
  roleContext: { role: string; userName: string }
): Promise<string> {
  const systemInstruction = `You are SkillForge Copilot, a helpful, intelligent conversational AI assistant built for students and professionals.
CRITICAL INSTRUCTIONS:
1. Answer ONLY what the user is asking directly, concisely, and naturally.
2. Maintain full conversation context from prior turns.
3. For casual greetings or chat ("How are you?", "Hi", "Good morning"), answer warmly, casually, and briefly.
4. For conceptual or technical questions ("What is a database?", "What is an API?"), provide clear, engaging, easy-to-understand explanations with formatting.
5. For coding questions, provide clean, idiomatic code examples with explanations.
6. For career, resume, roadmap, or interview questions, provide expert career advice.
7. NEVER give unsolicited career guidance, roadmap advice, or resume critique unless the user explicitly asks for career, role, or resume advice.
8. NEVER mention Jordan or force the response into Software Engineering topics unless the user asks about it.`;

  // Format history for Gemini API
  const contents = [
    ...history.slice(-8).map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: m.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: prompt }],
    },
  ];

  try {
    const aiResponse = await callGeminiApi(contents, systemInstruction);
    if (aiResponse) {
      return aiResponse;
    }
  } catch (err) {
    console.warn('Gemini Copilot generation failed, using conversational fallback:', err);
  }

  // Fallback to local intent-aware conversational engine
  return localConversationalFallback(prompt, history);
}

/**
 * Mock Interview Smart Answer Generator powered by Gemini
 */
export async function generateMockInterviewAnswer(question: string, role: string): Promise<string> {
  const prompt = `You are an expert interviewee for the role of ${role}.
Answer this specific interview question professionally, concisely (100–160 words), and naturally:
"${question}"

IMPORTANT GUIDELINES:
- Answer ONLY the exact question asked.
- If behavioral or situational, use the STAR methodology naturally (Situation, Task, Action, Result).
- If technical, outline your troubleshooting mindset, specific tools, and verification.
- Use natural first-person phrasing ("In my recent project, I...").
- Do not include meta commentary or introductory filler like "Here is an answer". Just output the response.`;

  try {
    const aiResponse = await callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
    if (aiResponse) {
      return aiResponse;
    }
  } catch (err) {
    console.warn('Gemini mock answer generation failed, using local generator:', err);
  }

  return localGenerateAnswer(question, role);
}

/**
 * Mock Interview Deep Evaluator powered by Gemini
 */
export async function evaluateMockInterviewAnswer(
  question: string,
  answer: string,
  role: string
): Promise<QuestionFeedback> {
  const prompt = `You are a senior hiring manager and interview coach evaluating a candidate's answer for the role of ${role}.

Question: "${question}"
Candidate's Answer: "${answer}"

Evaluate strictly based on what the candidate actually said in relation to the specific question asked. Do not use generic praise.

Output strictly valid JSON with this exact schema (no markdown fences, raw JSON only):
{
  "communication": number (0-100),
  "relevance": number (0-100: how directly the candidate answered the exact prompt),
  "structure": number (0-100),
  "summary": string (1-2 sentences giving honest, specific feedback on what they said),
  "strengths": [string, string] (2 specific strengths directly referencing their words),
  "improvements": [string, string] (2 actionable tips on what was missing or how to elevate),
  "modelAnswerSuggestion": string (an exemplary response answering this exact question)
}`;

  try {
    const aiResponse = await callGeminiApi([{ role: 'user', parts: [{ text: prompt }] }]);
    if (aiResponse) {
      const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.communication && parsed.relevance && parsed.summary) {
        return {
          communication: Math.min(98, Math.max(45, parsed.communication)),
          relevance: Math.min(98, Math.max(40, parsed.relevance)),
          structure: Math.min(98, Math.max(40, parsed.structure)),
          summary: parsed.summary,
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [parsed.strengths],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [parsed.improvements],
          modelAnswerSuggestion: parsed.modelAnswerSuggestion,
        };
      }
    }
  } catch (err) {
    console.warn('Gemini evaluation failed or JSON parse error, using semantic evaluator:', err);
  }

  return localEvaluateAnswer(question, answer, role);
}
