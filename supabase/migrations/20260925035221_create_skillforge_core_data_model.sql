/*
# Create SkillForge AI core data model

1. New Tables
- `profiles`: one private student profile per authenticated user, including education, skills, goals, and onboarding completion.
- `resumes`: private resume metadata and structured analysis output; the original file path is stored without exposing file contents.
- `target_roles`: private career targets and required-skill snapshots selected by a student.
- `skill_gaps`: private comparisons between current skills and a selected target role, including categorized gaps and alignment score.
- `roadmaps`: private career roadmaps linked to a target role and their overall progress.
- `roadmap_tasks`: private roadmap phases and tasks with completion status, progress, and ordering.
- `interviews`: private mock interview sessions and session state.
- `interview_feedback`: private per-question answers and feedback linked to an interview session.
- `progress`: one private current progress summary per authenticated user.

2. Relationships
- Every student-owned table references `auth.users` through `user_id`.
- Target roles connect skill gaps and roadmaps.
- Roadmaps contain ordered roadmap tasks.
- Interviews contain ordered interview feedback records.

3. Security
- Row Level Security is enabled on every table.
- Four separate CRUD policies are created for each table.
- Authenticated users can only access rows owned by their own `auth.uid()`.
- Child-table policies verify ownership through their parent record.

4. Important Notes
- Resume analysis output is stored as JSONB so future analysis fields can be added without destructive schema changes.
- Resume file contents are not stored in these tables; only private metadata and a storage path are retained.
- All owner columns default to `auth.uid()` so authenticated inserts do not need to pass user IDs from the browser.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  education_level text NOT NULL DEFAULT '',
  field_of_study text NOT NULL DEFAULT '',
  career_interest text NOT NULL DEFAULT '',
  current_skills text[] NOT NULL DEFAULT '{}',
  career_goals text NOT NULL DEFAULT '',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text,
  analysis_status text NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'complete', 'failed')),
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.target_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  domain text NOT NULL DEFAULT '',
  desired_position text NOT NULL DEFAULT '',
  required_skills text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skill_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role_id uuid NOT NULL REFERENCES public.target_roles(id) ON DELETE CASCADE,
  current_skills text[] NOT NULL DEFAULT '{}',
  required_skills text[] NOT NULL DEFAULT '{}',
  strong_skills text[] NOT NULL DEFAULT '{}',
  skills_to_improve text[] NOT NULL DEFAULT '{}',
  critical_gaps text[] NOT NULL DEFAULT '{}',
  alignment_score integer NOT NULL DEFAULT 0 CHECK (alignment_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role_id uuid NOT NULL REFERENCES public.target_roles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Career roadmap',
  overall_progress integer NOT NULL DEFAULT 0 CHECK (overall_progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roadmap_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  phase_number integer NOT NULL CHECK (phase_number > 0),
  phase_title text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role_id uuid REFERENCES public.target_roles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  question_count integer NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_number integer NOT NULL CHECK (question_number > 0),
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  communication_score integer CHECK (communication_score BETWEEN 0 AND 100),
  technical_score integer CHECK (technical_score BETWEEN 0 AND 100),
  relevance_score integer CHECK (relevance_score BETWEEN 0 AND 100),
  strengths text[] NOT NULL DEFAULT '{}',
  improvement_areas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  skills_completed integer NOT NULL DEFAULT 0 CHECK (skills_completed >= 0),
  roadmap_progress integer NOT NULL DEFAULT 0 CHECK (roadmap_progress BETWEEN 0 AND 100),
  resume_improvements integer NOT NULL DEFAULT 0 CHECK (resume_improvements >= 0),
  interview_sessions integer NOT NULL DEFAULT 0 CHECK (interview_sessions >= 0),
  readiness_score integer NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  recommended_next_step text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resumes_user_id_idx ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS target_roles_user_id_idx ON public.target_roles(user_id);
CREATE INDEX IF NOT EXISTS skill_gaps_user_id_idx ON public.skill_gaps(user_id);
CREATE INDEX IF NOT EXISTS skill_gaps_target_role_id_idx ON public.skill_gaps(target_role_id);
CREATE INDEX IF NOT EXISTS roadmaps_user_id_idx ON public.roadmaps(user_id);
CREATE INDEX IF NOT EXISTS roadmaps_target_role_id_idx ON public.roadmaps(target_role_id);
CREATE INDEX IF NOT EXISTS roadmap_tasks_roadmap_id_idx ON public.roadmap_tasks(roadmap_id);
CREATE INDEX IF NOT EXISTS interviews_user_id_idx ON public.interviews(user_id);
CREATE INDEX IF NOT EXISTS interview_feedback_interview_id_idx ON public.interview_feedback(interview_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
CREATE POLICY "delete_own_profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "select_own_resumes" ON public.resumes;
CREATE POLICY "select_own_resumes" ON public.resumes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_resumes" ON public.resumes;
CREATE POLICY "insert_own_resumes" ON public.resumes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_resumes" ON public.resumes;
CREATE POLICY "update_own_resumes" ON public.resumes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_resumes" ON public.resumes;
CREATE POLICY "delete_own_resumes" ON public.resumes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_target_roles" ON public.target_roles;
CREATE POLICY "select_own_target_roles" ON public.target_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_target_roles" ON public.target_roles;
CREATE POLICY "insert_own_target_roles" ON public.target_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_target_roles" ON public.target_roles;
CREATE POLICY "update_own_target_roles" ON public.target_roles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_target_roles" ON public.target_roles;
CREATE POLICY "delete_own_target_roles" ON public.target_roles FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_skill_gaps" ON public.skill_gaps;
CREATE POLICY "select_own_skill_gaps" ON public.skill_gaps FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_skill_gaps" ON public.skill_gaps;
CREATE POLICY "insert_own_skill_gaps" ON public.skill_gaps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.target_roles WHERE target_roles.id = skill_gaps.target_role_id AND target_roles.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_skill_gaps" ON public.skill_gaps;
CREATE POLICY "update_own_skill_gaps" ON public.skill_gaps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.target_roles WHERE target_roles.id = skill_gaps.target_role_id AND target_roles.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_skill_gaps" ON public.skill_gaps;
CREATE POLICY "delete_own_skill_gaps" ON public.skill_gaps FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_roadmaps" ON public.roadmaps;
CREATE POLICY "select_own_roadmaps" ON public.roadmaps FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_roadmaps" ON public.roadmaps;
CREATE POLICY "insert_own_roadmaps" ON public.roadmaps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.target_roles WHERE target_roles.id = roadmaps.target_role_id AND target_roles.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_roadmaps" ON public.roadmaps;
CREATE POLICY "update_own_roadmaps" ON public.roadmaps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.target_roles WHERE target_roles.id = roadmaps.target_role_id AND target_roles.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_roadmaps" ON public.roadmaps;
CREATE POLICY "delete_own_roadmaps" ON public.roadmaps FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_roadmap_tasks" ON public.roadmap_tasks;
CREATE POLICY "select_own_roadmap_tasks" ON public.roadmap_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.roadmaps WHERE roadmaps.id = roadmap_tasks.roadmap_id AND roadmaps.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_roadmap_tasks" ON public.roadmap_tasks;
CREATE POLICY "insert_own_roadmap_tasks" ON public.roadmap_tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.roadmaps WHERE roadmaps.id = roadmap_tasks.roadmap_id AND roadmaps.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_roadmap_tasks" ON public.roadmap_tasks;
CREATE POLICY "update_own_roadmap_tasks" ON public.roadmap_tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.roadmaps WHERE roadmaps.id = roadmap_tasks.roadmap_id AND roadmaps.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.roadmaps WHERE roadmaps.id = roadmap_tasks.roadmap_id AND roadmaps.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_roadmap_tasks" ON public.roadmap_tasks;
CREATE POLICY "delete_own_roadmap_tasks" ON public.roadmap_tasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.roadmaps WHERE roadmaps.id = roadmap_tasks.roadmap_id AND roadmaps.user_id = auth.uid()));

DROP POLICY IF EXISTS "select_own_interviews" ON public.interviews;
CREATE POLICY "select_own_interviews" ON public.interviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_interviews" ON public.interviews;
CREATE POLICY "insert_own_interviews" ON public.interviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (target_role_id IS NULL OR EXISTS (SELECT 1 FROM public.target_roles WHERE target_roles.id = interviews.target_role_id AND target_roles.user_id = auth.uid())));
DROP POLICY IF EXISTS "update_own_interviews" ON public.interviews;
CREATE POLICY "update_own_interviews" ON public.interviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND (target_role_id IS NULL OR EXISTS (SELECT 1 FROM public.target_roles WHERE target_roles.id = interviews.target_role_id AND target_roles.user_id = auth.uid())));
DROP POLICY IF EXISTS "delete_own_interviews" ON public.interviews;
CREATE POLICY "delete_own_interviews" ON public.interviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_interview_feedback" ON public.interview_feedback;
CREATE POLICY "select_own_interview_feedback" ON public.interview_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.interviews WHERE interviews.id = interview_feedback.interview_id AND interviews.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_interview_feedback" ON public.interview_feedback;
CREATE POLICY "insert_own_interview_feedback" ON public.interview_feedback FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.interviews WHERE interviews.id = interview_feedback.interview_id AND interviews.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_interview_feedback" ON public.interview_feedback;
CREATE POLICY "update_own_interview_feedback" ON public.interview_feedback FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.interviews WHERE interviews.id = interview_feedback.interview_id AND interviews.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.interviews WHERE interviews.id = interview_feedback.interview_id AND interviews.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_interview_feedback" ON public.interview_feedback;
CREATE POLICY "delete_own_interview_feedback" ON public.interview_feedback FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.interviews WHERE interviews.id = interview_feedback.interview_id AND interviews.user_id = auth.uid()));

DROP POLICY IF EXISTS "select_own_progress" ON public.progress;
CREATE POLICY "select_own_progress" ON public.progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_progress" ON public.progress;
CREATE POLICY "insert_own_progress" ON public.progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_progress" ON public.progress;
CREATE POLICY "update_own_progress" ON public.progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_progress" ON public.progress;
CREATE POLICY "delete_own_progress" ON public.progress FOR DELETE TO authenticated USING (auth.uid() = user_id);