export type QuestionType = 'technical' | 'behavioral' | 'situational' | 'experience' | 'hr';

export interface EvaluatedFeedback {
  communication: number;
  relevance: number;
  structure: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionType: QuestionType;
  modelAnswerSuggestion?: string;
}

/**
 * Detects the question type based on linguistic markers and semantics
 */
export function detectQuestionType(question: string, explicitCategory?: string): QuestionType {
  const q = question.toLowerCase();

  if (q.includes('tell me about yourself') || q.includes('walk me through your resume') || q.includes('background') || q.includes('project you built') || q.includes('case study')) {
    return 'experience';
  }
  if (q.includes('why do you want') || q.includes('where do you see yourself') || q.includes('weakness') || q.includes('strength') || q.includes('culture') || q.includes('salary') || q.includes('values')) {
    return 'hr';
  }
  if (q.includes('how would you') || q.includes('what if') || q.includes('if a client') || q.includes('if an engineer') || q.includes('tight deadline') || q.includes('push back') || q.includes('disagree')) {
    return 'situational';
  }
  if (q.includes('debug') || q.includes('algorithm') || q.includes('sql') || q.includes('database') || q.includes('api') || q.includes('code') || q.includes('figma') || q.includes('pandas') || q.includes('architecture') || q.includes('trade-off') || q.includes('technical') || q.includes('system design') || q.includes('data structure')) {
    return 'technical';
  }
  if (explicitCategory?.toLowerCase() === 'technical') return 'technical';
  if (explicitCategory?.toLowerCase() === 'situational') return 'situational';
  return 'behavioral';
}

/**
 * Generates an appropriate, natural, professional answer directly addressing the exact question asked
 */
