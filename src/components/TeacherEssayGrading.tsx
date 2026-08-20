import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileEdit,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Save,
  Award,
  BookOpen,
  User,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  Clock,
  Check,
} from 'lucide-react';
import { CBTEssayAnswer, CBTExam } from '../types.ts';
import { apiFetch } from '../utils/api.ts';

interface TeacherEssayGradingProps {
  onNavigateToResults?: () => void;
}

export const TeacherEssayGrading: React.FC<TeacherEssayGradingProps> = ({
  onNavigateToResults,
}) => {
  const [essayAnswers, setEssayAnswers] = useState<CBTEssayAnswer[]>([]);
  const [exams, setExams] = useState<CBTExam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters state
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unscored' | 'scored'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editable scores local state: answerId -> number | string
  const [scoreInputs, setScoreInputs] = useState<Record<number, number | string>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Fetch Essay Answers from API (GET /api/essay-answers)
  const fetchEssayAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const [essayRes, examsRes] = await Promise.all([
        apiFetch('/api/essay-answers'),
        apiFetch('/api/exams'),
      ]);

      const essayData = await essayRes.json();
      const examsData = await examsRes.json();

      if (Array.isArray(essayData)) {
        setEssayAnswers(essayData);
        // Initialize local score inputs
        const initialScores: Record<number, number | string> = {};
        essayData.forEach((item: CBTEssayAnswer) => {
          if (item.skor_guru !== null && item.skor_guru !== undefined) {
            initialScores[item.id] = item.skor_guru;
          } else {
            initialScores[item.id] = '';
          }
        });
        setScoreInputs(initialScores);
      }

      if (Array.isArray(examsData)) {
        setExams(examsData);
      }
    } catch (err: any) {
      console.error('Error fetching essay data:', err);
      showToast('Gagal memuat daftar jawaban essay dari server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEssayAnswers();
  }, [fetchEssayAnswers]);

  // 2. Handle Score Input Change
  const handleScoreChange = (answerId: number, value: string) => {
    setScoreInputs((prev) => ({
      ...prev,
      [answerId]: value,
    }));
  };

  // 3. Quick Score Preset (0, Half, Full)
  const handleSetPresetScore = (answerId: number, score: number) => {
    setScoreInputs((prev) => ({
      ...prev,
      [answerId]: score,
    }));
  };

  // 4. Save Essay Score to Backend (POST /api/grade-essay)
  const handleSaveScore = async (answer: CBTEssayAnswer) => {
    const rawVal = scoreInputs[answer.id];
    if (rawVal === '' || rawVal === undefined || isNaN(Number(rawVal))) {
      showToast('Mohon masukkan nilai angka yang valid sebelum menyimpan.');
      return;
    }

    const numScore = Number(rawVal);
    if (numScore < 0) {
      showToast('Nilai tidak boleh lebih kecil dari 0.');
      return;
    }

    const maxScore = answer.bobot_poin || 20;
    if (numScore > maxScore) {
      showToast(`Perhatian: Skor (${numScore}) melebihi bobot maksimal (${maxScore} poin). Skor disesuaikan menjadi ${maxScore}.`);
    }
    const finalScore = Math.min(numScore, maxScore);

    setSavingId(answer.id);
    try {
      const res = await apiFetch('/api/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer_id: answer.id,
          skor_guru: finalScore,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan nilai essay');
      }

      // Update state locally
      setEssayAnswers((prev) =>
        prev.map((item) => {
          if (item.id === answer.id) {
            return {
              ...item,
              skor_guru: finalScore,
              is_correct: finalScore > 0,
              total_nilai: data.data?.total_nilai ?? item.total_nilai,
            };
          }
          return item;
        })
      );

      setScoreInputs((prev) => ({
        ...prev,
        [answer.id]: finalScore,
      }));

      showToast(`Nilai essay untuk ${answer.student_name} berhasil disimpan (${finalScore} poin). Total nilai sesi kini: ${data.data?.total_nilai || 'Terkalkulasi'}`);
    } catch (err: any) {
      console.error('Error saving essay score:', err);
      showToast(err.message || 'Gagal menyimpan nilai essay');
    } finally {
      setSavingId(null);
    }
  };

  // Filtered List
  const filteredAnswers = useMemo(() => {
    return essayAnswers.filter((item) => {
      // Exam Filter
      if (selectedExamId !== 'all' && item.exam_id !== parseInt(selectedExamId, 10)) {
        return false;
      }

      // Status Filter
      const isScored = item.skor_guru !== null && item.skor_guru !== undefined;
      if (statusFilter === 'scored' && !isScored) return false;
      if (statusFilter === 'unscored' && isScored) return false;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.student_name?.toLowerCase().includes(q);
        const matchesUser = item.student_username?.toLowerCase().includes(q);
        const matchesQuestion = item.pertanyaan?.toLowerCase().includes(q);
        const matchesExam = item.exam_mapel?.toLowerCase().includes(q);
        if (!matchesName && !matchesUser && !matchesQuestion && !matchesExam) {
          return false;
        }
      }

      return true;
    });
  }, [essayAnswers, selectedExamId, statusFilter, searchQuery]);

  // Statistics
  const totalCount = essayAnswers.length;
  const scoredCount = essayAnswers.filter((item) => item.skor_guru !== null && item.skor_guru !== undefined).length;
  const unscoredCount = totalCount - scoredCount;

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
            <FileEdit className="w-6 h-6 text-[#00236f]" />
            <h2>Koreksi Lembar Jawaban Essay</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Berikan penilaian manual pada jawaban bertipe <strong>Essay</strong> siswa. Sistem Cloud SQL akan otomatis menjumlahkan <strong>Nilai PG + Nilai Essay</strong> ke kolom <code>total_nilai</code> pada tabel <code>Exam_Sessions</code>.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={fetchEssayAnswers}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
          {onNavigateToResults && (
            <button
              onClick={onNavigateToResults}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Lihat Rekap Nilai</span>
            </button>
          )}
        </div>
      </div>

      {/* Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              Total Jawaban Essay
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {totalCount} <span className="text-xs text-slate-500 font-normal">Jawaban</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#00236f] flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              Belum Dikoreksi
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono">
              {unscoredCount} <span className="text-xs text-slate-500 font-normal">Perlu Dinilai</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              Sudah Selesai Dinilai
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">
              {scoredCount} <span className="text-xs text-slate-500 font-normal">Terkoreksi</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari siswa, NIS, atau soal..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 px-3 text-xs border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium text-slate-700"
          >
            <option value="all">Semua Status Koreksi</option>
            <option value="unscored">Belum Dikoreksi ({unscoredCount})</option>
            <option value="scored">Sudah Dikoreksi ({scoredCount})</option>
          </select>
        </div>
      </div>

      {/* Main List of Essay Answers */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <RotateCcw className="w-8 h-8 text-[#00236f] animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Memuat data jawaban essay dari database Cloud SQL...</p>
        </div>
      ) : filteredAnswers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileEdit className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Jawaban Essay</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {searchQuery || selectedExamId !== 'all' || statusFilter !== 'all'
              ? 'Tidak ditemukan jawaban essay yang cocok dengan filter yang dipilih.'
              : 'Belum ada siswa yang mengerjakan soal bertipe Essay pada paket ujian yang tersedia.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnswers.map((answer, index) => {
            const isScored = answer.skor_guru !== null && answer.skor_guru !== undefined;
            const currentScore = scoreInputs[answer.id] ?? '';
            const maxScore = answer.bobot_poin || 20;

            return (
              <div
                key={answer.id}
                className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 shadow-xs ${
                  isScored
                    ? 'border-slate-200/90 bg-white'
                    : 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200'
                }`}
              >
                {/* Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00236f] flex items-center justify-center font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-slate-900">
                          {answer.student_name}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-[11px] rounded font-semibold">
                          NIS: {answer.student_username}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {answer.exam_mapel} ({answer.exam_kelas}) • Status Sesi: <strong className="text-slate-700">{answer.session_status}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isScored ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Terkoreksi: {answer.skor_guru} / {maxScore} Poin</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Belum Dinilai</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question & Rubric Box */}
                <div className="my-4 space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      <span>Pertanyaan Soal Essay #{index + 1}</span>
                      <span className="text-[#00236f] font-mono">Bobot Maksimal: {maxScore} Poin</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                      {answer.pertanyaan}
                    </p>

                    {answer.link_media && answer.tipe_media === 'Image' && (
                      <div className="mt-2">
                        <img
                          src={answer.link_media}
                          alt="Media Soal"
                          className="max-h-40 rounded-lg border border-slate-200 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Kunci / Rubrik Jawaban Acuan Guru */}
                  {answer.kunci && answer.kunci.toUpperCase() !== 'ESSAY' && (
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900">
                      <strong className="block font-bold mb-0.5 text-indigo-950">
                        Kunci / Rubrik Penilaian Acuan:
                      </strong>
                      <span>{answer.kunci}</span>
                    </div>
                  )}

                  {/* Jawaban Siswa */}
                  <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#00236f] uppercase tracking-wider mb-2">
                      <span>Lembar Jawaban Siswa:</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Dikirim pada {new Date(answer.createdAt || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-900 leading-relaxed font-mono whitespace-pre-wrap bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      {answer.jawaban_siswa ? (
                        answer.jawaban_siswa
                      ) : (
                        <span className="italic text-slate-400">Siswa tidak memberikan jawaban / dikosongkan.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Input & Save Action Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-medium text-[11px] mr-1">Preset Cepat:</span>
                    <button
                      type="button"
                      onClick={() => handleSetPresetScore(answer.id, 0)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      0 (Salah)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetScore(answer.id, Math.round(maxScore / 2))}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Setengah ({Math.round(maxScore / 2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetScore(answer.id, maxScore)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Penuh ({maxScore})
                    </button>
                  </div>

                  {/* Input Score & Save Button */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                        Skor Guru:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={maxScore}
                        step={1}
                        placeholder="0"
                        value={currentScore}
                        onChange={(e) => handleScoreChange(answer.id, e.target.value)}
                        className="w-20 h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none text-center font-bold text-sm text-slate-900"
                      />
                      <span className="text-xs text-slate-400 font-mono">/ {maxScore}</span>
                    </div>

                    <button
                      type="button"
                      disabled={savingId === answer.id}
                      onClick={() => handleSaveScore(answer)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {savingId === answer.id ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Simpan Skor</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
