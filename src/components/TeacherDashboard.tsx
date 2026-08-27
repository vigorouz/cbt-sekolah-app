import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Bell,
  HelpCircle,
  Laptop,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  ShieldAlert,
  Users,
  Clock,
  Sparkles,
  BookOpen,
  Plus,
  RefreshCw,
  Eye,
  Check,
  Radio,
  FileText,
  X,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../utils/api.ts';

export interface LiveSessionItem {
  id: number; // exam_sessions.id
  userId: number;
  nis: string;
  name: string;
  examId?: number;
  examTitle: string;
  examCode: string;
  status: 'Aktif' | 'Melanggar' | 'Selesai' | 'Force Submit';
  rawStatus: string;
  violationsCount: number; // 0 = Hijau/Aman, 1-2 = Kuning/Melanggar, 3+ = Merah/Force Submit
  lastViolationReason?: string;
  detailPelanggaran?: string;
  progress: number;
  score?: number;
  ipAddress: string;
  timeRemaining?: string;
  waktuMulai?: string;
  terakhirAktif?: string;
}

export const TeacherDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<LiveSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Aktif' | 'Melanggar' | 'Selesai' | 'Force Submit'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionLog, setSelectedSessionLog] = useState<LiveSessionItem | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<number | null>(null);

  // Function to fetch live monitor data from Cloud SQL
  const fetchLiveMonitorData = useCallback(async (isManualTrigger = false) => {
    if (isManualTrigger) setIsSyncing(true);
    try {
      const res = await apiFetch('/api/live-monitor');
      if (!res.ok) throw new Error('Gagal mengambil data live monitor');
      const data = await res.json();

      const rawList = Array.isArray(data) ? data : (data && Array.isArray(data.sessions) ? data.sessions : []);

      if (rawList.length >= 0) {
        const mapped: LiveSessionItem[] = rawList.map((s: any) => {
          const violCount = s.jml_pelanggaran || 0;
          let displayStatus: 'Aktif' | 'Melanggar' | 'Selesai' | 'Force Submit' = 'Aktif';

          if (s.status_pengerjaan === 'Force Submit' || violCount >= 3) {
            displayStatus = 'Force Submit';
          } else if (s.status_pengerjaan === 'Selesai') {
            displayStatus = 'Selesai';
          } else if (violCount >= 1) {
            displayStatus = 'Melanggar';
          } else {
            displayStatus = 'Aktif';
          }

          // Parse last violation reason from detail_pelanggaran
          let lastReason: string | undefined = undefined;
          if (s.detail_pelanggaran) {
            const lines = s.detail_pelanggaran.trim().split('\n');
            if (lines.length > 0) {
              lastReason = lines[lines.length - 1];
            }
          }

          return {
            id: s.id,
            userId: s.user_id,
            nis: s.student_username || `NIS-${s.user_id}`,
            name: s.student_name || `Siswa #${s.user_id}`,
            examId: s.exam_id,
            examTitle: s.exam_mapel || 'Ujian CBT',
            examCode: s.exam_kode || 'CBT26',
            status: displayStatus,
            rawStatus: s.status_pengerjaan || 'Sedang Mengerjakan',
            violationsCount: violCount,
            lastViolationReason: lastReason,
            detailPelanggaran: s.detail_pelanggaran,
            progress: displayStatus === 'Selesai' || displayStatus === 'Force Submit' ? 100 : Math.min(95, 25 + (s.id * 17) % 65),
            score: s.total_nilai !== null && s.total_nilai !== undefined ? Math.round(s.total_nilai) : undefined,
            ipAddress: `192.168.1.${100 + (s.id % 50)}`,
            timeRemaining: displayStatus === 'Selesai' || displayStatus === 'Force Submit' ? '00:00' : '25:00',
            waktuMulai: s.waktu_mulai_siswa ? new Date(s.waktu_mulai_siswa).toLocaleTimeString('id-ID') : undefined,
            terakhirAktif: s.terakhir_aktif ? new Date(s.terakhir_aktif).toLocaleTimeString('id-ID') : undefined,
          };
        });

        setSessions(mapped);
        setLastSyncTime(new Date());
      }
    } catch (err: any) {
      console.warn('Live monitor polling error:', err);
    } finally {
      setLoading(false);
      if (isManualTrigger) setIsSyncing(false);
    }
  }, []);

  // Polling Real-Time setiap 3 Detik (3000 ms) via useEffect & setInterval
  useEffect(() => {
    // 1. Initial Fetch
    fetchLiveMonitorData();

    // 2. Setup 3-second interval timer
    const intervalId = setInterval(() => {
      fetchLiveMonitorData();
    }, 3000);

    // 3. Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchLiveMonitorData]);

  // Statistik Real-time
  const stats = useMemo(() => {
    const total = sessions.length;
    const aktif = sessions.filter((s) => s.status === 'Aktif').length;
    const melanggar = sessions.filter((s) => s.status === 'Melanggar').length;
    const forceSubmit = sessions.filter((s) => s.status === 'Force Submit').length;
    const selesai = sessions.filter((s) => s.status === 'Selesai').length;
    return { total, aktif, melanggar, forceSubmit, selesai };
  }, [sessions]);

  // Filter & Search data siswa
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchFilter =
        filterStatus === 'Semua' ||
        s.status === filterStatus ||
        (filterStatus === 'Melanggar' && s.violationsCount > 0 && s.status !== 'Selesai');
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [sessions, filterStatus, searchQuery]);

  // Handler: Reset Pelanggaran Siswa via POST /api/reset-violation
  const handleResetViolation = async (sessionId: number, studentName: string) => {
    setIsResetting(sessionId);
    try {
      const res = await apiFetch('/api/reset-violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mereset pelanggaran');
      }

      // Optimistic update
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                violationsCount: 0,
                status: 'Aktif',
                lastViolationReason: undefined,
              }
            : s
        )
      );

      showToast(`Pelanggaran untuk ${studentName} berhasil di-reset ke 0 di database.`);
      fetchLiveMonitorData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses reset pelanggaran.');
    } finally {
      setIsResetting(null);
    }
  };

  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast(null);
    }, 3500);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30 px-4 sm:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00236f] text-white flex items-center justify-center shadow-md shadow-blue-900/10">
            <Radio className="w-5 h-5 text-rose-400 animate-pulse" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-[#00236f]">
              Live Monitor Pengawas CBT
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              ● Polling Aktif (Setiap 3 Detik)
            </span>
          </div>
        </div>

        {/* Right Status Indicator & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Activity className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            <span className="text-slate-500 font-medium">Sinkronisasi Terakhir:</span>
            <span className="font-mono font-bold text-slate-700">
              {lastSyncTime.toLocaleTimeString('id-ID')}
            </span>
          </div>

          <button
            onClick={() => fetchLiveMonitorData(true)}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-[#00236f] hover:bg-[#1e3a8a] disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Refresh Data Sekarang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-grow px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Dashboard Title & Stats Overview */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-[0px_10px_25px_-5px_rgba(30,58,138,0.05)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#00236f]">
                  Pemantauan Aktivitas Ujian Siswa (Live Grid)
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Data ditarik otomatis dari tabel <strong>Exam_Sessions</strong> Cloud SQL. Indikator warna kartu siswa otomatis berubah sesuai jumlah pelanggaran.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs bg-blue-50 text-[#00236f] px-3 py-1.5 rounded-xl border border-blue-200 font-semibold">
                <ShieldAlert className="w-4 h-4 text-[#00236f]" />
                <span>Anti-Cheat Guard 3x Toleransi</span>
              </div>
            </div>
          </div>

          {/* Stats Summary Cards (5 Cards Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Total Siswa */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center sm:items-start justify-center">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Total Peserta
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#00236f] font-mono">
                {stats.total}
              </p>
            </div>

            {/* Aktif / Aman (Hijau) */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col items-center sm:items-start justify-center">
              <p className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">
                Aktif (Aman)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono">
                {stats.aktif}
              </p>
            </div>

            {/* Melanggar 1-2x (Kuning) */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 flex flex-col items-center sm:items-start justify-center">
              <p className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">
                Melanggar (1-2x)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono">
                {stats.melanggar}
              </p>
            </div>

            {/* Force Submit 3x (Merah) */}
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-300 flex flex-col items-center sm:items-start justify-center">
              <p className="text-[10px] sm:text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-0.5">
                Force Submit (3x)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono">
                {stats.forceSubmit}
              </p>
            </div>

            {/* Selesai Normal */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col items-center sm:items-start justify-center col-span-2 sm:col-span-1">
              <p className="text-[10px] sm:text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-0.5">
                Selesai / Terkumpul
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-blue-800 font-mono">
                {stats.selesai}
              </p>
            </div>
          </div>
        </div>

        {/* Filter, Search & Status Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari nama siswa, NIS, atau mapel ujian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/10 transition-all font-sans"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden lg:inline">
              Filter Status:
            </span>
            {(['Semua', 'Aktif', 'Melanggar', 'Force Submit', 'Selesai'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Student Grid / Loading / Empty State */}
        {loading && sessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#00236f] flex items-center justify-center mx-auto animate-spin">
              <RefreshCw className="w-5 h-5 text-[#00236f]" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">Memuat data live...</p>
              <p className="text-xs text-slate-500 mt-1">Mengambil data sesi ujian siswa secara real-time dari database</p>
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 text-xs sm:text-sm space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-base">Belum Ada Sesi Ujian Aktif</p>
            <p className="max-w-md mx-auto">
              Saat siswa login dan memasukkan token ujian di Portal Siswa, sesi pengerjaan akan langsung muncul di kotak monitor ini secara otomatis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSessions.map((student) => {
              // Aturan Warna Indikator Kotak Siswa (Urutan Prioritas):
              // a. Jika status_pengerjaan === 'Force Submit' / violationsCount >= 3 -> Merah: Force Submit (${student.violationsCount}x)
              // b. Jika violationsCount > 0 (terlepas dari 'Selesai' atau 'Sedang Mengerjakan') -> Kuning/Orange: Melanggar (${student.violationsCount}x)
              // c. Jika violationsCount === 0 -> jika 'Selesai' (Biru), jika aktif -> Hijau: Aman (0 Pelanggaran)

              let cardBg = 'bg-white';
              let cardBorder = 'border-emerald-300 hover:border-emerald-400 ring-1 ring-emerald-500/20';
              let statusDot = 'bg-emerald-500';
              let statusTextColor = 'text-emerald-700';
              let statusBadge = (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Aman (0 Pelanggaran)
                </span>
              );
              let iconComponent = <Laptop className="w-7 h-7 text-emerald-600 mb-1" />;

              if (student.rawStatus === 'Force Submit' || student.status === 'Force Submit' || student.violationsCount >= 3) {
                // a. Force Submit (Merah)
                cardBg = 'bg-rose-50/70';
                cardBorder = 'border-rose-400 ring-2 ring-rose-500/50';
                statusDot = 'bg-rose-600';
                statusTextColor = 'text-rose-800';
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Force Submit ({student.violationsCount}x)
                  </span>
                );
                iconComponent = <XCircle className="w-7 h-7 text-rose-600 mb-1" />;
              } else if (student.violationsCount > 0) {
                // b. Pelanggaran > 0 (Kuning/Orange) - Terlepas dari status 'Selesai' atau 'Sedang Mengerjakan'
                cardBg = 'bg-amber-50/70';
                cardBorder = 'border-amber-400 ring-2 ring-amber-400/50';
                statusDot = 'bg-amber-500 animate-ping';
                statusTextColor = 'text-amber-800';
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    Melanggar ({student.violationsCount}x)
                  </span>
                );
                iconComponent = <AlertTriangle className="w-7 h-7 text-amber-600 mb-1" />;
              } else if (student.rawStatus === 'Selesai' || student.status === 'Selesai') {
                // c. Selesai Bersih (0 Pelanggaran)
                cardBg = 'bg-slate-50';
                cardBorder = 'border-slate-200';
                statusDot = 'bg-blue-600';
                statusTextColor = 'text-blue-800';
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                    Selesai Dikerjakan
                  </span>
                );
                iconComponent = <CheckCircle2 className="w-7 h-7 text-blue-600 mb-1" />;
              } else {
                // c. Aman (0 Pelanggaran)
                cardBg = 'bg-white';
                cardBorder = 'border-emerald-300 hover:border-emerald-400 ring-1 ring-emerald-500/20';
                statusDot = 'bg-emerald-500';
                statusTextColor = 'text-emerald-700';
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Aman (0 Pelanggaran)
                  </span>
                );
                iconComponent = <Laptop className="w-7 h-7 text-emerald-600 mb-1" />;
              }

              return (
                <div
                  key={student.id}
                  className={`${cardBg} ${cardBorder} border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative shadow-[0px_10px_25px_-5px_rgba(30,58,138,0.05)] transition-all hover:-translate-y-0.5 duration-150`}
                >
                  {/* Top Header Badge & Pulse Dot */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-mono font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                      NIS: {student.nis}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
                      <span className="text-[10px] font-mono text-slate-400">Sesi #{student.id}</span>
                    </div>
                  </div>

                  {/* Center Content: Avatar Icon & Student Name */}
                  <div className="flex flex-col items-center text-center my-2">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center mb-2">
                      {iconComponent}
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate max-w-full">
                      {student.name}
                    </h3>

                    <div className="text-[11px] text-slate-500 truncate max-w-full font-medium">
                      {student.examTitle}
                    </div>

                    <div className="mt-2">{statusBadge}</div>

                    {student.lastViolationReason && (
                      <div
                        onClick={() => setSelectedSessionLog(student)}
                        className="text-[10px] text-rose-700 bg-rose-100/90 border border-rose-200 px-2.5 py-1 rounded-lg mt-2 font-medium max-w-full truncate cursor-pointer hover:bg-rose-200/80 transition-colors"
                        title="Klik untuk melihat detail log pelanggaran lengkap"
                      >
                        ⚠️ {student.lastViolationReason}
                      </div>
                    )}
                  </div>

                  {/* Progress & Exam Info */}
                  <div className="space-y-1.5 my-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>Nilai / Skor Akhir:</span>
                      <span className="font-bold font-mono text-slate-800">
                        {student.score !== undefined ? `${student.score} Poin` : 'Sedang Berlangsung'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Mulai: {student.waktuMulai || '-'}
                      </span>
                      <span>
                        Pelanggaran: <strong>{student.violationsCount}/3</strong>
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="pt-3 border-t border-slate-100/80 flex flex-col gap-1.5">
                    {/* Reset Pelanggaran Button */}
                    <button
                      onClick={() => handleResetViolation(student.id, student.name)}
                      disabled={isResetting === student.id}
                      className={`w-full py-1.5 px-2 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                        student.violationsCount > 0 || student.status === 'Force Submit'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                          : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-300'
                      }`}
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResetting === student.id ? 'animate-spin' : ''}`} />
                      <span>
                        {isResetting === student.id ? 'Mereset...' : 'Reset Pelanggaran (0)'}
                      </span>
                    </button>

                    {/* Tombol Lihat Log Lengkap */}
                    {student.detailPelanggaran && (
                      <button
                        onClick={() => setSelectedSessionLog(student)}
                        className="w-full py-1 px-2 text-[10px] font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Buka Log Pelanggaran</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL: DETAIL LOG PELANGGARAN */}
      {selectedSessionLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#00236f]">
                  Audit Log Pelanggaran: {selectedSessionLog.name}
                </h3>
                <p className="text-xs text-slate-500">
                  NIS: {selectedSessionLog.nis} • Sesi #{selectedSessionLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedSessionLog(null)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Status Saat Ini:</span>{' '}
                  <strong className="text-slate-800">{selectedSessionLog.status}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Total Pelanggaran:</span>{' '}
                  <strong className="text-rose-600 font-mono font-bold">
                    {selectedSessionLog.violationsCount} / 3
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Catatan Waktu & Detail Pelanggaran (Cloud SQL):
                </label>
                <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                  {selectedSessionLog.detailPelanggaran || 'Belum ada catatan pelanggaran.'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => {
                  handleResetViolation(selectedSessionLog.id, selectedSessionLog.name);
                  setSelectedSessionLog(null);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Pelanggaran Siswa</span>
              </button>

              <button
                onClick={() => setSelectedSessionLog(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notificationToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span>{notificationToast}</span>
        </div>
      )}
    </div>
  );
};
