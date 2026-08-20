import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  KeyRound,
  FileCheck2,
  LogOut,
  Bell,
  Download,
  Calendar,
  Clock,
  BookOpen,
  ArrowRight,
  Play,
  CheckCircle2,
  AlertTriangle,
  Award,
  ShieldCheck,
  Search,
  Sparkles,
  Info,
  Loader2,
  Maximize2,
} from 'lucide-react';
import { CBTUser, CBTExam, CBTExamSession } from '../types.ts';
import { apiFetch, parseJsonResponse } from '../utils/api.ts';

interface StudentDashboardProps {
  currentUser?: CBTUser | null;
  onLogout?: () => void;
  onStartExam?: (token: string, session?: CBTExamSession, exam?: CBTExam) => void;
  completedNotification?: {
    message: string;
    session?: CBTExamSession;
    stats?: any;
  } | null;
  onClearNotification?: () => void;
}

interface ExamHistoryItem {
  id: number;
  subject: string;
  date: string;
  examType: string;
  score: number;
  maxScore: number;
  status: 'Lulus' | 'Batas Bawah' | 'Remedial';
  classAvg: number;
  benar_pg?: number;
  salah_pg?: number;
  kosong_pg?: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  onLogout,
  onStartExam,
  completedNotification,
  onClearNotification,
}) => {
  // State untuk navigasi menu aktif: 'ujian' | 'hasil'
  const [activeTab, setActiveTab] = useState<'ujian' | 'hasil'>(completedNotification ? 'hasil' : 'ujian');
  const [examToken, setExamToken] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(completedNotification?.message || null);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [realHistory, setRealHistory] = useState<ExamHistoryItem[]>([]);

  const studentName = currentUser?.name || 'Budi Santoso';
  const studentNis = currentUser?.username || '10001';

  // Load real sessions dari server untuk murid ini
  useEffect(() => {
    apiFetch('/api/live-monitor')
      .then((res) => parseJsonResponse(res, { sessions: [] }))
      .then((data) => {
        if (data?.sessions && Array.isArray(data.sessions)) {
          const userSessions = data.sessions.filter(
            (s: any) =>
              (s.user_id === currentUser?.id || s.student_username === currentUser?.username) &&
              (s.status_pengerjaan === 'Selesai' || s.status_pengerjaan === 'Force Submit')
          );

          if (userSessions.length > 0) {
            const mapped: ExamHistoryItem[] = userSessions.map((s: any) => {
              const score = s.total_nilai ?? 0;
              let status: 'Lulus' | 'Batas Bawah' | 'Remedial' = 'Lulus';
              if (score < 65) status = 'Remedial';
              else if (score < 75) status = 'Batas Bawah';

              const submitDate = s.waktu_submit
                ? new Date(s.waktu_submit).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Hari ini';

              return {
                id: s.id,
                subject: s.exam_mapel || s.exam_kode || 'Ujian CBT',
                date: submitDate,
                examType: s.status_pengerjaan === 'Force Submit' ? 'Ujian (Force Submit)' : 'Ujian Online Terjadwal',
                score: Math.round(score),
                maxScore: 100,
                status,
                classAvg: 80,
                benar_pg: s.benar_pg,
                salah_pg: s.salah_pg,
                kosong_pg: s.kosong_pg,
              };
            });
            setRealHistory(mapped);
          }
        }
      })
      .catch((e) => console.warn('Could not load live sessions:', e));
  }, [currentUser, completedNotification]);

  // Efek bila ada notifikasi submit selesai
  useEffect(() => {
    if (completedNotification?.message) {
      setActiveTab('hasil');
      setToastMessage(completedNotification.message);
    }
  }, [completedNotification]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleStartExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = examToken.trim().toUpperCase();

    if (!cleanToken) {
      setTokenError('Silakan masukkan token ujian terlebih dahulu.');
      return;
    }

    if (cleanToken.length < 3) {
      setTokenError('Format token tidak valid. Silakan periksa kembali token dari pengawas.');
      return;
    }

    setTokenError(null);
    setIsValidatingToken(true);

    try {
      // 1. Tembak API POST /api/start-exam dengan payload aman (user_id siswa yang sedang login & token)
      const res = await apiFetch('/api/start-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser?.id,
          username: currentUser?.username,
          token: cleanToken,
        }),
      });

      const data = await parseJsonResponse(res);

      // 2. Request Fullscreen Mode jika browser mendukung untuk pengalaman ujian terstandar
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (fsErr) {
        console.log('Fullscreen request was bypassed or not permitted in iframe:', fsErr);
      }

      // 3. Transisi langsung ke Halaman Soal Ujian (StudentExamSimulator)
      if (onStartExam) {
        onStartExam(cleanToken, data.session, data.exam);
      }
    } catch (err: any) {
      console.error('Error starting exam:', err);
      setTokenError(err.message || 'Gagal memulai ujian. Silakan coba kembali.');
    } finally {
      setIsValidatingToken(false);
    }
  };

  const allHistory = realHistory;

  const filteredHistory = allHistory.filter(
    (item) =>
      item.subject.toLowerCase().includes(searchHistoryQuery.toLowerCase()) ||
      item.examType.toLowerCase().includes(searchHistoryQuery.toLowerCase())
  );

  const averageScore = Math.round(
    allHistory.reduce((acc, curr) => acc + curr.score, 0) / (allHistory.length || 1)
  );

  const highestScore = allHistory.length > 0 ? Math.max(...allHistory.map((h) => h.score)) : 0;

  return (
    <div className="bg-[#f8fafc] font-sans text-[#191c1e] min-h-screen flex flex-col md:flex-row antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR NAVIGATION (Hidden on Mobile)                         */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col py-8 px-4 h-screen w-64 fixed left-0 top-0 bg-white border-r border-slate-200/90 shadow-sm z-40">
        {/* Portal Header & User Profile Info */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-50 border border-blue-200 flex-shrink-0 flex items-center justify-center text-[#00236f] font-bold text-sm">
            {studentName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-[#00236f] tracking-tight truncate">
              Academic Excellence Portal
            </span>
            <span className="text-xs text-slate-500 font-medium">Portal Siswa</span>
          </div>
        </div>

        {/* Navigation Tabs (Ujian vs Hasil Ujian) */}
        <div className="flex flex-col gap-2 flex-grow">
          {/* Tab 1: Ujian */}
          <button
            onClick={() => setActiveTab('ujian')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer text-left ${
              activeTab === 'ujian'
                ? 'bg-blue-50 text-[#00236f] border-r-4 border-[#00236f] shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <KeyRound className={`w-5 h-5 ${activeTab === 'ujian' ? 'text-[#00236f]' : 'text-slate-400'}`} />
            <span>Ruang Ujian</span>
          </button>

          {/* Tab 2: Hasil Ujian */}
          <button
            onClick={() => setActiveTab('hasil')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer text-left ${
              activeTab === 'hasil'
                ? 'bg-blue-50 text-[#00236f] border-r-4 border-[#00236f] shadow-xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className={`w-5 h-5 ${activeTab === 'hasil' ? 'text-[#00236f]' : 'text-slate-400'}`} />
            <span>Hasil Ujian</span>
          </button>
        </div>

        {/* User Info Card & Logout Footer */}
        <div className="mt-auto pt-4 border-t border-slate-200 space-y-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div className="font-semibold text-slate-800 truncate">{studentName}</div>
            <div className="text-[11px] text-slate-500 font-mono">NIS: {studentNis}</div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sesi Terautentikasi</span>
            </div>
          </div>

          <button
            onClick={onLogout || (() => showToast('Anda telah keluar dari akun.'))}
            className="flex items-center gap-2.5 px-4 py-2.5 w-full rounded-xl text-rose-700 hover:bg-rose-50 font-medium text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE TOP APP BAR (Visible on Mobile Only)                           */}
      {/* ========================================================================= */}
      <header className="flex md:hidden justify-between items-center px-4 h-16 w-full fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Logo Academic Excellence Portal"
            className="w-8 h-8 object-contain rounded-md"
          />
          <h1 className="text-base font-bold text-[#00236f] tracking-tight">Academic Excellence Portal</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Belum ada pemberitahuan baru.')}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-100 text-[#00236f] font-bold text-xs flex items-center justify-center border border-blue-200">
            {studentName.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT CANVAS (Responsive Desktop & Mobile)                     */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full ml-0 md:ml-64 min-h-screen overflow-y-auto pt-20 md:pt-8 pb-24 md:pb-12 px-4 sm:px-8 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-5xl mx-auto flex flex-col min-h-screen flex-1 gap-8">
        {/* ----------------------------------------------------------------------- */}
        {/* TAB 1: RUANG UJIAN (Token Entry & Active Cards)                         */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'ujian' && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-200">
            {/* Hero Greeting */}
            <section className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#191c1e] tracking-tight">
                Selamat Datang, <span className="text-[#00236f]">{studentName}</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                Persiapkan diri Anda dengan baik. Pastikan koneksi internet stabil dan kamera
                aktif sebelum memulai sesi ujian terproteksi.
              </p>
            </section>

            {/* Ujian Entry Card */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-[0px_10px_25px_-5px_rgba(30,58,138,0.05)] p-6 sm:p-10 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
              <div className="w-16 h-16 bg-blue-50 border border-blue-200 text-[#00236f] rounded-2xl flex items-center justify-center mb-4 shadow-xs">
                <KeyRound className="w-8 h-8" />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-[#191c1e] mb-1">
                  Masuk Ruang Ujian
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                  Silakan masukkan kode token resmi yang diberikan oleh guru pengawas Anda.
                </p>
              </div>

              <form onSubmit={handleStartExamSubmit} className="w-full max-w-md flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="token-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Masukkan Token Ujian
                  </label>
                  <input
                    id="token-input"
                    type="text"
                    disabled={isValidatingToken}
                    value={examToken}
                    onChange={(e) => {
                      setExamToken(e.target.value);
                      if (tokenError) setTokenError(null);
                    }}
                    placeholder="Masukkan Token Ujian (Contoh: AB12CD)"
                    className={`w-full h-13 px-4 rounded-xl border ${
                      tokenError ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-400' : 'border-slate-300 bg-white focus:border-[#00236f] focus:ring-[#00236f]/10'
                    } focus:outline-none focus:ring-2 text-center text-lg font-mono font-bold tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 transition-all disabled:bg-slate-100 disabled:opacity-60`}
                  />
                  {tokenError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 mt-1 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                      <span className="font-medium">{tokenError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isValidatingToken}
                  className="w-full h-12 bg-[#00236f] hover:bg-[#1e3a8a] disabled:bg-slate-400 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:cursor-not-allowed"
                >
                  {isValidatingToken ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Memverifikasi Token & Membuka Ujian...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Mulai Ujian Sekarang</span>
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* Informational / Upcoming Bento Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Jadwal Hari Ini */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-2 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#00236f] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Jadwal Hari Ini
                </p>
                <p className="text-base font-bold text-slate-900">UAS Matematika Diskrit</p>
                <p className="text-xs font-semibold text-[#00236f] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 08:00 - 10:00 WIB (90 Menit)
                </p>
              </div>

              {/* Sisa Paket Ujian */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-2 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Status Agenda
                </p>
                <p className="text-base font-bold text-slate-900">3 Mata Pelajaran</p>
                <p className="text-xs text-slate-500 font-medium">Tersisa pada pekan ini</p>
              </div>

              {/* Integritas Anti-Cheat */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-2 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sistem Keamanan
                </p>
                <p className="text-base font-bold text-slate-900">Anti-Cheat Aktif</p>
                <p className="text-xs text-emerald-600 font-medium">Toleransi 3x kecurangan saja</p>
              </div>
            </section>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 2: HASIL UJIAN (Transcript & Score History)                         */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'hasil' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Banner Notifikasi Ujian Berhasil Dikumpulkan */}
            {completedNotification && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-6 sm:p-7 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                      Pengerjaan Sukses
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                      {completedNotification.message}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Jawaban Anda telah dicocokkan dengan kunci database dan skor nilai langsung tercatat di Cloud SQL.
                    </p>
                  </div>
                </div>

                {completedNotification.stats && (
                  <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-emerald-200 shadow-xs flex-shrink-0">
                    <div className="text-center px-2 border-r border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Benar</div>
                      <div className="text-base font-extrabold text-emerald-600 font-mono">
                        {completedNotification.stats.benar_pg}
                      </div>
                    </div>
                    <div className="text-center px-2 border-r border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Salah</div>
                      <div className="text-base font-extrabold text-rose-600 font-mono">
                        {completedNotification.stats.salah_pg}
                      </div>
                    </div>
                    <div className="text-center px-2 border-r border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Kosong</div>
                      <div className="text-base font-extrabold text-slate-500 font-mono">
                        {completedNotification.stats.kosong_pg}
                      </div>
                    </div>
                    <div className="text-center pl-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Nilai</div>
                      <div className="text-xl font-black text-[#00236f] font-mono">
                        {completedNotification.stats.nilai_pg ?? completedNotification.stats.total_nilai}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#191c1e] tracking-tight">
                  Riwayat Hasil Ujian
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Transkrip rekapitulasi nilai dan status kelulusan evaluasi akademik.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Transkrip</span>
                </button>
              </div>
            </div>

            {/* Performance Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Rata-Rata Nilai
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#00236f] font-mono mt-0.5">
                    {averageScore} / 100
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#00236f] flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Ujian Selesai
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono mt-0.5">
                    {allHistory.length} Mapel
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Nilai Tertinggi
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700 font-mono mt-0.5">
                    {highestScore}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Search Filter for Exam Table */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                type="text"
                placeholder="Cari mata pelajaran atau tipe ujian..."
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Exam Results Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="py-3.5 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Mata Pelajaran
                      </th>
                      <th className="py-3.5 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Tanggal
                      </th>
                      <th className="py-3.5 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Tipe Ujian
                      </th>
                      <th className="py-3.5 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Nilai Akhir
                      </th>
                      <th className="py-3.5 px-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                    {filteredHistory.map((item) => {
                      let statusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Lulus
                        </span>
                      );

                      if (item.status === 'Batas Bawah') {
                        statusBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Batas Bawah
                          </span>
                        );
                      } else if (item.status === 'Remedial') {
                        statusBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            Remedial
                          </span>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-5 font-semibold text-[#00236f]">
                            <div>{item.subject}</div>
                            {item.benar_pg !== undefined && (
                              <div className="text-[11px] text-slate-400 font-mono font-normal mt-0.5">
                                Benar: {item.benar_pg} • Salah: {item.salah_pg} • Kosong: {item.kosong_pg}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-5 text-slate-500">{item.date}</td>
                          <td className="py-4 px-5 text-slate-600">{item.examType}</td>
                          <td className="py-4 px-5 text-right font-bold text-slate-900 font-mono text-base">
                            {item.score}
                          </td>
                          <td className="py-4 px-5 text-center">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredHistory.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                  <Info className="w-6 h-6 mx-auto text-slate-300" />
                  <p>Tidak ada riwayat hasil ujian yang cocok dengan kata kunci.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Standardized Portal Footer */}
        <footer className="mt-auto pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-semibold text-[#00236f]">
            <img
              src="/logo.png"
              alt="Logo Academic Excellence Portal"
              className="w-5 h-5 object-contain rounded"
            />
            <span>Academic Excellence Portal</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            © 2026 Academic Excellence Portal. All rights reserved.
          </div>
        </footer>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. MOBILE BOTTOM NAVIGATION BAR (Visible on Mobile Only)                 */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-50 flex md:hidden justify-around items-center px-6 py-2 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {/* Active Tab: Ujian */}
        <button
          onClick={() => setActiveTab('ujian')}
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all ${
            activeTab === 'ujian'
              ? 'bg-blue-50 text-[#00236f] font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-5 h-5" />
          <span className="text-[11px] mt-0.5">Ujian</span>
        </button>

        {/* Tab: Hasil Ujian */}
        <button
          onClick={() => setActiveTab('hasil')}
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all ${
            activeTab === 'hasil'
              ? 'bg-blue-50 text-[#00236f] font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileCheck2 className="w-5 h-5" />
          <span className="text-[11px] mt-0.5">Hasil</span>
        </button>

        {/* Tab: Logout */}
        <button
          onClick={onLogout || (() => showToast('Anda telah keluar.'))}
          className="flex flex-col items-center justify-center py-1 px-4 text-rose-600 rounded-xl"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[11px] mt-0.5">Keluar</span>
        </button>
      </nav>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
