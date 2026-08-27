import bcrypt from 'bcryptjs';

export interface MemUser {
  id: number;
  uid: string | null;
  username: string;
  name: string;
  password: string;
  role: 'murid' | 'guru' | 'admin';
  status: 'aktif' | 'tidak aktif';
  createdAt: Date;
}

export interface MemExam {
  id: number;
  kode_paket: string;
  mapel: string;
  kelas: string;
  waktu_mulai: Date | null;
  waktu_selesai: Date | null;
  durasi: number;
  token: string;
  status: 'Aktif' | 'Draft' | 'Selesai';
  tipe_penilaian: string;
  createdAt: Date;
}

export interface MemQuestion {
  id: number;
  exam_id: number;
  guru_id: number | null;
  question_type: 'pilihan_ganda' | 'essay';
  tipe_media: 'Teks' | 'Image' | 'Audio' | 'Video';
  link_media: string | null;
  pertanyaan: string;
  opsi_a?: string | null;
  opsi_b?: string | null;
  opsi_c?: string | null;
  opsi_d?: string | null;
  opsi_e?: string | null;
  kunci?: string | null;
  bobot_poin: number;
  createdAt: Date;
}

export interface MemExamSession {
  id: number;
  exam_id: number;
  user_id: number;
  waktu_mulai_siswa: Date;
  waktu_submit: Date | null;
  terakhir_aktif: Date;
  status_pengerjaan: 'Sedang Mengerjakan' | 'Selesai' | 'Force Submit';
  jml_pelanggaran: number;
  detail_pelanggaran: string | null;
  benar_pg: number | null;
  salah_pg: number | null;
  kosong_pg: number | null;
  nilai_pg: number | null;
  total_nilai: number | null;
  createdAt: Date;
}

export interface MemStudentAnswer {
  id: number;
  session_id: number;
  question_id: number;
  jawaban_siswa: string;
  is_correct: boolean | null;
  skor_guru: number | null;
  waktu_jawab: Date;
  createdAt: Date;
}

export class InMemoryCbtStore {
  users: MemUser[] = [];
  exams: MemExam[] = [];
  questions: MemQuestion[] = [];
  sessions: MemExamSession[] = [];
  answers: MemStudentAnswer[] = [];

  private nextUserId = 1;
  private nextExamId = 1;
  private nextQuestionId = 1;
  private nextSessionId = 1;
  private nextAnswerId = 1;
  private initialized = false;

  constructor() {
    this.initDemoData();
  }

  async initDemoData() {
    if (this.initialized) return;
    this.initialized = true;

    this.users = [];
    this.exams = [];
    this.questions = [];
    this.sessions = [];
    this.answers = [];

    const adminPass = await bcrypt.hash('admin123', 10);
    const guruPass = await bcrypt.hash('guru123', 10);
    const muridPass = await bcrypt.hash('murid123', 10);

    const admin: MemUser = {
      id: this.nextUserId++,
      uid: null,
      username: 'admin_cbt',
      name: 'Administrator CBT',
      password: adminPass,
      role: 'admin',
      status: 'aktif',
      createdAt: new Date(),
    };

    const guru: MemUser = {
      id: this.nextUserId++,
      uid: null,
      username: 'guru_cbt',
      name: 'Drs. H. Mulyadi, M.Pd.',
      password: guruPass,
      role: 'guru',
      status: 'aktif',
      createdAt: new Date(),
    };

    this.users.push(admin, guru);

    const exam: MemExam = {
      id: this.nextExamId++,
      kode_paket: 'CBT-MAT-2026-X',
      mapel: 'Matematika Terapan & Logika Komputasi',
      kelas: 'X-RPL',
      waktu_mulai: null,
      waktu_selesai: null,
      durasi: 60,
      token: 'CBT26',
      status: 'Aktif',
      tipe_penilaian: 'Otomatis',
      createdAt: new Date(),
    };
    this.exams.push(exam);

    const q1: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: exam.id,
      guru_id: guru.id,
      question_type: 'pilihan_ganda',
      tipe_media: 'Teks',
      link_media: null,
      pertanyaan: 'Manakah dari berikut ini yang merupakan sifat dasar dari Relational Database Management System (RDBMS)?',
      opsi_a: 'Menyimpan data tanpa skema terdefinisi (NoSQL)',
      opsi_b: 'Mendukung integritas referensial antar tabel menggunakan Foreign Key',
      opsi_c: 'Hanya dapat diakses melalui satu thread proses saja',
      opsi_d: 'Tidak mendukung transaksi ACID',
      opsi_e: 'Data hanya tersimpan di memori RAM tanpa persistensi disk',
      kunci: 'B',
      bobot_poin: 20,
      createdAt: new Date(),
    };

