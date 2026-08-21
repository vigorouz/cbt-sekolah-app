import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  BookOpen,
  User,
  Users,
  GraduationCap,
  Sparkles,
  Download,
  Printer,
  Eye,
  FileEdit,
  Check,
  X,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { CBTExamResult, CBTExam } from '../types.ts';
import { apiFetch } from '../utils/api.ts';

interface TeacherExamResultsProps {
  onNavigateToGrading?: () => void;
}

export const TeacherExamResults: React.FC<TeacherExamResultsProps> = ({
  onNavigateToGrading,
}) => {
  const [results, setResults] = useState<CBTExamResult[]>([]);
  const [exams, setExams] = useState<CBTExam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Result Modal Detail
  const [selectedResult, setSelectedResult] = useState<CBTExamResult | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Fetch Exam Results from API (GET /api/exam-results)
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const [resRes, examsRes] = await Promise.all([
        apiFetch('/api/exam-results'),
        apiFetch('/api/exams'),
      ]);

      const resData = await resRes.json();
      const examsData = await examsRes.json();

      if (Array.isArray(resData)) {
        setResults(resData);
      }
      if (Array.isArray(examsData)) {
        setExams(examsData);
      }
    } catch (err: any) {
      console.error('Error fetching exam results:', err);
      showToast('Gagal memuat rekapitulasi hasil ujian dari server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Filtered Results
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      // Exam Filter
      if (selectedExamId !== 'all' && item.exam_id !== parseInt(selectedExamId, 10)) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'all' && item.status_pengerjaan !== selectedStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.student_name?.toLowerCase().includes(q);
        const matchesUser = item.student_username?.toLowerCase().includes(q);
        const matchesExam = item.exam_mapel?.toLowerCase().includes(q);
        const matchesKode = item.exam_kode?.toLowerCase().includes(q);
        if (!matchesName && !matchesUser && !matchesExam && !matchesKode) {
          return false;
        }
      }

      return true;
    });
  }, [results, selectedExamId, selectedStatus, searchQuery]);

  // Statistics Calculations
  const stats = useMemo(() => {
    const total = filteredResults.length;
    if (total === 0) {
      return { total: 0, avg: 0, highest: 0, lowest: 0, passed: 0, passRate: 0 };
    }

    const scores = filteredResults.map((r) => Number(r.total_nilai) || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Number((sum / total).toFixed(1));
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passed = scores.filter((s) => s >= 75).length;
    const passRate = Number(((passed / total) * 100).toFixed(0));

    return { total, avg, highest, lowest, passed, passRate };
  }, [filteredResults]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredResults.length === 0) {
      showToast('Tidak ada data hasil ujian untuk diekspor.');
      return;
    }

    const headers = ['No', 'NIS', 'Nama Siswa', 'Mata Pelajaran', 'Kelas', 'Status Pengerjaan', 'Nilai PG', 'Nilai Essay', 'Total Nilai', 'Pelanggaran', 'Waktu Submit'];
    const rows = filteredResults.map((r, idx) => [
      idx + 1,
      `"${r.student_username}"`,
      `"${r.student_name}"`,
      `"${r.exam_mapel}"`,
      `"${r.exam_kelas}"`,
      `"${r.status_pengerjaan}"`,
      r.nilai_pg || 0,
      r.nilai_essay || 0,
      r.total_nilai || 0,
      r.jml_pelanggaran || 0,
      r.waktu_submit ? `"${new Date(r.waktu_submit).toLocaleString('id-ID')}"` : '"-"',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Hasil_Ujian_CBT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV rekap nilai berhasil diunduh.');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#00236f] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00236f] font-bold text-lg sm:text-xl">
            <Award className="w-6 h-6 text-[#00236f]" />
            <h2>Tabel Rekapitulasi Hasil Ujian</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Ringkasan komprehensif pencapaian akademik siswa. Menyajikan rincian <strong>Nilai Pilihan Ganda</strong> (otomatis), <strong>Nilai Esai</strong> (manual), serta <strong>Total Nilai Akhir</strong> yang terakumulasi secara langsung (real-time) oleh sistem.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 w-full print:hidden">
          <button
            onClick={fetchResults}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Print Rekap</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          {onNavigateToGrading && (
            <button
              onClick={onNavigateToGrading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Koreksi Essay</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Total Peserta
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {stats.total} <span className="text-xs text-slate-500 font-normal">Siswa</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Terekam di sistem
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Rata-rata Nilai
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono">
            {stats.avg} <span className="text-xs text-slate-500 font-normal">/ 100</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Skala total nilai
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Nilai Tertinggi / Rendah
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 font-mono">
            {stats.highest} <span className="text-xs text-slate-400 font-normal">/ {stats.lowest}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rentang perolehan skor
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            Kelulusan KKM (≥75)
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 font-mono">
            {stats.passRate}% <span className="text-xs text-slate-500 font-normal">({stats.passed} Siswa)</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Mencapai batas tuntas
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama siswa, NIS, paket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-xs border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Paket:</span>
          </div>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="h-10 px-3 text-xs border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium text-slate-700"
          >
            <option value="all">Semua Paket Ujian</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.mapel} ({ex.kode_paket})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 px-3 text-xs border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium text-slate-700"
          >
            <option value="all">Semua Status</option>
            <option value="Selesai">Selesai</option>
            <option value="Sedang Mengerjakan">Sedang Mengerjakan</option>
            <option value="Force Submit">Force Submit</option>
          </select>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RotateCcw className="w-8 h-8 text-[#00236f] animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Memuat rekapitulasi nilai siswa dari Cloud SQL...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="p-12 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Data Hasil Ujian Masih Kosong</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Belum ada sesi ujian yang diselesaikan atau data tidak sesuai dengan filter yang Anda gunakan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Siswa & NIS</th>
                  <th className="py-3.5 px-4">Paket Ujian & Kelas</th>
                  <th className="py-3.5 px-4 text-center">Status Ujian</th>
                  <th className="py-3.5 px-4 text-center">Nilai PG</th>
                  <th className="py-3.5 px-4 text-center">Nilai Essay</th>
                  <th className="py-3.5 px-4 text-center">Total Nilai</th>
                  <th className="py-3.5 px-4 text-center">Pelanggaran</th>
                  <th className="py-3.5 px-4">Waktu Submit</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((row, index) => {
                  const total = Number(row.total_nilai) || 0;
                  const isPassed = total >= 75;

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                      Sedang Mengerjakan
                    </span>
                  );

                  if (row.status_pengerjaan === 'Selesai') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Selesai
                      </span>
                    );
                  } else if (row.status_pengerjaan === 'Force Submit') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Force Submit
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-semibold">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{row.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">NIS: {row.student_username}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{row.exam_mapel}</div>
                        <div className="text-[11px] text-slate-500">{row.exam_kelas} • {row.exam_kode}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {statusBadge}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                        {row.nilai_pg !== null && row.nilai_pg !== undefined ? row.nilai_pg : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-indigo-700">
                        {row.nilai_essay !== null && row.nilai_essay !== undefined ? row.nilai_essay : 0}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-mono text-sm font-extrabold px-2.5 py-0.5 rounded-lg ${
                              isPassed
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-rose-700 bg-rose-50'
                            }`}
                          >
                            {total}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {isPassed ? 'Tuntas KKM' : 'Belum Tuntas'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {row.jml_pelanggaran > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 font-mono">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            {row.jml_pelanggaran}x
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                        {row.waktu_submit ? (
                          <>
                            <div>{new Date(row.waktu_submit).toLocaleDateString('id-ID')}</div>
                            <div className="text-slate-400 font-mono">{new Date(row.waktu_submit).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                          </>
                        ) : (
                          <span className="italic text-slate-400">Belum Submit</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedResult(row)}
                            title="Lihat Detail Hasil"
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#00236f] rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onNavigateToGrading && (
                            <button
                              onClick={onNavigateToGrading}
                              title="Koreksi Lembar Essay"
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Hasil Sesi Siswa */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#00236f]">
                <Award className="w-5 h-5" />
                <h3 className="text-base font-bold">Rincian Hasil Ujian Siswa</h3>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Siswa:</span>
                  <strong className="text-slate-900">{selectedResult.student_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIS / Username:</span>
                  <span className="font-mono font-semibold text-slate-700">{selectedResult.student_username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mata Pelajaran:</span>
                  <span className="font-medium text-slate-800">{selectedResult.exam_mapel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paket & Kelas:</span>
                  <span className="text-slate-700">{selectedResult.exam_kode} ({selectedResult.exam_kelas})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Pengerjaan:</span>
                  <span className="font-bold text-emerald-700">{selectedResult.status_pengerjaan}</span>
                </div>
              </div>

              {/* Nilai Breakdown */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <div className="text-[10px] text-blue-600 font-bold uppercase">Nilai PG</div>
                  <div className="text-lg font-mono font-extrabold text-blue-900 mt-0.5">
                    {selectedResult.nilai_pg || 0}
                  </div>
                </div>
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <div className="text-[10px] text-indigo-600 font-bold uppercase">Nilai Essay</div>
                  <div className="text-lg font-mono font-extrabold text-indigo-900 mt-0.5">
                    {selectedResult.nilai_essay || 0}
                  </div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Total Nilai</div>
                  <div className="text-lg font-mono font-extrabold text-emerald-900 mt-0.5">
                    {selectedResult.total_nilai || 0}
                  </div>
                </div>
              </div>

              {/* Log Pelanggaran */}
              {selectedResult.detail_pelanggaran && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <div className="font-bold text-amber-800 text-[11px] mb-1 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    Log Deteksi Pelanggaran ({selectedResult.jml_pelanggaran}x)
                  </div>
                  <p className="text-[11px] text-amber-900 font-mono whitespace-pre-wrap">
                    {selectedResult.detail_pelanggaran}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
