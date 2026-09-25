import { supabase } from './supabase';
import type { UserProfile, RoadmapTask } from '../types';
import { defaultRoadmapTasks } from '../data/mockData';

const STORAGE_KEYS = {
  PROFILE: 'skillforge_profile',
  TASKS: 'skillforge_tasks',
  ROLE: 'skillforge_active_role',
  RESUME: 'skillforge_resume_data',
  INTERVIEW_STATE: 'skillforge_interview_state',
};

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      const profile: UserProfile = {
        id: data.id,
        fullName: data.full_name || 'Jordan Davis',
        educationLevel: data.education_level || 'Undergraduate',
        fieldOfStudy: data.field_of_study || 'Computer Science',
        careerInterest: data.career_interest || 'Software Engineering',
        currentSkills: data.current_skills || ['Python', 'JavaScript', 'HTML', 'CSS'],
        careerGoals: data.career_goals || 'Land a software engineering role at a mission-driven company.',
        onboardingCompleted: Boolean(data.onboarding_completed),
      };
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.warn('Could not fetch profile from Supabase, using local fallback:', err);
  }

  const cached = localStorage.getItem(STORAGE_KEYS.PROFILE);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fallback
    }
  }

  return {
    fullName: 'Jordan Davis',
    educationLevel: 'Undergraduate',
    fieldOfStudy: 'Computer Science',
    careerInterest: 'Software Engineering',
    currentSkills: ['Python', 'JavaScript', 'HTML', 'CSS'],
    careerGoals: 'Land a software engineering role at a high-growth tech company.',
    onboardingCompleted: true,
  };
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  try {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: profile.fullName,
      education_level: profile.educationLevel,
      field_of_study: profile.fieldOfStudy,
      career_interest: profile.careerInterest,
      current_skills: profile.currentSkills,
      career_goals: profile.careerGoals,
      onboarding_completed: profile.onboardingCompleted,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    console.warn('Supabase upsert profile failed, cached locally:', err);
    return true;
  }
}

export function loadSavedTasks(): RoadmapTask[] {
  const cached = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fallback
    }
  }
  return defaultRoadmapTasks;
}

export function saveTasks(tasks: RoadmapTask[]) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

export function loadSavedRole(): string {
  return localStorage.getItem(STORAGE_KEYS.ROLE) || 'Software Engineer';
}

export function saveActiveRole(role: string) {
  localStorage.setItem(STORAGE_KEYS.ROLE, role);
}
