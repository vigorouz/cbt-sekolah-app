import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Database,
  Calendar,
  Radio,
  FileEdit,
  Award,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Plus,
  Filter,
  Edit2,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Sparkles,
  BookOpen,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  ExternalLink,
  HelpCircle,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
  KeyRound,
  Copy,
  RefreshCw,
  FolderPlus,
  Layers,
  CalendarCheck,
  PlayCircle,
} from 'lucide-react';
import { TeacherDashboard } from './TeacherDashboard.tsx';
import { TeacherEssayGrading } from './TeacherEssayGrading.tsx';
import { TeacherExamResults } from './TeacherExamResults.tsx';
import { CBTUser, CBTExam, CBTQuestion } from '../types.ts';
import { apiFetch, parseJsonResponse } from '../utils/api.ts';

export type TeacherMenuTab =
  | 'dashboard'
  | 'data_siswa'
  | 'bank_soal'
  | 'jadwal_ujian'
  | 'live_monitor'
  | 'koreksi_essay'
  | 'hasil_ujian'
  | 'settings';

interface TeacherLayoutProps {
  currentUser?: CBTUser | null;
  onLogout?: () => void;
  initialTab?: TeacherMenuTab;
}

export const TeacherLayout: React.FC<TeacherLayoutProps> = ({
  currentUser,
  onLogout,
  initialTab = 'data_siswa',
}) => {
  // State Navigasi
  const [activeMenu, setActiveMenu] = useState<TeacherMenuTab>(initialTab);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ==========================================
  // DATA SISWA / USER STATES (Cloud SQL Users Table)
  // ==========================================
  const isAdmin = currentUser?.role === 'admin';
  const [students, setStudents] = useState<CBTUser[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('Semua Status');
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const studentsPerPage = 7;

  // Modals Data Siswa / User
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRole, setNewStudentRole] = useState<'murid' | 'guru' | 'admin'>('murid');
  const [newStudentPassword, setNewStudentPassword] = useState('siswa123');

  const [editingStudent, setEditingStudent] = useState<CBTUser | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentUsername, setEditStudentUsername] = useState('');
  const [editStudentRole, setEditStudentRole] = useState<'murid' | 'guru' | 'admin'>('murid');
  const [editStudentStatus, setEditStudentStatus] = useState<'aktif' | 'tidak aktif'>('aktif');
  const [editStudentPassword, setEditStudentPassword] = useState('');

  // ==========================================
  // BANK SOAL & PAKET SOAL STATES
  // ==========================================
  const [exams, setExams] = useState<CBTExam[]>([]);
  const [questions, setQuestions] = useState<CBTQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('Semua Paket');
  const [questionMediaTypeFilter, setQuestionMediaTypeFilter] = useState<string>('Semua Media');
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [questionCurrentPage, setQuestionCurrentPage] = useState(1);
  const questionsPerPage = 6;

  // Modal Buat Paket Ujian Baru (Bank Soal)
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false);
  const [newPackageCode, setNewPackageCode] = useState('');
  const [newPackageSubject, setNewPackageSubject] = useState('');
  const [newPackageClass, setNewPackageClass] = useState('Semua Kelas');

  // Modals Bank Soal
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [questionExamId, setQuestionExamId] = useState<number | ''>('');
  const [questionType, setQuestionType] = useState<'pilihan_ganda' | 'essay'>('pilihan_ganda');
  const [questionMediaType, setQuestionMediaType] = useState<'Teks' | 'Image' | 'Audio' | 'Video'>('Teks');
  const [questionMediaLink, setQuestionMediaLink] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [optionE, setOptionE] = useState('');
  const [answerKey, setAnswerKey] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');
  const [questionScore, setQuestionScore] = useState<number>(20);

  // Edit Question
  const [editingQuestion, setEditingQuestion] = useState<CBTQuestion | null>(null);

  // Preview Media Modal
  const [previewMedia, setPreviewMedia] = useState<{ type: string; url: string; title: string } | null>(null);

  // ==========================================
  // JADWAL UJIAN CRUD STATES
  // ==========================================
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleSourcePackageId, setScheduleSourcePackageId] = useState<number | ''>('');
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState<number>(60);
  const [scheduleToken, setScheduleToken] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState<'Aktif' | 'Draft'>('Aktif');
  const [scheduleClass, setScheduleClass] = useState('Semua Kelas');
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('Semua Status');

  // Edit Jadwal
  const [editingSchedule, setEditingSchedule] = useState<CBTExam | null>(null);
  const [editScheduleName, setEditScheduleName] = useState('');
  const [editScheduleStartTime, setEditScheduleStartTime] = useState('');
  const [editScheduleDuration, setEditScheduleDuration] = useState<number>(60);
  const [editScheduleToken, setEditScheduleToken] = useState('');
  const [editScheduleStatus, setEditScheduleStatus] = useState<'Aktif' | 'Draft' | 'Selesai'>('Aktif');
  const [editScheduleClass, setEditScheduleClass] = useState('Semua Kelas');

  const teacherName = currentUser?.name || 'Guru';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Fetch Students/Users from Cloud SQL (`GET /api/users`)
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const endpoint = isAdmin ? '/api/users' : '/api/users?role=murid';
      const res = await apiFetch(endpoint);
      const data = await parseJsonResponse(res, []);
      if (Array.isArray(data)) {
        setStudents(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      showToast(isAdmin ? 'Gagal memuat data user dari server' : 'Gagal memuat data siswa dari server');
    } finally {
      setLoadingStudents(false);
    }
  }, [isAdmin]);

  // 2. Fetch Exams and Questions from Cloud SQL (`GET /api/exams` & `GET /api/questions`)
  const fetchExamsAndQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const [examsRes, questionsRes] = await Promise.all([
        apiFetch('/api/exams'),
        apiFetch('/api/questions'),
      ]);

      const examsData = await parseJsonResponse(examsRes, []);
      const questionsData = await parseJsonResponse(questionsRes, []);

      if (Array.isArray(examsData)) {
        setExams(examsData);
        if (examsData.length > 0 && questionExamId === '') {
          setQuestionExamId(examsData[0].id);
        }
      }

      if (Array.isArray(questionsData)) {
        setQuestions(questionsData);
      }
    } catch (err) {
      console.error('Error fetching questions or exams:', err);
      showToast('Gagal memuat bank soal dari server');
    } finally {
      setLoadingQuestions(false);
    }
  }, [questionExamId]);

  useEffect(() => {
    fetchStudents();
    fetchExamsAndQuestions();
  }, [fetchStudents, fetchExamsAndQuestions]);

  // ==========================================
  // HANDLERS: DATA SISWA
  // ==========================================

  // Tambah Siswa Baru (POST /api/users)
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentUsername.trim() || !newStudentName.trim()) {
      showToast('Mohon isi Username dan Nama Siswa.');
      return;
    }

    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newStudentUsername.trim(),
          name: newStudentName.trim(),
          password: newStudentPassword.trim() || 'siswa123',
          role: isAdmin ? newStudentRole : 'murid',
          status: 'aktif',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambah akun');
      }

      showToast(`User "${data.name}" (${data.role}) berhasil ditambahkan ke database!`);
      setIsAddStudentOpen(false);
      setNewStudentUsername('');
      setNewStudentName('');
      setNewStudentRole('murid');
      setNewStudentPassword('siswa123');
      fetchStudents();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat menambah user');
    }
  };

  // Buka Modal Edit Siswa / User
  const handleOpenEditStudent = (student: CBTUser) => {
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentUsername(student.username);
    setEditStudentRole(student.role);
    setEditStudentStatus(student.status);
    setEditStudentPassword('');
  };

  // Simpan Edit Siswa / User (PUT /api/users/:id)
  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const payload: any = {
        name: editStudentName.trim(),
        username: editStudentUsername.trim(),
        role: isAdmin ? editStudentRole : editingStudent.role,
        status: editStudentStatus,
      };
      if (editStudentPassword.trim()) {
        payload.password = editStudentPassword.trim();
        payload.passwordPlain = editStudentPassword.trim();
      }

      const res = await apiFetch(`/api/users/${editingStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui data user');
      }

      showToast(`Data user "${data.name || editStudentName}" berhasil diperbarui!`);
      setEditingStudent(null);
      await fetchStudents();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan saat mengupdate user');
    }
  };

  // Toggle Status / Soft Delete Siswa (DELETE /api/users/:id -> status = 'tidak aktif' / PUT /api/users/:id)
  const handleToggleStudentStatus = async (student: CBTUser) => {
    const nextStatus = student.status === 'aktif' ? 'tidak aktif' : 'aktif';
    try {
      let res;
      if (nextStatus === 'tidak aktif') {
        // Panggil endpoint Soft Delete
        res = await apiFetch(`/api/users/${student.id}`, {
          method: 'DELETE',
        });
      } else {
        // Re-aktifkan akun
        res = await apiFetch(`/api/users/${student.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'aktif' }),
        });
      }

      if (!res.ok) {
        throw new Error('Gagal mengubah status akun siswa');
      }

      showToast(
        nextStatus === 'tidak aktif'
          ? `Akun siswa "${student.name}" berhasil dinonaktifkan (Soft Delete).`
          : `Akun siswa "${student.name}" berhasil diaktifkan kembali.`
      );
      fetchStudents();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses perubahan status');
    }
  };

  // Hapus Permanen Siswa (DELETE /api/users/:id?permanent=true)
  const handlePermanentDeleteStudent = async (student: CBTUser) => {
    if (
      confirm(
        `PERINGATAN: Apakah Anda yakin ingin MENGHAPUS PERMANEN siswa "${student.name}" (@${student.username}) beserta riwayatnya dari Cloud SQL?`
      )
    ) {
      try {
        const res = await apiFetch(`/api/users/${student.id}?permanent=true`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Gagal menghapus siswa permanen');
        showToast(`Akun siswa "${student.name}" telah dihapus permanen dari database.`);
        fetchStudents();
      } catch (err: any) {
        showToast(err.message || 'Gagal menghapus siswa');
      }
    }
  };

  // ==========================================
  // HANDLERS: BANK SOAL (QUESTIONS CRUD)
  // ==========================================

  // Tambah Soal Baru (POST /api/questions)
  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEssay = questionType === 'essay';
    if (!questionExamId || !questionText.trim()) {
      showToast('Lengkapi paket ujian dan teks pertanyaan.');
      return;
    }
    if (!isEssay && (!optionA.trim() || !optionB.trim())) {
      showToast('Untuk Pilihan Ganda, mohon isi minimal opsi A & B.');
      return;
    }

    try {
      const res = await apiFetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: Number(questionExamId),
          guru_id: currentUser?.id || 1,
          tipe_media: questionMediaType,
          pertanyaan: questionText.trim(),
          opsi_a: isEssay ? null : optionA.trim(),
          opsi_b: isEssay ? null : optionB.trim(),
          opsi_c: isEssay ? null : (optionC.trim() || null),
          opsi_d: isEssay ? null : (optionD.trim() || null),
          opsi_e: isEssay ? null : (optionE.trim() || null),
          kunci: isEssay ? 'essay' : answerKey,
          bobot_poin: Number(questionScore) || 20,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambah butir soal ke database');
      }

      showToast('Butir soal baru berhasil disimpan ke database!');
      setIsAddQuestionOpen(false);
      resetQuestionForm();
      await fetchExamsAndQuestions();
    } catch (err: any) {
      console.error('Error saving question:', err);
      showToast(err.message || 'Gagal menyimpan soal');
    }
  };

  // Buka Modal Edit Soal
  const handleOpenEditQuestion = (q: CBTQuestion) => {
    setEditingQuestion(q);
    const qType = q.question_type || (q.kunci?.toLowerCase() === 'essay' ? 'essay' : 'pilihan_ganda');
    setQuestionType(qType);
    setQuestionExamId(q.exam_id);
    setQuestionMediaType(q.tipe_media);
    setQuestionMediaLink(q.link_media || '');
    setQuestionText(q.pertanyaan);
    setOptionA(q.opsi_a || '');
    setOptionB(q.opsi_b || '');
    setOptionC(q.opsi_c || '');
    setOptionD(q.opsi_d || '');
    setOptionE(q.opsi_e || '');
    setAnswerKey(q.kunci && ['A', 'B', 'C', 'D', 'E'].includes(q.kunci.toUpperCase()) ? (q.kunci.toUpperCase() as any) : 'A');
    setQuestionScore(q.bobot_poin || 20);
  };

  // Simpan Edit Soal (PUT /api/questions/:id)
  const handleEditQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    const isEssay = questionType === 'essay';
    if (!questionExamId || !questionText.trim()) {
      showToast('Lengkapi paket ujian dan teks pertanyaan.');
      return;
    }
    if (!isEssay && (!optionA.trim() || !optionB.trim())) {
      showToast('Untuk Pilihan Ganda, mohon isi minimal opsi A & B.');
      return;
    }

    try {
      const res = await apiFetch(`/api/questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: Number(questionExamId),
          tipe_media: questionMediaType,
          pertanyaan: questionText.trim(),
          opsi_a: isEssay ? null : optionA.trim(),
          opsi_b: isEssay ? null : optionB.trim(),
          opsi_c: isEssay ? null : optionC.trim(),
          opsi_d: isEssay ? null : optionD.trim(),
          opsi_e: isEssay ? null : (optionE.trim() || null),
          kunci: isEssay ? 'essay' : answerKey,
          bobot_poin: Number(questionScore) || 20,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui soal');
      }

      showToast('Butir soal berhasil diperbarui di database!');
      setEditingQuestion(null);
      resetQuestionForm();
      await fetchExamsAndQuestions();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui soal');
    }
  };

  // Hapus Soal (DELETE /api/questions/:id)
  const handleDeleteQuestion = async (q: CBTQuestion) => {
    if (confirm(`Apakah Anda yakin ingin menghapus soal #${q.id}: "${q.pertanyaan.substring(0, 40)}..."?`)) {
      try {
        const res = await apiFetch(`/api/questions/${q.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Gagal menghapus butir soal');
        showToast('Butir soal berhasil dihapus dari database.');
        await fetchExamsAndQuestions();
      } catch (err: any) {
        showToast(err.message || 'Gagal menghapus butir soal');
      }
    }
  };

  const resetQuestionForm = () => {
    setQuestionType('pilihan_ganda');
    setQuestionMediaLink('');
    setQuestionMediaType('Teks');
    setQuestionText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setOptionE('');
    setAnswerKey('A');
    setQuestionScore(20);
  };

  const generateRandomToken = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // ==========================================
  // HANDLERS: PAKET SOAL (BANK SOAL)
  // ==========================================
  const handleAddPackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackageCode.trim() || !newPackageSubject.trim()) {
      showToast('Mohon lengkapi Kode Paket dan Nama Mata Pelajaran.');
      return;
    }

    try {
      const res = await apiFetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kode_paket: newPackageCode.trim().toUpperCase(),
          mapel: newPackageSubject.trim(),
          kelas: newPackageClass || 'Semua Kelas',
          durasi: 60,
          token: generateRandomToken(),
          status: 'Draft',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat paket soal');
      }

      showToast(`Paket Soal "${data.kode_paket} - ${data.mapel}" berhasil dibuat!`);
      setIsAddPackageOpen(false);
      setNewPackageCode('');
      setNewPackageSubject('');
      setNewPackageClass('Semua Kelas');
      setQuestionExamId(data.id);
      setSelectedExamFilter(String(data.id));
      await fetchExamsAndQuestions();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat paket soal');
    }
  };

  // ==========================================
  // HANDLERS: JADWAL UJIAN CRUD
  // ==========================================
  const handleOpenAddSchedule = () => {
    setScheduleName('');
    setScheduleSourcePackageId(exams.length > 0 ? exams[0].id : '');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setScheduleStartTime(now.toISOString().slice(0, 16));
    setScheduleDuration(60);
    setScheduleToken(generateRandomToken());
    setScheduleStatus('Aktif');
    setScheduleClass(exams.length > 0 ? exams[0].kelas : 'Semua Kelas');
    setIsAddScheduleOpen(true);
  };

  const handleAddScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleName.trim()) {
      showToast('Mohon masukkan Nama Ujian.');
      return;
    }
    if (!scheduleSourcePackageId) {
      showToast('Mohon pilih Paket Soal dari Bank Soal.');
      return;
    }

    const selectedPkg = exams.find((ex) => ex.id === Number(scheduleSourcePackageId));
    const tokenClean = (scheduleToken || generateRandomToken()).trim().toUpperCase();

    try {
      const res = await apiFetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapel: scheduleName.trim(),
          kode_paket: selectedPkg?.kode_paket || `PKT-${Date.now().toString().slice(-4)}`,
          kelas: scheduleClass || selectedPkg?.kelas || 'Semua Kelas',
          waktu_mulai: scheduleStartTime ? new Date(scheduleStartTime).toISOString() : null,
          durasi: Number(scheduleDuration) || 60,
          token: tokenClean,
          status: scheduleStatus,
          source_package_id: scheduleSourcePackageId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat jadwal ujian');
      }

      showToast(`Jadwal Ujian "${data.mapel}" berhasil dirilis dengan Token: ${data.token}!`);
      setIsAddScheduleOpen(false);
      await fetchExamsAndQuestions();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat jadwal ujian');
    }
  };

  const handleOpenEditSchedule = (ex: CBTExam) => {
    setEditingSchedule(ex);
    setEditScheduleName(ex.mapel);
    if (ex.waktu_mulai) {
      const d = new Date(ex.waktu_mulai);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setEditScheduleStartTime(d.toISOString().slice(0, 16));
    } else {
      setEditScheduleStartTime('');
    }
    setEditScheduleDuration(ex.durasi || 60);
    setEditScheduleToken(ex.token || '');
    setEditScheduleStatus(ex.status);
    setEditScheduleClass(ex.kelas || 'Semua Kelas');
  };

  const handleEditScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    try {
      const res = await apiFetch(`/api/exams/${editingSchedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapel: editScheduleName.trim(),
          waktu_mulai: editScheduleStartTime ? new Date(editScheduleStartTime).toISOString() : null,
          durasi: Number(editScheduleDuration) || 60,
          token: editScheduleToken.trim().toUpperCase(),
          status: editScheduleStatus,
          kelas: editScheduleClass,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengupdate jadwal ujian');
      }

      showToast(`Jadwal Ujian "${data.mapel}" berhasil diperbarui!`);
      setEditingSchedule(null);
      await fetchExamsAndQuestions();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui jadwal ujian');
    }
  };

  const handleToggleScheduleStatus = async (ex: CBTExam) => {
    const nextStatus = ex.status === 'Aktif' ? 'Draft' : 'Aktif';
    try {
      const res = await apiFetch(`/api/exams/${ex.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status ujian');
      showToast(`Ujian "${ex.mapel}" kini berstatus "${nextStatus}".`);
      await fetchExamsAndQuestions();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status ujian');
    }
  };

  const handleRegenerateToken = async (ex: CBTExam) => {
    const newToken = generateRandomToken();
    try {
      const res = await apiFetch(`/api/exams/${ex.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken }),
      });
      if (!res.ok) throw new Error('Gagal memperbarui token');
      showToast(`Token baru untuk "${ex.mapel}": ${newToken}`);
      await fetchExamsAndQuestions();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengganti token');
    }
  };

  const handleDeleteSchedule = async (ex: CBTExam) => {
    if (confirm(`Apakah Anda yakin ingin menghapus jadwal ujian "${ex.mapel}" (Token: ${ex.token})?`)) {
      try {
        const res = await apiFetch(`/api/exams/${ex.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Gagal menghapus jadwal ujian');
        showToast(`Jadwal ujian "${ex.mapel}" berhasil dihapus.`);
        await fetchExamsAndQuestions();
      } catch (err: any) {
        showToast(err.message || 'Gagal menghapus jadwal ujian');
      }
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    showToast(`Token "${token}" berhasil disalin ke clipboard!`);
  };

  // Filter Data Siswa
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const matchStatus =
        studentStatusFilter === 'Semua Status' ||
        (studentStatusFilter === 'Aktif' && st.status === 'aktif') ||
        (studentStatusFilter === 'Tidak Aktif' && st.status === 'tidak aktif');
      const matchSearch =
        st.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        st.username.toLowerCase().includes(studentSearchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [students, studentStatusFilter, studentSearchQuery]);

  const studentTotalPages = Math.ceil(filteredStudents.length / studentsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (studentCurrentPage - 1) * studentsPerPage;
    return filteredStudents.slice(start, start + studentsPerPage);
  }, [filteredStudents, studentCurrentPage, studentsPerPage]);

  // Filter Bank Soal
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchExam =
        selectedExamFilter === 'Semua Paket' || q.exam_id === Number(selectedExamFilter);
      const matchMedia =
        questionMediaTypeFilter === 'Semua Media' || q.tipe_media === questionMediaTypeFilter;
      const qText = (q.pertanyaan || '').toLowerCase();
      const qOpsiA = (q.opsi_a || '').toLowerCase();
      const qOpsiB = (q.opsi_b || '').toLowerCase();
      const qSearch = questionSearchQuery.toLowerCase();
      const matchSearch =
        qText.includes(qSearch) ||
        qOpsiA.includes(qSearch) ||
        qOpsiB.includes(qSearch);
      return matchExam && matchMedia && matchSearch;
    });
  }, [questions, selectedExamFilter, questionMediaTypeFilter, questionSearchQuery]);

  const questionTotalPages = Math.ceil(filteredQuestions.length / questionsPerPage) || 1;
  const paginatedQuestions = useMemo(() => {
    const start = (questionCurrentPage - 1) * questionsPerPage;
    return filteredQuestions.slice(start, start + questionsPerPage);
  }, [filteredQuestions, questionCurrentPage, questionsPerPage]);

  // Helper: Status Dinamis Real-Time Jadwal Ujian
  const getDynamicStatus = (exam: CBTExam) => {
    if (exam.status === 'Draft') {
      return {
        text: 'Draft',
        color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        dotColor: 'bg-amber-500',
      };
    }

    const now = new Date();

    // Cek apakah ujian memiliki waktu_mulai dan waktu_selesai (atau hitung waktu selesai dari waktu_mulai + durasi jika waktu_selesai tidak ada di DB)
    if (exam.waktu_mulai) {
      const startTime = new Date(exam.waktu_mulai);
      let endTime: Date;

      if (exam.waktu_selesai) {
        endTime = new Date(exam.waktu_selesai);
      } else {
        const durasiMinutes = exam.durasi || 60;
        endTime = new Date(startTime.getTime() + durasiMinutes * 60 * 1000);
      }

      if (now > endTime) {
        return {
          text: 'Selesai',
          color: 'bg-gray-100 text-gray-600 border-gray-300',
          dotColor: 'bg-slate-400',
        };
      }

      if (now < startTime) {
        return {
          text: 'Terjadwal',
          color: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
          dotColor: 'bg-blue-500',
        };
      }

      if (now >= startTime && now <= endTime) {
        return {
          text: 'Aktif',
          color: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
          dotColor: 'bg-green-500 animate-pulse',
        };
      }
    }

    // JIKA ujian bebas (tidak ada waktu mulai/durasi): return status bawaan dari DB dengan warna hijau/aktif
    const isSelesai = exam.status === 'Selesai';
    return {
      text: exam.status || 'Aktif',
      color: isSelesai
        ? 'bg-gray-100 text-gray-600 border-gray-300'
        : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
      dotColor: isSelesai ? 'bg-slate-400' : 'bg-green-500 animate-pulse',
    };
  };

  // Filter Jadwal Ujian
  const filteredSchedules = useMemo(() => {
    return exams.filter((ex) => {
      const matchSearch =
        ex.mapel.toLowerCase().includes(scheduleSearchQuery.toLowerCase()) ||
        ex.kode_paket.toLowerCase().includes(scheduleSearchQuery.toLowerCase()) ||
        ex.token.toLowerCase().includes(scheduleSearchQuery.toLowerCase()) ||
        ex.kelas.toLowerCase().includes(scheduleSearchQuery.toLowerCase());
      const dynStatus = getDynamicStatus(ex);
      const matchStatus =
        scheduleStatusFilter === 'Semua Status' ||
        dynStatus.text === scheduleStatusFilter ||
        ex.status === scheduleStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [exams, scheduleSearchQuery, scheduleStatusFilter]);

  const navMenuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'data_siswa', label: isAdmin ? 'Data User' : 'Data Siswa', icon: Users },
    { key: 'bank_soal', label: 'Bank Soal', icon: Database },
    { key: 'jadwal_ujian', label: 'Jadwal Ujian', icon: Calendar },
    { key: 'live_monitor', label: 'Live Monitor', icon: Radio, badge: 'Live' },
    { key: 'koreksi_essay', label: 'Koreksi Essay', icon: FileEdit },
    { key: 'hasil_ujian', label: 'Hasil Ujian', icon: Award },
  ];

  return (
    <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-screen flex flex-col md:flex-row antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. DESKTOP FIXED SIDEBAR */}
      <aside className="hidden md:flex flex-col h-screen py-6 px-4 w-64 fixed left-0 top-0 bg-white border-r border-slate-200 shadow-sm z-40">
        <div className="flex items-center gap-3 px-2 mb-6">
          <img
            src="/logo.png"
            alt="Logo Academic Excellence Portal"
            className="w-10 h-10 object-contain rounded-md flex-shrink-0"
          />
          <div>
            <h1 className="text-sm font-bold text-[#00236f] leading-tight tracking-tight">
              Academic Excellence Portal
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {isAdmin ? 'Admin Portal & CBT' : 'Teacher Portal & CBT'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
          {navMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveMenu(item.key as TeacherMenuTab);
                  setIsMobileDrawerOpen(false);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer text-left ${
                  isActive
                    ? 'bg-blue-50 text-[#00236f] shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4.5 h-4.5 ${
                      isActive ? 'text-[#00236f]' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-[#00236f] text-white flex items-center justify-center text-xs font-bold">
              {teacherName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">{teacherName}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {isAdmin ? 'Administrator CBT' : 'Guru Pengawas CBT'}
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar (Logout)</span>
            </button>
          )}
        </div>
      </aside>

      {/* 2. MOBILE TOP NAVIGATION */}
      <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Logo Academic Excellence Portal"
            className="w-9 h-9 object-contain rounded-md"
          />
          <div>
            <div className="text-sm font-bold text-[#00236f]">Academic Excellence Portal</div>
            <div className="text-[10px] text-slate-400 capitalize">{activeMenu.replace('_', ' ')}</div>
          </div>
        </div>

        <button
          onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {isMobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="font-bold text-sm text-[#00236f]">Menu Pengawas CBT</span>
              <button onClick={() => setIsMobileDrawerOpen(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {navMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveMenu(item.key as TeacherMenuTab);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                      isActive
                        ? 'bg-blue-50 border-[#00236f] text-[#00236f]'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Profil & Tombol Logout Mobile Menu */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-[#00236f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {teacherName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{teacherName}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {isAdmin ? 'Administrator CBT' : 'Guru Pengawas CBT'}
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onLogout();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Keluar (Logout)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00236f] text-white px-4 py-3 rounded-2xl shadow-xl border border-blue-400/30 flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3. MAIN CONTENT WRAPPER */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              {activeMenu.replace('_', ' ')}
            </h2>
            <span className="text-xs text-slate-400 border-l border-slate-200 pl-3 font-medium">
              Cloud SQL PostgreSQL Integrated
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchStudents();
                fetchExamsAndQuestions();
                showToast('Data berhasil disinkronkan ulang dari Cloud SQL.');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Sinkronkan data dari Cloud SQL"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sinkronkan Data</span>
            </button>
          </div>
        </header>

        {/* Dynamic Views */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {/* =================================================================== */}
          {/* VIEW 1: MANAJEMEN DATA SISWA / DATA USER                          */}
          {/* =================================================================== */}
          {activeMenu === 'data_siswa' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {isAdmin ? 'Manajemen Data User' : 'Manajemen Data Siswa'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {isAdmin
                      ? 'Kelola data seluruh akun (Admin, Guru, Murid), hak akses, username, password, dan status aktif akun di database.'
                      : 'Kelola data profil, username, password, dan status aktif akun peserta ujian di Cloud SQL.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsAddStudentOpen(true)}
                    className="inline-flex items-center justify-center gap-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAdmin ? 'Tambah User Baru' : 'Tambah Siswa Baru'}</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cari nama atau username siswa..."
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setStudentCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00236f]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>

                  <select
                    value={studentStatusFilter}
                    onChange={(e) => {
                      setStudentStatusFilter(e.target.value);
                      setStudentCurrentPage(1);
                    }}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:border-[#00236f] focus:outline-none h-10"
                  >
                    <option>Semua Status</option>
                    <option>Aktif</option>
                    <option>Tidak Aktif</option>
                  </select>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan <strong className="text-slate-800">{paginatedStudents.length}</strong> dari{' '}
                  <strong className="text-slate-800">{filteredStudents.length}</strong> siswa
                </div>
              </div>

              {/* Student Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-4 px-6">ID & Username</th>
                        <th className="py-4 px-6">Nama Lengkap</th>
                        <th className="py-4 px-6">Role</th>
                        <th className="py-4 px-6">Status Akun</th>
                        <th className="py-4 px-6 text-right">Aksi & Soft Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                      {loadingStudents ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Memuat data siswa dari Cloud SQL PostgreSQL...
                          </td>
                        </tr>
                      ) : paginatedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Tidak ada data siswa yang cocok dengan filter pencarian.
                          </td>
                        </tr>
                      ) : (
                        paginatedStudents.map((st) => {
                          const isInactive = st.status === 'tidak aktif';
                          return (
                            <tr
                              key={st.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isInactive ? 'bg-slate-50/40 opacity-75' : ''
                              }`}
                            >
                              <td className="py-4 px-6">
                                <div className="font-mono font-semibold text-blue-700">
                                  @{st.username}
                                </div>
                                <div className="text-[11px] text-slate-400">ID: #{st.id}</div>
                              </td>

                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[#00236f] flex items-center justify-center text-xs font-bold border border-blue-200">
                                    {st.name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .join('')
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </div>
                                  <div>
                                    <div
                                      className={`font-semibold ${
                                        isInactive ? 'text-slate-500 line-through' : 'text-slate-900'
                                      }`}
                                    >
                                      {st.name}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {st.createdAt ? new Date(st.createdAt).toLocaleDateString('id-ID') : 'Tersimpan'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-6">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                                  {st.role}
                                </span>
                              </td>

                              <td className="py-4 px-6">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                    st.status === 'aktif'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {st.status === 'aktif' ? 'Aktif' : 'Tidak Aktif (Soft Deleted)'}
                                </span>
                              </td>

                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleOpenEditStudent(st)}
                                    className="p-1.5 text-slate-500 hover:text-[#00236f] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Data User (PUT /api/users/:id)"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>

                                  {/* Toggle Status / Soft Delete Button */}
                                  <button
                                    onClick={() => handleToggleStudentStatus(st)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      st.status === 'aktif'
                                        ? 'text-amber-600 hover:bg-amber-50'
                                        : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                    title={
                                      st.status === 'aktif'
                                        ? 'Soft Delete (Ubah status menjadi tidak aktif)'
                                        : 'Aktifkan Kembali Akun User'
                                    }
                                  >
                                    {st.status === 'aktif' ? (
                                      <UserX className="w-4 h-4" />
                                    ) : (
                                      <UserCheck className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/60 text-xs">
                  <button
                    onClick={() => setStudentCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={studentCurrentPage === 1}
                    className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="font-medium text-slate-600">
                    Halaman <strong>{studentCurrentPage}</strong> dari <strong>{studentTotalPages}</strong>
                  </div>

                  <button
                    onClick={() => setStudentCurrentPage((p) => Math.min(studentTotalPages, p + 1))}
                    disabled={studentCurrentPage >= studentTotalPages}
                    className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* VIEW 2: BANK SOAL (Cloud SQL Questions Table CRUD + Media Preview) */}
          {/* =================================================================== */}
          {activeMenu === 'bank_soal' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Bank Soal Ujian CBT
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Kelola paket soal mandiri, butir soal pilihan ganda, kunci jawaban, dan media pendukung.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => {
                      setNewPackageCode(`PKT-${Date.now().toString().slice(-4)}`);
                      setNewPackageSubject('');
                      setNewPackageClass('Semua Kelas');
                      setIsAddPackageOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#00236f] border border-blue-200 font-semibold text-xs sm:text-sm h-11 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 text-[#00236f]" />
                    <span>Buat Paket Ujian Baru</span>
                  </button>

                  <button
                    onClick={() => {
                      if (exams.length === 0) {
                        setNewPackageCode(`PKT-${Date.now().toString().slice(-4)}`);
                        setNewPackageSubject('');
                        setNewPackageClass('Semua Kelas');
                        setIsAddPackageOpen(true);
                        showToast('Silakan buat paket soal terlebih dahulu sebelum menambah butir soal.');
                        return;
                      }
                      resetQuestionForm();
                      setQuestionExamId(selectedExamFilter !== 'Semua Paket' ? Number(selectedExamFilter) : exams[0].id);
                      setIsAddQuestionOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Butir Soal Baru</span>
                  </button>
                </div>
              </div>

              {/* Banner jika belum ada paket */}
              {exams.length === 0 && !loadingQuestions && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FolderPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Belum Ada Paket Ujian Terdaftar</h4>
                      <p className="text-[11px] text-amber-700">
                        Buat paket soal mandiri terlebih dahulu untuk mulai mengelompokkan butir-butir soal CBT.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setNewPackageCode(`PKT-${Date.now().toString().slice(-4)}`);
                      setNewPackageSubject('');
                      setNewPackageClass('Semua Kelas');
                      setIsAddPackageOpen(true);
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex-shrink-0"
                  >
                    + Buat Paket Sekarang
                  </button>
                </div>
              )}

              {/* Filters Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cari teks soal atau opsi jawaban..."
                      value={questionSearchQuery}
                      onChange={(e) => {
                        setQuestionSearchQuery(e.target.value);
                        setQuestionCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00236f]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>

                  {/* Filter Paket Ujian */}
                  <select
                    value={selectedExamFilter}
                    onChange={(e) => {
                      setSelectedExamFilter(e.target.value);
                      setQuestionCurrentPage(1);
                    }}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:border-[#00236f] focus:outline-none h-10"
                  >
                    <option>Semua Paket</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        [{ex.kode_paket}] {ex.mapel}
                      </option>
                    ))}
                  </select>

                  {/* Filter Tipe Media */}
                  <select
                    value={questionMediaTypeFilter}
                    onChange={(e) => {
                      setQuestionMediaTypeFilter(e.target.value);
                      setQuestionCurrentPage(1);
                    }}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:border-[#00236f] focus:outline-none h-10"
                  >
                    <option>Semua Media</option>
                    <option>Teks</option>
                    <option>Image</option>
                    <option>Video</option>
                    <option>Audio</option>
                  </select>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan <strong className="text-slate-800">{paginatedQuestions.length}</strong> dari{' '}
                  <strong className="text-slate-800">{filteredQuestions.length}</strong> butir soal
                </div>
              </div>

              {/* Questions Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-4 px-5">ID & Paket</th>
                        <th className="py-4 px-5">Media</th>
                        <th className="py-4 px-5">Pertanyaan & Opsi</th>
                        <th className="py-4 px-5">Kunci & Bobot</th>
                        <th className="py-4 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {loadingQuestions ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Memuat daftar butir soal dari Cloud SQL PostgreSQL...
                          </td>
                        </tr>
                      ) : paginatedQuestions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Belum ada butir soal yang sesuai dengan kriteria filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedQuestions.map((q) => {
                          const examMatch = exams.find((e) => e.id === q.exam_id);
                          return (
                            <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-4 px-5">
                                <div className="font-bold text-[#00236f]">Soal #{q.id}</div>
                                <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                  {examMatch
                                    ? `[${examMatch.kode_paket}] ${examMatch.mapel}`
                                    : (q as any).kode_paket
                                    ? `[${(q as any).kode_paket}] Paket #${q.exam_id}`
                                    : `Paket #${q.exam_id}`}
                                </div>
                              </td>

                              <td className="py-4 px-5">
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                      q.question_type === 'essay' || q.kunci?.toLowerCase() === 'essay'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>{q.question_type === 'essay' || q.kunci?.toLowerCase() === 'essay' ? 'Essay' : 'PG'}</span>
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                        q.tipe_media === 'Image'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : q.tipe_media === 'Video'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : q.tipe_media === 'Audio'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      {q.tipe_media === 'Image' && <ImageIcon className="w-3 h-3" />}
                                      {q.tipe_media === 'Video' && <VideoIcon className="w-3 h-3" />}
                                      {q.tipe_media === 'Audio' && <Music className="w-3 h-3" />}
                                      {q.tipe_media === 'Teks' && <FileText className="w-3 h-3" />}
                                      <span>{q.tipe_media}</span>
                                    </span>

                                    {q.link_media && (
                                      <button
                                        onClick={() =>
                                          setPreviewMedia({
                                            type: q.tipe_media,
                                            url: q.link_media!,
                                            title: `Soal #${q.id}: ${q.pertanyaan.substring(0, 30)}...`,
                                          })
                                        }
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                        title="Preview Media"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-5 max-w-[320px]">
                                <div className="font-medium text-slate-900 leading-snug line-clamp-2">
                                  {q.pertanyaan}
                                </div>
                                {q.question_type === 'essay' || q.kunci?.toLowerCase() === 'essay' ? (
                                  <div className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                                    <span>📝 Soal Essay (Isian teks siswa & penilaian guru)</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-1">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">A: {(q.opsi_a || '').substring(0, 15)}...</span>
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">B: {(q.opsi_b || '').substring(0, 15)}...</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-4 px-5">
                                <div className="flex items-center gap-2">
                                  {q.question_type === 'essay' || q.kunci?.toLowerCase() === 'essay' ? (
                                    <span className="px-2 py-1 rounded-lg bg-amber-500 text-white font-bold text-[10px] tracking-wide shadow-xs">
                                      ESSAY
                                    </span>
                                  ) : (
                                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                                      {q.kunci}
                                    </span>
                                  )}
                                  <div className="text-[11px] text-slate-500">
                                    Bobot: <strong className="text-slate-800">{q.bobot_poin} Poin</strong>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditQuestion(q)}
                                    className="p-1.5 text-slate-500 hover:text-[#00236f] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Soal (PUT /api/questions/:id)"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteQuestion(q)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Hapus Soal (DELETE /api/questions/:id)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/60 text-xs">
                  <button
                    onClick={() => setQuestionCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={questionCurrentPage === 1}
                    className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="font-medium text-slate-600">
                    Halaman <strong>{questionCurrentPage}</strong> dari <strong>{questionTotalPages}</strong>
                  </div>

                  <button
                    onClick={() => setQuestionCurrentPage((p) => Math.min(questionTotalPages, p + 1))}
                    disabled={questionCurrentPage >= questionTotalPages}
                    className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* VIEW 3: LIVE MONITOR PROCTORING (<TeacherDashboard />)               */}
          {/* =================================================================== */}
          {activeMenu === 'live_monitor' && (
            <div className="animate-in fade-in duration-200">
              <TeacherDashboard />
            </div>
          )}

          {/* =================================================================== */}
          {/* VIEW 4: DASHBOARD OVERVIEW                                          */}
          {/* =================================================================== */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#00236f]">
                    Selamat Datang, {teacherName}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Ringkasan performa dan agenda pelaksanaan Computer Based Test (CBT).
                  </p>
                </div>

                <button
                  onClick={() => setActiveMenu('live_monitor')}
                  className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>Buka Live Monitor</span>
                </button>
              </div>

              {/* Bento Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Total Siswa Terdaftar
                  </div>
                  <div className="text-3xl font-extrabold text-[#00236f] font-mono">
                    {students.length}
                  </div>
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    ● Terhubung ke Cloud SQL
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Paket Ujian
                  </div>
                  <div className="text-3xl font-extrabold text-blue-700 font-mono">
                    {exams.length} Paket
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    Tersedia di Bank Soal
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Total Butir Soal
                  </div>
                  <div className="text-3xl font-extrabold text-indigo-600 font-mono">
                    {questions.length} Soal
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    Termasuk Media Gambar/Video
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Anti-Cheat Guard
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-600 font-mono">
                    Aktif
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                    Batas 3x Force Submit
                  </p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveMenu('data_siswa')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-900">Kelola Data Siswa</h3>
                    <p className="text-[11px] text-slate-500">
                      Kelola peserta & akun ujian (Soft Delete).
                    </p>
                  </div>
                  <Users className="w-7 h-7 text-[#00236f] shrink-0 ml-2" />
                </div>

                <div
                  onClick={() => setActiveMenu('bank_soal')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-900">Bank Soal CBT</h3>
                    <p className="text-[11px] text-slate-500">
                      Input butir soal PG/Essay & media.
                    </p>
                  </div>
                  <Database className="w-7 h-7 text-indigo-600 shrink-0 ml-2" />
                </div>

                <div
                  onClick={() => setActiveMenu('koreksi_essay')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-900">Koreksi Essay</h3>
                    <p className="text-[11px] text-slate-500">
                      Input skor manual & auto-kalkulasi total.
                    </p>
                  </div>
                  <FileEdit className="w-7 h-7 text-amber-600 shrink-0 ml-2" />
                </div>

                <div
                  onClick={() => setActiveMenu('hasil_ujian')}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-900">Rekap Hasil Ujian</h3>
                    <p className="text-[11px] text-slate-500">
                      Tabel nilai PG, Essay, & Total Nilai.
                    </p>
                  </div>
                  <Award className="w-7 h-7 text-emerald-600 shrink-0 ml-2" />
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* VIEW 5: KOREKSI ESSAY                                               */}
          {/* =================================================================== */}
          {activeMenu === 'koreksi_essay' && (
            <TeacherEssayGrading
              onNavigateToResults={() => setActiveMenu('hasil_ujian')}
            />
          )}

          {/* =================================================================== */}
          {/* VIEW 6: HASIL UJIAN (REKAP NILAI SISWA)                             */}
          {/* =================================================================== */}
          {activeMenu === 'hasil_ujian' && (
            <TeacherExamResults
              onNavigateToGrading={() => setActiveMenu('koreksi_essay')}
            />
          )}

          {/* =================================================================== */}
          {/* VIEW 4: JADWAL UJIAN (CRUD MANAJEMEN JADWAL & TOKEN UJIAN)          */}
          {/* =================================================================== */}
          {activeMenu === 'jadwal_ujian' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Manajemen Jadwal Ujian
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Atur jadwal pelaksanaan ujian CBT, rilis token ujian, dan tentukan durasi serta paket soal.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleOpenAddSchedule}
                    className="inline-flex items-center justify-center gap-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Jadwal Ujian Baru</span>
                  </button>
                </div>
              </div>

              {/* Filters Bar Jadwal */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cari nama ujian, mapel, kelas, atau token..."
                      value={scheduleSearchQuery}
                      onChange={(e) => setScheduleSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#00236f]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>

                  {/* Filter Status Jadwal */}
                  <select
                    value={scheduleStatusFilter}
                    onChange={(e) => setScheduleStatusFilter(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:border-[#00236f] focus:outline-none h-10"
                  >
                    <option>Semua Status</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Draft">Draft</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Total <strong className="text-slate-800">{filteredSchedules.length}</strong> jadwal ujian
                </div>
              </div>

              {/* Schedules Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[780px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-4 px-5">Nama Ujian & Kelas</th>
                        <th className="py-4 px-5">Paket Soal</th>
                        <th className="py-4 px-5">Waktu & Durasi</th>
                        <th className="py-4 px-5">Token Ujian</th>
                        <th className="py-4 px-5">Status</th>
                        <th className="py-4 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {loadingQuestions ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Memuat daftar jadwal ujian...
                          </td>
                        </tr>
                      ) : filteredSchedules.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Belum ada jadwal ujian yang ditemukan.{' '}
                            <button
                              onClick={handleOpenAddSchedule}
                              className="text-[#00236f] underline font-semibold hover:text-blue-800 ml-1"
                            >
                              Buat Jadwal Baru
                            </button>
                          </td>
                        </tr>
                      ) : (
                        filteredSchedules.map((ex) => {
                          const questionCount = questions.filter((q) => q.exam_id === ex.id).length;
                          return (
                            <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Nama Ujian & Kelas */}
                              <td className="py-4 px-5">
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                  <span>{ex.mapel}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                                    {ex.kelas || 'Semua Kelas'}
                                  </span>
                                  <span>ID #{ex.id}</span>
                                </div>
                              </td>

                              {/* Paket Soal */}
                              <td className="py-4 px-5">
                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                                  <span>[{ex.kode_paket}]</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {questionCount > 0 ? `${questionCount} Butir Soal Terpasang` : '0 Butir Soal'}
                                </div>
                              </td>

                              {/* Waktu & Durasi */}
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{ex.durasi || 60} Menit</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {ex.waktu_mulai
                                    ? new Date(ex.waktu_mulai).toLocaleString('id-ID', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      })
                                    : 'Bebas / Langsung Mulai'}
                                </div>
                              </td>

                              {/* Token Ujian */}
                              <td className="py-4 px-5">
                                <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg">
                                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                                  <span className="font-mono font-bold text-amber-900 text-xs tracking-wider">
                                    {ex.token || '-'}
                                  </span>
                                  {ex.token && (
                                    <button
                                      onClick={() => handleCopyToken(ex.token)}
                                      title="Salin Token"
                                      className="p-0.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRegenerateToken(ex)}
                                    title="Generate Token Baru"
                                    className="p-0.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-5">
                                {(() => {
                                  const dynStatus = getDynamicStatus(ex);
                                  return (
                                    <button
                                      onClick={() => handleToggleScheduleStatus(ex)}
                                      title="Klik untuk mengubah status"
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${dynStatus.color}`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${dynStatus.dotColor}`}
                                      />
                                      <span>{dynStatus.text}</span>
                                    </button>
                                  );
                                })()}
                              </td>

                              {/* Aksi */}
                              <td className="py-4 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditSchedule(ex)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Jadwal Ujian"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSchedule(ex)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Hapus Jadwal Ujian"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* VIEW 7: PLACEHOLDER TABS (Settings)                                 */}
          {/* =================================================================== */}
          {activeMenu === 'settings' && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center space-y-4 max-w-2xl mx-auto my-6">
              <div className="w-14 h-14 bg-blue-50 text-[#00236f] rounded-2xl flex items-center justify-center mx-auto">
                <Settings className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 capitalize">
                Pengaturan Sistem CBT
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Pengaturan umum aplikasi CBT, konfigurasi koneksi Cloud SQL PostgreSQL, dan preferensi evaluasi otomatis.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH SISWA / USER (POST /api/users)                             */}
      {/* ========================================================================= */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#00236f]">
                {isAdmin ? 'Tambah Data User' : 'Tambah Data Siswa (Role: Murid)'}
              </h3>
              <button
                onClick={() => setIsAddStudentOpen(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Username Login</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: user_baru"
                  value={newStudentUsername}
                  onChange={(e) => setNewStudentUsername(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Prasetyo"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role / Peran Pengguna</label>
                  <select
                    value={newStudentRole}
                    onChange={(e) => setNewStudentRole(e.target.value as any)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium capitalize"
                  >
                    <option value="murid">Murid (Peserta Ujian)</option>
                    <option value="guru">Guru (Pembuat Soal & Pengawas)</option>
                    <option value="admin">Admin (Administrator Sistem)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password Awal</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: user123"
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Password akan otomatis di-hash dengan bcrypt di server database.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00236f] text-white rounded-xl font-semibold hover:bg-[#1e3a8a] transition-colors"
                >
                  {isAdmin ? 'Simpan User ke Database' : 'Simpan Siswa ke Cloud SQL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT SISWA / USER (PUT /api/users/:id)                             */}
      {/* ========================================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#00236f]">
                {isAdmin ? `Edit Data User #${editingStudent.id}` : `Edit Data Siswa #${editingStudent.id}`}
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStudentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editStudentUsername}
                  onChange={(e) => setEditStudentUsername(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none"
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role / Peran Pengguna</label>
                  <select
                    value={editStudentRole}
                    onChange={(e) => setEditStudentRole(e.target.value as any)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium capitalize"
                  >
                    <option value="murid">Murid (Peserta Ujian)</option>
                    <option value="guru">Guru (Pembuat Soal & Pengawas)</option>
                    <option value="admin">Admin (Administrator Sistem)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status Akun</label>
                <select
                  value={editStudentStatus}
                  onChange={(e) => setEditStudentStatus(e.target.value as any)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                >
                  <option value="aktif">Aktif</option>
                  <option value="tidak aktif">Tidak Aktif (Soft Deleted)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ganti Password (Opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  value={editStudentPassword}
                  onChange={(e) => setEditStudentPassword(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00236f] text-white rounded-xl font-semibold hover:bg-[#1e3a8a] transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUAT PAKET UJIAN / SOAL BARU (POST /api/exams)                     */}
      {/* ========================================================================= */}
      {isAddPackageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00236f] flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#00236f]">Buat Paket Soal Baru</h3>
              </div>
              <button
                onClick={() => setIsAddPackageOpen(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPackageSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kode Paket Soal</label>
                <input
                  type="text"
                  required
                  placeholder="cth: PKT-MTK-01, PKT-IPA-X"
                  value={newPackageCode}
                  onChange={(e) => setNewPackageCode(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-mono uppercase"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Kode unik identitas kumpulan soal di Bank Soal.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  placeholder="cth: Matematika Wajib, Bahasa Indonesia, Fisika"
                  value={newPackageSubject}
                  onChange={(e) => setNewPackageSubject(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Tingkat / Kelas</label>
                <select
                  value={newPackageClass}
                  onChange={(e) => setNewPackageClass(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                >
                  <option value="Semua Kelas">Semua Kelas</option>
                  <option value="Kelas 10">Kelas 10</option>
                  <option value="Kelas 11">Kelas 11</option>
                  <option value="Kelas 12">Kelas 12</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPackageOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00236f] text-white rounded-xl font-semibold hover:bg-[#1e3a8a] transition-colors"
                >
                  Simpan Paket Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUAT JADWAL UJIAN BARU (POST /api/exams)                           */}
      {/* ========================================================================= */}
      {isAddScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00236f] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#00236f]">Buat Jadwal Ujian Baru</h3>
              </div>
              <button
                onClick={() => setIsAddScheduleOpen(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddScheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Ujian / Agenda</label>
                <input
                  type="text"
                  required
                  placeholder="cth: Penilaian Tengah Semester - Matematika Dasar"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Pilih Paket Soal (Bank Soal)</label>
                {exams.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
                    <p className="text-[11px]">
                      Belum ada paket soal terdaftar. Buat paket soal terlebih dahulu di Bank Soal.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddScheduleOpen(false);
                        setNewPackageCode(`PKT-${Date.now().toString().slice(-4)}`);
                        setNewPackageSubject('');
                        setNewPackageClass('Semua Kelas');
                        setIsAddPackageOpen(true);
                      }}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
                    >
                      + Buat Paket Soal Sekarang
                    </button>
                  </div>
                ) : (
                  <select
                    required
                    value={scheduleSourcePackageId}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setScheduleSourcePackageId(val);
                      const found = exams.find((x) => x.id === val);
                      if (found && !scheduleName) {
                        setScheduleName(`Ujian ${found.mapel}`);
                      }
                      if (found) {
                        setScheduleClass(found.kelas);
                      }
                    }}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        [{ex.kode_paket}] {ex.mapel} ({ex.kelas})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Waktu Mulai Pelaksanaan</label>
                  <input
                    type="datetime-local"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Kosongkan jika fleksibel.</p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Durasi Ujian (Menit)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={5}
                      max={300}
                      value={scheduleDuration}
                      onChange={(e) => setScheduleDuration(Number(e.target.value))}
                      className="w-full h-10 pl-3 pr-12 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-medium"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 font-medium">Menit</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Token Ujian Masuk</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="6 Karakter"
                      value={scheduleToken}
                      onChange={(e) => setScheduleToken(e.target.value.toUpperCase())}
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-mono uppercase font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setScheduleToken(generateRandomToken())}
                      title="Generate Acak"
                      className="px-2.5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1 flex-shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Kelas</label>
                  <select
                    value={scheduleClass}
                    onChange={(e) => setScheduleClass(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    <option value="Kelas 10">Kelas 10</option>
                    <option value="Kelas 11">Kelas 11</option>
                    <option value="Kelas 12">Kelas 12</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status Awal</label>
                <select
                  value={scheduleStatus}
                  onChange={(e) => setScheduleStatus(e.target.value as any)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                >
                  <option value="Aktif">Aktif (Langsung Bisa Diakses Siswa)</option>
                  <option value="Draft">Draft (Disimpan Sementara)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddScheduleOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={exams.length === 0}
                  className="px-4 py-2 bg-[#00236f] text-white rounded-xl font-semibold hover:bg-[#1e3a8a] disabled:opacity-50 transition-colors"
                >
                  Rilis Jadwal Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT JADWAL UJIAN (PUT /api/exams/:id)                              */}
      {/* ========================================================================= */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00236f] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#00236f]">
                  Edit Jadwal: {editingSchedule.mapel}
                </h3>
              </div>
              <button
                onClick={() => setEditingSchedule(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditScheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Ujian / Agenda</label>
                <input
                  type="text"
                  required
                  value={editScheduleName}
                  onChange={(e) => setEditScheduleName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Waktu Mulai Pelaksanaan</label>
                  <input
                    type="datetime-local"
                    value={editScheduleStartTime}
                    onChange={(e) => setEditScheduleStartTime(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Durasi Ujian (Menit)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={5}
                      max={300}
                      value={editScheduleDuration}
                      onChange={(e) => setEditScheduleDuration(Number(e.target.value))}
                      className="w-full h-10 pl-3 pr-12 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-medium"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 font-medium">Menit</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Token Ujian Masuk</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={editScheduleToken}
                      onChange={(e) => setEditScheduleToken(e.target.value.toUpperCase())}
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none font-mono uppercase font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setEditScheduleToken(generateRandomToken())}
                      title="Generate Acak"
                      className="px-2.5 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1 flex-shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Kelas</label>
                  <select
                    value={editScheduleClass}
                    onChange={(e) => setEditScheduleClass(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    <option value="Kelas 10">Kelas 10</option>
                    <option value="Kelas 11">Kelas 11</option>
                    <option value="Kelas 12">Kelas 12</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status Ujian</label>
                <select
                  value={editScheduleStatus}
                  onChange={(e) => setEditScheduleStatus(e.target.value as any)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Draft">Draft</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00236f] text-white rounded-xl font-semibold hover:bg-[#1e3a8a] transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT BUTIR SOAL (POST / PUT /api/questions)               */}
      {/* ========================================================================= */}
      {(isAddQuestionOpen || editingQuestion) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#00236f]">
                {editingQuestion ? `Edit Butir Soal #${editingQuestion.id}` : 'Tambah Butir Soal Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsAddQuestionOpen(false);
                  setEditingQuestion(null);
                  resetQuestionForm();
                }}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingQuestion ? handleEditQuestionSubmit : handleAddQuestionSubmit}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Paket Ujian</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPackageCode(`PKT-${Date.now().toString().slice(-4)}`);
                        setNewPackageSubject('');
                        setNewPackageClass('Semua Kelas');
                        setIsAddPackageOpen(true);
                      }}
                      className="text-[#00236f] hover:underline font-semibold text-[11px]"
                    >
                      + Paket Baru
                    </button>
                  </div>
                  {exams.length === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                      <p className="text-[11px] mb-1 font-medium">Belum ada paket soal terdaftar.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewPackageCode(`PKT-${Date.now().toString().slice(-4)}`);
                          setNewPackageSubject('');
                          setNewPackageClass('Semua Kelas');
                          setIsAddPackageOpen(true);
                        }}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 text-[11px]"
                      >
                        + Buat Paket Sekarang
                      </button>
                    </div>
                  ) : (
                    <select
                      required
                      value={questionExamId}
                      onChange={(e) => setQuestionExamId(Number(e.target.value))}
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          [{ex.kode_paket}] {ex.mapel} ({ex.kelas})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tipe Soal</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as 'pilihan_ganda' | 'essay')}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-semibold text-[#00236f]"
                  >
                    <option value="pilihan_ganda">Pilihan Ganda (PG)</option>
                    <option value="essay">Essay / Uraian</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tipe Media Pendukung</label>
                  <select
                    value={questionMediaType}
                    onChange={(e) => setQuestionMediaType(e.target.value as any)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-medium"
                  >
                    <option value="Teks">Teks Biasa (Tanpa Media)</option>
                    <option value="Image">Gambar (Image URL)</option>
                    <option value="Video">Video (Video / YouTube URL)</option>
                    <option value="Audio">Audio (Audio URL)</option>
                  </select>
                </div>
              </div>

              {/* Link Media (Gambar / Video / Audio) */}
              {questionMediaType !== 'Teks' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-700 block">
                    Link Media ({questionMediaType})
                  </label>
                  <input
                    type="url"
                    placeholder={`Masukkan URL ${questionMediaType} (cth: https://images.unsplash.com/... atau https://youtu.be/...)`}
                    value={questionMediaLink}
                    onChange={(e) => setQuestionMediaLink(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-mono text-[11px]"
                  />
                  {questionMediaLink.trim() && questionMediaType === 'Image' && (
                    <div className="mt-2 flex justify-center p-2 bg-white border border-slate-200 rounded-lg">
                      <img
                        src={questionMediaLink}
                        alt="Preview"
                        className="max-h-32 object-contain rounded"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Pertanyaan */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Isi Teks Pertanyaan</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tuliskan butir soal atau studi kasus di sini..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:border-[#00236f] focus:outline-none leading-relaxed"
                />
              </div>

              {/* CONDITIONAL RENDERING: Pilihan Ganda vs Essay */}
              {questionType === 'pilihan_ganda' ? (
                <>
                  {/* Opsi Pilihan Ganda */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 block">Pilihan Jawaban (A - E)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-300 font-bold flex items-center justify-center flex-shrink-0">
                          A
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Teks opsi A"
                          value={optionA}
                          onChange={(e) => setOptionA(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-300 rounded-lg focus:border-[#00236f] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-300 font-bold flex items-center justify-center flex-shrink-0">
                          B
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Teks opsi B"
                          value={optionB}
                          onChange={(e) => setOptionB(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-300 rounded-lg focus:border-[#00236f] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-300 font-bold flex items-center justify-center flex-shrink-0">
                          C
                        </span>
                        <input
                          type="text"
                          placeholder="Teks opsi C"
                          value={optionC}
                          onChange={(e) => setOptionC(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-300 rounded-lg focus:border-[#00236f] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-300 font-bold flex items-center justify-center flex-shrink-0">
                          D
                        </span>
                        <input
                          type="text"
                          placeholder="Teks opsi D"
                          value={optionD}
                          onChange={(e) => setOptionD(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-300 rounded-lg focus:border-[#00236f] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 sm:col-span-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-300 font-bold flex items-center justify-center flex-shrink-0">
                          E
                        </span>
                        <input
                          type="text"
                          placeholder="Teks opsi E (Opsional)"
                          value={optionE}
                          onChange={(e) => setOptionE(e.target.value)}
                          className="w-full h-9 px-2.5 border border-slate-300 rounded-lg focus:border-[#00236f] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kunci Jawaban & Bobot Poin */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <div>
                      <label className="font-bold text-[#00236f] block mb-1">Kunci Jawaban Benar</label>
                      <select
                        value={answerKey}
                        onChange={(e) => setAnswerKey(e.target.value as any)}
                        className="w-full h-10 px-3 border border-blue-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-bold text-slate-800"
                      >
                        <option value="A">Opsi A</option>
                        <option value="B">Opsi B</option>
                        <option value="C">Opsi C</option>
                        <option value="D">Opsi D</option>
                        <option value="E">Opsi E</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-[#00236f] block mb-1">Bobot Poin Soal</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={questionScore}
                        onChange={(e) => setQuestionScore(Number(e.target.value))}
                        className="w-full h-10 px-3 border border-blue-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Essay Info Banner & Bobot Poin */}
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <FileText className="w-4 h-4 text-amber-700" />
                      <span>Format Soal Essay / Uraian Bebas</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Pada tipe soal Essay, opsi pilihan jawaban (A–E) dan kunci otomatis ditiadakan. Siswa akan menjawab melalui kolom isian textarea, dan penilaian/skor akan diperiksa oleh Guru pada menu <strong>Koreksi Essay</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <label className="font-bold text-[#00236f] block mb-1">Bobot Poin Maksimal Essay</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={questionScore}
                      onChange={(e) => setQuestionScore(Number(e.target.value))}
                      className="w-full h-10 px-3 border border-blue-300 rounded-xl focus:border-[#00236f] focus:outline-none bg-white font-mono font-bold text-slate-800"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Poin maksimal yang dapat diberikan guru saat mengoreksi jawaban essay siswa.
                    </p>
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddQuestionOpen(false);
                    setEditingQuestion(null);
                    resetQuestionForm();
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00236f] text-white rounded-xl font-semibold hover:bg-[#1e3a8a] transition-colors"
                >
                  {editingQuestion ? 'Perbarui Soal ke Cloud SQL' : 'Simpan Soal ke Cloud SQL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW MEDIA (Gambar / Video / Audio)                             */}
      {/* ========================================================================= */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-[#00236f] truncate">{previewMedia.title}</h4>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-center min-h-[180px]">
              {previewMedia.type === 'Image' && (
                <img
                  src={previewMedia.url}
                  alt="Media Soal"
                  className="max-h-72 object-contain rounded-lg border border-slate-200"
                />
              )}
              {previewMedia.type === 'Video' && (
                <div className="w-full text-center space-y-2">
                  <VideoIcon className="w-10 h-10 text-slate-400 mx-auto" />
                  <a
                    href={previewMedia.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold underline"
                  >
                    <span>Buka Tautan Video</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
              {previewMedia.type === 'Audio' && (
                <audio controls src={previewMedia.url} className="w-full">
                  Browser Anda tidak mendukung elemen audio.
                </audio>
              )}
            </div>

            <button
              onClick={() => setPreviewMedia(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