    const q2: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: exam.id,
      guru_id: guru.id,
      question_type: 'pilihan_ganda',
      tipe_media: 'Teks',
      link_media: null,
      pertanyaan: 'Dalam basis data PostgreSQL, klausa SQL apa yang digunakan untuk memastikan nilai kolom unik di seluruh baris tabel?',
      opsi_a: 'CHECK',
      opsi_b: 'FOREIGN KEY',
      opsi_c: 'UNIQUE',
      opsi_d: 'CASCADE',
      opsi_e: 'INDEX ONLY',
      kunci: 'C',
      bobot_poin: 20,
      createdAt: new Date(),
    };

    const q3: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: exam.id,
      guru_id: guru.id,
      question_type: 'pilihan_ganda',
      tipe_media: 'Teks',
      link_media: null,
      pertanyaan: 'Jika sebuah transaksi database memenuhi aturan ACID, huruf "I" dalam akronim tersebut merepresentasikan:',
      opsi_a: 'Integrity',
      opsi_b: 'Indexation',
      opsi_c: 'Isolation',
      opsi_d: 'Iteration',
      opsi_e: 'Inheritance',
      kunci: 'C',
      bobot_poin: 20,
      createdAt: new Date(),
    };

    const q4: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: exam.id,
      guru_id: guru.id,
      question_type: 'pilihan_ganda',
      tipe_media: 'Teks',
      link_media: null,
      pertanyaan: 'Pada sistem Computer Based Test (CBT), apa fungsi dari kolom "token" pada tabel Exams?',
      opsi_a: 'Menyimpan password akun guru pengawas',
      opsi_b: 'Kunci otentikasi unik yang harus dimasukkan siswa sebelum memulai sesi ujian',
      opsi_c: 'Enkripsi kunci jawaban seluruh soal',
      opsi_d: 'ID unik transaksi pembayaran ujian',
      opsi_e: 'Alamat IP server Cloud SQL',
      kunci: 'B',
      bobot_poin: 20,
      createdAt: new Date(),
    };

    const q5: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: exam.id,
      guru_id: guru.id,
      question_type: 'pilihan_ganda',
      tipe_media: 'Teks',
      link_media: null,
      pertanyaan: 'Perintah SQL manakah yang paling tepat untuk menghitung rata-rata nilai siswa per paket ujian?',
      opsi_a: 'SELECT AVG(total_nilai) FROM exam_sessions GROUP BY exam_id;',
      opsi_b: 'SELECT SUM(total_nilai) FROM exam_sessions WHERE status_pengerjaan = "Selesai";',
      opsi_c: 'UPDATE exam_sessions SET total_nilai = AVG(bobot_poin);',
      opsi_d: 'SELECT COUNT(*) FROM questions WHERE kunci = "A";',
      opsi_e: 'DELETE FROM student_answers WHERE is_correct = false;',
      kunci: 'A',
      bobot_poin: 20,
      createdAt: new Date(),
    };

    const q6: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: exam.id,
      guru_id: guru.id,
      question_type: 'essay',
      tipe_media: 'Teks',
      link_media: null,
      pertanyaan: 'Jelaskan perbedaan mendasar antara Database Relasional (PostgreSQL) dan Database NoSQL dalam hal konsistensi data (ACID) dan fleksibilitas skema!',
      opsi_a: null,
      opsi_b: null,
      opsi_c: null,
      opsi_d: null,
      opsi_e: null,
      kunci: 'essay',
      bobot_poin: 20,
      createdAt: new Date(),
    };

    this.questions.push(q1, q2, q3, q4, q5, q6);

    // Initial sessions & answers dibiarkan kosong secara default (tanpa mock data dummy)
    this.sessions = [];
    this.answers = [];
  }

  // --- Users ---
  findUserByUsername(username: string) {
    return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  findUserById(id: number) {
    return this.users.find((u) => u.id === id) || null;
  }

  getAllUsers(roleFilter?: 'murid' | 'guru' | 'admin') {
    if (roleFilter) {
      return [...this.users.filter((u) => u.role === roleFilter)].sort((a, b) => b.id - a.id);
    }
    return [...this.users].sort((a, b) => b.id - a.id);
  }

  async createUser(data: {
    username: string;
    name: string;
    passwordPlain: string;
    role: 'murid' | 'guru' | 'admin';
    status?: 'aktif' | 'tidak aktif';
    uid?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.passwordPlain, 10);
    const newUser: MemUser = {
      id: this.nextUserId++,
      uid: data.uid || null,
      username: data.username,
      name: data.name,
      password: hashedPassword,
      role: data.role,
      status: data.status || 'aktif',
      createdAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUser(
    id: number,
    data: Partial<{
      username: string;
      name: string;
      role: 'murid' | 'guru' | 'admin';
      status: 'aktif' | 'tidak aktif';
      passwordPlain?: string;
      password?: string;
    }>
  ) {
    const user = this.findUserById(id);
    if (!user) return null;

    if (data.username !== undefined && data.username.trim().length > 0) user.username = data.username.trim();
    if (data.name !== undefined && data.name.trim().length > 0) user.name = data.name.trim();
    if (data.role !== undefined) user.role = data.role;
    if (data.status !== undefined) user.status = data.status;
    const rawPassword = data.password !== undefined ? data.password : data.passwordPlain;
    if (typeof rawPassword === 'string' && rawPassword.trim().length > 0) {
      user.password = bcrypt.hashSync(rawPassword.trim(), 10);
    }
    return user;
  }

  softDeleteUser(id: number) {
    const user = this.findUserById(id);
    if (user) {
      user.status = 'tidak aktif';
    }
    return user;
  }

  deleteUser(id: number) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      const deleted = this.users.splice(idx, 1)[0];
      return deleted;
    }
    return null;
  }

  // --- Exams ---
  getAllExams() {
    return [...this.exams].sort((a, b) => b.id - a.id);
  }

  getExamById(id: number) {
    return this.exams.find((e) => e.id === id) || null;
  }

  getExamByToken(token: string) {
    return this.exams.find((e) => e.token.toLowerCase() === token.toLowerCase()) || null;
  }

  createExam(data: {
    kode_paket: string;
    mapel: string;
    kelas: string;
    waktu_mulai?: Date | null;
    waktu_selesai?: Date | null;
    durasi: number;
    token: string;
    status: 'Aktif' | 'Draft' | 'Selesai';
    tipe_penilaian?: string;
  }) {
    const newExam: MemExam = {
      id: this.nextExamId++,
      kode_paket: data.kode_paket,
      mapel: data.mapel,
      kelas: data.kelas,
      waktu_mulai: data.waktu_mulai || null,
      waktu_selesai: data.waktu_selesai || null,
      durasi: data.durasi,
      token: data.token,
      status: data.status,
      tipe_penilaian: data.tipe_penilaian || 'Otomatis',
      createdAt: new Date(),
    };
    this.exams.push(newExam);
    return newExam;
  }

  updateExam(
    id: number,
    data: Partial<{
      kode_paket: string;
      mapel: string;
      kelas: string;
      waktu_mulai: Date | null;
      waktu_selesai: Date | null;
      durasi: number;
      token: string;
      status: 'Aktif' | 'Draft' | 'Selesai';
      tipe_penilaian: string;
    }>
  ) {
    const exam = this.getExamById(id);
    if (!exam) return null;
    Object.assign(exam, data);
    return exam;
  }

  deleteExam(id: number) {
    const idx = this.exams.findIndex((e) => e.id === id);
    if (idx !== -1) {
      return this.exams.splice(idx, 1)[0];
    }
    return null;
  }

  // --- Questions ---
  getAllQuestions(examId?: number) {
    if (examId) {
      return this.questions.filter((q) => q.exam_id === examId).sort((a, b) => a.id - b.id);
    }
    return [...this.questions].sort((a, b) => a.id - b.id);
  }

  getQuestionsByExamId(examId: number) {
    return this.questions.filter((q) => q.exam_id === examId).sort((a, b) => a.id - b.id);
  }

  createQuestion(data: {
    exam_id: number;
    guru_id?: number | null;
    question_type?: 'pilihan_ganda' | 'essay';
    tipe_media: 'Teks' | 'Image' | 'Audio' | 'Video';
    link_media?: string | null;
    pertanyaan: string;
    opsi_a?: string | null;
    opsi_b?: string | null;
    opsi_c?: string | null;
    opsi_d?: string | null;
    opsi_e?: string | null;
    kunci?: string | null;
    bobot_poin?: number;
  }) {
    const qType = data.question_type || 'pilihan_ganda';
    const isEssay = qType === 'essay';

    const newQ: MemQuestion = {
      id: this.nextQuestionId++,
      exam_id: data.exam_id,
      guru_id: data.guru_id || null,
      question_type: qType,
      tipe_media: data.tipe_media || 'Teks',
      link_media: data.link_media || null,
      pertanyaan: data.pertanyaan,
      opsi_a: isEssay ? null : (data.opsi_a || null),
      opsi_b: isEssay ? null : (data.opsi_b || null),
      opsi_c: isEssay ? null : (data.opsi_c || null),
      opsi_d: isEssay ? null : (data.opsi_d || null),
      opsi_e: isEssay ? null : (data.opsi_e || null),
      kunci: isEssay ? 'essay' : (data.kunci ? data.kunci.toUpperCase() : 'A'),
      bobot_poin: data.bobot_poin ?? 20,
      createdAt: new Date(),
    };
    this.questions.push(newQ);
    return newQ;
  }

  updateQuestion(
    id: number,
    data: Partial<{
      question_type: 'pilihan_ganda' | 'essay';
      tipe_media: 'Teks' | 'Image' | 'Audio' | 'Video';
      link_media: string | null;
      pertanyaan: string;
      opsi_a: string | null;
      opsi_b: string | null;
      opsi_c: string | null;
      opsi_d: string | null;
      opsi_e: string | null;
      kunci: string | null;
      bobot_poin: number;
    }>
  ) {
    const q = this.questions.find((item) => item.id === id);
    if (!q) return null;
    if (data.question_type === 'essay') {
      data.opsi_a = null;
      data.opsi_b = null;
      data.opsi_c = null;
      data.opsi_d = null;
      data.opsi_e = null;
      data.kunci = 'essay';
    } else if (data.kunci) {
      data.kunci = data.kunci.toUpperCase();
    }
    Object.assign(q, data);
    return q;
  }

  deleteQuestion(id: number) {
    const idx = this.questions.findIndex((q) => q.id === id);
    if (idx !== -1) {
      return this.questions.splice(idx, 1)[0];
    }
    return null;
  }

  // --- Sessions & Student Answers ---
  startOrGetExamSession(examId: number, userId: number, forceNew: boolean = false) {
    if (!forceNew) {
      const ongoing = this.sessions
        .filter(
          (s) => s.exam_id === examId && s.user_id === userId && s.status_pengerjaan === 'Sedang Mengerjakan'
        )
        .sort((a, b) => b.id - a.id)[0];

      if (ongoing) {
        ongoing.terakhir_aktif = new Date();
        return ongoing;
      }
    }

    const newSess: MemExamSession = {
      id: this.nextSessionId++,
      exam_id: examId,
      user_id: userId,
      waktu_mulai_siswa: new Date(),
      waktu_submit: null,
      terakhir_aktif: new Date(),
      status_pengerjaan: 'Sedang Mengerjakan',
      jml_pelanggaran: 0,
      detail_pelanggaran: null,
      benar_pg: null,
      salah_pg: null,
      kosong_pg: null,
      nilai_pg: null,
      total_nilai: 0,
      createdAt: new Date(),
    };
    this.sessions.push(newSess);
    return newSess;
  }

  saveStudentAnswer(
    sessionId: number,
    questionId: number,
    jawaban: string,
    fallbackData?: { user_id?: number; exam_id?: number }
  ) {
    let session = this.sessions.find((s) => s.id === sessionId);
    if (!session && fallbackData?.user_id && fallbackData?.exam_id) {
      session = this.sessions
        .filter((s) => s.user_id === fallbackData.user_id && s.exam_id === fallbackData.exam_id)
        .sort((a, b) => b.id - a.id)[0];
    }
    if (!session && this.sessions.length > 0) {
      session = this.sessions[this.sessions.length - 1];
    }
    if (!session) {
      const examId = fallbackData?.exam_id || (this.exams.length > 0 ? this.exams[0].id : 1);
      const userId = fallbackData?.user_id || 1;
      session = {
        id: sessionId || this.nextSessionId++,
        exam_id: examId,
        user_id: userId,
        waktu_mulai_siswa: new Date(),
        waktu_submit: null,
        terakhir_aktif: new Date(),
        status_pengerjaan: 'Sedang Mengerjakan',
        jml_pelanggaran: 0,
        detail_pelanggaran: null,
        benar_pg: null,
        salah_pg: null,
        kosong_pg: null,
        nilai_pg: null,
        total_nilai: 0,
        createdAt: new Date(),
      };
      this.sessions.push(session);
    }

    const actualSessionId = session.id;
    let q = this.questions.find((item) => item.id === questionId);
    if (!q) {
      q = this.questions.find((item) => item.exam_id === session!.exam_id);
    }

    const isEssay = q?.question_type === 'essay' || q?.kunci?.toLowerCase() === 'essay';
    const isCorrect = isEssay ? false : (q?.kunci ? q.kunci.trim().toUpperCase() === (jawaban || '').trim().toUpperCase() : false);
    const skor = isEssay ? null : (isCorrect ? (q?.bobot_poin || 1) : 0);

    let existing = this.answers.find(
      (a) => a.session_id === actualSessionId && a.question_id === questionId
    );

    if (existing) {
      existing.jawaban_siswa = jawaban;
      existing.is_correct = isCorrect;
      existing.skor_guru = isEssay ? existing.skor_guru : skor;
      existing.waktu_jawab = new Date();
      return existing;
    }

    const newAns: MemStudentAnswer = {
      id: this.nextAnswerId++,
      session_id: actualSessionId,
      question_id: questionId,
      jawaban_siswa: jawaban,
      is_correct: isCorrect,
      skor_guru: skor,
      waktu_jawab: new Date(),
      createdAt: new Date(),
    };
    this.answers.push(newAns);
    return newAns;
  }

  recordViolation(
    sessionId: number,
    reason: string,
    fallbackData?: { user_id?: number; exam_id?: number }
  ) {
    let session = this.sessions.find((s) => s.id === sessionId);
    if (!session && fallbackData?.user_id && fallbackData?.exam_id) {
      session = this.sessions
        .filter((s) => s.user_id === fallbackData.user_id && s.exam_id === fallbackData.exam_id)
        .sort((a, b) => b.id - a.id)[0];
    }
    if (!session && this.sessions.length > 0) {
      session = this.sessions[this.sessions.length - 1];
    }
    if (!session) {
      const examId = fallbackData?.exam_id || (this.exams.length > 0 ? this.exams[0].id : 1);
      const userId = fallbackData?.user_id || 1;
      session = {
        id: sessionId || this.nextSessionId++,
        exam_id: examId,
        user_id: userId,
        waktu_mulai_siswa: new Date(),
        waktu_submit: null,
        terakhir_aktif: new Date(),
        status_pengerjaan: 'Sedang Mengerjakan',
        jml_pelanggaran: 0,
        detail_pelanggaran: null,
        benar_pg: null,
        salah_pg: null,
        kosong_pg: null,
        nilai_pg: null,
        total_nilai: 0,
        createdAt: new Date(),
      };
      this.sessions.push(session);
    }

    const currentCount = session.jml_pelanggaran || 0;
    const newCount = currentCount + 1;
    const currentDetail = session.detail_pelanggaran ? `${session.detail_pelanggaran}\n` : '';
    const currentTime = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    const newDetail = `${currentDetail}[${currentTime}] Pelanggaran #${newCount}: ${reason}`;

    if (newCount >= 3) {
      session.jml_pelanggaran = newCount;
      session.detail_pelanggaran = `${newDetail} -> [SYSTEM] BATAS PELANGGARAN TERCAPAI (3x). Sesi di-Force Submit otomatis.`;
      session.status_pengerjaan = 'Force Submit';
      session.waktu_submit = new Date();
      session.terakhir_aktif = new Date();

      return {
        ...session,
        forceSubmitted: true,
        finalScore: session.total_nilai || 0,
        warning: 'Batas toleransi pelanggaran tercapai (3x). Ujian otomatis dihentikan (Force Submit).'
      };
    }

    session.jml_pelanggaran = newCount;
    session.detail_pelanggaran = newDetail;
    session.terakhir_aktif = new Date();

    return {
      ...session,
      forceSubmitted: false,
      warning: `Peringatan ${newCount}/3: Jangan berpindah jendela ujian!`
    };
  }

  resetViolation(
    sessionId: number,
    fallbackData?: { user_id?: number; exam_id?: number }
  ) {
    let session = this.sessions.find((s) => s.id === sessionId);
    if (!session && fallbackData?.user_id && fallbackData?.exam_id) {
      session = this.sessions
        .filter((s) => s.user_id === fallbackData.user_id && s.exam_id === fallbackData.exam_id)
        .sort((a, b) => b.id - a.id)[0];
    }
    if (!session && this.sessions.length > 0) {
      session = this.sessions[this.sessions.length - 1];
    }
    if (!session) {
      throw new Error('Sesi ujian tidak ditemukan');
    }

    const currentDetail = session.detail_pelanggaran ? `${session.detail_pelanggaran}\n` : '';
    const currentTime = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    session.detail_pelanggaran = `${currentDetail}[${currentTime}] [GURU / PENGAWAS] Pelanggaran di-reset kembali menjadi 0.`;
    session.jml_pelanggaran = 0;
    if (session.status_pengerjaan === 'Force Submit') {
      session.status_pengerjaan = 'Sedang Mengerjakan';
    }
    session.terakhir_aktif = new Date();
    return session;
  }

  getLiveMonitorSessions(examId?: number) {
    let list = this.sessions.map((s) => {
      const user = this.users.find((u) => u.id === s.user_id);
      const exam = this.exams.find((e) => e.id === s.exam_id);
      return {
        id: s.id,
        user_id: s.user_id,
        exam_id: s.exam_id,
        waktu_mulai_siswa: s.waktu_mulai_siswa,
        waktu_submit: s.waktu_submit,
        terakhir_aktif: s.terakhir_aktif,
        status_pengerjaan: s.status_pengerjaan,
        jml_pelanggaran: s.jml_pelanggaran,
        detail_pelanggaran: s.detail_pelanggaran,
        total_nilai: s.total_nilai,
        created_at: s.createdAt,
        student_name: user ? user.name : 'Unknown',
        student_username: user ? user.username : 'unknown',
        student_status: user ? user.status : 'aktif',
        exam_kode: exam ? exam.kode_paket : 'CBT',
        exam_mapel: exam ? exam.mapel : 'Ujian',
        exam_kelas: exam ? exam.kelas : 'X',
        exam_durasi: exam ? exam.durasi : 60,
        exam_status: exam ? exam.status : 'Aktif',
      };
    });

    if (examId) {
      list = list.filter((item) => item.exam_id === examId);
    }
    return list.sort((a, b) => b.id - a.id);
  }

  submitExam(
    sessionId: number,
    status: 'Selesai' | 'Force Submit' = 'Selesai',
    fallbackData?: { user_id?: number; exam_id?: number; answers?: Record<number, string> }
  ) {
    let session = this.sessions.find((s) => s.id === sessionId);
    if (!session && fallbackData?.user_id && fallbackData?.exam_id) {
      session = this.sessions
        .filter((s) => s.user_id === fallbackData.user_id && s.exam_id === fallbackData.exam_id)
        .sort((a, b) => b.id - a.id)[0];
    }
    if (!session && this.sessions.length > 0) {
      session = this.sessions[this.sessions.length - 1];
    }
    if (!session) {
      const examId = fallbackData?.exam_id || (this.exams.length > 0 ? this.exams[0].id : 1);
      const userId = fallbackData?.user_id || 1;
      session = {
        id: sessionId || this.nextSessionId++,
        exam_id: examId,
        user_id: userId,
        waktu_mulai_siswa: new Date(),
        waktu_submit: new Date(),
        terakhir_aktif: new Date(),
        status_pengerjaan: status,
        jml_pelanggaran: 0,
        detail_pelanggaran: null,
        benar_pg: 0,
        salah_pg: 0,
        kosong_pg: 0,
        nilai_pg: 0,
        total_nilai: 0,
        createdAt: new Date(),
      };
      this.sessions.push(session);
    }

    if (fallbackData?.answers && typeof fallbackData.answers === 'object') {
      const rawAns = fallbackData.answers;
      if (Array.isArray(rawAns)) {
        rawAns.forEach((item: any) => {
          const qId = Number(item.question_id ?? item.questionId);
          const val = item.jawaban_siswa !== undefined ? item.jawaban_siswa : (item.answer !== undefined ? item.answer : '');
          if (!isNaN(qId)) {
            this.saveStudentAnswer(session!.id, qId, String(val));
          }
        });
      } else {
        Object.entries(rawAns).forEach(([qIdStr, ansVal]) => {
          const qId = Number(qIdStr);
          if (!isNaN(qId) && ansVal !== undefined) {
            this.saveStudentAnswer(session!.id, qId, String(ansVal));
          }
        });
      }
    }

    const allQuestions = this.questions.filter((q) => q.exam_id === session.exam_id);
    const existingAnswers = this.answers.filter((a) => a.session_id === session.id);

    const answerMap = new Map<number, MemStudentAnswer>();
    existingAnswers.forEach((ans) => {
      answerMap.set(ans.question_id, ans);
    });

    let benar_pg = 0;
    let salah_pg = 0;
    let kosong_pg = 0;
    let totalPointsEarned = 0;
    let totalEssayPoints = 0;

    for (const q of allQuestions) {
      const qWeight = Number(q.bobot_poin) || 0;
      const isEssay =
        q.kunci?.toUpperCase() === 'ESSAY' ||
        q.tipe_media === ('Essay' as any) ||
        !q.opsi_a ||
        q.opsi_a.trim() === '' ||
        q.opsi_a.trim() === '-';

      const studentAnsRecord = answerMap.get(q.id);

      if (isEssay) {
        if (studentAnsRecord && studentAnsRecord.skor_guru !== null && studentAnsRecord.skor_guru !== undefined) {
          totalEssayPoints += Number(studentAnsRecord.skor_guru) || 0;
        }
        continue;
      }

      const studentAnsText = studentAnsRecord?.jawaban_siswa?.trim().toUpperCase() || '';
      const kunciText = q.kunci?.trim().toUpperCase() || '';

      if (!studentAnsRecord || !studentAnsText) {
        kosong_pg++;
        if (studentAnsRecord) {
          studentAnsRecord.is_correct = false;
          studentAnsRecord.skor_guru = 0;
        }
      } else if (studentAnsText === kunciText) {
        benar_pg++;
        totalPointsEarned += qWeight;
        studentAnsRecord.is_correct = true;
        studentAnsRecord.skor_guru = qWeight;
      } else {
        salah_pg++;
        studentAnsRecord.is_correct = false;
        studentAnsRecord.skor_guru = 0;
      }
    }

    const nilai_pg = Math.round(totalPointsEarned);
    const total_nilai = Math.round(nilai_pg + totalEssayPoints);

    session.status_pengerjaan = status;
    session.waktu_submit = new Date();
    session.terakhir_aktif = new Date();
    session.benar_pg = benar_pg;
    session.salah_pg = salah_pg;
    session.kosong_pg = kosong_pg;
    session.nilai_pg = nilai_pg;
    session.total_nilai = total_nilai;

    return {
      session,
      finalScore: total_nilai,
      totalCorrect: benar_pg,
      stats: {
        benar_pg,
        salah_pg,
        kosong_pg,
        nilai_pg,
        total_nilai,
        total_soal: allQuestions.length,
      },
    };
  }

  getAllEssayAnswers(examId?: number, sessionId?: number) {
    const list = this.answers
      .map((ans) => {
        const q = this.questions.find((item) => item.id === ans.question_id);
        const s = this.sessions.find((item) => item.id === ans.session_id);
        const user = s ? this.users.find((u) => u.id === s.user_id) : null;
        const exam = s ? this.exams.find((e) => e.id === s.exam_id) : null;

        return {
          id: ans.id,
          session_id: ans.session_id,
          question_id: ans.question_id,
          jawaban_siswa: ans.jawaban_siswa,
          is_correct: ans.is_correct,
          skor_guru: ans.skor_guru,
          createdAt: ans.createdAt,
          pertanyaan: q ? q.pertanyaan : '',
          tipe_media: q ? q.tipe_media : 'Teks',
          link_media: q ? q.link_media : null,
          kunci: q ? q.kunci : '',
          bobot_poin: q ? q.bobot_poin : 20,
          opsi_a: q ? q.opsi_a : '',
          opsi_b: q ? q.opsi_b : '',
          student_id: user ? user.id : 0,
          student_name: user ? user.name : 'Unknown',
          student_username: user ? user.username : 'unknown',
          exam_id: exam ? exam.id : 0,
          exam_kode: exam ? exam.kode_paket : '',
          exam_mapel: exam ? exam.mapel : '',
          exam_kelas: exam ? exam.kelas : '',
          session_status: s ? s.status_pengerjaan : 'Selesai',
          nilai_pg: s ? s.nilai_pg : 0,
          total_nilai: s ? s.total_nilai : 0,
        };
      })
      .filter((rec) => {
        const isEssayQuestion =
          rec.kunci?.toUpperCase() === 'ESSAY' ||
          rec.tipe_media === ('Essay' as any) ||
          !rec.opsi_a ||
          rec.opsi_a.trim() === '' ||
          rec.opsi_a.trim() === '-' ||
          rec.kunci?.length > 1;

        if (examId && rec.exam_id !== examId) return false;
        if (sessionId && rec.session_id !== sessionId) return false;
        return isEssayQuestion || rec.skor_guru !== null;
      });

    return list.sort((a, b) => b.id - a.id);
  }

  gradeEssayAnswer(answerId: number, skorGuru: number) {
    const validatedScore = Math.max(0, Number(skorGuru) || 0);
    const ans = this.answers.find((a) => a.id === answerId);
    if (!ans) throw new Error(`Jawaban dengan ID ${answerId} tidak ditemukan.`);

    ans.skor_guru = validatedScore;
    ans.is_correct = validatedScore > 0;

    const session = this.sessions.find((s) => s.id === ans.session_id);
    if (!session) throw new Error(`Sesi ujian ID ${ans.session_id} tidak ditemukan.`);

    const sessionAnswers = this.answers.filter((a) => a.session_id === session.id);
    let totalNilaiEssay = 0;
    for (const a of sessionAnswers) {
      if (a.skor_guru !== null && a.skor_guru !== undefined) {
        totalNilaiEssay += Number(a.skor_guru);
      }
    }

    const nilaiPg = Number(session.nilai_pg) || 0;
    const totalNilai = Math.round(nilaiPg + totalNilaiEssay);
    session.total_nilai = totalNilai;
    session.terakhir_aktif = new Date();

    return {
      answer: ans,
      session,
      nilai_pg: nilaiPg,
      nilai_essay: totalNilaiEssay,
      total_nilai: totalNilai,
    };
  }

  getAllExamResults(examId?: number) {
    let raw = this.sessions.map((s) => {
      const user = this.users.find((u) => u.id === s.user_id);
      const exam = this.exams.find((e) => e.id === s.exam_id);
      const userAnswers = this.answers.filter((a) => a.session_id === s.id);
      let nilai_essay = 0;
      for (const a of userAnswers) {
        if (a.skor_guru !== null && a.skor_guru !== undefined) {
          nilai_essay += Number(a.skor_guru);
        }
      }

      const nilai_pg = Number(s.nilai_pg) || 0;
      const total_nilai = s.total_nilai !== null && s.total_nilai !== undefined
        ? Math.round(Number(s.total_nilai))
        : Math.round(nilai_pg + nilai_essay);

      return {
        id: s.id,
        user_id: s.user_id,
        exam_id: s.exam_id,
        waktu_mulai_siswa: s.waktu_mulai_siswa,
        waktu_submit: s.waktu_submit,
        status_pengerjaan: s.status_pengerjaan,
        terakhir_aktif: s.terakhir_aktif,
        jml_pelanggaran: s.jml_pelanggaran,
        detail_pelanggaran: s.detail_pelanggaran,
        benar_pg: s.benar_pg,
        salah_pg: s.salah_pg,
        kosong_pg: s.kosong_pg,
        nilai_pg,
        nilai_essay,
        total_nilai,
        created_at: s.createdAt,
        student_name: user ? user.name : 'Unknown',
        student_username: user ? user.username : 'unknown',
        student_status: user ? user.status : 'aktif',
        exam_kode: exam ? exam.kode_paket : 'CBT',
        exam_mapel: exam ? exam.mapel : 'Ujian',
        exam_kelas: exam ? exam.kelas : 'X',
        exam_durasi: exam ? exam.durasi : 60,
        exam_status: exam ? exam.status : 'Aktif',
      };
    });

    if (examId) {
      raw = raw.filter((s) => s.exam_id === examId);
    }
    return raw.sort((a, b) => b.id - a.id);
  }

  getSessionDetails(sessionId: number) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const exam = this.exams.find((e) => e.id === session.exam_id);
    const user = this.users.find((u) => u.id === session.user_id);
    const answers = this.answers.filter((a) => a.session_id === sessionId);
    const examQuestions = this.questions.filter((q) => q.exam_id === session.exam_id);

    return {
      session,
      exam: exam || null,
      user: user ? { id: user.id, name: user.name, username: user.username, role: user.role } : null,
      answers,
      questions: examQuestions,
    };
  }

  getAllSessions() {
    return [...this.sessions].sort((a, b) => b.id - a.id);
  }
}

export const memStore = new InMemoryCbtStore();
