import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LogOut,
  Menu,
  Mic,
  MicOff,
  MoreHorizontal,
  Play,
  Plus,
  Printer,
  Radar,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  UserRound,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { View, UserProfile, RoadmapTask, RoadmapPhase, QuestionFeedback, ResumeData, ToastMessage } from './types';
import { rolesData, roadmapPhases, interviewQuestions, sampleResumeRewrites } from './data/mockData';
import { fetchUserProfile, saveUserProfile, loadSavedTasks, saveTasks, loadSavedRole, saveActiveRole } from './lib/storage';
import {
  generateCopilotResponse,
  generateMockInterviewAnswer,
  evaluateMockInterviewAnswer,
} from './lib/geminiAI';
import { detectQuestionType, generateSmartAnswer, evaluateAnswer } from './lib/interviewAI';

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'skill-gap', label: 'Skill Gap', icon: Radar },
  { id: 'roadmap', label: 'Career Roadmap', icon: Target },
  { id: 'resume', label: 'Resume Studio', icon: FileText },
  { id: 'interview', label: 'Mock Interview', icon: Mic },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
];

const availableRoles = ['Software Engineer', 'Product Designer', 'Data Analyst', 'Marketing Strategist'];

function getInitials(name: string): string {
  const parts = name.trim().split(/[ ._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || 'SF').toUpperCase();
}

// Calculate dynamic alignment score based on user profile skills vs role skills
function calculateAlignmentScore(role: string, currentSkills: string[]): number {
  const roleInfo = rolesData[role] || rolesData['Software Engineer'];
  if (!roleInfo.skills.length) return 65;

  const userSkillsLower = (currentSkills || []).map((s) => s.toLowerCase());
  let matchedWeight = 0;
  let totalWeight = 0;

  roleInfo.skills.forEach((skill) => {
    const weight = skill.type === 'strong' ? 3 : skill.type === 'improve' ? 2 : 1;
    totalWeight += weight;
    const hasSkill = userSkillsLower.some((userSkill) =>
      skill.name.toLowerCase().includes(userSkill) || userSkill.includes(skill.name.toLowerCase())
    );
    if (hasSkill) matchedWeight += weight;
  });

  const calculated = Math.round((matchedWeight / totalWeight) * 100);
  return Math.max(38, Math.min(96, Math.max(calculated, roleInfo.alignmentBase)));
}

function App() {
  const [view, setView] = useState<View>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<{ sender: 'user' | 'assistant'; text: string }[]>([]);
  const [copilotThinking, setCopilotThinking] = useState(false);

  // Authenticated User & Profile
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>({
    fullName: 'Jordan Davis',
    educationLevel: 'Undergraduate',
    fieldOfStudy: 'Computer Science',
    careerInterest: 'Software Engineering',
    currentSkills: ['Python', 'JavaScript', 'HTML', 'CSS'],
    careerGoals: 'Land a software engineering role at a mission-driven company.',
    onboardingCompleted: true,
  });

  // Active Role & Roadmap Tasks
  const [role, setRole] = useState<string>(loadSavedRole());
  const [tasks, setTasks] = useState<RoadmapTask[]>(loadSavedTasks());

  // Interactive Modals
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [resourcesModalPhase, setResourcesModalPhase] = useState<RoadmapPhase | null>(null);
  const [resumeImproverOpen, setResumeImproverOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Resume Studio State
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  // Mock Interview State
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<number, string>>({});
  const [interviewFeedbacks, setInterviewFeedbacks] = useState<Record<number, QuestionFeedback>>({});
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, description?: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Keyboard shortcut for command palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auth listener & sync
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          fetchUserProfile(data.session.user.id).then((p) => {
            if (p && mounted) {
              setProfile(p);
              if (p.careerInterest && rolesData[p.careerInterest]) {
                setRole(p.careerInterest);
              }
              if (!p.onboardingCompleted) {
                setOnboardingOpen(true);
              }
            }
          });
        }
        setAuthLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserProfile(session.user.id).then((p) => {
            if (p && mounted) {
              setProfile(p);
              if (!p.onboardingCompleted) {
                setOnboardingOpen(true);
              }
            }
          });
        }
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Save tasks and role changes to storage
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveActiveRole(role);
  }, [role]);

  // Dynamic readiness score calculation
  const completedTaskCount = tasks.filter((t) => t.done).length;
  const alignmentScore = useMemo(() => {
    return calculateAlignmentScore(role, profile.currentSkills);
  }, [role, profile.currentSkills]);

  const readiness = useMemo(() => {
    const base = 52;
    const taskBonus = completedTaskCount * 4;
    const resumeBonus = resumeData ? (resumeData.score >= 90 ? 8 : 4) : 0;
    const interviewBonus = interviewComplete ? 12 : Object.keys(interviewAnswers).length > 0 ? 5 : 0;
    const skillBonus = Math.round((alignmentScore - 50) * 0.15);
    return Math.min(99, Math.round(base + taskBonus + resumeBonus + interviewBonus + Math.max(0, skillBonus)));
  }, [completedTaskCount, resumeData, interviewComplete, interviewAnswers, alignmentScore]);

  // Handle Role Change
  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setInterviewIndex(0);
    setInterviewAnswers({});
    setInterviewFeedbacks({});
    setInterviewComplete(false);
    setInterviewStarted(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeakingQuestion(false);
    addToast(`Target role switched to ${newRole}`, `Loaded role requirements & roadmap alignment.`);
  };

  // Toggle task done
  const handleToggleTask = (taskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      const target = updated.find((t) => t.id === taskId);
      if (target?.done) {
        addToast(`Milestone completed!`, `+4% Career Readiness for ${target.title}`);
      }
      return updated;
    });
  };

  // Add task to roadmap from Skill Gap
  const handleAddSkillToRoadmap = (skillName: string) => {
    const existing = tasks.find((t) => t.title.toLowerCase().includes(skillName.toLowerCase()));
    if (existing) {
      addToast(`Already in roadmap`, `"${existing.title}" is already on your career path.`, 'info');
      setView('roadmap');
      return;
    }
    const newTask: RoadmapTask = {
      id: `task-${Date.now()}`,
      phaseId: 2,
      title: `Master ${skillName} Fundamentals & Projects`,
      meta: 'Core Technical · Added from Skill Gap Analyzer',
      done: false,
      skills: [skillName],
    };
    setTasks((prev) => [...prev, newTask]);
    addToast(`Added to Roadmap!`, `"${newTask.title}" added to Phase 02.`);
    setView('roadmap');
  };

  // Add custom milestone from modal
  const handleAddCustomMilestone = (title: string, phaseId: number, meta: string) => {
    const newTask: RoadmapTask = {
      id: `task-${Date.now()}`,
      phaseId,
      title,
      meta: meta || `Phase 0${phaseId} · Custom Milestone`,
      done: false,
    };
    setTasks((prev) => [...prev, newTask]);
    setAddMilestoneOpen(false);
    addToast('Milestone Added', `"${title}" has been added to your roadmap.`);
  };

  // Save profile from onboarding
  const handleSaveProfile = async (updated: UserProfile) => {
    setProfile(updated);
    if (updated.careerInterest && rolesData[updated.careerInterest]) {
      setRole(updated.careerInterest);
    }
    if (user) {
      await saveUserProfile(user.id, updated);
    }
    setOnboardingOpen(false);
    addToast('Profile Updated', `Welcome, ${updated.fullName}! Your roadmap is personalized.`);
  };

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <Loader2 size={28} className="spin" />
          <span>Loading SkillForge AI…</span>
        </div>
      </div>
    );
  }

  if (user) {
    const initials = getInitials(profile.fullName || user.email?.split('@')[0] || 'Student');
    const firstName = profile.fullName ? profile.fullName.split(' ')[0] : 'Student';

    return (
      <div className="app-shell">
        {/* Mobile sidebar backdrop */}
        {mobileNav && (
          <div
            onClick={() => setMobileNav(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(6,9,15,0.6)',
              zIndex: 199, backdropFilter: 'blur(4px)',
            }}
          />
        )}
        {/* Sidebar */}
        <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <div className="brand brand-sidebar">
            <span className="brand-mark"><Sparkles size={16} /></span>
            SkillForge <em>AI</em>
          </div>
          <div className="workspace-label">YOUR WORKSPACE</div>
          <nav>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`side-link ${view === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setView(item.id);
                    setMobileNav(false);
                  }}
                >
                  <Icon size={17} />
                  {item.label}
                  {item.id === 'interview' && interviewStarted && !interviewComplete && <span className="nav-dot" />}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <button
              className="side-link"
              onClick={() => {
                setOnboardingOpen(true);
                setMobileNav(false);
              }}
            >
              <UserRound size={17} />
              Edit Profile
            </button>
            <button
              className="side-link"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              <LogOut size={17} />
              Sign out
            </button>
            <div className="demo-profile" onClick={() => setOnboardingOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="avatar">{initials}</div>
              <div>
                <strong>{profile.fullName || 'Student'}</strong>
                <span>{role}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="workspace">
          <header className="workspace-header">
            <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}>
              <Menu size={20} />
            </button>
            <div className="crumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{navItems.find((item) => item.id === view)?.label}</strong>
              <span className="demo-badge" style={{ marginLeft: 12 }}>
                <BriefcaseBusiness size={12} /> {role}
              </span>
            </div>
            <div className="header-actions">
              <button
                className="icon-button"
                title="Search & Command Palette (Ctrl+K)"
                onClick={() => setCommandPaletteOpen(true)}
              >
                <Search size={18} />
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  className="icon-button"
                  title="Notifications"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                >
                  <Bell size={18} />
                  <span className="notification-dot" />
                </button>
                {notificationsOpen && (
                  <div className="notifications-popover">
                    <div className="popover-header">
                      <h4>Notifications</h4>
                      <button onClick={() => setNotificationsOpen(false)}>Mark all read</button>
                    </div>
                    <div className="notification-item">
                      <div className="toast-icon"><Target size={14} /></div>
                      <div>
                        <strong>Data Structures Milestone</strong>
                        <small>Priority gap recommended for {role}.</small>
                      </div>
                    </div>
                    <div className="notification-item">
                      <div className="toast-icon"><FileText size={14} /></div>
                      <div>
                        <strong>Resume Studio</strong>
                        <small>{resumeData ? `Resume score: ${resumeData.score}/100` : 'Upload your resume to calculate alignment.'}</small>
                      </div>
                    </div>
                    <div className="notification-item">
                      <div className="toast-icon"><Mic size={14} /></div>
                      <div>
                        <strong>Mock Interview Ready</strong>
                        <small>5 questions customized for {role}.</small>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button className="copilot-button" onClick={() => setCopilotOpen(true)}>
                <Sparkles size={16} /> Ask Copilot
              </button>
              <div
                className="avatar avatar-small"
                onClick={() => setOnboardingOpen(true)}
                title="Click to edit profile"
                style={{ cursor: 'pointer' }}
              >
                {initials}
              </div>
            </div>
          </header>

          <div className="workspace-content">
            {view === 'overview' && (
              <Overview
                readiness={readiness}
                completed={completedTaskCount}
                tasks={tasks}
                onToggleTask={handleToggleTask}
                setView={setView}
                setCopilotOpen={setCopilotOpen}
                userName={firstName}
                role={role}
                alignmentScore={alignmentScore}
                resumeScore={resumeData ? resumeData.score : 78}
                interviewDone={interviewComplete}
              />
            )}
            {view === 'skill-gap' && (
              <SkillGap
                role={role}
                alignmentScore={alignmentScore}
                onRoleChange={handleRoleChange}
                onAddSkill={handleAddSkillToRoadmap}
              />
            )}
            {view === 'roadmap' && (
              <Roadmap
                tasks={tasks}
                onToggleTask={handleToggleTask}
                onOpenAddMilestone={() => setAddMilestoneOpen(true)}
                onOpenResources={(phase) => setResourcesModalPhase(phase)}
                readiness={readiness}
              />
            )}
            {view === 'resume' && (
              <ResumeStudio
                resumeData={resumeData}
                setResumeData={setResumeData}
                role={role}
                onOpenImprover={() => setResumeImproverOpen(true)}
                addToast={addToast}
              />
            )}
            {view === 'interview' && (
              <Interview
                role={role}
                started={interviewStarted}
                setStarted={setInterviewStarted}
                questionIndex={interviewIndex}
                setQuestionIndex={setInterviewIndex}
                answers={interviewAnswers}
                setAnswers={setInterviewAnswers}
                feedbacks={interviewFeedbacks}
                setFeedbacks={setInterviewFeedbacks}
                isComplete={interviewComplete}
                setIsComplete={setInterviewComplete}
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                isSpeakingQuestion={isSpeakingQuestion}
                setIsSpeakingQuestion={setIsSpeakingQuestion}
                addToast={addToast}
              />
            )}
            {view === 'progress' && (
              <Progress
                readiness={readiness}
                completedTasks={completedTaskCount}
                resumeScore={resumeData ? resumeData.score : 78}
                interviewDone={interviewComplete}
                role={role}
                userName={firstName}
                tasks={tasks}
                setView={setView}
              />
            )}
          </div>
        </main>

        {/* Copilot Drawer */}
        {copilotOpen && (
          <Copilot
            messages={copilotMessages}
            setMessages={setCopilotMessages}
            isThinking={copilotThinking}
            setIsThinking={setCopilotThinking}
            onClose={() => setCopilotOpen(false)}
            role={role}
            userName={firstName}
            tasks={tasks}
            readiness={readiness}
          />
        )}

        {/* Command Palette Modal */}
        {commandPaletteOpen && (
          <CommandPaletteModal
            currentRole={role}
            onSelectView={(v) => {
              setView(v);
              setCommandPaletteOpen(false);
            }}
            onSelectRole={(r) => {
              handleRoleChange(r);
              setCommandPaletteOpen(false);
            }}
            onOpenCopilot={() => {
              setCommandPaletteOpen(false);
              setCopilotOpen(true);
            }}
            onOpenProfile={() => {
              setCommandPaletteOpen(false);
              setOnboardingOpen(true);
            }}
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}

        {/* Onboarding / Edit Profile Modal */}
        {onboardingOpen && (
          <Onboarding
            profile={profile}
            onSave={handleSaveProfile}
            onClose={() => setOnboardingOpen(false)}
          />
        )}

        {/* Add Milestone Modal */}
        {addMilestoneOpen && (
          <AddMilestoneModal
            onAdd={handleAddCustomMilestone}
            onClose={() => setAddMilestoneOpen(false)}
          />
        )}

        {/* Phase Resources Modal */}
        {resourcesModalPhase && (
          <ResourcesModal
            phase={resourcesModalPhase}
            onClose={() => setResourcesModalPhase(null)}
          />
        )}

        {/* Resume Improver Modal */}
        {resumeImproverOpen && (
          <ResumeImproverModal
            role={role}
            onApply={() => {
              if (resumeData) {
                setResumeData({ ...resumeData, score: 92 });
                addToast('Resume Optimized!', 'Score boosted to 92/100 with applied bullet improvements.');
              }
              setResumeImproverOpen(false);
            }}
            onClose={() => setResumeImproverOpen(false)}
          />
        )}

        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type || 'success'}`}>
              <div className="toast-icon">
                {t.type === 'purple' ? <Sparkles size={16} /> : <Check size={16} />}
              </div>
              <div className="toast-body">
                <strong>{t.title}</strong>
                {t.description && <p>{t.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Landing
      onSuccessLogin={() => {
        // Handled by auth listener
      }}
    />
  );
}

/* ============================================================
   LANDING PAGE COMPONENT WITH INTERACTIVE FAQ
   ============================================================ */

function Landing({ onSuccessLogin }: { onSuccessLogin: () => void }) {
  const [menu, setMenu] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does SkillForge AI calculate my career readiness score?',
      a: 'Your Career Readiness Score (0–100%) dynamically aggregates your active roadmap task completions, target role skill alignment, ATS resume optimization rating, and mock interview performance. Each milestone you achieve increases your score in real time.',
    },
    {
      q: 'Can I switch target career roles anytime?',
      a: 'Yes! SkillForge supports multiple career tracks including Software Engineer, Product Designer, Data Analyst, and Marketing Strategist. When you switch roles, your skill gaps, roadmap phases, and interview questions dynamically adapt.',
    },
    {
      q: 'How does the AI Mock Interview evaluate my answers?',
      a: 'Our interview coach evaluates your responses against communication clarity, domain technical depth, and the STAR framework (Situation, Task, Action, Result). It provides specific strengths, actionable tips, and model answers tailored directly to the exact question asked.',
    },
    {
      q: 'Is my resume and student profile data private?',
      a: 'Absolutely. SkillForge utilizes Row-Level Security (RLS) policies through Supabase. Only authenticated students can view or edit their own profile, roadmap, and private resume analyses.',
    },
  ];

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={16} /></span>
          SkillForge <em>AI</em>
        </div>
        <nav className={menu ? 'landing-nav open' : 'landing-nav'}>
          <a href="#how" onClick={() => setMenu(false)}>How it works</a>
          <a href="#features" onClick={() => setMenu(false)}>Features</a>
          <a href="#roadmap" onClick={() => setMenu(false)}>Roadmap</a>
          <a href="#faq" onClick={() => setMenu(false)}>FAQ</a>
        </nav>
        <div className="header-cta">
          <button className="text-button" onClick={() => setAuthMode('signin')}>Sign in</button>
          <button className="button button-small" onClick={() => setAuthMode('signup')}>
            Get started <ArrowRight size={15} />
          </button>
        </div>
        <button className="mobile-menu landing-menu" onClick={() => setMenu(!menu)}>
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse" /> AI-powered employability agent</div>
            <h1>Build the skills your career <span>actually needs.</span></h1>
            <p>SkillForge AI turns your current skills into a clear career roadmap, so you know what to learn, what to improve, and how to become job-ready.</p>
            <div className="hero-buttons">
              <button className="button" onClick={() => setAuthMode('signup')}>
                Analyze my profile <ArrowRight size={17} />
              </button>
              <a className="button button-ghost" href="#features">
                Explore features <ChevronRight size={16} />
              </a>
            </div>
            <div className="trust-line">
              <div className="mini-avatars">
                <span>JD</span><span>AM</span><span>RK</span>
              </div>
              <div>
                <strong>Built for the next generation</strong>
                <small>One focused step at a time.</small>
              </div>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className="signal-strip">
          <span>FROM PROFILE TO PROGRESS</span>
          <div>
            <span><Check size={14} /> Clear direction</span>
            <span><Check size={14} /> Actionable gaps</span>
            <span><Check size={14} /> Measurable growth</span>
          </div>
        </section>

        <section className="section problems" id="how">
          <div className="section-heading">
            <div>
              <div className="eyebrow">The career clarity gap</div>
              <h2>Students know they want a career.<br /><span>They don't always know how to get there.</span></h2>
            </div>
            <p>Scattered advice, generic courses, and a resume that does not tell the whole story. SkillForge brings it together into one guided path.</p>
          </div>
          <div className="problem-grid">
            {[
              ['01', 'Unclear direction', 'Too many paths. Not enough signal.'],
              ['02', 'Unknown skill gaps', 'You cannot improve what you cannot see.'],
              ['03', 'Generic learning paths', 'Your goals deserve a plan built for you.'],
              ['04', 'Weak resumes', 'Make your real potential easy to understand.'],
              ['05', 'Limited practice', 'Build confidence before the interview room.'],
            ].map(([number, title, desc]) => (
              <div className="problem-card" key={number}>
                <span className="card-number">{number}</span>
                <div className="problem-icon"><Lightbulb size={19} /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
                <ArrowRight size={16} />
              </div>
            ))}
          </div>
        </section>

        <section className="section journey" id="roadmap">
          <div className="center-heading">
            <div className="eyebrow">One connected journey</div>
            <h2>From where you are to <span>where you want to be.</span></h2>
            <p>Your career-readiness journey, made visible.</p>
          </div>
          <div className="journey-map">
            <div className="journey-line" />
            {([
              ['01', 'Profile', UserRound],
              ['02', 'Analyze', BrainCircuit],
              ['03', 'Build', BookOpen],
              ['04', 'Practice', Mic],
              ['05', 'Progress', TrendingUp],
            ] as const).map(([num, label, Icon]) => {
              const JourneyIcon = Icon;
              return (
                <div className="journey-node" key={num}>
                  <div className="node-orb"><JourneyIcon size={20} /></div>
                  <span>{num}</span>
                  <strong>{label}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section feature-showcase" id="features">
          <div className="showcase-copy">
            <div className="eyebrow">Your career copilot</div>
            <h2>One AI platform for your entire <span>career-readiness journey.</span></h2>
            <p>See the bigger picture, then take the next right step. SkillForge keeps your profile, goals, skills, resume, and practice in one calm workspace.</p>
            <div className="feature-list">
              <div>
                <span className="list-icon"><Radar size={17} /></span>
                <div>
                  <strong>Spot the signal</strong>
                  <small>Understand your strengths and the gaps that matter most.</small>
                </div>
              </div>
              <div>
                <span className="list-icon"><Target size={17} /></span>
                <div>
                  <strong>Follow a focused roadmap</strong>
                  <small>Move forward with phases designed around your target role.</small>
                </div>
              </div>
              <div>
                <span className="list-icon"><Zap size={17} /></span>
                <div>
                  <strong>Build momentum</strong>
                  <small>Track progress and turn small wins into readiness.</small>
                </div>
              </div>
            </div>
            <button className="button button-ghost" onClick={() => setAuthMode('signup')}>
              Get started free <ArrowRight size={16} />
            </button>
          </div>
          <DashboardPreview />
        </section>

        {/* FAQ ACCORDION SECTION */}
        <section className="faq-section" id="faq">
          <div className="center-heading">
            <div className="eyebrow">Got Questions?</div>
            <h2>Frequently Asked <span>Questions</span></h2>
            <p>Everything you need to know about SkillForge AI and your career roadmap.</p>
          </div>

          <div className="faq-accordion">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div className="faq-item" key={index}>
                  <button
                    className="faq-question"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        color: 'var(--blue-soft)',
                      }}
                    />
                  </button>
                  {isOpen && <div className="faq-answer">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="section final-cta">
          <div className="cta-glow" />
          <div className="eyebrow">Your next chapter starts here</div>
          <h2>Ready to build your <span>career roadmap?</span></h2>
          <p>Let SkillForge AI show you what to learn, what to improve, and how to become job-ready.</p>
          <button className="button" onClick={() => setAuthMode('signup')}>
            Start your SkillForge journey <ArrowRight size={17} />
          </button>
        </section>
      </main>

      <footer>
        <div className="brand">
          <span className="brand-mark"><Sparkles size={16} /></span>
          SkillForge <em>AI</em>
        </div>
        <span>Student Employability Agent</span>
        <div className="footer-links">
          <a href="#features">Product</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
        <small>© 2026 SkillForge AI. Empowering Student Careers.</small>
      </footer>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitchMode={(m) => setAuthMode(m)}
          onSuccess={() => {
            setAuthMode(null);
            onSuccessLogin();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   AUTH MODAL COMPONENT
   ============================================================ */

function AuthModal({
  mode,
  onClose,
  onSwitchMode,
  onSuccess,
}: {
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSwitchMode: (m: 'signin' | 'signup') => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
      }
      onSuccess();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: 'studentdemo@example.com',
        password: 'FSecure#2026',
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError('Something went wrong during demo login.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="auth-side">
          <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span>SkillForge <em>AI</em></div>
          <h2>{mode === 'signup' ? 'Build your career roadmap.' : 'Welcome back.'}</h2>
          <p>{mode === 'signup' ? 'Create your free account to start your skill analysis.' : 'Sign in to continue your career journey.'}</p>
          <div className="auth-feature">
            <span className="list-icon"><Radar size={16} /></span>
            <div><strong>Skill gap clarity</strong><small>See exactly what to learn next.</small></div>
          </div>
          <div className="auth-feature">
            <span className="list-icon"><Target size={16} /></span>
            <div><strong>Personalized roadmap</strong><small>Follow a path built around your goal.</small></div>
          </div>
        </div>
        <div className="auth-form-side">
          <div className="auth-tabs">
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => onSwitchMode('signup')}>Sign up</button>
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => onSwitchMode('signin')}>Sign in</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@university.edu"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="button button-block" disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ textAlign: 'center', margin: '14px 0 10px', color: 'var(--text-muted)', fontSize: '13px' }}>— or —</div>

          <button
            type="button"
            className="button button-ghost button-block"
            disabled={loading}
            onClick={handleDemoLogin}
          >
            <Sparkles size={15} /> One-Click Demo Sign In
          </button>

          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(45,125,255,0.08)', border: '1px solid var(--border-blue)', fontSize: '12px', color: 'var(--text-soft)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Demo Credentials:</div>
            <div>Email: <strong style={{ color: 'var(--blue-soft)' }}>studentdemo@example.com</strong></div>
            <div>Password: <strong style={{ color: 'var(--blue-soft)' }}>FSecure#2026</strong></div>
          </div>

          <span className="auth-note">
            {mode === 'signup' ? 'Already have an account? ' : 'New to SkillForge? '}
            <button className="auth-switch" onClick={() => onSwitchMode(mode === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ONBOARDING & PROFILE WIZARD MODAL
   ============================================================ */

function Onboarding({
  profile,
  onSave,
  onClose,
}: {
  profile: UserProfile;
  onSave: (p: UserProfile) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(profile.fullName || 'Jordan Davis');
  const [educationLevel, setEducationLevel] = useState(profile.educationLevel || 'Undergraduate');
  const [fieldOfStudy, setFieldOfStudy] = useState(profile.fieldOfStudy || 'Computer Science');
  const [skills, setSkills] = useState<string[]>(profile.currentSkills || ['Python', 'JavaScript', 'HTML', 'CSS']);
  const [skillInput, setSkillInput] = useState('');
  const [careerInterest, setCareerInterest] = useState(profile.careerInterest || 'Software Engineer');
  const [careerGoals, setCareerGoals] = useState(profile.careerGoals || 'Land a software engineering role.');

  const steps = [
    { title: 'Basic profile', subtitle: 'Let us get to know you.', icon: UserRound },
    { title: 'Education', subtitle: 'Your academic standing.', icon: GraduationCap },
    { title: 'Current skills', subtitle: 'What can you already do?', icon: BookOpen },
    { title: 'Target career role', subtitle: 'Where do you want to go?', icon: Target },
    { title: 'Career goals', subtitle: 'What does success look like?', icon: BriefcaseBusiness },
  ];
  const StepIcon = steps[step].icon;

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onSave({
        fullName,
        educationLevel,
        fieldOfStudy,
        careerInterest,
        currentSkills: skills,
        careerGoals,
        onboardingCompleted: true,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="onboarding-side">
          <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span>SkillForge <em>AI</em></div>
          <div className="step-counter">Step {step + 1} of {steps.length}</div>
          <h2>{steps[step].title}</h2>
          <p>{steps[step].subtitle}</p>
          <div className="step-dots">
            {steps.map((item, index) => (
              <span key={item.title} className={index === step ? 'current' : index < step ? 'done' : ''}>
                {index < step && <Check size={9} />}
              </span>
            ))}
          </div>
          <div className="onboard-illustration"><StepIcon size={30} /></div>
        </div>
        <div className="onboarding-form">
          <form onSubmit={handleFinish}>
            {step === 0 && (
              <>
                <div className="auth-field">
                  <label>Full name</label>
                  <input
                    placeholder="Jordan Davis"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label>Current Status</label>
                  <select defaultValue="Active Student">
                    <option>Active Student</option>
                    <option>Recent Graduate</option>
                    <option>Career Switcher</option>
                  </select>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="auth-field">
                  <label>Education level</label>
                  <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                    <option>High school</option>
                    <option>Undergraduate</option>
                    <option>Graduate / Master's</option>
                    <option>Bootcamp</option>
                    <option>Self-taught</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label>Field of study</label>
                  <input
                    placeholder="Computer Science / Informatics"
                    value={fieldOfStudy}
                    onChange={(e) => setFieldOfStudy(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <div className="auth-field">
                <label>Add your current skills</label>
                <div className="chip-input">
                  {skills.map((s) => (
                    <b key={s}>
                      {s} <X size={11} style={{ cursor: 'pointer' }} onClick={() => handleRemoveSkill(s)} />
                    </b>
                  ))}
                  <input
                    placeholder="Type skill & press Enter..."
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                </div>
                <small>Skills directly increase your role match score across the app.</small>
              </div>
            )}

            {step === 3 && (
              <>
                <div className="auth-field">
                  <label>Target job role</label>
                  <select value={careerInterest} onChange={(e) => setCareerInterest(e.target.value)}>
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="auth-field">
                  <label>Desired Industry</label>
                  <select defaultValue="Technology & Cloud">
                    <option>Technology & Cloud</option>
                    <option>Fintech & Finance</option>
                    <option>Healthcare & Biotech</option>
                    <option>Consumer Apps & E-commerce</option>
                  </select>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="auth-field">
                  <label>What is your primary career goal?</label>
                  <textarea
                    rows={3}
                    value={careerGoals}
                    onChange={(e) => setCareerGoals(e.target.value)}
                    placeholder="I want to land a full-time position by next summer..."
                  />
                </div>
              </>
            )}

            <div className="onboarding-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
              >
                {step > 0 ? 'Back' : 'Cancel'}
              </button>
              <button type="submit" className="button button-small">
                {step < steps.length - 1 ? 'Continue' : 'Save & Enter Workspace'} <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VIEWS
   ============================================================ */

function Overview({
  readiness,
  completed,
  tasks,
  onToggleTask,
  setView,
  setCopilotOpen,
  userName,
  role,
  alignmentScore,
  resumeScore,
  interviewDone,
}: {
  readiness: number;
  completed: number;
  tasks: RoadmapTask[];
  onToggleTask: (id: string) => void;
  setView: (v: View) => void;
  setCopilotOpen: (open: boolean) => void;
  userName: string;
  role: string;
  alignmentScore: number;
  resumeScore: number;
  interviewDone: boolean;
}) {
  const roleInfo = rolesData[role] || rolesData['Software Engineer'];
  const nextTasks = tasks.slice(0, 4);

  return (
    <div>
      <div className="page-intro">
        <div>
          <div className="eyebrow">Career Readiness Dashboard · {role}</div>
          <h1>Good morning, {userName}.</h1>
          <p>Your career path is taking shape. Here is your next highest-leverage move.</p>
        </div>
        <button className="button" onClick={() => setCopilotOpen(true)}>
          <Sparkles size={16} /> Ask SkillForge Copilot
        </button>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Career readiness"
          value={`${readiness}%`}
          change="+8% this month"
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          label="Target Role Match"
          value={`${alignmentScore}%`}
          change="Dynamic profile sync"
          icon={Radar}
          accent="purple"
        />
        <StatCard
          label="Resume Score"
          value={`${resumeScore}/100`}
          change={resumeScore >= 90 ? 'ATS Optimized' : 'Needs alignment'}
          icon={FileText}
          accent="green"
        />
        <StatCard
          label="Roadmap Progress"
          value={`${Math.round((completed / Math.max(1, tasks.length)) * 100)}%`}
          change={`${tasks.length - completed} milestones left`}
          icon={Target}
          accent="orange"
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel readiness-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">YOUR READINESS SIGNAL</span>
              <h2>Career readiness</h2>
            </div>
            <button className="more-button" onClick={() => setView('progress')}>
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="readiness-body">
            <div className="readiness-ring" style={{ '--progress': `${readiness * 3.6}deg` } as React.CSSProperties}>
              <div>
                <strong>{readiness}<small>%</small></strong>
                <span>On the rise</span>
              </div>
            </div>
            <div className="readiness-copy">
              <p>
                Your profile is building strong momentum for <strong>{role}</strong> ({alignmentScore}% skill match). Focus on your priority technical gaps to move from <strong>exploring</strong> to <strong>job-ready.</strong>
              </p>
              <div className="legend">
                <span><i className="dot blue-dot" /> Current signal</span>
                <span><i className="dot muted-dot" /> Remaining</span>
              </div>
              <button className="inline-link" onClick={() => setView('skill-gap')}>
                View skill gaps & requirements <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="mini-chart">
            <div className="chart-labels">
              <span>Aug 28</span>
              <span>Today ({readiness}%)</span>
            </div>
            <div className="line-graph">
              <svg viewBox="0 0 500 80" preserveAspectRatio="none">
                <path
                  d="M0 69 C45 68 55 62 86 64 S130 43 158 49 S205 38 231 44 S274 19 308 33 S356 25 378 28 S432 7 500 10"
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="3"
                />
                <defs>
                  <linearGradient id="lineGradient" x1="0" x2="1">
                    <stop stopColor="#2d7dff" />
                    <stop offset="1" stopColor="#a98eff" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        <div className="panel actions-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">INTERACTIVE CHECKLIST</span>
              <h2>Your next best actions</h2>
            </div>
            <button className="more-button" onClick={() => setView('roadmap')}>
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="task-list">
            {nextTasks.map((task) => (
              <button
                className={`task-item ${task.done ? 'done' : ''}`}
                key={task.id}
                onClick={() => onToggleTask(task.id)}
              >
                <span className="task-check">{task.done && <Check size={13} />}</span>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.meta}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <button className="panel-link" onClick={() => setView('roadmap')}>
            View full 5-phase roadmap ({tasks.length} total) <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="panel mini-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">TARGET ROLE</span>
              <h2>{role}</h2>
            </div>
            <BriefcaseBusiness size={18} className="muted-icon" />
          </div>
          <div className="role-progress">
            <div>
              <span>Profile alignment</span>
              <strong>{alignmentScore}%</strong>
            </div>
            <div className="meter">
              <i style={{ width: `${alignmentScore}%` }} />
            </div>
          </div>
          <button className="panel-link" onClick={() => setView('skill-gap')}>
            Review role requirements & gaps <ArrowRight size={14} />
          </button>
        </div>

        <div className="panel mini-panel copilot-card">
          <div className="copilot-art">
            <div><Sparkles size={22} /></div>
          </div>
          <div>
            <span className="panel-kicker">SKILLFORGE COPILOT</span>
            <h2>Have a career question?</h2>
            <p>Ask for a focused recommendation tailored to your {role} journey.</p>
            <button className="button button-small" onClick={() => setCopilotOpen(true)}>
              Start a conversation <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillGap({
  role,
  alignmentScore,
  onRoleChange,
  onAddSkill,
}: {
  role: string;
  alignmentScore: number;
  onRoleChange: (r: string) => void;
  onAddSkill: (skill: string) => void;
}) {
  const roleInfo = rolesData[role] || rolesData['Software Engineer'];
  const priorityGaps = roleInfo.skills.filter((s) => s.type === 'critical');
  const highestLeverageGap = priorityGaps[0] || roleInfo.skills[roleInfo.skills.length - 1];

  return (
    <div>
      <PageTitle
        eyebrow="CLARITY BEFORE ACTION"
        title="Your skill gap"
        description="See the exact difference between your current skills and what your target role asks for."
        action={
          <select
            className="role-select"
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
          >
            {availableRoles.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        }
      />

      <div className="gap-summary">
        <div>
          <span>Target role</span>
          <strong>{role}</strong>
          <small>{roleInfo.averageSalary}</small>
        </div>
        <div>
          <span>Current alignment</span>
          <strong>{alignmentScore}%</strong>
          <small className="positive"><TrendingUp size={13} /> High market demand</small>
        </div>
        <div>
          <span>Priority gaps</span>
          <strong>{priorityGaps.length}</strong>
          <small>Need your focus next</small>
        </div>
        <div className="gap-ring">
          <div>
            <strong>{alignmentScore}</strong>
            <span>match</span>
          </div>
        </div>
      </div>

      <div className="panel gap-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">SKILL MAP</span>
            <h2>Current skills vs. role requirements</h2>
          </div>
          <span className="demo-badge">
            <Sparkles size={12} /> {roleInfo.domain}
          </span>
        </div>
        <div className="skill-rows">
          {roleInfo.skills.map((skill) => (
            <div className="skill-row" key={skill.name}>
              <div className="skill-name">
                <span className={`skill-status ${skill.type}`} />
                <div>
                  <strong>{skill.name}</strong>
                  {skill.description && <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px' }}>{skill.description}</small>}
                </div>
                <span className={`priority ${skill.type}`}>
                  {skill.type === 'strong' ? 'Strong' : skill.type === 'improve' ? 'Improve' : 'Critical gap'}
                </span>
              </div>
              <div className="skill-bar">
                <i className={skill.type} style={{ width: `${skill.score}%` }} />
              </div>
              <strong className="skill-score">{skill.score}%</strong>
              <button
                className="skill-action"
                title={`Add ${skill.name} to Career Roadmap`}
                onClick={() => onAddSkill(skill.name)}
              >
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="insight-banner">
        <div className="insight-icon"><Sparkles size={17} /></div>
        <div>
          <strong>Highest-leverage next step: {highestLeverageGap.name}</strong>
          <p>
            Strengthening {highestLeverageGap.name} will unlock progress across technical interviews and boost your {role} alignment score.
          </p>
        </div>
        <button className="button button-small" onClick={() => onAddSkill(highestLeverageGap.name)}>
          Add {highestLeverageGap.name} to roadmap <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Roadmap({
  tasks,
  onToggleTask,
  onOpenAddMilestone,
  onOpenResources,
  readiness,
}: {
  tasks: RoadmapTask[];
  onToggleTask: (id: string) => void;
  onOpenAddMilestone: () => void;
  onOpenResources: (phase: RoadmapPhase) => void;
  readiness: number;
}) {
  const completedCount = tasks.filter((t) => t.done).length;
  const overallPercent = Math.round((completedCount / Math.max(1, tasks.length)) * 100);

  // Group tasks by phaseId
  const getTasksForPhase = (phaseId: number) => tasks.filter((t) => t.phaseId === phaseId);

  const getPhaseProgress = (phaseId: number) => {
    const phaseTasks = getTasksForPhase(phaseId);
    if (phaseTasks.length === 0) return 0;
    const done = phaseTasks.filter((t) => t.done).length;
    return Math.round((done / phaseTasks.length) * 100);
  };

  const handleMarkNextPending = () => {
    const nextPending = tasks.find((t) => !t.done);
    if (nextPending) {
      onToggleTask(nextPending.id);
    }
  };

  return (
    <div>
      <PageTitle
        eyebrow="YOUR PERSONAL PATH"
        title="Career roadmap"
        description="A clear, interactive sequence of focused milestones between today and job readiness."
        action={
          <button className="button button-small" onClick={onOpenAddMilestone}>
            <Plus size={15} /> Add a milestone
          </button>
        }
      />

      <div className="roadmap-progress">
        <div>
          <span>Overall progress</span>
          <strong>{overallPercent}%</strong>
        </div>
        <div className="progress-track">
          <i style={{ width: `${overallPercent}%` }} />
        </div>
        <span>{completedCount} of {tasks.length} milestones complete</span>
      </div>

      <div className="timeline">
        {roadmapPhases.map((phase, phaseIdx) => {
          const phaseId = phaseIdx + 1;
          const phaseTasks = getTasksForPhase(phaseId);
          const phaseProgress = getPhaseProgress(phaseId);

          return (
            <div
              className={`phase ${phaseProgress > 0 ? 'phase-active' : ''}`}
              key={phase.title}
            >
              <div className="phase-marker">
                <span>{phase.number}</span>
              </div>
              <div className="phase-card">
                <div className="phase-heading">
                  <div>
                    <span className="panel-kicker">PHASE {phase.number}</span>
                    <h2>{phase.title}</h2>
                    <p>{phase.subtitle}</p>
                  </div>
                  <div className="phase-percent">
                    {phaseProgress}%<small>complete</small>
                  </div>
                </div>
                <div className="phase-meter">
                  <i style={{ width: `${phaseProgress}%` }} />
                </div>
                <div className="phase-items">
                  {phaseTasks.length === 0 ? (
                    <small style={{ color: 'var(--text-muted)' }}>No milestones yet in this phase.</small>
                  ) : (
                    phaseTasks.map((task) => (
                      <label
                        key={task.id}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => onToggleTask(task.id)}
                        />
                        <span className="custom-checkbox">
                          {task.done && <Check size={11} />}
                        </span>
                        <span style={{ textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? 0.75 : 1 }}>
                          {task.title}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div className="phase-footer">
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => onOpenResources(phase)}
                    style={{ fontSize: '12px' }}
                  >
                    <BookOpen size={13} /> View {phase.resourceLinks.length} Curated Resources
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {phaseProgress === 100 ? 'Phase Complete' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="roadmap-note">
        <span><Sparkles size={16} /></span>
        <div>
          <strong>Small steps create career momentum.</strong>
          <p>Every milestone you check off moves your Career Readiness closer to job-ready status (currently {readiness}%).</p>
        </div>
        <button className="inline-link" onClick={handleMarkNextPending}>
          Mark next action complete <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ResumeStudio({
  resumeData,
  setResumeData,
  role,
  onOpenImprover,
  addToast,
}: {
  resumeData: ResumeData | null;
  setResumeData: React.Dispatch<React.SetStateAction<ResumeData | null>>;
  role: string;
  onOpenImprover: () => void;
  addToast: (title: string, desc?: string, type?: ToastMessage['type']) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeKb = Math.round(file.size / 1024);
    const roleInfo = rolesData[role] || rolesData['Software Engineer'];
    const extracted = roleInfo.skills.slice(0, 4).map((s) => s.name);

    const newResume: ResumeData = {
      fileName: file.name,
      fileSize: `${sizeKb || 142} KB`,
      uploadedAt: 'Today',
      score: 78,
      skillsFound: extracted,
      projectsFound: 2,
      strengths: ['Clear project ownership', 'Technical fundamentals present'],
      improvements: ['Quantify business outcomes with metrics', `Missing keywords: ${roleInfo.skills[4]?.name || 'System Design'}`],
      rewrites: sampleResumeRewrites,
    };

    setResumeData(newResume);
    addToast('Resume Analyzed!', `Parsed "${file.name}" with initial score of 78/100.`);
  };

  const handleDemoUpload = () => {
    const roleInfo = rolesData[role] || rolesData['Software Engineer'];
    const newResume: ResumeData = {
      fileName: 'Jordan_Davis_Resume_2026.pdf',
      fileSize: '154 KB',
      uploadedAt: 'Today',
      score: 78,
      skillsFound: roleInfo.skills.slice(0, 4).map((s) => s.name),
      projectsFound: 2,
      strengths: ['Clear project ownership', 'Consistent technical stack'],
      improvements: ['Quantify business outcomes with metrics', `Missing keywords: ${roleInfo.skills[4]?.name || 'System Design'}`],
      rewrites: sampleResumeRewrites,
    };
    setResumeData(newResume);
    addToast('Sample Resume Analyzed!', 'Loaded Jordan_Davis_Resume_2026.pdf (Score: 78/100)');
  };

  return (
    <div>
      <PageTitle
        eyebrow="MAKE YOUR STORY CLEAR"
        title="Resume studio"
        description="Understand what your resume signals to recruiters, then optimize it specifically for your target role."
        action={
          resumeData ? (
            <button
              className="button button-small"
              onClick={() => {
                setResumeData(null);
                addToast('Resume reset', 'Upload another file to analyze.');
              }}
            >
              <Upload size={15} /> Upload different resume
            </button>
          ) : undefined
        }
      />

      {!resumeData ? (
        <div className="upload-state">
          <div className="upload-icon"><Upload size={25} /></div>
          <h2>Upload your resume to discover your strengths.</h2>
          <p>Drop a PDF or DOCX here, or choose a file from your device. Your resume stays private to your workspace.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            <label className="button" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Choose file from device
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>
            <button className="button button-ghost" onClick={handleDemoUpload}>
              <Sparkles size={16} /> Use Sample Student Resume
            </button>
          </div>
          <span className="upload-note">ATS Parser ready · Tailored for {role}</span>
        </div>
      ) : (
        <div className="resume-result">
          <div className="panel resume-score">
            <div className="panel-kicker">RESUME ANALYSIS · {resumeData.fileName}</div>
            <div className="score-display">
              <strong>{resumeData.score}</strong><span>/100</span>
            </div>
            <div className="score-bar">
              <i style={{ width: `${resumeData.score}%` }} />
            </div>
            <p>
              {resumeData.score >= 90
                ? 'High ATS alignment! Your experience and role keywords are prominent and impactful.'
                : 'Solid foundation. Your project scope is clear; role-specific keywords and quantified outcomes can be surfaced more strongly.'}
            </p>
            <button className="button button-small" onClick={onOpenImprover}>
              <Sparkles size={15} /> Open resume improver <ArrowRight size={14} />
            </button>
          </div>

          <div className="panel extracted">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">EXTRACTED SIGNALS</span>
                <h2>What recruiters see</h2>
              </div>
              <span className="demo-badge"><Check size={12} /> Analysis complete</span>
            </div>
            <div className="extract-grid">
              <div>
                <span>Skills Detected</span>
                <div className="chip-list">
                  {resumeData.skillsFound.map((s) => <b key={s}>{s}</b>)}
                </div>
              </div>
              <div>
                <span>Experience Found</span>
                <strong>{resumeData.projectsFound} technical projects</strong>
                <small>Coursework & open source</small>
              </div>
              <div>
                <span>Strengths</span>
                <strong>{resumeData.strengths[0]}</strong>
                <small>{resumeData.strengths[1] || 'Good structure'}</small>
              </div>
              <div>
                <span>Missing ATS Keywords</span>
                <strong>{resumeData.improvements[0]}</strong>
                <small>{resumeData.improvements[1]}</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SMART MOCK INTERVIEW COMPONENT
   ============================================================ */

function Interview({
  role,
  started,
  setStarted,
  questionIndex,
  setQuestionIndex,
  answers,
  setAnswers,
  feedbacks,
  setFeedbacks,
  isComplete,
  setIsComplete,
  isRecording,
  setIsRecording,
  isSpeakingQuestion,
  setIsSpeakingQuestion,
  addToast,
}: {
  role: string;
  started: boolean;
  setStarted: React.Dispatch<React.SetStateAction<boolean>>;
  questionIndex: number;
  setQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  answers: Record<number, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  feedbacks: Record<number, QuestionFeedback>;
  setFeedbacks: React.Dispatch<React.SetStateAction<Record<number, QuestionFeedback>>>;
  isComplete: boolean;
  setIsComplete: React.Dispatch<React.SetStateAction<boolean>>;
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  isSpeakingQuestion: boolean;
  setIsSpeakingQuestion: React.Dispatch<React.SetStateAction<boolean>>;
  addToast: (title: string, desc?: string, type?: ToastMessage['type']) => void;
}) {
  const roleQuestions = interviewQuestions[role] || interviewQuestions['Software Engineer'];
  const currentQ = roleQuestions[questionIndex] || roleQuestions[0];
  const currentAnswer = answers[questionIndex] || '';
  const currentFeedback = feedbacks[questionIndex];
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  // Dynamic question type detection
  const detectedType = useMemo(() => {
    return detectQuestionType(currentQ.question, currentQ.category);
  }, [currentQ]);

  // Speech Recognition hook (Speech to text)
  const recognitionRef = useRef<any>(null);

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('Voice Not Supported', 'Your browser does not support Web Speech API. Please type your answer.', 'info');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setAnswers((prev) => ({
            ...prev,
            [questionIndex]: (prev[questionIndex] ? prev[questionIndex] + ' ' : '') + transcript,
          }));
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        addToast('Listening...', 'Speak clearly into your microphone.');
      } catch (err) {
        console.error('Speech recognition error:', err);
        setIsRecording(false);
      }
    }
  };

  // Text to Speech (Listen to Question)
  const toggleSpeechSynthesis = () => {
    if (!('speechSynthesis' in window)) {
      addToast('TTS Not Supported', 'Your browser does not support Speech Synthesis audio.', 'info');
      return;
    }

    if (isSpeakingQuestion) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQ.question);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeakingQuestion(false);
      utterance.onerror = () => setIsSpeakingQuestion(false);

      window.speechSynthesis.speak(utterance);
      setIsSpeakingQuestion(true);
      addToast('Speaking Question', 'Listen to the interview coach.');
    }
  };

  // Smart question-specific answer generator
  const handleGenerateSmartAnswer = async () => {
    addToast('Generating Answer...', `AI is drafting a specific response for this question.`);
    try {
      const smartAnswer = await generateMockInterviewAnswer(currentQ.question, role);
      setAnswers((prev) => ({ ...prev, [questionIndex]: smartAnswer }));
      addToast('Answer Generated', `Tailored professional response created.`);
    } catch {
      const smartAnswer = generateSmartAnswer(currentQ.question, role);
      setAnswers((prev) => ({ ...prev, [questionIndex]: smartAnswer }));
    }
  };

  // Deep evaluation of candidate answer
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      addToast('Answer Required', 'Please type or speak your answer before submitting.', 'info');
      return;
    }

    addToast('Evaluating Answer...', 'AI coach is analyzing communication, relevance, and structure.');
    try {
      const evaluation = await evaluateMockInterviewAnswer(currentQ.question, currentAnswer, role);
      setFeedbacks((prev) => ({ ...prev, [questionIndex]: evaluation }));
      setShowModelAnswer(false);
      addToast('Answer Evaluated!', `Communication: ${evaluation.communication}%, Relevance: ${evaluation.relevance}%, Structure: ${evaluation.structure}%`);
    } catch {
      const evaluation = evaluateAnswer(currentQ.question, currentAnswer, role);
      setFeedbacks((prev) => ({ ...prev, [questionIndex]: evaluation }));
      setShowModelAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeakingQuestion(false);
    setShowModelAnswer(false);

    if (questionIndex < roleQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setIsComplete(true);
      addToast('Mock Interview Completed!', 'Session finished with +12% boost to Career Readiness!', 'purple');
    }
  };

  const handleRestart = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeakingQuestion(false);
    setQuestionIndex(0);
    setAnswers({});
    setFeedbacks({});
    setIsComplete(false);
    setStarted(false);
    setShowModelAnswer(false);
  };

  if (!started) {
    return (
      <div>
        <PageTitle
          eyebrow="PRACTICE WITH INTENT"
          title={`Mock interview · ${role}`}
          description="Build interview confidence through deliberate, role-tailored practice."
          action={
            <button className="button button-small" onClick={() => setStarted(true)}>
              <Play size={14} /> Start session
            </button>
          }
        />
        <div className="interview-start">
          <div className="interview-orb"><Mic size={34} /></div>
          <h2>Ready when you are.</h2>
          <p>Practice 5 curated questions tailored for <strong>{role}</strong>, and receive instant AI coach feedback on communication, structure, and relevance.</p>
          <div className="session-details">
            <span><ClipboardCheck size={15} /> 5 questions</span>
            <span><Clock size={15} /> ~15 min</span>
            <span><Sparkles size={15} /> Adaptive AI feedback</span>
          </div>
          <button className="button" onClick={() => setStarted(true)}>
            Begin mock interview <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const feedbackList = Object.values(feedbacks);
    const avgComm = feedbackList.length ? Math.round(feedbackList.reduce((acc, f) => acc + f.communication, 0) / feedbackList.length) : 84;
    const avgRel = feedbackList.length ? Math.round(feedbackList.reduce((acc, f) => acc + f.relevance, 0) / feedbackList.length) : 89;
    const avgStruct = feedbackList.length ? Math.round(feedbackList.reduce((acc, f) => acc + f.structure, 0) / feedbackList.length) : 82;

    return (
      <div>
        <PageTitle
          eyebrow="SESSION COMPLETE"
          title="Interview performance summary"
          description="Great job completing your mock interview session!"
          action={
            <button className="button button-small" onClick={handleRestart}>
              <RotateCcw size={14} /> Practice again
            </button>
          }
        />
        <div className="progress-hero" style={{ marginBottom: 24 }}>
          <div>
            <span className="panel-kicker">OVERALL INTERVIEW SCORE</span>
            <h2>Strong execution across 5 questions.</h2>
            <p>Your responses demonstrated technical depth and clarity. You earned <strong>+12% Career Readiness</strong> for completing this practice.</p>
          </div>
          <div className="big-progress-ring">
            <strong>{Math.round((avgComm + avgRel + avgStruct) / 3)}<small>%</small></strong>
            <span>average</span>
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <StatCard label="Communication" value={`${avgComm}%`} change="Articulate delivery" icon={TrendingUp} accent="blue" />
          <StatCard label="Role Relevance" value={`${avgRel}%`} change={`Aligined with ${role}`} icon={Target} accent="purple" />
          <StatCard label="STAR Structure" value={`${avgStruct}%`} change="Situation, Action, Result" icon={Check} accent="green" />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">QUESTIONS REVIEWED</span>
              <h2>Your answers breakdown</h2>
            </div>
            <button className="button button-small" onClick={handleRestart}>Start new session</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
            {roleQuestions.map((q, idx) => (
              <div key={q.id} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13, color: 'var(--blue-soft)' }}>Question 0{idx + 1} · {detectQuestionType(q.question).toUpperCase()}</strong>
                  <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Answered</span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{q.question}</p>
                <div style={{ fontSize: 12, color: 'var(--text-soft)', fontStyle: 'italic', marginBottom: 6 }}>
                  "{answers[idx] || 'Answer recorded.'}"
                </div>
                {feedbacks[idx] && (
                  <div style={{ fontSize: 11.5, color: 'var(--blue-soft)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    💡 <strong>Coach Feedback:</strong> {feedbacks[idx].summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        eyebrow="PRACTICE WITH INTENT"
        title="Mock interview session"
        description={`Customized questions for ${role}.`}
        action={
          <span className="session-pill">
            <span className="live-dot" /> Session in progress (Question {questionIndex + 1} of {roleQuestions.length})
          </span>
        }
      />

      <div className="interview-layout">
        <div className="panel interviewer">
          <div className="ai-face"><BrainCircuit size={24} /></div>
          <div>
            <span className="panel-kicker">SKILLFORGE AI</span>
            <h2>Interview coach</h2>
            <p>Take a moment to formulate your thoughts. Focus on specific technical contributions.</p>
          </div>
          <div className="coach-tip">
            <Sparkles size={14} />
            <span>{currentQ.coachTip}</span>
          </div>
        </div>

        <div className="panel question-panel">
          <div className="question-top">
            <span>QUESTION 0{questionIndex + 1} / 0{roleQuestions.length}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="demo-badge" style={{ textTransform: 'capitalize' }}>
                {detectedType} Question
              </span>
              <button
                className="icon-button"
                style={{ width: 30, height: 30 }}
                title={isSpeakingQuestion ? 'Stop speaking' : 'Listen to question (AI Voice)'}
                onClick={toggleSpeechSynthesis}
              >
                {isSpeakingQuestion ? <VolumeX size={15} style={{ color: '#ff5a5a' }} /> : <Volume2 size={15} />}
              </button>
            </div>
          </div>

          <h2>{currentQ.question}</h2>

          <textarea
            value={currentAnswer}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [questionIndex]: e.target.value }))}
            placeholder={`Type your ${detectedType} response, or click 'Draft AI Answer' below to see an ideal structured answer...`}
            rows={5}
          />

          <div className="answer-actions">
            <button
              type="button"
              className="text-button"
              style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={handleGenerateSmartAnswer}
            >
              <Sparkles size={13} /> Draft AI Answer for this Question
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`icon-button ${isRecording ? 'mic-listening' : ''}`}
                title={isRecording ? 'Stop recording' : 'Speak answer (Speech-to-Text)'}
                onClick={toggleMic}
              >
                {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button className="button button-small" onClick={handleSubmitAnswer}>
                Evaluate answer <Send size={14} />
              </button>
            </div>
          </div>

          {currentFeedback && (
            <div className="feedback">
              <div className="feedback-heading">
                <span className="feedback-icon"><Check size={15} /></span>
                <div>
                  <strong>{currentFeedback.summary}</strong>
                  <small>Evaluated against {role} ({detectedType}) rubric</small>
                </div>
              </div>
              <div className="feedback-grid">
                <span>
                  <b>Communication</b>
                  <i style={{ width: `${currentFeedback.communication}%` }} />
                </span>
                <span>
                  <b>Relevance</b>
                  <i style={{ width: `${currentFeedback.relevance}%` }} />
                </span>
                <span>
                  <b>Structure ({detectedType === 'technical' ? 'Problem/Resolution' : 'STAR'})</b>
                  <i style={{ width: `${currentFeedback.structure}%` }} />
                </span>
              </div>

              {/* Dynamic Strengths & Actionable Improvements */}
              <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.5 }}>
                <div style={{ color: 'var(--green)', marginBottom: 4 }}>
                  ✓ <strong>Key Strengths:</strong> {currentFeedback.strengths.join(' ')}
                </div>
                <div style={{ color: 'var(--blue-soft)' }}>
                  💡 <strong>How to Elevate:</strong> {currentFeedback.improvements.join(' ')}
                </div>
              </div>

              {/* Model Answer Toggle */}
              {currentFeedback.modelAnswerSuggestion && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="inline-link"
                    style={{ fontSize: 12 }}
                    onClick={() => setShowModelAnswer(!showModelAnswer)}
                  >
                    {showModelAnswer ? 'Hide model response' : 'Compare with ideal AI response'} <ChevronDown size={13} />
                  </button>
                  {showModelAnswer && (
                    <div style={{ marginTop: 8, padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>
                      {currentFeedback.modelAnswerSuggestion}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="button button-small" onClick={handleNextQuestion}>
                  {questionIndex < roleQuestions.length - 1 ? (
                    <>Next question <ArrowRight size={14} /></>
                  ) : (
                    <>View final results <Check size={14} /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="panel interview-progress">
          <span className="panel-kicker">YOUR PROGRESS</span>
          <div className="interview-ring">
            <strong>{questionIndex + 1}<small>/{roleQuestions.length}</small></strong>
          </div>
          <p>Practice makes permanent. Keep your answers grounded in specific examples.</p>
          <div className="question-dots">
            {roleQuestions.map((_, idx) => (
              <span
                key={idx}
                className={idx < questionIndex ? 'complete' : idx === questionIndex ? 'current' : ''}
              >
                {idx < questionIndex ? <Check size={10} /> : idx + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Progress({
  readiness,
  completedTasks,
  resumeScore,
  interviewDone,
  role,
  userName,
  tasks,
  setView,
}: {
  readiness: number;
  completedTasks: number;
  resumeScore: number;
  interviewDone: boolean;
  role: string;
  userName: string;
  tasks: RoadmapTask[];
  setView: (v: View) => void;
}) {
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div>
      <PageTitle
        eyebrow="MAKE GROWTH VISIBLE"
        title="Your progress"
        description="A clear view of the work you have completed and your momentum toward career readiness."
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="button button-ghost button-small" onClick={handlePrintReport}>
              <Printer size={15} /> Export Career Report
            </button>
            <button className="button button-small" onClick={() => setView('roadmap')}>
              <Target size={15} /> View roadmap
            </button>
          </div>
        }
      />

      <div className="progress-hero">
        <div>
          <span className="panel-kicker">CAREER READINESS SUMMARY</span>
          <h2>{userName}'s Momentum Toward {role}</h2>
          <p>Your readiness signal is at <strong>{readiness}%</strong>. Complete remaining high-priority technical milestones to enter the job-ready tier.</p>
        </div>
        <div className="big-progress-ring">
          <strong>{readiness}<small>%</small></strong>
          <span>ready</span>
        </div>
      </div>

      <div className="milestone-grid">
        <div className="milestone-card">
          <span className="milestone-icon blue"><Check size={17} /></span>
          <strong>Skills mastered</strong>
          <b>{completedTasks + 4}</b>
          <small>Across core domains</small>
        </div>
        <div className="milestone-card">
          <span className="milestone-icon purple"><Target size={17} /></span>
          <strong>Roadmap milestones</strong>
          <b>{completedTasks}</b>
          <small>Completed tasks</small>
        </div>
        <div className="milestone-card">
          <span className="milestone-icon green"><FileText size={17} /></span>
          <strong>Resume score</strong>
          <b>{resumeScore}/100</b>
          <small>{resumeScore >= 90 ? 'ATS Optimized' : 'Needs alignment'}</small>
        </div>
        <div className="milestone-card">
          <span className="milestone-icon orange"><Mic size={17} /></span>
          <strong>Mock interview</strong>
          <b>{interviewDone ? '1 complete' : 'In progress'}</b>
          <small>STAR methodology</small>
        </div>
      </div>

      <div className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">RECENT ACTIVITY</span>
            <h2>Your progress trail</h2>
          </div>
          <button className="inline-link" onClick={() => setView('overview')}>
            Back to overview <ArrowRight size={14} />
          </button>
        </div>
        <div className="activity-list">
          {[
            ['Today', `Aligned profile with ${role} requirements`, 'Target Role', Target],
            ['Today', `Updated career roadmap milestones (${completedTasks} complete)`, 'Roadmap', Check],
            ['Recent', `Resume analyzed (${resumeScore}/100)`, 'Resume Studio', FileText],
            ['Recent', 'Mock interview practice question session', 'Interview', Mic],
          ].map(([date, title, meta, Icon]) => {
            const ActivityIcon = Icon as typeof Check;
            return (
              <div className="activity-item" key={title as string}>
                <span className="activity-icon"><ActivityIcon size={14} /></span>
                <div>
                  <strong>{title as string}</strong>
                  <small>{meta as string}</small>
                </div>
                <span className="activity-date">{date as string}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SMART COPILOT DRAWER COMPONENT
   ============================================================ */

function Copilot({
  messages,
  setMessages,
  isThinking,
  setIsThinking,
  onClose,
  role,
  userName,
  tasks,
  readiness,
}: {
  messages: { sender: 'user' | 'assistant'; text: string }[];
  setMessages: React.Dispatch<React.SetStateAction<{ sender: 'user' | 'assistant'; text: string }[]>>;
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  role: string;
  userName: string;
  tasks: RoadmapTask[];
  readiness: number;
}) {
  const [input, setInput] = useState('');
  const suggestions = [
    'What should I learn next for my role?',
    'How can I improve my resume for recruiters?',
    `Top interview tips for ${role}`,
    'What is the average salary and market demand?',
  ];

  const send = async (text: string) => {
    if (!text.trim() || isThinking) return;
    const userMsg = text.trim();
    const updated = [...messages, { sender: 'user' as const, text: userMsg }];
    setMessages(updated);
    setInput('');
    setIsThinking(true);

    try {
      const reply = await generateCopilotResponse(userMsg, updated, { role, userName });
      setMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: "I'm having a momentary connection issue. Let me know what you need help with!" },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="copilot-drawer">
      <div className="copilot-header">
        <div>
          <span className="copilot-spark"><Sparkles size={15} /></span>
          <div>
            <strong>SkillForge Copilot</strong>
            <small>AI Career Agent · {role}</small>
          </div>
        </div>
        <button className="icon-button" onClick={onClose}><X size={17} /></button>
      </div>

      <div className="copilot-body">
        <div className="copilot-welcome">
          <div className="copilot-big-icon"><Sparkles size={22} /></div>
          <h2>Clarity starts with a question.</h2>
          <p>I know your profile, target role ({role}), and current gaps. Ask me anything to accelerate your readiness.</p>
        </div>

        {messages.length === 0 && (
          <div className="suggestion-list">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s} <ArrowRight size={14} />
              </button>
            ))}
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className="message">
            {m.sender === 'user' ? (
              <span>{m.text}</span>
            ) : (
              <div className="copilot-reply">
                <Sparkles size={15} />
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.text}</div>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="copilot-reply">
            <Sparkles size={15} className="spin" />
            <span>Analyzing your profile and generating recommendation…</span>
          </div>
        )}
      </div>

      <div className="copilot-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder={`Ask about ${role}, coding, resumes, interviews...`}
          disabled={isThinking}
        />
        <button onClick={() => send(input)} disabled={isThinking}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   COMMAND PALETTE SPOTLIGHT MODAL (CTRL+K)
   ============================================================ */

function CommandPaletteModal({
  currentRole,
  onSelectView,
  onSelectRole,
  onOpenCopilot,
  onOpenProfile,
  onClose,
}: {
  currentRole: string;
  onSelectView: (v: View) => void;
  onSelectRole: (r: string) => void;
  onOpenCopilot: () => void;
  onOpenProfile: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.toLowerCase().trim();

  const views: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'skill-gap', label: 'Skill Gap Analyzer', icon: Radar },
    { id: 'roadmap', label: 'Career Roadmap Timeline', icon: Target },
    { id: 'resume', label: 'Resume Studio & ATS Optimizer', icon: FileText },
    { id: 'interview', label: 'Mock Interview Coach', icon: Mic },
    { id: 'progress', label: 'Progress Signals & Metrics', icon: TrendingUp },
  ];

  const filteredViews = views.filter((v) => v.label.toLowerCase().includes(q));
  const filteredRoles = availableRoles.filter((r) => r.toLowerCase().includes(q));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-wrap">
          <Search size={18} style={{ color: 'var(--blue-soft)' }} />
          <input
            ref={inputRef}
            placeholder="Type a command or search views, roles, actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          <span className="command-shortcut">ESC</span>
        </div>

        <div className="command-list">
          {/* Quick Actions */}
          <div className="command-category">Quick Actions</div>
          <button className="command-item" onClick={onOpenCopilot}>
            <div className="command-item-left">
              <Sparkles size={16} style={{ color: 'var(--blue-soft)' }} />
              <span>Ask SkillForge Copilot</span>
            </div>
            <small>AI Chat</small>
          </button>
          <button className="command-item" onClick={onOpenProfile}>
            <div className="command-item-left">
              <UserRound size={16} style={{ color: 'var(--purple)' }} />
              <span>Edit Student Profile & Skills</span>
            </div>
            <small>Profile</small>
          </button>

          {/* Navigation Views */}
          <div className="command-category" style={{ marginTop: 10 }}>Navigation</div>
          {filteredViews.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="command-item"
                onClick={() => onSelectView(item.id)}
              >
                <div className="command-item-left">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                <small>Go to view</small>
              </button>
            );
          })}

          {/* Switch Role */}
          <div className="command-category" style={{ marginTop: 10 }}>Switch Target Role</div>
          {filteredRoles.map((role) => (
            <button
              key={role}
              className={`command-item ${role === currentRole ? 'active' : ''}`}
              onClick={() => onSelectRole(role)}
            >
              <div className="command-item-left">
                <BriefcaseBusiness size={16} />
                <span>{role}</span>
              </div>
              <small>{role === currentRole ? 'Active' : 'Switch role'}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EXTRA INTERACTIVE MODALS
   ============================================================ */

function AddMilestoneModal({
  onAdd,
  onClose,
}: {
  onAdd: (title: string, phaseId: number, meta: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [phaseId, setPhaseId] = useState(2);
  const [meta, setMeta] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), phaseId, meta.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-single" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Add a Custom Milestone</h2>
        <p>Define a new goal or action item to track in your career roadmap.</p>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Milestone Title</label>
            <input
              placeholder="e.g. Build Docker Container for Backend API"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label>Roadmap Phase</label>
            <select value={phaseId} onChange={(e) => setPhaseId(Number(e.target.value))}>
              <option value={1}>Phase 01: Foundation</option>
              <option value={2}>Phase 02: Core Technical Skills</option>
              <option value={3}>Phase 03: Projects & Portfolio</option>
              <option value={4}>Phase 04: Interview Preparation</option>
              <option value={5}>Phase 05: Job Readiness</option>
            </select>
          </div>
          <div className="auth-field">
            <label>Tag / Subtitle (Optional)</label>
            <input
              placeholder="e.g. Portfolio · 2 hours"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button type="button" className="text-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-small">Add Milestone <Plus size={15} /></button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResourcesModal({
  phase,
  onClose,
}: {
  phase: RoadmapPhase;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-single" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="eyebrow">Phase {phase.number} Resources</div>
        <h2>{phase.title} Learning Hub</h2>
        <p>Curated guides, official documentation, and interactive practice materials.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phase.resourceLinks.map((res) => (
            <a
              key={res.title}
              href={res.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              <div>
                <strong style={{ fontSize: 14 }}>{res.title}</strong>
                <small style={{ display: 'block', color: 'var(--blue-soft)', fontSize: 11, marginTop: 2 }}>{res.type}</small>
              </div>
              <ExternalLink size={16} style={{ color: 'var(--text-muted)' }} />
            </a>
          ))}
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="button button-small" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ResumeImproverModal({
  role,
  onApply,
  onClose,
}: {
  role: string;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-single" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="eyebrow">AI Resume Optimizer · {role}</div>
        <h2>Actionable Bullet Improvements</h2>
        <p>Rewriting passive bullet points into high-impact outcome statements increases callback rates by 3.2x.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sampleResumeRewrites.map((r, idx) => (
            <div
              key={idx}
              style={{
                padding: 16,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#ff5a5a', fontWeight: 600 }}>BEFORE: </span>
                <span style={{ fontSize: 13, textDecoration: 'line-through', opacity: 0.8 }}>"{r.before}"</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>AFTER: </span>
                <strong style={{ fontSize: 13.5, color: 'var(--text)' }}>"{r.after}"</strong>
              </div>
              <small style={{ color: 'var(--blue-soft)', fontSize: 11 }}>💡 {r.reason}</small>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimated Score Boost: +14 points</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="text-button" onClick={onClose}>Cancel</button>
            <button className="button button-small" onClick={onApply}>
              <Sparkles size={15} /> Apply to Resume & Boost Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SHARED REUSABLE MINI COMPONENTS
   ============================================================ */

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  change: string;
  icon: typeof TrendingUp;
  accent: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${accent}`}><Icon size={17} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small><span className={`status-dot ${accent}`} /> {change}</small>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="hero-visual">
      <div className="visual-glow" />
      <div className="floating-tag tag-role">
        <BriefcaseBusiness size={14} />
        <span>Target role</span>
        <strong>Software Engineer</strong>
      </div>
      <div className="floating-tag tag-readiness">
        <span className="tiny-ring">72</span>
        <span>Career readiness</span>
        <strong>On the rise <TrendingUp size={13} /></strong>
      </div>
      <div className="dashboard-card">
        <div className="dashboard-top">
          <span><span className="live-dot" /> Profile analysis</span>
          <MoreHorizontal size={16} />
        </div>
        <div className="profile-row">
          <div className="big-avatar">JD</div>
          <div>
            <strong>Jordan Davis</strong>
            <span>Computer Science · Junior</span>
          </div>
          <span className="score-pill">72% ready</span>
        </div>
        <div className="dash-divider" />
        <div className="metrics">
          <div>
            <span>Skill alignment</span>
            <strong>68%</strong>
            <div className="meter"><i style={{ width: '68%' }} /></div>
          </div>
          <div>
            <span>Roadmap progress</span>
            <strong>42%</strong>
            <div className="meter purple"><i style={{ width: '42%' }} /></div>
          </div>
        </div>
        <div className="recommendation">
          <span className="recommend-icon"><Sparkles size={13} /></span>
          <div>
            <small>NEXT BEST ACTION</small>
            <strong>Complete data structures fundamentals</strong>
          </div>
          <ChevronRight size={15} />
        </div>
      </div>
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="preview-wrap">
      <div className="preview-top">
        <span className="window-dot red" />
        <span className="window-dot yellow" />
        <span className="window-dot green" />
        <span className="preview-title">skillforge.ai / overview</span>
      </div>
      <div className="preview-body">
        <div className="preview-sidebar">
          <span className="preview-logo"><Sparkles size={13} /></span>
          <span className="preview-side-active"><LayoutDashboard size={13} /></span>
          <span><Radar size={13} /></span>
          <span><Target size={13} /></span>
          <span><FileText size={13} /></span>
          <span><Mic size={13} /></span>
        </div>
        <div className="preview-main">
          <div className="preview-welcome">
            <div>
              <span>TODAY</span>
              <strong>Good morning, Jordan.</strong>
            </div>
            <span className="preview-chip"><Sparkles size={11} /> Live profile</span>
          </div>
          <div className="preview-stats">
            <div>
              <span>Career readiness</span>
              <strong>76<span>%</span></strong>
              <small><TrendingUp size={10} /> +8% this month</small>
            </div>
            <div>
              <span>Skill gap</span>
              <strong>2<span> critical</span></strong>
              <small>Data structures & System Design</small>
            </div>
            <div>
              <span>Roadmap</span>
              <strong>50<span>%</span></strong>
              <small>5 milestones complete</small>
            </div>
          </div>
          <div className="preview-lower">
            <div className="preview-chart">
              <div className="chart-heading">
                <strong>Readiness over time</strong>
                <span>Last 30 days <ChevronDown size={10} /></span>
              </div>
              <div className="chart-grid">
                <div className="chart-line" />
                <span>40</span><span>60</span><span>80</span>
              </div>
            </div>
            <div className="preview-actions">
              <strong>Next best actions</strong>
              <div>
                <span className="action-check"><Check size={10} /></span>
                <span>Complete Python fundamentals</span>
              </div>
              <div>
                <span className="action-check empty" />
                <span>Build REST API project</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
