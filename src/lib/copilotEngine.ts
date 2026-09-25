import { rolesData } from '../data/mockData';
import type { RoadmapTask } from '../types';

export function generateCopilotReply(
  prompt: string,
  role: string,
  userName: string,
  tasks: RoadmapTask[],
  readiness: number
): string {
  const p = prompt.toLowerCase().trim();
  const roleInfo = rolesData[role] || rolesData['Software Engineer'];
  const criticalGaps = roleInfo.skills.filter((s) => s.type === 'critical');
  const strongSkills = roleInfo.skills.filter((s) => s.type === 'strong');
  const pendingTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  // 1. Framework & Technical Specifics
  if (p.includes('react') || p.includes('hook') || p.includes('state management') || p.includes('frontend')) {
    return `### Mastering React & Modern Frontend Architecture

Hi ${userName}! For a high-impact **${role}** portfolio, here is how to structure production-grade React code:
- **Clean Component Hierarchy:** Separate UI presentation from business logic using custom hooks (e.g. \`useAuth\`, \`useRoadmapSync\`).
- **State Management:** Avoid prop-drilling; use React Context for global session state or lightweight state machines (Zustand/TanStack Query) for server caching.
- **Performance:** Memorize expensive calculations with \`useMemo\` and stabilize callback references with \`useCallback\` when passing handlers to virtualized lists.
- **Action Item:** Build a feature with accessible keyboard navigation (WAI-ARIA) and full TypeScript typing to demonstrate seniority in code reviews.`;
  }

  if (p.includes('sql') || p.includes('postgres') || p.includes('database') || p.includes('query')) {
    return `### Production SQL & Relational Database Mastery

For **${role}**, technical interviews look for data modeling and query efficiency over simple syntax:
- **Indexing Strategy:** Create B-Tree indexes on high-cardinality foreign keys (\`user_id\`, \`target_role_id\`) and compound indexes for frequent filtered lookups.
- **Window Functions:** Practice \`ROW_NUMBER()\`, \`DENSE_RANK()\`, and \`PARTITION BY\`—they appear in ~80% of data and backend coding rounds.
- **ACID Transactions:** Know when to wrap multi-table operations in \`BEGIN ... COMMIT\` to avoid orphaned records during system interruptions.
- **Interview Favorite:** *"How do you diagnose a slow query?"* Answer with \`EXPLAIN ANALYZE\` to check whether the planner is performing sequential scans vs. index scans.`;
  }

  if (p.includes('python') || p.includes('pandas') || p.includes('backend') || p.includes('api')) {
    return `### Python & Scalable Backend APIs

To stand out in **${role}** recruitment:
- **Modern REST Patterns:** Build modular routers with FastAPI or Flask, utilizing Pydantic models for strict payload validation.
- **Asynchronous Execution:** Use \`async\`/\`await\` for I/O bound tasks like external AI API calls or database lookups to prevent blocking the event loop.
- **Data Engineering (Pandas):** Avoid iterating through rows with \`.iterrows()\`; always leverage vectorized operations and \`.apply()\` with NumPy arrays for 100x performance.`;
  }

  if (p.includes('figma') || p.includes('design system') || p.includes('ui') || p.includes('ux')) {
    return `### Design Systems & Product Craft

As a **${role}**, engineering teams value designers who understand system scalability:
- **Atomic Tokens:** Group tokens into Color, Typography, Spacing, and Elevation that map 1:1 to CSS custom properties.
- **Auto-Layout & Variants:** Ensure all components handle dynamic text wrapping and multi-screen breakpoints cleanly.
- **Accessibility (WCAG 2.1):** Check minimum contrast ratios (4.5:1 for body copy) and annotate focus rings for keyboard users.`;
  }

  // 2. Learning Path / Next Steps
  if (p.includes('learn') || p.includes('next') || p.includes('what to') || p.includes('start') || p.includes('focus') || p.includes('roadmap')) {
    const topGap = criticalGaps[0]?.name || 'Data Structures & Algorithms';
    const secondGap = criticalGaps[1]?.name || 'System Design';

    return `### Your High-Leverage Learning Plan for ${role}

Hello ${userName}! With your current readiness score at **${readiness}%**, here is where your energy yields the highest return:

1. **Immediate Focus: ${topGap}**
   - *Why:* This is the #1 screening gate for ${role} candidates.
   - *Daily Routine:* Spend 30–45 minutes solving 1–2 focused practice problems before building features.

2. **Secondary Milestone: ${secondGap}**
   - Apply this directly to an open-source or portfolio milestone in your roadmap.

3. **Your Core Strengths:**
   - You already have solid proficiency in **${strongSkills.map((s) => s.name).join(', ')}**. Make these visible in your resume projects!

*Next step:* Head to the **Career Roadmap** tab to check off your next pending task: "${pendingTasks[0]?.title || 'Complete next milestone'}".`;
  }

  // 3. Resume & Portfolio
  if (p.includes('resume') || p.includes('cv') || p.includes('portfolio') || p.includes('ats') || p.includes('bullet') || p.includes('project')) {
    return `### How to Build a Standout ${role} Resume

To get past ATS filters and capture recruiter attention within 6 seconds:

1. **The Google X-Y-Z Formula:**
   *"Accomplished [X], measured by [Y], by implementing [Z]."*
   - ❌ *Weak:* "Created database queries and helped backend team."
   - ✅ *Strong:* "Architected PostgreSQL database queries and automated indexing, reducing API response latency by 38% across 10k daily requests."

2. **Crucial Keywords to Surface:**
   Ensure these skills from your target role appear in your top bullets: **${roleInfo.skills.slice(0, 4).map((s) => s.name).join(', ')}**.

3. **Active Projects Over Passive Tutorials:**
   Recruiters look for deployed live links and GitHub repositories with meaningful commit histories and comprehensive README files.

*Try it now:* Open our **Resume Studio** in the sidebar to run an automated analysis on your resume!`;
  }

  // 4. Interview Preparation
  if (p.includes('interview') || p.includes('mock') || p.includes('star') || p.includes('question') || p.includes('behavioral') || p.includes('coach')) {
    return `### Interview Strategy & STAR Framework for ${role}

Here is how to ace your behavioral and technical rounds:

- **Situation (20%):** Set the stage concisely: company, project context, and the hurdle.
- **Task (10%):** Clearly state your individual responsibility. (Say *"I was tasked with"*, not *"we"*).
- **Action (50%):** The meat of your answer. Walk through the technical trade-offs, tools chosen, and challenges resolved.
- **Result (20%):** Concrete outcomes. Share percentages, hours saved, or key lessons learned.

**High-Frequency Question to Master:**
*"Tell me about a time you noticed an engineering flaw or missed requirement late in a sprint. How did you handle it?"*

👉 *Head over to the **Mock Interview** tab to practice live with real-time AI scoring and speech recognition!*`;
  }

  // 5. Compensation, Salary & Industry Trends
  if (p.includes('salary') || p.includes('pay') || p.includes('compensation') || p.includes('market') || p.includes('demand') || p.includes('job market')) {
    return `### Market Landscape & Compensation for ${role}

- **Average Market Compensation:** **${roleInfo.averageSalary}** (Entry to Mid-Level benchmark)
- **Domain Specialization:** ${roleInfo.domain}
- **Industry Demand:** High. Organizations are shifting hiring toward candidates who can demonstrate end-to-end execution, testing discipline, and business acumen.
- **Negotiation Tip:** Always negotiate around total compensation (base salary, sign-on bonus, equity/stock units, and professional development stipends).`;
  }

  // 6. Networking, Cold Emails & Job Applications
  if (p.includes('network') || p.includes('cold email') || p.includes('linkedin') || p.includes('apply') || p.includes('internship') || p.includes('job')) {
    return `### Strategic Job Search & Outreach Guide

Applying blindly on job boards has a ~2% response rate. Use this high-touch strategy:
1. **Curate a 15-Company Target List:** Focus on Series B–D tech startups where engineering leads review candidates directly.
2. **Cold Outreach Template:**
   *"Hi [Name], I noticed your team recently launched [Feature/Product]. I'm a student specializing in ${role} and recently built a project tackling [Similar Problem]. Loved your architecture approach! Would you be open to a 10-minute coffee chat about how your engineering team navigates [Specific Challenge]?"*
3. **Show Your Work:** Share concise summaries of what you build on LinkedIn and Twitter/X with short demo clips.`;
  }

  // 7. General Intelligent Fallback
  return `### Career Guidance for ${userName} (${role})

Thanks for asking! Here is how to look at this in the context of your career-readiness journey:

- **Your Current Target Role:** **${role}** in ${roleInfo.domain}
- **Career Readiness Score:** **${readiness}%** (Target threshold: 85%+)
- **Progress:** ${completedTasks.length} milestones complete, ${pendingTasks.length} in progress.
- **Next High-Leverage Move:** Focus on closing your **${criticalGaps[0]?.name || 'critical technical gaps'}** to ensure you pass technical screening hurdles.

Feel free to ask me about specific code frameworks, resume bullet revisions, behavioral question practice, or portfolio project ideas!`;
}