export function generateSmartAnswer(question: string, role: string): string {
  const q = question.toLowerCase();
  const qType = detectQuestionType(question);

  // Technical questions
  if (qType === 'technical' || q.includes('debug') || q.includes('sql') || q.includes('api') || q.includes('database')) {
    if (q.includes('debug') || q.includes('bottleneck') || q.includes('production bug') || q.includes('latency')) {
      return `When diagnosing an unexpected production bug or latency spike, I follow a disciplined 4-step triage process:
1. **Reproduce & Telemetry Isolation:** I first inspect application logs, stack traces, and APM metrics (like Datadog or Sentry) to identify the specific error frequency, payload signatures, and affected environment.
2. **Local Reproduction:** I isolate the failing component in a local test environment and write a failing unit/integration test to reproduce the exact state reliably.
3. **Root Cause Analysis:** For performance bottlenecks, I profile CPU flamegraphs, database query plans (EXPLAIN ANALYZE), or memory leaks rather than guessing. 
4. **Fix, Verify & Prevent:** Once patched, I ensure the test passes, run regression suites, deploy a staged canary release, and document the root cause in a blameless post-mortem to prevent recurrences.`;
    }

    if (q.includes('sql') || q.includes('nosql') || q.includes('database') || q.includes('trade-off')) {
      return `When choosing between relational (SQL) and NoSQL storage engines, I evaluate three critical axes:
- **Transactional Consistency vs. Write Throughput:** If the domain demands strict ACID guarantees—such as financial ledger transactions or user auth credentials—PostgreSQL is my go-to choice due to mature relational constraints.
- **Data Shape & Schema Evolution:** For rapidly mutating semi-structured documents, telemetry logs, or unstructured metadata, NoSQL document stores (like MongoDB or DynamoDB) eliminate schema migration overhead.
- **Query Patterns & Joins:** Relational databases excel when complex analytical JOINs across normalized entities are frequent. For key-value lookups with predictable horizontal sharding, NoSQL provides superior low-latency reads at scale.`;
    }

    if (q.includes('figma') || q.includes('design system') || q.includes('component')) {
      return `I maintain design systems using an atomic hierarchy:
- **Design Tokens:** Global primitives for color hexes, typography scales, spacing units, and elevation shadows defined as variables.
- **Component Variants:** Building flexible Figma components with autolayout, responsive constraints, and interactive states (hover, pressed, disabled, error).
- **Documentation & Token Sync:** Each component has clear usage guidelines and semantic token mappings that align 1:1 with frontend CSS variables, making developer handoff seamless.`;
    }

    if (q.includes('clean') || q.includes('messy dataset') || q.includes('pandas') || q.includes('missing values')) {
      return `My approach to data wrangling follows a systematic pipeline:
- **Exploratory Profiling:** I assess null counts, data type mismatches, and summary statistics using Pandas to understand missingness mechanisms (MCAR vs. MAR).
- **Deduplication & Imputation:** For numeric features with low skew, I impute medians; for categorical gaps, I flag missingness explicitly or use domain-informed rules rather than dropping rows blindly.
- **Outlier Validation:** I inspect boxplots and IQR distributions to separate true anomaly signals from instrumentation errors before feeding into downstream models.`;
    }

    if (q.includes('keyword') || q.includes('seo') || q.includes('conversion') || q.includes('cpc') || q.includes('campaign')) {
      return `To diagnose high CPC and low conversion rate, I bifurcate the user funnel:
- **Top of Funnel (Ad side):** If CTR is below benchmark, I test ad creative variations, copy relevance, and negative keyword lists to weed out low-intent impressions.
- **Bottom of Funnel (Landing side):** If CTR is healthy but conversions falter, the friction is on-page. I audit headline message match, load speeds (<2s), mobile responsiveness, and checkout friction via Hotjar heatmaps and Google Analytics drop-off funnels.`;
    }

    return `In approaching this technical challenge for ${role}, I focus on modular architecture and measurable outcomes. I begin by defining the interface contracts, validating edge cases with automated tests, and benchmarking performance under realistic loads before shipping to production.`;
  }

  // Situational & Conflict Questions
  if (qType === 'situational' || q.includes('deadline') || q.includes('disagree') || q.includes('push back') || q.includes('trade-off')) {
    return `In a situation where deadlines or requirements conflict, I prioritize transparency and data-backed trade-offs:
- **Active Listening:** I first sync with the stakeholder or team member to deeply understand the underlying business driver or technical constraint.
- **Options with Trade-offs:** Rather than simply saying "no", I present two concrete alternatives: for instance, delivering the critical core MVP on time while deferring secondary enhancements to the next sprint, or adjusting timelines with explicit risk tradeoffs.
- **Collaborative Consensus:** By aligning on user value and team capacity, we reach an informed agreement without compromising code quality or team morale.`;
  }

  // Experience / Project questions
  if (qType === 'experience' || q.includes('proud') || q.includes('project') || q.includes('walk me through')) {
    return `In my primary portfolio project as an aspiring ${role}, I took full ownership of building a responsive, end-to-end application from scratch:
- **Situation & Problem:** Students frequently struggled with fragmented career advice and unorganized skill tracking across disparate websites.
- **My Action & Technical Choices:** I designed the relational schema, built authenticated REST endpoints, and integrated an interactive dashboard with real-time state synchronization.
- **Measurable Result:** The application achieved sub-500ms load times, passed full test coverage, and successfully guided 50+ beta testers through personalized roadmaps with positive qualitative feedback.`;
  }

  // HR / Career Goals / Values
  if (qType === 'hr' || q.includes('two years') || q.includes('learn recently') || q.includes('why do you')) {
    return `Over the next two years, my goal is to evolve from building solid foundational features to driving architectural decisions and mentoring junior teammates in ${role}. 

I am particularly focused on deepening my expertise in scalable system design and automated delivery pipelines. Outside of coursework, I consistently build hands-on projects, study engineering post-mortems, and contribute to open-source discussions to ensure my technical judgment stays sharp and aligned with industry best practices.`;
  }

  // Default STAR Response
  return `To address this, I apply the STAR framework:
- **Situation:** In my previous academic capstone project, our team faced tight delivery timelines with ambiguous scope.
- **Task:** I was tasked with driving the core deliverables and aligning our technical approach.
- **Action:** I introduced weekly milestones, organized peer code reviews, and implemented core features with test-driven discipline.
- **Result:** We delivered the final release three days ahead of schedule, with zero critical defects and an overall 94% grading rubric score.`;
}

/**
 * Deep semantic evaluation of user's answer against the specific question
 */
