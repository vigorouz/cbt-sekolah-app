import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CBTExam, CBTQuestion, CBTUser, CBTExamSession } from '../types.ts';
import { apiFetch } from '../utils/api.ts';
import {
  Clock,
  Flag,
  AlertTriangle,
  Send,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Award,
  Grid,
  X,
  Sparkles,
  Maximize2,
  Save,
  Check,
  Loader2,
  ArrowLeft,
  FileText,
} from 'lucide-react';

interface ShuffledOption {
  displayKey: string;
  originalKey: string;
  text: string;
}

// Fisher-Yates Shuffle Algorithm for Anti-Cheat Randomization
function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface StudentExamSimulatorProps {
  currentUser?: CBTUser | null;
  initialToken?: string;
  initialSession?: CBTExamSession | null;
  initialExam?: CBTExam | null;
  onExitExam?: (info?: { session?: CBTExamSession; stats?: any; message?: string }) => void;
  onReturnToDashboard?: (info?: { session?: CBTExamSession; stats?: any; message?: string }) => void;
}

export const StudentExamSimulator: React.FC<StudentExamSimulatorProps> = ({
  currentUser,
  initialToken = '',
  initialSession = null,
  initialExam = null,
  onExitExam,
  onReturnToDashboard,
}) => {
  // Active exam and session state
  const [session, setSession] = useState<CBTExamSession | null>(initialSession);
  const [activeExam, setActiveExam] = useState<CBTExam | null>(initialExam);
  const [questions, setQuestions] = useState<CBTQuestion[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<Record<number, ShuffledOption[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(45 * 60);
  const [violationsCount, setViolationsCount] = useState<number>(initialSession?.jml_pelanggaran || 0);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(
    initialSession?.status_pengerjaan === 'Selesai' || initialSession?.status_pengerjaan === 'Force Submit'
  );
  const [examResult, setExamResult] = useState<{
    finalScore: number;
    totalCorrect: number;
    nilai_pg?: number;
    has_essay?: boolean;
  } | null>(
    initialSession?.status_pengerjaan === 'Selesai' || initialSession?.status_pengerjaan === 'Force Submit'
      ? {
          finalScore: initialSession.total_nilai || 0,
          totalCorrect: initialSession.benar_pg || 0,
          nilai_pg: initialSession.nilai_pg ?? initialSession.total_nilai ?? 0,
        }
      : null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI State: Submit Modal, Anti-Cheat Warning Modal & Mobile Drawer
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [warningMessage, setWarningMessage] = useState<string>(
    'Deteksi Keamanan: Dilarang berpindah tab, membuka aplikasi lain, atau menyalin teks!'
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // 1. Inisialisasi Sesi Ujian & Load Soal dari Database
  const initializeExam = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      let currentSess = session;
      let currentEx = activeExam;

      // Jika sesi belum ada di state (misalnya reload atau direct navigation dengan token)
      if (!currentSess) {
        const cleanToken = initialToken.trim().toUpperCase();
        if (!cleanToken) {
          throw new Error('Token ujian tidak ditemukan. Silakan masukkan token melalui Dashboard Siswa.');
        }

        const startRes = await apiFetch('/api/start-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser?.id,
            username: currentUser?.username,
            token: cleanToken,
          }),
        });

        const startData = await startRes.json();
        if (!startRes.ok) {
          throw new Error(startData.error || 'Gagal menginisialisasi sesi ujian.');
        }

        currentSess = startData.session || startData;
        currentEx = startData.exam || null;
        setSession(currentSess);
        if (currentEx) setActiveExam(currentEx);
      }

      if (!currentSess) {
        throw new Error('Gagal mendapatkan sesi ujian dari database.');
      }

      setViolationsCount(currentSess.jml_pelanggaran || 0);

      // Cek apakah sesi sudah selesai sebelumnya
      if (currentSess.status_pengerjaan === 'Selesai' || currentSess.status_pengerjaan === 'Force Submit') {
        setIsSubmitted(true);
        setExamResult({
          finalScore: currentSess.total_nilai ?? 0,
          totalCorrect: 0,
        });
        setLoading(false);
        return;
      }

      // Load Soal dari tabel Questions (GET /api/exams/:id/questions?studentView=true atau /api/exams/active)
      const examId = currentSess.exam_id;
      let loadedQuestions: any[] = [];

      try {
        const directRes = await apiFetch(`/api/exams/${examId}/questions?studentView=true`);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (Array.isArray(directData) && directData.length > 0) {
            loadedQuestions = directData;
          }
        }
      } catch (e) {
        console.warn('Gagal fetch /api/exams/:examId/questions:', e);
      }

      if (loadedQuestions.length === 0) {
        try {
          const activeRes = await apiFetch(`/api/exams/active?exam_id=${examId}&token=${encodeURIComponent(initialToken.trim())}`);
          if (activeRes.ok) {
            const activeData = await activeRes.json();
            if (activeData.questions && Array.isArray(activeData.questions) && activeData.questions.length > 0) {
              loadedQuestions = activeData.questions;
              if (activeData.exam && !currentEx) {
                setActiveExam(activeData.exam);
                currentEx = activeData.exam;
              }
            }
          }
        } catch (e) {
          console.warn('Gagal fetch /api/exams/active:', e);
        }
      }

      if (loadedQuestions.length === 0) {
        try {
          const allQuestionsRes = await apiFetch(`/api/questions?exam_id=${examId}`);
          if (allQuestionsRes.ok) {
            const allQData = await allQuestionsRes.json();
            if (Array.isArray(allQData) && allQData.length > 0) {
              // Sanitasi anti-cheat jika dari endpoint umum
              loadedQuestions = allQData.map((q: any) => {
                const { kunci, ...safeQ } = q;
                return safeQ;
              });
            }
          }
        } catch (e) {
          console.warn('Gagal fallback ke /api/questions:', e);
        }
      }

      if (loadedQuestions.length === 0) {
        throw new Error('Belum ada butir soal yang diinput oleh guru untuk paket ujian ini.');
      }

      // Normalisasi field data soal dari database (menggunakan pertanyaan)
      const normalizedQuestions: CBTQuestion[] = loadedQuestions.map((q: any) => ({
        id: Number(q.id),
        exam_id: Number(q.exam_id || examId),
        guru_id: q.guru_id ? Number(q.guru_id) : null,
        tipe_media: q.tipe_media || 'Teks',
        link_media: q.link_media || null,
        pertanyaan: q.pertanyaan || q.teks_soal || '',
        opsi_a: q.opsi_a || null,
        opsi_b: q.opsi_b || null,
        opsi_c: q.opsi_c || null,
        opsi_d: q.opsi_d || null,
        opsi_e: q.opsi_e || null,
        kunci: q.kunci || null,
        bobot_poin: q.bobot_poin != null ? Number(q.bobot_poin) : 10,
        question_type: (!q.opsi_a && !q.opsi_b && !q.opsi_c) ? 'essay' : (q.question_type || 'pilihan_ganda'),
      }));

      // Anti-Cheat: Terapkan algoritma Fisher-Yates Shuffle pada urutan soal
      const randomizedQuestions = fisherYatesShuffle(normalizedQuestions);
      setQuestions(randomizedQuestions);

      // Anti-Cheat: Terapkan algoritma Fisher-Yates Shuffle pada opsi jawaban untuk soal pilihan ganda
      const optionsMap: Record<number, ShuffledOption[]> = {};
      const optionLabels = ['A', 'B', 'C', 'D', 'E'];

      randomizedQuestions.forEach((q) => {
        const isEssay = q.question_type === 'essay' || q.kunci?.toLowerCase() === 'essay';
        if (!isEssay) {
          const rawOpts: { originalKey: string; text: string }[] = [];
          if (q.opsi_a) rawOpts.push({ originalKey: 'A', text: q.opsi_a });
          if (q.opsi_b) rawOpts.push({ originalKey: 'B', text: q.opsi_b });
          if (q.opsi_c) rawOpts.push({ originalKey: 'C', text: q.opsi_c });
          if (q.opsi_d) rawOpts.push({ originalKey: 'D', text: q.opsi_d });
          if (q.opsi_e) rawOpts.push({ originalKey: 'E', text: q.opsi_e });

          // Shuffle opsi jawaban
          const shuffled = fisherYatesShuffle(rawOpts);
          optionsMap[q.id] = shuffled.map((item, idx) => ({
            displayKey: optionLabels[idx] || `${idx + 1}`,
            originalKey: item.originalKey,
            text: item.text,
          }));
        }
      });
      setShuffledOptions(optionsMap);

      // Load riwayat jawaban siswa yang tersimpan di PostgreSQL
      try {
        const sDetailsRes = await apiFetch(`/api/sessions/${currentSess.id}`);
        if (sDetailsRes.ok) {
          const sDetails = await sDetailsRes.json();
          if (sDetails?.answers && Array.isArray(sDetails.answers)) {
            const ansMap: Record<number, string> = {};
            sDetails.answers.forEach((a: any) => {
              if (a.question_id && a.jawaban_siswa) {
                ansMap[a.question_id] = a.jawaban_siswa;
              }
            });
            setStudentAnswers(ansMap);
          }
        }
      } catch (errAns) {
        console.warn('Could not load existing answers:', errAns);
      }

      // Set durasi countdown
      if (currentEx?.durasi) {
        setTimeLeftSeconds(currentEx.durasi * 60);
      }
    } catch (err: any) {
      console.error('Error loading exam session:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memuat lembar ujian.');
    } finally {
      setLoading(false);
    }
  }, [session, activeExam, initialToken, currentUser]);

  useEffect(() => {
    initializeExam();
  }, [initializeExam]);

  // Reference to latest submit function to avoid stale closures in listeners
  const confirmSubmitExamRef = useRef<(statusOverride?: 'Selesai' | 'Force Submit' | any) => Promise<void>>(async () => {});
  // Ref cooldown untuk mencegah double-trigger saat event blur dan visibilitychange terpanggil bersamaan
  const lastViolationTime = useRef<number>(0);

  // 2. Anti-Cheat: Record violation to backend (POST /api/exams/violation) & show warning modal
  const handleRecordViolation = useCallback(
    async (reason: string) => {
      if (isSubmitted) return;

      // Pengecekan Cooldown / Debounce: Abaikan jika pelanggaran terjadi dalam jarak kurang dari 2 detik (2000 ms)
      const now = Date.now();
      if (now - lastViolationTime.current < 2000) {
        return;
      }
      lastViolationTime.current = now;

      const targetSessionId = Number(session?.id || initialSession?.id || 1);
      const targetUserId = Number(currentUser?.id || session?.user_id || initialSession?.user_id || 1);
      const targetExamId = Number(activeExam?.id || session?.exam_id || initialSession?.exam_id || 1);

      let nextViolations = 1;

      // Functional state update untuk mengatasi stale state / closure dengan penguncian mutlak
      setViolationsCount((prev) => {
        if (prev >= 3) {
          nextViolations = 3;
          return prev;
        }
        const newCount = prev + 1;
        nextViolations = newCount;
        if (newCount >= 3) {
          setWarningMessage(
            'FORCE SUBMIT: Batas toleransi 3x pelanggaran tercapai! Sesi ujian Anda otomatis dihentikan dan diserahkan ke database.'
          );
        } else {
          setWarningMessage(`Peringatan Keamanan (${newCount}/3): ${reason}`);
        }
        setShowWarningModal(true);
        return newCount;
      });

      try {
        // MUTLAK: Melakukan await pada fungsi update pelanggaran (menyimpan log ke-3 dan count 3 ke database) TERLEBIH DAHULU
        const res = await apiFetch('/api/exams/violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: targetSessionId,
            user_id: targetUserId,
            exam_id: targetExamId,
            reason,
          }),
        });

        const data = await res.json().catch(() => ({}));
        
        // Setelah (atau di dalam .then) fungsi update pelanggaran tersebut sukses, BARU panggil fungsi forceSubmitExam
        if (
          nextViolations >= 3 ||
          data.forceSubmitted ||
          data.status_pengerjaan === 'Force Submit' ||
          (data.jml_pelanggaran && data.jml_pelanggaran >= 3)
        ) {
          await confirmSubmitExamRef.current('Force Submit');
        }
      } catch (err) {
        console.error('Error reporting anti-cheat violation:', err);
        // Fallback jika network error namun batas 3x sudah tercapai di client
        if (nextViolations >= 3) {
          await confirmSubmitExamRef.current('Force Submit');
        }
      }
    },
    [session, initialSession, currentUser, activeExam, isSubmitted]
  );

  // Anti-Cheat Listeners (Pindah tab, klik kanan, copy, cut, paste, devtools)
  useEffect(() => {
    if (!session || isSubmitted) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleRecordViolation('Mencoba klik kanan (context menu)');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleRecordViolation('Meninggalkan tab browser / membuka tab lain');
      }
    };

    const handleWindowBlur = () => {
      handleRecordViolation('Jendela browser kehilangan fokus (pindah aplikasi)');
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      handleRecordViolation('Mencoba menyalin (copy) teks soal');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      handleRecordViolation('Mencoba memotong (cut) teks');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleRecordViolation('Mencoba menempelkan (paste) teks');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        handleRecordViolation('Mencoba membuka inspect element / source code');
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [session, isSubmitted, handleRecordViolation]);

  // Timer countdown
  useEffect(() => {
    if (!session || isSubmitted || timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam('Force Submit');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session, isSubmitted, timeLeftSeconds]);

  // Handler: Select Answer Option (HANYA simpan ke React local useState)
  const handleSelectAnswer = (questionId: number, rawValue: any) => {
    if (isSubmitted || isSubmitting) return;

    // Pastikan yang disimpan ke state adalah string murni, bukan SyntheticEvent atau elemen DOM
    let optionLetter = '';
    if (typeof rawValue === 'string') {
      optionLetter = rawValue;
    } else if (rawValue && typeof rawValue === 'object') {
      if (typeof rawValue.target?.value === 'string') {
        optionLetter = rawValue.target.value;
      } else if (typeof rawValue.value === 'string') {
        optionLetter = rawValue.value;
      } else {
        optionLetter = String(rawValue || '');
      }
    } else if (rawValue !== null && rawValue !== undefined) {
      optionLetter = String(rawValue);
    }

    // Update state HANYA ke lokal useState React untuk mencegah race condition & overload server
    setStudentAnswers((prev) => ({ ...prev, [questionId]: optionLetter }));
  };

  // Handler: Toggle Flag for Review (Ragu-ragu)
  const handleToggleFlag = (questionId: number) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Helper to return to dashboard
  const handleReturnToDashboard = (info?: { session?: CBTExamSession; stats?: any; message?: string }) => {
    if (onReturnToDashboard) {
      onReturnToDashboard(info);
    } else if (onExitExam) {
      onExitExam(info);
    }
  };

  // Handler: Open Submit Confirmation Modal (Membuka Dialog Modal UI React)
  const handleSubmitExam = (e?: React.MouseEvent | React.FormEvent | string | any) => {
    if (isSubmitting) return;
    try {
      if (e && typeof e === 'object') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }

      // Jika timer habis atau force submit dari anti-cheat
      const isForce = typeof e === 'string' && (e === 'Force Submit' || e === 'force');
      if (isForce) {
        confirmSubmitExam('Force Submit');
        return;
      }

      // Buka Modal Konfirmasi UI React
      setShowSubmitModal(true);
    } catch (error: any) {
      console.error('Error saat memproses klik submit:', error);
      alert('Gagal Submit: ' + (error?.message || 'Terjadi kesalahan internal.'));
    }
  };

  // Handler: Confirm & Submit Exam via POST /api/submit-exam (Batch Request)
  const confirmSubmitExam = async (statusOverride?: 'Selesai' | 'Force Submit' | any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      setShowSubmitModal(false);
      const currentStatus: 'Selesai' | 'Force Submit' =
        typeof statusOverride === 'string' && statusOverride === 'Force Submit' ? 'Force Submit' : 'Selesai';

      const targetSessionId = Number(session?.id || initialSession?.id || 1);
      const targetUserId = Number(currentUser?.id || session?.user_id || initialSession?.user_id || 1);
      const targetExamId = Number(activeExam?.id || session?.exam_id || initialSession?.exam_id || 1);

      // Filter dan map state answers menjadi array murni dan object murni tanpa referensi circular atau DOM
      const sanitizedAnswersArray: { question_id: number; jawaban_siswa: string }[] = [];
      const sanitizedAnswersObj: Record<number, string> = {};

      if (studentAnswers && typeof studentAnswers === 'object') {
        for (const [key, val] of Object.entries(studentAnswers)) {
          const qId = Number(key);
          if (isNaN(qId)) continue;
          let strVal = '';
          if (typeof val === 'string') {
            strVal = val;
          } else if (val && typeof val === 'object' && 'target' in val) {
            strVal = String((val as any)?.target?.value || '');
          } else if (val !== null && val !== undefined) {
            strVal = String(val);
          }
          sanitizedAnswersArray.push({ question_id: qId, jawaban_siswa: strVal });
          sanitizedAnswersObj[qId] = strVal;
        }
      }

      const payloadData = {
        session_id: targetSessionId,
        user_id: targetUserId,
        exam_id: targetExamId,
        status: currentStatus,
        answers: sanitizedAnswersObj,
        student_answers: sanitizedAnswersArray,
      };

      console.log('BATCH MENGIRIM DATA JAWABAN:', payloadData);

      const res = await apiFetch('/api/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadData),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsSubmitted(false);
        const errMsg = data?.message || data?.error || `Terjadi kesalahan pada server (Status: ${res.status}).`;
        throw new Error(errMsg);
      }

      // Layar hijau 'Sukses' HANYA BOLEH dirender jika response.ok bernilai true
      setIsSubmitted(true);
      const isEssayPresent =
        Boolean(data.has_essay) ||
        questions.some(
          (q) =>
            q.question_type === 'essay' ||
            q.kunci?.toUpperCase() === 'ESSAY' ||
            q.tipe_media === 'Essay' ||
            !q.opsi_a ||
            q.opsi_a.trim() === '' ||
            q.opsi_a.trim() === '-' ||
            (q.kunci && q.kunci.length > 1)
        );

      setExamResult({
        finalScore: data.finalScore ?? data.session?.total_nilai ?? 0,
        totalCorrect: data.totalCorrect ?? data.stats?.benar_pg ?? 0,
        nilai_pg: data.nilai_pg ?? data.session?.nilai_pg ?? data.stats?.nilai_pg ?? (isEssayPresent ? data.finalScore : undefined),
        has_essay: isEssayPresent,
      });

      if (data.session) {
        setSession(data.session);
      }
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      setIsSubmitted(false);
      alert('Gagal Submit: ' + (err?.message || 'Terjadi kesalahan saat menghubungi server.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  confirmSubmitExamRef.current = confirmSubmitExam;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const studentDisplayName = currentUser?.name || 'Siswa';
  const answeredCount = questions.filter(
    (q) => (studentAnswers[q.id] || '').trim().length > 0
  ).length;
  const currentQ = questions[currentQuestionIndex];
  const isCurrentQEssay = currentQ ? (currentQ.question_type === 'essay' || currentQ.kunci?.toLowerCase() === 'essay') : false;

  // =========================================================================
  // VIEW 1: LOADING SKELETON SCREEN
  // =========================================================================
  if (loading && !isSubmitted && !currentQ) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#00236f]">
            <Loader2 className="w-7 h-7 animate-spin text-[#00236f]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Menyiapkan Lembar Ujian</h2>
          <p className="text-xs text-slate-500 max-w-xs">
            Memuat butir soal dari Cloud SQL PostgreSQL dan mengaktifkan protokol pengawasan anti-cheat...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ERROR SCREEN (No Gateway Dropdowns - Clean Return)
  // =========================================================================
  if (errorMsg && !session) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 sm:p-10 rounded-2xl border border-rose-200 shadow-xl max-w-md w-full flex flex-col items-center gap-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Gagal Masuk Ujian</h2>
            <p className="text-xs text-rose-600 mt-2 font-medium">{errorMsg}</p>
          </div>
          <p className="text-xs text-slate-500">
            Pastikan token yang Anda masukkan sesuai dengan token aktif yang diberikan oleh guru pengawas.
          </p>
          {(onReturnToDashboard || onExitExam) && (
            <button
              onClick={() => handleReturnToDashboard()}
              className="mt-2 w-full py-3 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard Siswa</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: EXAM SUBMITTED / RESULT SUMMARY SCREEN
  // =========================================================================
  if (isSubmitted && examResult) {
    const hasEssayQuestions =
      examResult.has_essay ??
      questions.some(
        (q) =>
          q.question_type === 'essay' ||
          q.kunci?.toUpperCase() === 'ESSAY' ||
          q.tipe_media === 'Essay' ||
          !q.opsi_a ||
          q.opsi_a.trim() === '' ||
          q.opsi_a.trim() === '-' ||
          (q.kunci && q.kunci.length > 1)
      );

    const nilaiPg = examResult.nilai_pg ?? session?.nilai_pg ?? examResult.finalScore ?? 0;

    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200 shadow-inner">
            <Award className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Ujian Telah Selesai & Diserahkan
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-3">Hasil Evaluasi CBT</h2>
            <p className="text-xs text-slate-500 mt-1">
              Data pengerjaan tersimpan permanen di Cloud SQL PostgreSQL.
            </p>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 font-medium">Skor Akhir</div>
              {hasEssayQuestions ? (
                <div className="text-xs sm:text-sm font-bold text-[#00236f] mt-2 leading-snug">
                  Nilai Pilihan Ganda: {nilaiPg}. Nilai Essay: Menunggu Penilaian Guru.
                </div>
              ) : (
                <>
                  <div className="text-3xl font-black font-mono text-[#00236f] mt-1">
                    {examResult.finalScore}
                  </div>
                  <div className="text-[10px] text-slate-400">Skala 0 - 100</div>
                </>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Pelanggaran Terdeteksi</div>
              <div
                className={`text-3xl font-black font-mono mt-1 ${
                  violationsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {violationsCount} / 3
              </div>
              <div className="text-[10px] text-slate-400">
                {violationsCount >= 3 ? 'Status: Force Submit' : violationsCount > 0 ? 'Tercatat di Database' : 'Integritas Bersih'}
              </div>
            </div>
          </div>

          <div className="text-left text-xs space-y-1.5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
            <div><strong>Peserta:</strong> {studentDisplayName} ({currentUser?.username || 'Siswa'})</div>
            <div><strong>Paket Ujian:</strong> {activeExam?.mapel || 'Ujian Komprehensif'} ({activeExam?.kode_paket || 'CBT'})</div>
            <div><strong>Status Sesi:</strong> {violationsCount >= 3 ? 'Force Submit (Batas Pelanggaran 3x)' : 'Selesai Tepat Waktu'}</div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {(onReturnToDashboard || onExitExam) && (
              <button
                onClick={() =>
                  handleReturnToDashboard({
                    session: session || undefined,
                    stats: examResult ? { finalScore: examResult.finalScore, totalCorrect: examResult.totalCorrect } : undefined,
                    message: 'Ujian selesai dikerjakan.',
                  })
                }
                className="w-full py-3 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Kembali ke Dashboard Siswa</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: ACTIVE FULLSCREEN EXAM SCREEN (Standard Production CBT Layout)
  // =========================================================================
  return (
    <div className="relative min-h-screen bg-[#f7f9fb] text-slate-900 font-sans select-none overflow-x-hidden pb-24">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 shadow-xs flex justify-between items-center w-full px-4 sm:px-6 h-16 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-2 sm:gap-4 truncate max-w-[50%]">
          <span className="font-bold text-sm sm:text-base text-[#00236f] truncate">
            {activeExam?.mapel || 'Ujian Online Terproteksi'}
          </span>
          <span className="hidden md:inline text-xs text-slate-500 border-l border-slate-300 pl-3">
            {activeExam?.kelas || 'Kelas XII'}
          </span>
          {/* Local Device Save Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Jawaban tersimpan sementara di perangkat.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Anti-Cheat Badge */}
          <div
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
              violationsCount > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Anti-Cheat: {violationsCount}/3</span>
          </div>

          {/* Timer Display */}
          <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold font-mono shadow-xs">
            <Clock className="w-3.5 h-3.5 text-rose-600" />
            <span>{formatTimer(timeLeftSeconds)}</span>
          </div>

          {/* Submit Exam Button (Desktop) */}
          <button
            type="button"
            id="btn-header-submit-exam"
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="hidden md:flex items-center gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Kumpulkan Ujian</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-20 flex w-full max-w-7xl mx-auto px-4 sm:px-6 gap-6">
        {/* Question Panel */}
        <div className="flex-1 min-w-0 pb-20">
          {/* Mobile Question Counter & Drawer Trigger */}
          <div className="md:hidden flex justify-between items-center mb-3 bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-700">
              Soal {currentQuestionIndex + 1} dari {questions.length}
            </span>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="text-[#00236f] font-semibold text-xs flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Lihat Daftar Soal</span>
            </button>
          </div>

          {currentQ ? (
            <article className="bg-white rounded-2xl p-5 sm:p-7 shadow-[0px_10px_25px_-5px_rgba(30,58,138,0.05)] border border-slate-200/90 flex flex-col gap-6">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#00236f] text-white text-xs font-bold flex items-center justify-center shadow-xs">
                    {currentQuestionIndex + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-xl font-bold text-[#00236f]">
                        Soal No. {currentQuestionIndex + 1}
                      </h1>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isCurrentQEssay
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        <FileText className="w-3 h-3" />
                        <span>{isCurrentQEssay ? 'Essay / Uraian' : 'Pilihan Ganda'}</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Bobot: {currentQ.bobot_poin} Poin | Media: {currentQ.tipe_media}
                    </span>
                  </div>
                </div>

                {/* Mark for Review Button (Ragu-ragu) */}
                <button
                  type="button"
                  onClick={() => handleToggleFlag(currentQ.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    flaggedQuestions[currentQ.id]
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{flaggedQuestions[currentQ.id] ? 'Ditandai Ragu' : 'Tandai Ragu-ragu'}</span>
                </button>
              </div>

              {/* Media Display */}
              {currentQ.link_media && currentQ.tipe_media === 'Image' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-center items-center">
                  <img
                    src={currentQ.link_media}
                    alt={`Media Soal ${currentQuestionIndex + 1}`}
                    className="max-h-64 object-contain rounded-lg border border-slate-200 shadow-xs"
                  />
                </div>
              )}

              {/* Question Text */}
              <div className="text-sm sm:text-base text-slate-900 font-medium leading-relaxed">
                {currentQ.pertanyaan}
              </div>

              {/* MULTI-TIPE SOAL: Conditional Rendering (PG vs Essay) */}
              {isCurrentQEssay ? (
                /* Lembar Jawaban Essay */
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-[#00236f] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#00236f]" />
                      <span>Lembar Jawaban Essay / Uraian:</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {(studentAnswers[currentQ.id] || '').length} Karakter
                    </span>
                  </div>

                  <textarea
                    rows={6}
                    value={studentAnswers[currentQ.id] || ''}
                    onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                    placeholder="Tuliskan jawaban penjelasan, analisa, atau uraian Anda secara rinci di sini..."
                    className="w-full p-4 border border-slate-300 rounded-2xl focus:border-[#00236f] focus:ring-2 focus:ring-blue-100 focus:outline-none text-xs sm:text-sm text-slate-800 leading-relaxed bg-white shadow-xs resize-y transition-all"
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Jawaban tersimpan sementara di perangkat.</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tersimpan di Perangkat</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Opsi Pilihan Ganda (Shuffled with Fisher-Yates) */
                <div className="grid grid-cols-1 gap-3 mt-2">
                  {(shuffledOptions[currentQ.id] || [
                    { displayKey: 'A', originalKey: 'A', text: currentQ.opsi_a },
                    { displayKey: 'B', originalKey: 'B', text: currentQ.opsi_b },
                    { displayKey: 'C', originalKey: 'C', text: currentQ.opsi_c },
                    { displayKey: 'D', originalKey: 'D', text: currentQ.opsi_d },
                    ...(currentQ.opsi_e ? [{ displayKey: 'E', originalKey: 'E', text: currentQ.opsi_e }] : []),
                  ]).map((opt) => {
                    const isChecked = studentAnswers[currentQ.id] === opt.originalKey;
                    return (
                      <label
                        key={opt.originalKey}
                        onClick={() => handleSelectAnswer(currentQ.id, opt.originalKey)}
                        className={`relative flex items-center p-3.5 sm:p-4 border rounded-xl cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#00236f] bg-blue-50/80 ring-1 ring-[#00236f] shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`answer_${currentQ.id}`}
                          value={opt.originalKey}
                          checked={isChecked}
                          onChange={() => {}}
                          className="sr-only"
                        />
                        <div
                          className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs mr-3.5 flex-shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-[#00236f] text-white border-[#00236f]'
                              : 'border-slate-300 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {opt.displayKey}
                        </div>
                        <span className="text-xs sm:text-sm text-slate-900 leading-relaxed font-normal">
                          {opt.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </article>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 text-xs">
              Memuat soal ujian...
            </div>
          )}
        </div>

        {/* Sidebar Question Palette (Right on Desktop) */}
        <aside className="hidden md:flex flex-col w-[300px] bg-white border border-slate-200 rounded-2xl p-4 shadow-xs shrink-0 h-fit sticky top-20">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#00236f]">Lembar Nomor Soal</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {answeredCount} dari {questions.length} Soal Terjawab
            </p>

            {/* Legend */}
            <div className="flex flex-wrap gap-2.5 mt-3 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-[#10b981]" />
                <span>Dijawab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-100 border border-slate-300" />
                <span>Belum</span>
              </div>
            </div>
          </div>

          <div className="py-3 max-h-[380px] overflow-y-auto pr-1">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = currentQuestionIndex === idx;
                const isAnswered = (studentAnswers[q.id] || '').trim().length > 0;
                const isFlagged = !!flaggedQuestions[q.id];
                const isEssay = q.question_type === 'essay' || q.kunci?.toLowerCase() === 'essay';

                let btnClass = 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
                if (isCurrent) {
                  btnClass = 'bg-[#00236f] text-white font-bold ring-2 ring-blue-400 shadow-xs';
                } else if (isFlagged) {
                  btnClass = 'bg-amber-400 text-slate-950 font-bold border-transparent';
                } else if (isAnswered) {
                  btnClass = 'bg-[#10b981] text-white font-bold border-transparent';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all cursor-pointer ${btnClass}`}
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && !isCurrent && (
                      <span className="text-[9px] font-mono leading-none opacity-85">
                        {isEssay ? '✓' : studentAnswers[q.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selesai & Submit Button */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              id="btn-palette-submit-exam"
              onClick={handleSubmitExam}
              disabled={isSubmitting}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? 'Mengirim...' : 'Selesai & Kumpulkan'}</span>
            </button>
          </div>
        </aside>
      </main>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:right-[320px] bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex justify-between items-center z-30 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
        <button
          disabled={currentQuestionIndex === 0 || isSubmitting}
          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Sebelumnya</span>
        </button>

        {/* Mobile Trigger for Question Drawer */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="md:hidden flex items-center gap-1 text-xs font-semibold text-[#00236f] bg-blue-50 px-3 py-2 rounded-lg border border-blue-200"
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Daftar Soal</span>
        </button>

        {/* Jika di soal terakhir: GANTIKAN tombol Selanjutnya dengan tombol Selesai & Kumpulkan */}
        {currentQuestionIndex === questions.length - 1 ? (
          <button
            type="button"
            id="btn-bottom-submit-exam"
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'Mengirim...' : 'Selesai & Kumpulkan'}</span>
          </button>
        ) : (
          <button
            disabled={isSubmitting}
            onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="flex items-center gap-1.5 px-5 sm:px-6 py-2.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-40"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile Drawer for Question Palette */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl shadow-2xl p-5 max-h-[80vh] flex flex-col gap-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#00236f]">Daftar Nomor Soal</h3>
                <p className="text-xs text-slate-500">{answeredCount} dari {questions.length} Terjawab</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2.5 overflow-y-auto max-h-[50vh] p-1">
              {questions.map((q, idx) => {
                const isCurrent = currentQuestionIndex === idx;
                const isAnswered = (studentAnswers[q.id] || '').trim().length > 0;
                const isFlagged = !!flaggedQuestions[q.id];

                let btnClass = 'bg-slate-50 border border-slate-200 text-slate-700';
                if (isCurrent) {
                  btnClass = 'bg-[#00236f] text-white font-bold ring-2 ring-blue-500';
                } else if (isFlagged) {
                  btnClass = 'bg-amber-400 text-slate-950 font-bold';
                } else if (isAnswered) {
                  btnClass = 'bg-[#10b981] text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      setIsDrawerOpen(false);
                    }}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              id="btn-mobile-submit-exam"
              disabled={isSubmitting}
              onClick={() => {
                setIsDrawerOpen(false);
                handleSubmitExam();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? 'Mengirim...' : 'Selesai & Kumpulkan Ujian'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal (Pengganti window.confirm untuk iframe preview) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-blue-50 text-[#00236f] rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
              <Send className="w-8 h-8 text-[#00236f]" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                Konfirmasi Kumpulkan Ujian
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menyelesaikan ujian ini? Seluruh jawaban yang telah dipilih akan dikunci dan dikirim sekaligus ke server Cloud SQL untuk dinilai.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex justify-around items-center">
              <div>
                <div className="font-bold text-emerald-600 text-base">{answeredCount}</div>
                <div className="text-[10px] text-slate-500">Sudah Terjawab</div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <div className="font-bold text-slate-800 text-base">{questions.length - answeredCount}</div>
                <div className="text-[10px] text-slate-500">Belum Terjawab</div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => confirmSubmitExam()}
                className="flex-1 py-2.5 px-4 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{isSubmitting ? 'Mengirim...' : 'Ya, Kumpulkan Ujian'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-Cheat Warning Modal (Pop-up Keamanan) */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-[#0b1c30]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 sm:p-8 shadow-2xl border-t-4 border-rose-600 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-rose-600">Peringatan Keamanan!</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                {warningMessage}
              </p>
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs text-rose-900 font-medium">
              Akumulasi Pelanggaran: <strong>{violationsCount}/3</strong>. Jika mencapai 3x, ujian akan otomatis diselesaikan (Force Submit).
            </div>

            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              Saya Mengerti & Kembali ke Ujian
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
