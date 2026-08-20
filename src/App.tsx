import React, { useState, useEffect } from 'react';
import {
  Database,
  LayoutDashboard,
  GraduationCap,
  Terminal,
  Layers,
  Code2,
  Users,
  BookOpen,
  CheckCircle2,
  Server,
  Activity,
  ShieldCheck,
  LogIn,
  LogOut,
  UserCheck,
  Radio,
  FileCheck2,
} from 'lucide-react';
import { SqlSchemaViewer } from './components/SqlSchemaViewer.tsx';
import { TeacherLayout } from './components/TeacherLayout.tsx';
import { StudentDashboard } from './components/StudentDashboard.tsx';
import { StudentExamSimulator } from './components/StudentExamSimulator.tsx';
import { ApiConsole } from './components/ApiConsole.tsx';
import { LoginUI } from './components/LoginUI.tsx';
import { SchemaTableInfo, SampleQueryInfo, CBTUser, CBTExam, CBTExamSession } from './types.ts';
import { apiFetch, parseJsonResponse } from './utils/api.ts';
import { fallbackSchemaData } from './data/schemaData.ts';

export type AppTab = 'login' | 'teacher' | 'student' | 'exam_active' | 'schema' | 'api';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('login');
  const [currentUser, setCurrentUser] = useState<CBTUser | null>(null);
  const [userRole, setUserRole] = useState<'guru' | 'murid' | 'admin' | null>(null);
  const [activeExamToken, setActiveExamToken] = useState<string>('');
  const [activeExamSession, setActiveExamSession] = useState<CBTExamSession | null>(null);
  const [activeExamInfo, setActiveExamInfo] = useState<CBTExam | null>(null);
  const [examCompletedNotification, setExamCompletedNotification] = useState<{
    message: string;
    session?: CBTExamSession;
    stats?: any;
  } | null>(null);

  const [schemaData, setSchemaData] = useState<{
    tables: SchemaTableInfo[];
    sampleQueries: SampleQueryInfo[];
  }>(fallbackSchemaData);

  const [stats, setStats] = useState({
    totalUsers: 3,
    totalExams: 1,
    totalQuestions: 5,
    totalSessions: 0,
  });

  // Handler Login: Mengarahkan secara dinamis berdasarkan peran pengguna
  const handleLoginSuccess = (user: CBTUser, role: 'guru' | 'murid' | 'admin') => {
    setCurrentUser(user);
    setUserRole(role);

    if (role === 'murid') {
      setActiveTab('student');
    } else if (role === 'guru' || role === 'admin') {
      setActiveTab('teacher');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole(null);
    setActiveExamToken('');
    setActiveExamSession(null);
    setActiveExamInfo(null);
    setExamCompletedNotification(null);
    setActiveTab('login');
  };

  // Handler ketika siswa memulai ujian dari StudentDashboard
  const handleStartExamFromDashboard = (token: string, sessionData?: CBTExamSession, examData?: CBTExam) => {
    setActiveExamToken(token);
    if (sessionData) setActiveExamSession(sessionData);
    if (examData) setActiveExamInfo(examData);
    setExamCompletedNotification(null);
    setActiveTab('exam_active');
  };

  // Handler saat selesai / keluar dari ruang ujian simulator
  const handleExitExamToDashboard = (info?: { session?: CBTExamSession; stats?: any; message?: string }) => {
    setActiveExamToken('');
    setActiveExamSession(null);
    setActiveExamInfo(null);
    if (info?.message) {
      setExamCompletedNotification({
        message: info.message,
        session: info.session,
        stats: info.stats,
      });
    }
    setActiveTab('student');
  };

  useEffect(() => {
    // Fetch schema details safely with fallback
    apiFetch('/api/db/schema-info')
      .then((res) => parseJsonResponse(res, fallbackSchemaData))
      .then((data) => {
        if (data && data.tables) {
          setSchemaData(data);
        }
      })
      .catch((err) => {
        console.warn('Schema info notice (using fallback):', err.message || err);
        setSchemaData(fallbackSchemaData);
      });

    // Fetch live summary stats
    Promise.all([
      apiFetch('/api/users').then((r) => parseJsonResponse(r, [])).catch(() => []),
      apiFetch('/api/exams').then((r) => parseJsonResponse(r, [])).catch(() => []),
      apiFetch('/api/sessions').then((r) => parseJsonResponse(r, [])).catch(() => []),
    ])
      .then(([users, exams, sessions]) => {
        setStats({
          totalUsers: Array.isArray(users) && users.length > 0 ? users.length : 5,
          totalExams: Array.isArray(exams) && exams.length > 0 ? exams.length : 1,
          totalQuestions: 6,
          totalSessions: Array.isArray(sessions) ? sessions.length : 4,
        });
      })
      .catch((e) => console.warn('Stats fetch notice:', e));
  }, [activeTab]);

  // =========================================================================
  // JIKA SEDANG UJIAN (Fullscreen View tanpa wrapper toolbar manager)
  // =========================================================================
  if (activeTab === 'exam_active') {
    return (
      <div className="min-h-screen bg-[#f7f9fb]">
        <StudentExamSimulator
          currentUser={currentUser}
          initialToken={activeExamToken}
          initialSession={activeExamSession}
          initialExam={activeExamInfo}
          onExitExam={handleExitExamToDashboard}
          onReturnToDashboard={handleExitExamToDashboard}
        />
      </div>
    );
  }

  // =========================================================================
  // JIKA TAMPILAN GURU (Full Teacher Layout terintegrasi)
  // =========================================================================
  if (activeTab === 'teacher') {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <TeacherLayout currentUser={currentUser} onLogout={handleLogout} />
      </div>
    );
  }

  // =========================================================================
  // JIKA TAMPILAN MURID (Full Student Dashboard)
  // =========================================================================
  if (activeTab === 'student') {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <StudentDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onStartExam={handleStartExamFromDashboard}
          completedNotification={examCompletedNotification}
          onClearNotification={() => setExamCompletedNotification(null)}
        />
      </div>
    );
  }

  // =========================================================================
  // JIKA TAMPILAN LOGIN PORTAL
  // =========================================================================
  if (activeTab === 'login') {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <LoginUI onLoginSuccess={handleLoginSuccess} onNavigateToTab={setActiveTab} />
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN DEV / ARCHITECTURE / SCHEMA & API CONSOLE
  // =========================================================================
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* Top Navbar */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Academic Excellence Portal"
            className="w-10 h-10 object-contain rounded-md"
          />
          <div className="flex items-center">
            <h1 className="font-semibold text-lg tracking-tight text-slate-900">
              Academic Excellence Portal
            </h1>
            <span className="text-slate-400 font-normal ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              PostgreSQL • Node.js Express
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2.5 bg-slate-50 pl-3 pr-1.5 py-1 rounded-full border border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-800">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{currentUser.name}</span>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded uppercase">
                  {userRole}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Keluar"
                className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-slate-200 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('login')}
              className="px-3 py-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Buka Portal Login</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 text-xs font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Cloud SQL: Connected</span>
          </div>
        </div>
      </nav>

      {/* Main Body with Sidebar Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Dark Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 text-slate-400 p-4 flex flex-col justify-between border-r border-slate-800 flex-shrink-0">
          <div className="space-y-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 px-2">
                User Portals
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('login')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium hover:bg-slate-800/60 hover:text-slate-200 transition-colors text-left"
                >
                  <LogIn className="w-4 h-4 text-blue-400" />
                  <span>Academic Login UI</span>
                </button>

                <button
                  onClick={() => setActiveTab('teacher')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium hover:bg-slate-800/60 hover:text-slate-200 transition-colors text-left"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-400" />
                  <span>Portal Guru (Layout)</span>
                </button>

                <button
                  onClick={() => setActiveTab('student')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium hover:bg-slate-800/60 hover:text-slate-200 transition-colors text-left"
                >
                  <GraduationCap className="w-4 h-4 text-blue-400" />
                  <span>Portal Murid (Dashboard)</span>
                </button>

                <button
                  onClick={() => setActiveTab('exam_active')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium hover:bg-slate-800/60 hover:text-slate-200 transition-colors text-left"
                >
                  <FileCheck2 className="w-4 h-4 text-blue-400" />
                  <span>Ruang Ujian (Simulator)</span>
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 px-2">
                Database Architecture
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTab('schema')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
                    activeTab === 'schema'
                      ? 'bg-slate-800 text-white shadow-xs font-semibold'
                      : 'hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>Relational Schema (5)</span>
                </button>

                <button
                  onClick={() => setActiveTab('api')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
                    activeTab === 'api'
                      ? 'bg-slate-800 text-white shadow-xs font-semibold'
                      : 'hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>API Endpoints Console</span>
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 px-2">
                Active Relational Tables
              </div>
              <div className="flex flex-col gap-0.5 text-xs font-mono">
                <div
                  onClick={() => setActiveTab('schema')}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer rounded hover:bg-slate-800/40 flex items-center justify-between"
                >
                  <span>• Users</span>
                  <span className="text-[10px] text-slate-600">auth/roles</span>
                </div>
                <div
                  onClick={() => setActiveTab('schema')}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer rounded hover:bg-slate-800/40 flex items-center justify-between"
                >
                  <span>• Exams</span>
                  <span className="text-[10px] text-slate-600">packages</span>
                </div>
                <div
                  onClick={() => setActiveTab('schema')}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer rounded hover:bg-slate-800/40 flex items-center justify-between"
                >
                  <span>• Questions</span>
                  <span className="text-[10px] text-slate-600">A-E bank</span>
                </div>
                <div
                  onClick={() => setActiveTab('schema')}
                  className="px-3 py-1.5 text-blue-400 font-semibold cursor-pointer rounded bg-slate-800/30 flex items-center justify-between"
                >
                  <span>• Exam_Sessions</span>
                  <span className="text-[10px] text-blue-400">anti-cheat</span>
                </div>
                <div
                  onClick={() => setActiveTab('schema')}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer rounded hover:bg-slate-800/40 flex items-center justify-between"
                >
                  <span>• Student_Answers</span>
                  <span className="text-[10px] text-slate-600">grading</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                ACID Transactions
              </span>
              <span className="text-green-400 font-mono">OK</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Drizzle ORM Dialect: pg
            </div>
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
          {/* Top Metric Cards Row */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Active Users (Murid/Guru)
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalUsers}</div>
              <div className="text-[10px] text-green-600 mt-1 font-medium flex items-center gap-1">
                <span>↑</span> Terdaftar di PostgreSQL Users
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Exams Active
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalExams}</div>
              <div
                onClick={() => setActiveTab('teacher')}
                className="text-[10px] text-blue-600 mt-1 font-medium underline cursor-pointer"
              >
                Lihat paket ujian live →
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Total Questions (A-E)
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalQuestions}</div>
              <div className="text-[10px] text-slate-400 mt-1">Multi-media & bobot poin</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Sesi Ujian Selesai
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalSessions}</div>
              <div className="w-full bg-slate-100 h-1.5 mt-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[40%]"></div>
              </div>
            </div>
          </section>

          {/* Active View Container */}
          <section className="flex-1 min-h-0">
            {activeTab === 'schema' && schemaData && (
              <SqlSchemaViewer tables={schemaData.tables} sampleQueries={schemaData.sampleQueries} />
            )}

            {activeTab === 'api' && <ApiConsole />}
          </section>
        </main>
      </div>
    </div>
  );
}
