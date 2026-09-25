import type { LucideIcon } from 'lucide-react';

export type View = 'overview' | 'skill-gap' | 'roadmap' | 'resume' | 'interview' | 'progress';

export interface UserProfile {
  id?: string;
  fullName: string;
  educationLevel: string;
  fieldOfStudy: string;
  careerInterest: string;
  currentSkills: string[];
  careerGoals: string;
  onboardingCompleted: boolean;
}

export type SkillLevel = 'strong' | 'improve' | 'critical';

export interface SkillItem {
  name: string;
  score: number;
  type: SkillLevel;
  description?: string;
}

export interface RoleInfo {
  title: string;
  domain: string;
  description: string;
  averageSalary: string;
  alignmentBase: number;
  skills: SkillItem[];
}

export interface RoadmapTask {
  id: string;
  phaseId: number;
  title: string;
  meta: string;
  done: boolean;
  skills?: string[];
}

export interface RoadmapPhase {
  number: string;
  title: string;
  subtitle: string;
  items: string[];
  resourceLinks: { title: string; url: string; type: string }[];
}

export interface InterviewQuestion {
  id: number;
  role: string;
  category: 'Behavioral' | 'Technical' | 'Situational';
  question: string;
  coachTip: string;
  starterText?: string;
}

export interface QuestionFeedback {
  communication: number;
  relevance: number;
  structure: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionType?: string;
  modelAnswerSuggestion?: string;
}

export interface ResumeData {
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  score: number;
  skillsFound: string[];
  projectsFound: number;
  strengths: string[];
  improvements: string[];
  rewrites: { before: string; after: string; reason: string }[];
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'purple';
}