export function evaluateAnswer(question: string, answer: string, role: string): EvaluatedFeedback {
  const q = question.toLowerCase();
  const a = answer.trim();
  const qType = detectQuestionType(question);

  const wordCount = a ? a.split(/\s+/).length : 0;
  const sentences = a ? a.split(/[.!?]+/).filter(Boolean).length : 0;

  // Key indicators
  const hasNumbersOrMetrics = /\b\d+(\.\d+)?%?|\b\d+\s*(ms|seconds|users|hours|days|sprint|points)\b/i.test(a);
  const hasFirstPerson = /\b(i|my|we|our|me)\b/i.test(a);
  const hasStarWords = /\b(situation|task|action|result|because|therefore|resolved|achieved|implemented|led to|impact|measured)\b/i.test(a);
  const hasTechnicalTerms = /\b(api|database|query|function|component|test|framework|latency|metrics|git|design|architecture|state|model|cache|frontend|backend)\b/i.test(a);

  // Question-specific keyword presence check
  const questionWords = q
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !['about', 'would', 'could', 'should', 'which', 'their', 'there'].includes(w));
  const matchedQuestionTerms = questionWords.filter((w) => a.toLowerCase().includes(w));
  const questionCoverageRatio = questionWords.length > 0 ? matchedQuestionTerms.length / questionWords.length : 0.5;

  // Communication score (clarity, depth, length)
  let communication = 60;
  if (wordCount >= 25) communication += 12;
  if (wordCount >= 60) communication += 12;
  if (wordCount >= 100) communication += 8;
  if (wordCount > 300) communication -= 10; // overly verbose
  if (sentences >= 3) communication += 6;
  communication = Math.min(96, Math.max(45, communication));

  // Relevance score (did they answer the prompt)
  let relevance = 62;
  if (questionCoverageRatio > 0.25) relevance += 14;
  if (questionCoverageRatio > 0.5) relevance += 12;
  if (a.toLowerCase().includes(role.toLowerCase()) || hasTechnicalTerms) relevance += 8;
  if (wordCount < 15) relevance -= 25; // too short to be relevant
  relevance = Math.min(98, Math.max(40, relevance));

  // Structure score (STAR, problem/resolution, organization)
  let structure = 58;
  if (hasStarWords) structure += 16;
  if (hasNumbersOrMetrics) structure += 14;
  if (sentences >= 4) structure += 8;
  if (wordCount < 20) structure -= 20;
  structure = Math.min(95, Math.max(35, structure));

  // Specific Strengths & Improvements
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (hasFirstPerson) {
    strengths.push('Demonstrates direct personal ownership with clear first-person responsibility.');
  }
  if (matchedQuestionTerms.length > 0) {
    strengths.push(`Directly targets the prompt topic (${matchedQuestionTerms.slice(0, 3).join(', ')}).`);
  }
  if (hasNumbersOrMetrics) {
    strengths.push('Effectively quantifies impact with concrete metrics or timeline indicators.');
  } else {
    improvements.push('Add specific quantifiable outcomes (e.g. "% performance gain", "hours saved", or "number of users impacted").');
  }

  if (qType === 'behavioral' || qType === 'situational') {
    if (hasStarWords) {
      strengths.push('Applies clear structured storytelling aligned with the STAR methodology.');
    } else {
      improvements.push('Frame your narrative more explicitly: Situation ➔ Task ➔ Action ➔ Final Result.');
    }
  }

  if (qType === 'technical' && !hasTechnicalTerms) {
    improvements.push(`Deepen technical credibility by naming the specific tools, libraries, or architectural patterns relevant to ${role}.`);
  }

  if (wordCount < 35) {
    improvements.push('Elaborate on the "why" behind your technical decisions; a 60–120 word response gives recruiters enough signal.');
  }

  let summary = '';
  if (relevance >= 85 && structure >= 80) {
    summary = `Outstanding response! You directly answered the ${qType} prompt with disciplined structure and domain relevance.`;
  } else if (relevance >= 75) {
    summary = `Solid answer. You addressed the core question well; polishing your delivery with specific metrics will make it elite.`;
  } else {
    summary = `Good starting draft. Focus on addressing the prompt's key technical terms more directly and substantiating with an example.`;
  }

  return {
    communication,
    relevance,
    structure,
    summary,
    strengths: strengths.length ? strengths : ['Clear conversational tone', 'Approachable phrasing'],
    improvements: improvements.length ? improvements : ['Consider summarizing the key takeaway in a strong final sentence.'],
    questionType: qType,
    modelAnswerSuggestion: generateSmartAnswer(question, role),
  };
}
