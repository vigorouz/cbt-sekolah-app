import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { eq, desc, and, relations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const JWT_SECRET = process.env.JWT_SECRET || 'cbt-sekolah-jwt-secret-key-2026';

// ==========================================
// 1. DATABASE SCHEMA
// ==========================================

// Enums sesuai spesifikasi
export const userRoleEnum = pgEnum('user_role', ['murid', 'guru', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['aktif', 'tidak aktif']);
export const examStatusEnum = pgEnum('exam_status', ['Aktif', 'Draft', 'Selesai']);
export const mediaTypeEnum = pgEnum('media_type', ['Teks', 'Image', 'Audio', 'Video']);
export const sessionStatusEnum = pgEnum('session_status', [
  'Sedang Mengerjakan',
  'Selesai',
  'Force Submit',
]);

// 1. Tabel Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID (opsional untuk SSO Google)
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(), // encrypted (bcrypt)
  role: userRoleEnum('role').notNull().default('murid'),
  status: userStatusEnum('status').notNull().default('aktif'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Tabel Exams
export const exams = pgTable('exams', {
  id: serial('id').primaryKey(),
  kode_paket: text('kode_paket').notNull().unique(),
  mapel: text('mapel').notNull(),
  kelas: text('kelas').notNull(),
  waktu_mulai: timestamp('waktu_mulai'),
  waktu_selesai: timestamp('waktu_selesai'),
  durasi: integer('durasi').notNull(), // dalam menit
  token: text('token').notNull(),
  status: examStatusEnum('status').notNull().default('Draft'),
  tipe_penilaian: text('tipe_penilaian').notNull().default('Otomatis'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Tabel Questions
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  exam_id: integer('exam_id')
    .references(() => exams.id, { onDelete: 'cascade' })
    .notNull(),
  guru_id: integer('guru_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  question_type: text('question_type').notNull().default('pilihan_ganda'),
  tipe_media: mediaTypeEnum('tipe_media').notNull().default('Teks'),
  link_media: text('link_media'),
  pertanyaan: text('pertanyaan').notNull(),
  opsi_a: text('opsi_a'),
  opsi_b: text('opsi_b'),
  opsi_c: text('opsi_c'),
  opsi_d: text('opsi_d'),
  opsi_e: text('opsi_e'),
  kunci: text('kunci'),
  bobot_poin: doublePrecision('bobot_poin').notNull().default(1.0),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Tabel Exam_Sessions
export const exam_sessions = pgTable('exam_sessions', {
  id: serial('id').primaryKey(),
  exam_id: integer('exam_id')
    .references(() => exams.id, { onDelete: 'cascade' })
    .notNull(),
  user_id: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  waktu_mulai_siswa: timestamp('waktu_mulai_siswa').defaultNow(),
  waktu_submit: timestamp('waktu_submit'),
  status_pengerjaan: sessionStatusEnum('status_pengerjaan')
    .notNull()
    .default('Sedang Mengerjakan'),
  terakhir_aktif: timestamp('terakhir_aktif').defaultNow(),
  jml_pelanggaran: integer('jml_pelanggaran').notNull().default(0),
  detail_pelanggaran: text('detail_pelanggaran'),
  benar_pg: integer('benar_pg').default(0),
  salah_pg: integer('salah_pg').default(0),
  kosong_pg: integer('kosong_pg').default(0),
  nilai_pg: doublePrecision('nilai_pg').default(0),
  total_nilai: doublePrecision('total_nilai').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Tabel Student_Answers
export const student_answers = pgTable('student_answers', {
  id: serial('id').primaryKey(),
  session_id: integer('session_id')
    .references(() => exam_sessions.id, { onDelete: 'cascade' })
    .notNull(),
  question_id: integer('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull(),
  jawaban_siswa: text('jawaban_siswa'),
  is_correct: boolean('is_correct'),
  skor_guru: doublePrecision('skor_guru'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Definisi Relations Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  createdQuestions: many(questions),
  examSessions: many(exam_sessions),
}));

export const examsRelations = relations(exams, ({ many }) => ({
  questions: many(questions),
  sessions: many(exam_sessions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [questions.exam_id],
    references: [exams.id],
  }),
  guru: one(users, {
    fields: [questions.guru_id],
    references: [users.id],
  }),
  answers: many(student_answers),
}));

export const examSessionsRelations = relations(exam_sessions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [exam_sessions.exam_id],
    references: [exams.id],
  }),
  user: one(users, {
    fields: [exam_sessions.user_id],
    references: [users.id],
  }),
  studentAnswers: many(student_answers),
}));

export const studentAnswersRelations = relations(student_answers, ({ one }) => ({
  session: one(exam_sessions, {
    fields: [student_answers.session_id],
    references: [exam_sessions.id],
  }),
  question: one(questions, {
    fields: [student_answers.question_id],
    references: [questions.id],
  }),
}));


// ==========================================
// 2. IN-MEMORY FALLBACK STORE
// ==========================================


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

    const murid1: MemUser = {
      id: this.nextUserId++,
      uid: null,
      username: 'siswa_ahmad',
      name: 'Ahmad Fauzi',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
      createdAt: new Date(),
    };

    const murid2: MemUser = {
      id: this.nextUserId++,
      uid: null,
      username: 'siswa_siti',
      name: 'Siti Nurhaliza',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
      createdAt: new Date(),
    };

    const murid3: MemUser = {
      id: this.nextUserId++,
      uid: null,
      username: 'siswa_budi',
      name: 'Budi Pratama',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
      createdAt: new Date(),
    };

    const murid4: MemUser = {
      id: this.nextUserId++,
      uid: null,
      username: 'siswa_dewi',
      name: 'Dewi Anggraini',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
      createdAt: new Date(),
    };

    this.users.push(admin, guru, murid1, murid2, murid3, murid4);

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

    const sess1: MemExamSession = {
      id: this.nextSessionId++,
      exam_id: exam.id,
      user_id: murid1.id,
      waktu_mulai_siswa: new Date(Date.now() - 45 * 60 * 1000),
      waktu_submit: new Date(),
      terakhir_aktif: new Date(),
      status_pengerjaan: 'Selesai',
      jml_pelanggaran: 0,
      detail_pelanggaran: null,
      benar_pg: 4,
      salah_pg: 1,
      kosong_pg: 0,
      nilai_pg: 80,
      total_nilai: 80,
      createdAt: new Date(),
    };

    const sess2: MemExamSession = {
      id: this.nextSessionId++,
      exam_id: exam.id,
      user_id: murid2.id,
      waktu_mulai_siswa: new Date(Date.now() - 20 * 60 * 1000),
      waktu_submit: null,
      terakhir_aktif: new Date(),
      status_pengerjaan: 'Sedang Mengerjakan',
      jml_pelanggaran: 1,
      detail_pelanggaran: `[${new Date().toLocaleTimeString('id-ID')}] Peringatan: Berpindah tab browser / membuka aplikasi lain`,
      benar_pg: null,
      salah_pg: null,
      kosong_pg: null,
      nilai_pg: null,
      total_nilai: null,
      createdAt: new Date(),
    };

    const sess3: MemExamSession = {
      id: this.nextSessionId++,
      exam_id: exam.id,
      user_id: murid3.id,
      waktu_mulai_siswa: new Date(Date.now() - 30 * 60 * 1000),
      waktu_submit: new Date(),
      terakhir_aktif: new Date(),
      status_pengerjaan: 'Force Submit',
      jml_pelanggaran: 3,
      detail_pelanggaran: `[10:00:15] Peringatan: Mencoba klik kanan (context menu)\n[10:05:22] Peringatan: Berpindah tab browser\n[10:08:44] FORCE SUBMIT: Batas 3x pelanggaran anti-cheat tercapai`,
      benar_pg: 1,
      salah_pg: 4,
      kosong_pg: 0,
      nilai_pg: 20,
      total_nilai: 20,
      createdAt: new Date(),
    };

    const sess4: MemExamSession = {
      id: this.nextSessionId++,
      exam_id: exam.id,
      user_id: murid4.id,
      waktu_mulai_siswa: new Date(Date.now() - 15 * 60 * 1000),
      waktu_submit: null,
      terakhir_aktif: new Date(),
      status_pengerjaan: 'Sedang Mengerjakan',
      jml_pelanggaran: 0,
      detail_pelanggaran: null,
      benar_pg: null,
      salah_pg: null,
      kosong_pg: null,
      nilai_pg: null,
      total_nilai: null,
      createdAt: new Date(),
    };

    this.sessions.push(sess1, sess2, sess3, sess4);
    // this.answers dibiarkan kosong secara default (tanpa dummy data)
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
      name: string;
      role: 'murid' | 'guru' | 'admin';
      status: 'aktif' | 'tidak aktif';
      passwordPlain?: string;
    }>
  ) {
    const user = this.findUserById(id);
    if (!user) return null;

    if (data.name !== undefined) user.name = data.name;
    if (data.role !== undefined) user.role = data.role;
    if (data.status !== undefined) user.status = data.status;
    if (data.passwordPlain) {
      user.password = await bcrypt.hash(data.passwordPlain, 10);
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

    const actualSessionId = session.id;
    const currentCount = session.jml_pelanggaran || 0;
    const newCount = currentCount + 1;
    const currentDetail = session.detail_pelanggaran ? `${session.detail_pelanggaran}\n` : '';
    const timestampStr = new Date().toLocaleTimeString('id-ID');
    const newDetail = `${currentDetail}[${timestampStr}] Pelanggaran #${newCount}: ${reason}`;

    if (newCount >= 3) {
      session.jml_pelanggaran = newCount;
      session.detail_pelanggaran = `${newDetail} -> [SYSTEM] BATAS PELANGGARAN TERCAPAI (3x). Sesi di-Force Submit otomatis.`;
      session.status_pengerjaan = 'Force Submit';
      session.waktu_submit = new Date();
      session.terakhir_aktif = new Date();

      const userAnswers = this.answers.filter((a) => a.session_id === actualSessionId);
      const examQuestions = this.questions.filter((q) => q.exam_id === session!.exam_id);
      let totalPts = 0;
      let maxPts = 0;
      for (const q of examQuestions) {
        maxPts += q.bobot_poin || 1;
      }
      for (const ans of userAnswers) {
        if (ans.is_correct) {
          totalPts += ans.skor_guru || 1;
        }
      }
      const score = maxPts > 0 ? Number(((totalPts / maxPts) * 100).toFixed(2)) : 0;
      session.total_nilai = score;

      return {
        ...session,
        forceSubmitted: true,
        finalScore: score,
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
      return null;
    }

    const currentDetail = session.detail_pelanggaran ? `${session.detail_pelanggaran}\n` : '';
    const timestampStr = new Date().toLocaleTimeString('id-ID');
    session.detail_pelanggaran = `${currentDetail}[${timestampStr}] [GURU / PENGAWAS] Pelanggaran di-reset kembali menjadi 0.`;
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
    if (!session && fallbackData?.user_id) {
      session = this.sessions
        .filter((s) => s.user_id === fallbackData.user_id)
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
        status_pengerjaan: status || 'Selesai',
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

    // Pastikan seluruh jawaban tersimpan secara permanen ke memory store
    if (fallbackData?.answers && typeof fallbackData.answers === 'object') {
      Object.entries(fallbackData.answers).forEach(([qIdStr, ansVal]) => {
        const qId = Number(qIdStr);
        if (!isNaN(qId) && ansVal !== undefined) {
          this.saveStudentAnswer(session!.id, qId, String(ansVal));
        }
      });
    }

    const allQuestions = this.questions.filter((q) => q.exam_id === session!.exam_id);
    const existingAnswers = this.answers.filter((a) => a.session_id === session!.id);

    const answerMap = new Map<number, MemStudentAnswer>();
    existingAnswers.forEach((ans) => {
      answerMap.set(ans.question_id, ans);
    });

    let benar_pg = 0;
    let salah_pg = 0;
    let kosong_pg = 0;
    let totalPointsEarned = 0;
    let totalEssayPoints = 0;
    let hasEssay = false;

    for (const q of allQuestions) {
      const qWeight = Number(q.bobot_poin) || 0;
      const isEssay =
        q.question_type === 'essay' ||
        q.kunci?.toUpperCase() === 'ESSAY' ||
        q.tipe_media === ('Essay' as any) ||
        !q.opsi_a ||
        q.opsi_a.trim() === '' ||
        q.opsi_a.trim() === '-' ||
        (q.kunci && q.kunci.length > 1);

      const studentAnsRecord = answerMap.get(q.id);

      if (isEssay) {
        hasEssay = true;
        // Backend HANYA boleh menghitung skor otomatis untuk PG. Skor untuk essay dibiarkan 0 (menunggu dikoreksi)
        if (studentAnsRecord && studentAnsRecord.skor_guru !== null && studentAnsRecord.skor_guru !== undefined) {
          totalEssayPoints += Number(studentAnsRecord.skor_guru) || 0;
        } else if (studentAnsRecord) {
          studentAnsRecord.is_correct = false;
          studentAnsRecord.skor_guru = null;
        }
        continue;
      }

      // Soal Pilihan Ganda (PG)
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
        if (studentAnsRecord) {
          studentAnsRecord.is_correct = true;
          studentAnsRecord.skor_guru = qWeight;
        }
      } else {
        salah_pg++;
        if (studentAnsRecord) {
          studentAnsRecord.is_correct = false;
          studentAnsRecord.skor_guru = 0;
        }
      }
    }

    const nilai_pg = Math.round(totalPointsEarned);
    const total_nilai = Math.round(nilai_pg + totalEssayPoints);

    session.status_pengerjaan = status || 'Selesai';
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
      nilai_pg,
      nilai_essay: totalEssayPoints,
      has_essay: hasEssay,
      totalCorrect: benar_pg,
      stats: {
        benar_pg,
        salah_pg,
        kosong_pg,
        nilai_pg,
        nilai_essay: totalEssayPoints,
        total_nilai,
        total_soal: allQuestions.length,
        has_essay: hasEssay,
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
        // HANYA tarik data dari sesi ujian yang berstatus 'Selesai'
        if (rec.session_status !== 'Selesai') return false;

        const isEssayQuestion =
          rec.kunci?.toUpperCase() === 'ESSAY' ||
          rec.tipe_media === ('Essay' as any) ||
          !rec.opsi_a ||
          rec.opsi_a.trim() === '' ||
          rec.opsi_a.trim() === '-' ||
          (rec.kunci && rec.kunci.length > 1);

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
      const q = this.questions.find((item) => item.id === a.question_id);
      const isEssay =
        q?.kunci?.toUpperCase() === 'ESSAY' ||
        q?.tipe_media === ('Essay' as any) ||
        !q?.opsi_a ||
        q?.opsi_a.trim() === '' ||
        q?.opsi_a.trim() === '-' ||
        (q?.kunci && q.kunci.length > 1);

      if (isEssay && a.skor_guru !== null && a.skor_guru !== undefined) {
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


// ==========================================
// 3. DATABASE CONNECTION & POOL
// ==========================================
const schemaObj = {
  users,
  exams,
  questions,
  exam_sessions,
  student_answers,
  usersRelations,
  examsRelations,
  questionsRelations,
  examSessionsRelations,
  studentAnswersRelations,
};

declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: any | undefined;
}

export const getPool = (): Pool => {
  if (!global._postgresPool) {
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.VERCEL) ||
      Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

    const sslConfig = {
      rejectUnauthorized: false,
    };

    try {
      if (process.env.DATABASE_URL) {
        const dbUrl = process.env.DATABASE_URL;
        const isRemote =
          isProduction ||
          dbUrl.includes('supabase.co') ||
          dbUrl.includes('pooler.supabase.com') ||
          dbUrl.includes('sslmode') ||
          (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1'));

        global._postgresPool = new Pool({
          connectionString: dbUrl,
          ssl: isRemote ? sslConfig : false,
          max: isProduction ? 5 : 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        });
      } else {
        const isRemoteHost =
          isProduction ||
          (Boolean(process.env.SQL_HOST) &&
            !process.env.SQL_HOST?.includes('localhost') &&
            !process.env.SQL_HOST?.includes('127.0.0.1'));

        global._postgresPool = new Pool({
          host: process.env.SQL_HOST || '127.0.0.1',
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || '',
          database: process.env.SQL_DB_NAME || 'postgres',
          port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
          ssl: isRemoteHost ? sslConfig : false,
          max: isProduction ? 5 : 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        });
      }

      global._postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } catch (poolInitError) {
      console.error('PostgreSQL Pool initialization warning:', poolInitError);
      global._postgresPool = new Pool({
        max: 1,
        connectionTimeoutMillis: 3000,
      });
    }
  }
  return global._postgresPool;
};

export const getDb = () => {
  if (!global._drizzleDb) {
    try {
      const pool = getPool();
      global._drizzleDb = drizzle(pool, { schema: schemaObj });
    } catch (dbInitErr) {
      console.error('Drizzle DB initialization warning:', dbInitErr);
      const fallbackPool = new Pool();
      global._drizzleDb = drizzle(fallbackPool, { schema: schemaObj });
    }
  }
  return global._drizzleDb;
};

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schemaObj>>, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});

// ==========================================
// 4. DATABASE QUERIES
// ==========================================






let sqlUnavailableNoticeLogged = false;

function handleSqlError(context: string, error: any) {
  const errMsg = String(error?.message || error || '');
  const isConnRefused =
    errMsg.includes('ECONNREFUSED') ||
    errMsg.includes('connect') ||
    errMsg.includes('timeout') ||
    errMsg.includes('failed query') ||
    errMsg.includes('password');

  if (isConnRefused && !sqlUnavailableNoticeLogged) {
    console.warn(
      `[Database notice] Cloud SQL / PostgreSQL is currently unreachable (${errMsg}). Falling back to local in-memory CBT store seamlessly.`
    );
    sqlUnavailableNoticeLogged = true;
  }
}

// User Helpers
export async function findUserByUsername(username: string) {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, uid, username, name, password, role, status, created_at as "createdAt"
       FROM users
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [username.trim()]
    );
    return result.rows[0] || null;
  } catch (error: any) {
    handleSqlError('findUserByUsername', error);
    return memStore.findUserByUsername(username);
  }
}

export async function findUserById(id: number) {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT id, uid, username, name, password, role, status, created_at as "createdAt"
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error: any) {
    handleSqlError('findUserById', error);
    return memStore.findUserById(id);
  }
}

export async function getAllUsers(roleFilter?: 'murid' | 'guru' | 'admin') {
  const pool = getPool();
  try {
    if (roleFilter) {
      const result = await pool.query(
        `SELECT id, uid, username, name, password, role, status, created_at as "createdAt"
         FROM users
         WHERE role = $1
         ORDER BY id DESC`,
        [roleFilter]
      );
      return result.rows;
    }
    const result = await pool.query(
      `SELECT id, uid, username, name, password, role, status, created_at as "createdAt"
       FROM users
       ORDER BY id DESC`
    );
    return result.rows;
  } catch (error: any) {
    handleSqlError('getAllUsers', error);
    return memStore.getAllUsers(roleFilter);
  }
}

export async function createUser(data: {
  username: string;
  name: string;
  passwordPlain: string;
  role: 'murid' | 'guru' | 'admin';
  status?: 'aktif' | 'tidak aktif';
  uid?: string;
}) {
  const pool = getPool();
  try {
    const hashedPassword = await bcrypt.hash(data.passwordPlain, 10);
    const result = await pool.query(
      `INSERT INTO users (username, name, password, role, status, uid)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, uid, username, name, role, status, created_at as "createdAt"`,
      [data.username, data.name, hashedPassword, data.role, data.status || 'aktif', data.uid || null]
    );
    return result.rows[0];
  } catch (error: any) {
    handleSqlError('createUser', error);
    return await memStore.createUser(data);
  }
}

export async function updateUser(
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
  const pool = getPool();
  try {
    const rawPassword = data.password !== undefined ? data.password : data.passwordPlain;
    let hashedPassword: string | undefined = undefined;
    if (typeof rawPassword === 'string' && rawPassword.trim().length > 0) {
      hashedPassword = bcrypt.hashSync(rawPassword.trim(), 10);
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.username !== undefined && data.username.trim().length > 0) {
      setClauses.push(`username = $${paramIndex++}`);
      values.push(data.username.trim());
    }
    if (data.name !== undefined && data.name.trim().length > 0) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(data.name.trim());
    }
    if (data.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (hashedPassword !== undefined) {
      setClauses.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (setClauses.length === 0) {
      const res = await pool.query(
        `SELECT id, uid, username, name, role, status, created_at as "createdAt" FROM users WHERE id = $1`,
        [id]
      );
      return res.rows[0];
    }

    values.push(id);
    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, uid, username, name, role, status, created_at as "createdAt"
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error: any) {
    handleSqlError('updateUser', error);
    return await memStore.updateUser(id, data);
  }
}

export async function softDeleteUser(id: number) {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE users SET status = 'tidak aktif' WHERE id = $1 RETURNING id, uid, username, name, role, status, created_at as "createdAt"`,
      [id]
    );
    return result.rows[0];
  } catch (error: any) {
    handleSqlError('softDeleteUser', error);
    return memStore.softDeleteUser(id);
  }
}

export async function deleteUser(id: number) {
  const pool = getPool();
  try {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, uid, username, name, role, status, created_at as "createdAt"`,
      [id]
    );
    return result.rows[0];
  } catch (error: any) {
    handleSqlError('deleteUser', error);
    return memStore.deleteUser(id);
  }
}

// Exam Helpers
export async function getAllExams() {
  try {
    const allExams = await db.select().from(exams).orderBy(desc(exams.createdAt));
    return allExams;
  } catch (error) {
    handleSqlError('getAllExams', error);
    return memStore.getAllExams();
  }
}

export async function getExamById(id: number) {
  try {
    const result = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    handleSqlError('getExamById', error);
    return memStore.getExamById(id);
  }
}

export async function createExam(data: {
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
  try {
    const result = await db.insert(exams).values({
      kode_paket: data.kode_paket,
      mapel: data.mapel,
      kelas: data.kelas,
      waktu_mulai: data.waktu_mulai || null,
      waktu_selesai: data.waktu_selesai || null,
      durasi: data.durasi,
      token: data.token,
      status: data.status,
      tipe_penilaian: data.tipe_penilaian || 'Otomatis',
    }).returning();
    return result[0];
  } catch (error) {
    handleSqlError('createExam', error);
    return memStore.createExam(data);
  }
}

export async function updateExam(
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
  try {
    const result = await db.update(exams).set(data).where(eq(exams.id, id)).returning();
    return result[0];
  } catch (error) {
    handleSqlError('updateExam', error);
    return memStore.updateExam(id, data);
  }
}

export async function deleteExam(id: number) {
  try {
    const result = await db.delete(exams).where(eq(exams.id, id)).returning();
    return result[0];
  } catch (error) {
    handleSqlError('deleteExam', error);
    return memStore.deleteExam(id);
  }
}

// Questions Helpers
export async function getAllQuestions(examId?: number) {
  try {
    const pool = getPool();
    if (examId) {
      const result = await pool.query(
        `SELECT q.*, e.kode_paket FROM questions q LEFT JOIN exams e ON q.exam_id = e.id WHERE q.exam_id = $1 ORDER BY q.id DESC`,
        [examId]
      );
      return result.rows;
    }
    const result = await pool.query(
      `SELECT q.*, e.kode_paket FROM questions q LEFT JOIN exams e ON q.exam_id = e.id ORDER BY q.id DESC`
    );
    return result.rows;
  } catch (error) {
    handleSqlError('getAllQuestions', error);
    return memStore.getAllQuestions(examId);
  }
}

export async function getQuestionsByExamId(examId: number) {
  try {
    return await db.select().from(questions).where(eq(questions.exam_id, examId)).orderBy(questions.id);
  } catch (error) {
    handleSqlError('getQuestionsByExamId', error);
    return memStore.getQuestionsByExamId(examId);
  }
}

export async function createQuestion(data: {
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

  try {
    const pool = getPool();
    const safeOpsiA = isEssay ? null : (data.opsi_a || null);
    const safeOpsiB = isEssay ? null : (data.opsi_b || null);
    const safeOpsiC = isEssay ? null : (data.opsi_c || null);
    const safeOpsiD = isEssay ? null : (data.opsi_d || null);
    const safeOpsiE = isEssay ? null : (data.opsi_e || null);
    const safeKunci = isEssay ? 'essay' : (data.kunci ? data.kunci.toUpperCase() : 'A');

    const insertSql = `
      INSERT INTO questions (exam_id, guru_id, tipe_media, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_poin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    try {
      const result = await pool.query(insertSql, [
        data.exam_id,
        data.guru_id || null,
        data.tipe_media || 'Teks',
        data.pertanyaan,
        safeOpsiA,
        safeOpsiB,
        safeOpsiC,
        safeOpsiD,
        safeOpsiE,
        safeKunci,
        data.bobot_poin ?? 20,
      ]);
      return result.rows[0];
    } catch (queryErr: any) {
      if (queryErr?.message?.includes('not-null') || queryErr?.message?.includes('opsi_a')) {
        const retryResult = await pool.query(insertSql, [
          data.exam_id,
          data.guru_id || null,
          data.tipe_media || 'Teks',
          data.pertanyaan,
          safeOpsiA ?? '',
          safeOpsiB ?? '',
          safeOpsiC ?? '',
          safeOpsiD ?? '',
          safeOpsiE ?? '',
          safeKunci ?? 'essay',
          data.bobot_poin ?? 20,
        ]);
        return retryResult.rows[0];
      }
      throw queryErr;
    }
  } catch (error) {
    handleSqlError('createQuestion', error);
    return memStore.createQuestion(data);
  }
}

export async function updateQuestion(
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
  try {
    const isEssay = data.question_type === 'essay' || data.kunci === 'essay';
    const pool = getPool();
    try {
      const result = await pool.query(
        `UPDATE questions
         SET tipe_media = COALESCE($1, tipe_media),
             pertanyaan = COALESCE($2, pertanyaan),
             opsi_a = $3,
             opsi_b = $4,
             opsi_c = $5,
             opsi_d = $6,
             opsi_e = $7,
             kunci = $8,
             bobot_poin = COALESCE($9, bobot_poin)
         WHERE id = $10
         RETURNING *`,
        [
          data.tipe_media || null,
          data.pertanyaan || null,
          isEssay ? null : (data.opsi_a !== undefined ? data.opsi_a : null),
          isEssay ? null : (data.opsi_b !== undefined ? data.opsi_b : null),
          isEssay ? null : (data.opsi_c !== undefined ? data.opsi_c : null),
          isEssay ? null : (data.opsi_d !== undefined ? data.opsi_d : null),
          isEssay ? null : (data.opsi_e !== undefined ? data.opsi_e : null),
          isEssay ? 'essay' : (data.kunci ? data.kunci.toUpperCase() : null),
          data.bobot_poin !== undefined ? data.bobot_poin : null,
          id,
        ]
      );
      return result.rows[0];
    } catch (queryErr: any) {
      if (queryErr?.message?.includes('not-null') || queryErr?.message?.includes('opsi_a')) {
        const retryResult = await pool.query(
          `UPDATE questions
           SET tipe_media = COALESCE($1, tipe_media),
               pertanyaan = COALESCE($2, pertanyaan),
               opsi_a = $3,
               opsi_b = $4,
               opsi_c = $5,
               opsi_d = $6,
               opsi_e = $7,
               kunci = $8,
               bobot_poin = COALESCE($9, bobot_poin)
           WHERE id = $10
           RETURNING *`,
          [
            data.tipe_media || null,
            data.pertanyaan || null,
            data.opsi_a ?? '',
            data.opsi_b ?? '',
            data.opsi_c ?? '',
            data.opsi_d ?? '',
            data.opsi_e ?? '',
            data.kunci ?? 'essay',
            data.bobot_poin !== undefined ? data.bobot_poin : null,
            id,
          ]
        );
        return retryResult.rows[0];
      }
      throw queryErr;
    }
  } catch (error) {
    handleSqlError('updateQuestion', error);
    return memStore.updateQuestion(id, data);
  }
}

export async function deleteQuestion(id: number) {
  try {
    const pool = getPool();
    const result = await pool.query(`DELETE FROM questions WHERE id = $1 RETURNING *`, [id]);
    return result.rows[0];
  } catch (error) {
    handleSqlError('deleteQuestion', error);
    return memStore.deleteQuestion(id);
  }
}

// Session & Student Answer Helpers
export async function startOrGetExamSession(examId: number, userId: number, forceNew: boolean = false) {
  try {
    if (!forceNew) {
      const ongoing = await db
        .select()
        .from(exam_sessions)
        .where(
          and(
            eq(exam_sessions.exam_id, examId),
            eq(exam_sessions.user_id, userId),
            eq(exam_sessions.status_pengerjaan, 'Sedang Mengerjakan')
          )
        )
        .orderBy(desc(exam_sessions.id))
        .limit(1);

      if (ongoing.length > 0) {
        await db
          .update(exam_sessions)
          .set({ terakhir_aktif: new Date() })
          .where(eq(exam_sessions.id, ongoing[0].id));
        return ongoing[0];
      }
    }

    const newSession = await db
      .insert(exam_sessions)
      .values({
        exam_id: examId,
        user_id: userId,
        status_pengerjaan: 'Sedang Mengerjakan',
        jml_pelanggaran: 0,
        total_nilai: 0,
      })
      .returning();

    return newSession[0];
  } catch (error) {
    handleSqlError('startOrGetExamSession', error);
    return memStore.startOrGetExamSession(examId, userId, forceNew);
  }
}

export async function saveStudentAnswer(
  sessionId: number,
  questionId: number,
  jawaban: string,
  fallbackData?: { user_id?: number; exam_id?: number }
) {
  try {
    const q = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
    if (!q.length) {
      return memStore.saveStudentAnswer(sessionId, questionId, jawaban, fallbackData);
    }

    let session = await db.select().from(exam_sessions).where(eq(exam_sessions.id, sessionId)).limit(1);
    if (!session.length && fallbackData?.user_id && fallbackData?.exam_id) {
      session = await db
        .select()
        .from(exam_sessions)
        .where(
          and(
            eq(exam_sessions.user_id, fallbackData.user_id),
            eq(exam_sessions.exam_id, fallbackData.exam_id)
          )
        )
        .orderBy(desc(exam_sessions.id))
        .limit(1);
    }

    if (!session.length) {
      return memStore.saveStudentAnswer(sessionId, questionId, jawaban, fallbackData);
    }

    const actualSessionId = session[0].id;
    const questionItem = q[0];
    const isEssay = questionItem.question_type === 'essay' || questionItem.kunci?.toLowerCase() === 'essay';
    const isCorrect = isEssay ? false : (questionItem.kunci ? questionItem.kunci.trim().toUpperCase() === (jawaban || '').trim().toUpperCase() : false);
    const skor = isEssay ? null : (isCorrect ? questionItem.bobot_poin : 0);

    const existing = await db
      .select()
      .from(student_answers)
      .where(and(eq(student_answers.session_id, actualSessionId), eq(student_answers.question_id, questionId)))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(student_answers)
        .set({
          jawaban_siswa: jawaban,
          is_correct: isCorrect,
          skor_guru: isEssay ? existing[0].skor_guru : skor,
        })
        .where(eq(student_answers.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const created = await db
      .insert(student_answers)
      .values({
        session_id: actualSessionId,
        question_id: questionId,
        jawaban_siswa: jawaban,
        is_correct: isCorrect,
        skor_guru: skor,
      })
      .returning();

    return created[0];
  } catch (error) {
    handleSqlError('saveStudentAnswer', error);
    return memStore.saveStudentAnswer(sessionId, questionId, jawaban, fallbackData);
  }
}

export async function recordViolation(
  sessionId: number,
  reason: string,
  fallbackData?: { user_id?: number; exam_id?: number }
) {
  try {
    let session = await db.select().from(exam_sessions).where(eq(exam_sessions.id, sessionId)).limit(1);
    if (!session.length && fallbackData?.user_id && fallbackData?.exam_id) {
      session = await db
        .select()
        .from(exam_sessions)
        .where(
          and(
            eq(exam_sessions.user_id, fallbackData.user_id),
            eq(exam_sessions.exam_id, fallbackData.exam_id)
          )
        )
        .orderBy(desc(exam_sessions.id))
        .limit(1);
    }

    if (!session.length) {
      return memStore.recordViolation(sessionId, reason, fallbackData);
    }

    const currentSession = session[0];
    const actualSessionId = currentSession.id;
    const currentCount = currentSession.jml_pelanggaran || 0;
    const newCount = currentCount + 1;
    const currentDetail = currentSession.detail_pelanggaran ? `${currentSession.detail_pelanggaran}\n` : '';
    const timestampStr = new Date().toLocaleTimeString('id-ID');
    const newDetail = `${currentDetail}[${timestampStr}] Pelanggaran #${newCount}: ${reason}`;

    if (newCount >= 3) {
      const answers = await db.select().from(student_answers).where(eq(student_answers.session_id, actualSessionId));
      const allQuestions = await db.select().from(questions).where(eq(questions.exam_id, currentSession.exam_id));

      let totalPoints = 0;
      let maxPoints = 0;
      for (const q of allQuestions) {
        maxPoints += q.bobot_poin || 1;
      }
      for (const ans of answers) {
        if (ans.is_correct) {
          totalPoints += ans.skor_guru || 1;
        }
      }
      const finalScore = maxPoints > 0 ? Number(((totalPoints / maxPoints) * 100).toFixed(2)) : 0;

      const updated = await db
        .update(exam_sessions)
        .set({
          jml_pelanggaran: newCount,
          detail_pelanggaran: `${newDetail} -> [SYSTEM] BATAS PELANGGARAN TERCAPAI (3x). Sesi di-Force Submit otomatis.`,
          status_pengerjaan: 'Force Submit',
          waktu_submit: new Date(),
          total_nilai: finalScore,
          terakhir_aktif: new Date(),
        })
        .where(eq(exam_sessions.id, actualSessionId))
        .returning();

      return {
        ...updated[0],
        forceSubmitted: true,
        finalScore,
        warning: 'Batas toleransi pelanggaran tercapai (3x). Ujian otomatis dihentikan (Force Submit).'
      };
    }

    const updated = await db
      .update(exam_sessions)
      .set({
        jml_pelanggaran: newCount,
        detail_pelanggaran: newDetail,
        terakhir_aktif: new Date(),
      })
      .where(eq(exam_sessions.id, actualSessionId))
      .returning();

    return {
      ...updated[0],
      forceSubmitted: false,
      warning: `Peringatan ${newCount}/3: Jangan berpindah jendela ujian!`
    };
  } catch (error) {
    handleSqlError('recordViolation', error);
    return memStore.recordViolation(sessionId, reason, fallbackData);
  }
}

export async function resetViolation(
  sessionId: number,
  fallbackData?: { user_id?: number; exam_id?: number }
) {
  try {
    let session = await db.select().from(exam_sessions).where(eq(exam_sessions.id, sessionId)).limit(1);
    if (!session.length && fallbackData?.user_id && fallbackData?.exam_id) {
      session = await db
        .select()
        .from(exam_sessions)
        .where(
          and(
            eq(exam_sessions.user_id, fallbackData.user_id),
            eq(exam_sessions.exam_id, fallbackData.exam_id)
          )
        )
        .orderBy(desc(exam_sessions.id))
        .limit(1);
    }

    if (!session.length) {
      return memStore.resetViolation(sessionId, fallbackData);
    }

    const currentSession = session[0];
    const actualSessionId = currentSession.id;
    const currentDetail = currentSession.detail_pelanggaran ? `${currentSession.detail_pelanggaran}\n` : '';
    const timestampStr = new Date().toLocaleTimeString('id-ID');
    const newDetail = `${currentDetail}[${timestampStr}] [GURU / PENGAWAS] Pelanggaran di-reset kembali menjadi 0.`;

    const nextStatus =
      currentSession.status_pengerjaan === 'Force Submit' ? 'Sedang Mengerjakan' : currentSession.status_pengerjaan;

    const updated = await db
      .update(exam_sessions)
      .set({
        jml_pelanggaran: 0,
        detail_pelanggaran: newDetail,
        status_pengerjaan: nextStatus,
        terakhir_aktif: new Date(),
      })
      .where(eq(exam_sessions.id, actualSessionId))
      .returning();

    return updated[0];
  } catch (error) {
    handleSqlError('resetViolation', error);
    return memStore.resetViolation(sessionId, fallbackData);
  }
}

export async function getLiveMonitorSessions(examId?: number) {
  try {
    if (examId) {
      const filtered = await db
        .select({
          id: exam_sessions.id,
          user_id: exam_sessions.user_id,
          exam_id: exam_sessions.exam_id,
          waktu_mulai_siswa: exam_sessions.waktu_mulai_siswa,
          waktu_submit: exam_sessions.waktu_submit,
          terakhir_aktif: exam_sessions.terakhir_aktif,
          status_pengerjaan: exam_sessions.status_pengerjaan,
          jml_pelanggaran: exam_sessions.jml_pelanggaran,
          detail_pelanggaran: exam_sessions.detail_pelanggaran,
          total_nilai: exam_sessions.total_nilai,
          created_at: exam_sessions.createdAt,
          student_name: users.name,
          student_username: users.username,
          student_status: users.status,
          exam_kode: exams.kode_paket,
          exam_mapel: exams.mapel,
          exam_kelas: exams.kelas,
          exam_durasi: exams.durasi,
          exam_status: exams.status,
        })
        .from(exam_sessions)
        .leftJoin(users, eq(exam_sessions.user_id, users.id))
        .leftJoin(exams, eq(exam_sessions.exam_id, exams.id))
        .where(eq(exam_sessions.exam_id, examId))
        .orderBy(desc(exam_sessions.id));
      return filtered;
    }

    const result = await db
      .select({
        id: exam_sessions.id,
        user_id: exam_sessions.user_id,
        exam_id: exam_sessions.exam_id,
        waktu_mulai_siswa: exam_sessions.waktu_mulai_siswa,
        waktu_submit: exam_sessions.waktu_submit,
        terakhir_aktif: exam_sessions.terakhir_aktif,
        status_pengerjaan: exam_sessions.status_pengerjaan,
        jml_pelanggaran: exam_sessions.jml_pelanggaran,
        detail_pelanggaran: exam_sessions.detail_pelanggaran,
        total_nilai: exam_sessions.total_nilai,
        created_at: exam_sessions.createdAt,
        student_name: users.name,
        student_username: users.username,
        student_status: users.status,
        exam_kode: exams.kode_paket,
        exam_mapel: exams.mapel,
        exam_kelas: exams.kelas,
        exam_durasi: exams.durasi,
        exam_status: exams.status,
      })
      .from(exam_sessions)
      .leftJoin(users, eq(exam_sessions.user_id, users.id))
      .leftJoin(exams, eq(exam_sessions.exam_id, exams.id))
      .orderBy(desc(exam_sessions.id));

    return result;
  } catch (error) {
    handleSqlError('getLiveMonitorSessions', error);
    return memStore.getLiveMonitorSessions(examId);
  }
}

export async function submitExam(
  sessionId: number,
  status: 'Selesai' | 'Force Submit' = 'Selesai',
  fallbackData?: { user_id?: number; exam_id?: number; answers?: Record<number, string> }
) {
  const pool = getPool();
  const hasDbConfig = Boolean(process.env.DATABASE_URL || process.env.SQL_HOST);

  try {
    // 1. Dapatkan atau pastikan sesi ujian ada di tabel exam_sessions
    let sessionRes = await pool.query(
      `SELECT id, exam_id, user_id, status_pengerjaan, jml_pelanggaran, total_nilai, nilai_pg 
       FROM exam_sessions 
       WHERE id = $1 LIMIT 1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0 && fallbackData?.user_id && fallbackData?.exam_id) {
      sessionRes = await pool.query(
        `SELECT id, exam_id, user_id, status_pengerjaan, jml_pelanggaran, total_nilai, nilai_pg 
         FROM exam_sessions 
         WHERE user_id = $1 AND exam_id = $2 
         ORDER BY id DESC LIMIT 1`,
        [fallbackData.user_id, fallbackData.exam_id]
      );
    }

    if (sessionRes.rows.length === 0 && fallbackData?.user_id) {
      sessionRes = await pool.query(
        `SELECT id, exam_id, user_id, status_pengerjaan, jml_pelanggaran, total_nilai, nilai_pg 
         FROM exam_sessions 
         WHERE user_id = $1 
         ORDER BY id DESC LIMIT 1`,
        [fallbackData.user_id]
      );
    }

    if (sessionRes.rows.length === 0) {
      let targetUserId = fallbackData?.user_id || 1;
      let targetExamId = fallbackData?.exam_id || 1;

      // Pastikan targetUserId valid
      const uCheck = await pool.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [targetUserId]);
      if (uCheck.rows.length === 0) {
        const anyUser = await pool.query(`SELECT id FROM users LIMIT 1`);
        if (anyUser.rows.length > 0) targetUserId = anyUser.rows[0].id;
      }

      // Pastikan targetExamId valid
      const eCheck = await pool.query(`SELECT id FROM exams WHERE id = $1 LIMIT 1`, [targetExamId]);
      if (eCheck.rows.length === 0) {
        const anyExam = await pool.query(`SELECT id FROM exams LIMIT 1`);
        if (anyExam.rows.length > 0) targetExamId = anyExam.rows[0].id;
      }

      sessionRes = await pool.query(
        `INSERT INTO exam_sessions (exam_id, user_id, status_pengerjaan, waktu_mulai_siswa, terakhir_aktif)
         VALUES ($1, $2, 'Sedang Mengerjakan', NOW(), NOW())
         RETURNING *`,
        [targetExamId, targetUserId]
      );
    }

    const currentSession = sessionRes.rows[0];
    const actualSessionId = currentSession.id;
    const actualExamId = currentSession.exam_id;

    // 2. Ambil seluruh data pertanyaan untuk ujian ini
    const questionsRes = await pool.query(
      `SELECT * FROM questions WHERE exam_id = $1 ORDER BY id ASC`,
      [actualExamId]
    );
    const allQuestions = questionsRes.rows;
    const questionsMap = new Map<number, any>();
    allQuestions.forEach((q) => questionsMap.set(q.id, q));

    // 3. Perulangan (looping) dari payload jawaban frontend: INSERT / UPDATE ke student_answers
    const rawAnswers = fallbackData?.answers || (fallbackData as any)?.student_answers || {};
    const normalizedEntries: Array<{ question_id: number; jawaban_siswa: string }> = [];

    if (Array.isArray(rawAnswers)) {
      rawAnswers.forEach((item: any) => {
        const qId = Number(item.question_id ?? item.questionId);
        if (!isNaN(qId)) {
          normalizedEntries.push({
            question_id: qId,
            jawaban_siswa: String(item.jawaban_siswa !== undefined ? item.jawaban_siswa : (item.answer !== undefined ? item.answer : '')),
          });
        }
      });
    } else if (rawAnswers && typeof rawAnswers === 'object') {
      for (const [qIdStr, ansVal] of Object.entries(rawAnswers)) {
        const qId = Number(qIdStr);
        if (!isNaN(qId)) {
          normalizedEntries.push({
            question_id: qId,
            jawaban_siswa: String(ansVal !== null && ansVal !== undefined ? ansVal : ''),
          });
        }
      }
    }

    for (const item of normalizedEntries) {
      const qId = item.question_id;
      const jawabanText = item.jawaban_siswa;

      // Cek apakah data jawaban untuk butir soal ini sudah pernah tersimpan di sesi ini
      const existingAns = await pool.query(
        `SELECT id FROM student_answers WHERE session_id = $1 AND question_id = $2 LIMIT 1`,
        [actualSessionId, qId]
      );

      if (existingAns.rows.length > 0) {
        await pool.query(
          `UPDATE student_answers SET jawaban_siswa = $1 WHERE id = $2`,
          [jawabanText, existingAns.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO student_answers (session_id, question_id, jawaban_siswa) VALUES ($1, $2, $3)`,
          [actualSessionId, qId, jawabanText]
        );
      }
    }

    // 4. Hitung skor otomatis untuk butir PG dan kumpulkan skor essay
    const savedAnswersRes = await pool.query(
      `SELECT id, session_id, question_id, jawaban_siswa, is_correct, skor_guru 
       FROM student_answers 
       WHERE session_id = $1`,
      [actualSessionId]
    );
    const savedAnswersMap = new Map<number, any>();
    savedAnswersRes.rows.forEach((ans) => savedAnswersMap.set(ans.question_id, ans));

    let benar_pg = 0;
    let salah_pg = 0;
    let kosong_pg = 0;
    let totalPointsEarned = 0;
    let totalEssayPoints = 0;
    let hasEssay = false;

    for (const q of allQuestions) {
      const qWeight = Number(q.bobot_poin) || 0;
      const isEssay =
        q.question_type === 'essay' ||
        q.kunci?.toUpperCase() === 'ESSAY' ||
        q.tipe_media === 'Essay' ||
        !q.opsi_a ||
        q.opsi_a.trim() === '' ||
        q.opsi_a.trim() === '-' ||
        (q.kunci && q.kunci.length > 1);

      const ansRecord = savedAnswersMap.get(q.id);

      if (isEssay) {
        hasEssay = true;
        if (ansRecord && ansRecord.skor_guru !== null && ansRecord.skor_guru !== undefined) {
          totalEssayPoints += Number(ansRecord.skor_guru) || 0;
        }
        continue;
      }

      const studentAnsText = ansRecord?.jawaban_siswa?.trim().toUpperCase() || '';
      const kunciText = (q.kunci || '').trim().toUpperCase();

      if (!ansRecord || !studentAnsText) {
        kosong_pg++;
      } else if (studentAnsText === kunciText) {
        benar_pg++;
        totalPointsEarned += qWeight;
      } else {
        salah_pg++;
      }
    }

    const nilai_pg = Math.round(totalPointsEarned);
    const total_nilai = Math.round(nilai_pg + totalEssayPoints);
    const finalStatus = status || 'Selesai';

    // 5. Jalankan UPDATE exam_sessions SET status_pengerjaan = 'Selesai' WHERE id = ...
    const updateRes = await pool.query(
      `UPDATE exam_sessions
       SET status_pengerjaan = $1,
           waktu_submit = NOW(),
           terakhir_aktif = NOW(),
           benar_pg = $2,
           salah_pg = $3,
           kosong_pg = $4,
           nilai_pg = $5,
           total_nilai = $6
       WHERE id = $7
       RETURNING *`,
      [finalStatus, benar_pg, salah_pg, kosong_pg, nilai_pg, total_nilai, actualSessionId]
    );

    const updatedSession = updateRes.rows[0] || currentSession;

    // Sinkronkan ke in-memory store jika ada
    try {
      memStore.submitExam(actualSessionId, finalStatus, fallbackData);
    } catch (_) {}

    return {
      session: updatedSession,
      finalScore: total_nilai,
      nilai_pg,
      nilai_essay: totalEssayPoints,
      has_essay: hasEssay,
      totalCorrect: benar_pg,
      stats: {
        benar_pg,
        salah_pg,
        kosong_pg,
        nilai_pg,
        nilai_essay: totalEssayPoints,
        total_nilai,
        total_soal: allQuestions.length,
        has_essay: hasEssay,
      },
    };
  } catch (error: any) {
    handleSqlError('submitExam', error);
    // Jika tidak ada konfigurasi database (mock local dev offline)
    if (!hasDbConfig) {
      return memStore.submitExam(sessionId, status, fallbackData);
    }
    // Jika database dikonfigurasi, WAJIB lempar error agar backend mengembalikan HTTP 500
    throw new Error(`Database Error [submitExam]: ${error.message || error}`);
  }
}

export async function getAllEssayAnswers(examId?: number, sessionId?: number) {
  try {
    const pool = getPool();
    let sql = `
      SELECT 
        sa.id,
        sa.session_id,
        sa.question_id,
        sa.jawaban_siswa,
        sa.skor_guru,
        sa.is_correct,
        sa.created_at,
        sa.created_at AS "createdAt",
        q.pertanyaan,
        q.pertanyaan AS teks_soal,
        q.bobot_poin,
        q.bobot_poin AS bobot,
        q.tipe_media,
        q.link_media,
        q.kunci,
        q.opsi_a,
        q.opsi_b,
        u.id AS student_id,
        u.name,
        u.name AS student_name,
        u.username,
        u.username AS nis,
        u.username AS student_username,
        e.id AS exam_id,
        e.kode_paket AS exam_kode,
        e.mapel AS exam_mapel,
        e.kelas AS exam_kelas,
        es.status_pengerjaan AS session_status,
        es.status_pengerjaan,
        es.nilai_pg,
        es.total_nilai
      FROM student_answers sa
      JOIN questions q ON sa.question_id = q.id
      JOIN exam_sessions es ON sa.session_id = es.id
      JOIN users u ON es.user_id = u.id
      LEFT JOIN exams e ON es.exam_id = e.id
      WHERE UPPER(q.kunci) = 'ESSAY' 
        AND (es.status_pengerjaan = 'Selesai' OR es.status_pengerjaan = 'Force Submit')
    `;

    const params: any[] = [];
    if (examId) {
      params.push(examId);
      sql += ` AND es.exam_id = $${params.length}`;
    }
    if (sessionId) {
      params.push(sessionId);
      sql += ` AND es.id = $${params.length}`;
    }

    sql += ` ORDER BY sa.id DESC`;

    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    handleSqlError('getAllEssayAnswers', error);
    return [];
  }
}

export async function gradeEssayAnswer(answerId: number, skorGuru: number) {
  try {
    const validatedScore = Math.max(0, Number(skorGuru) || 0);

    const updatedAnswer = await db
      .update(student_answers)
      .set({
        skor_guru: validatedScore,
        is_correct: validatedScore > 0,
      })
      .where(eq(student_answers.id, answerId))
      .returning();

    if (!updatedAnswer.length) {
      return memStore.gradeEssayAnswer(answerId, validatedScore);
    }

    const sessionId = updatedAnswer[0].session_id;

    const allSessionAnswers = await db
      .select({
        id: student_answers.id,
        skor_guru: student_answers.skor_guru,
        question_id: student_answers.question_id,
        kunci: questions.kunci,
        tipe_media: questions.tipe_media,
        opsi_a: questions.opsi_a,
      })
      .from(student_answers)
      .innerJoin(questions, eq(student_answers.question_id, questions.id))
      .where(eq(student_answers.session_id, sessionId));

    let totalNilaiEssay = 0;
    for (const ans of allSessionAnswers) {
      const isEssay =
        ans.kunci?.toUpperCase() === 'ESSAY' ||
        ans.tipe_media === ('Essay' as any) ||
        !ans.opsi_a ||
        ans.opsi_a.trim() === '' ||
        ans.opsi_a.trim() === '-' ||
        (ans.kunci && ans.kunci.length > 1);

      if (isEssay && ans.skor_guru !== null && ans.skor_guru !== undefined) {
        totalNilaiEssay += Number(ans.skor_guru);
      }
    }

    const currentSession = await db
      .select()
      .from(exam_sessions)
      .where(eq(exam_sessions.id, sessionId))
      .limit(1);

    if (!currentSession.length) {
      throw new Error(`Sesi ujian ID ${sessionId} tidak ditemukan.`);
    }

    const nilaiPg = Number(currentSession[0].nilai_pg) || 0;
    const totalNilai = Math.round(nilaiPg + totalNilaiEssay);

    const updatedSession = await db
      .update(exam_sessions)
      .set({
        total_nilai: totalNilai,
        terakhir_aktif: new Date(),
      })
      .where(eq(exam_sessions.id, sessionId))
      .returning();

    // Sinkronkan ke memStore
    try {
      memStore.gradeEssayAnswer(answerId, validatedScore);
    } catch (_) {}

    return {
      answer: updatedAnswer[0],
      session: updatedSession[0] || currentSession[0],
      nilai_pg: nilaiPg,
      nilai_essay: totalNilaiEssay,
      total_nilai: totalNilai,
    };
  } catch (error) {
    handleSqlError('gradeEssayAnswer', error);
    return memStore.gradeEssayAnswer(answerId, skorGuru);
  }
}

export async function getAllExamResults(examId?: number) {
  try {
    const rawSessions = await db
      .select({
        id: exam_sessions.id,
        user_id: exam_sessions.user_id,
        exam_id: exam_sessions.exam_id,
        waktu_mulai_siswa: exam_sessions.waktu_mulai_siswa,
        waktu_submit: exam_sessions.waktu_submit,
        status_pengerjaan: exam_sessions.status_pengerjaan,
        terakhir_aktif: exam_sessions.terakhir_aktif,
        jml_pelanggaran: exam_sessions.jml_pelanggaran,
        detail_pelanggaran: exam_sessions.detail_pelanggaran,
        benar_pg: exam_sessions.benar_pg,
        salah_pg: exam_sessions.salah_pg,
        kosong_pg: exam_sessions.kosong_pg,
        nilai_pg: exam_sessions.nilai_pg,
        total_nilai: exam_sessions.total_nilai,
        created_at: exam_sessions.createdAt,
        student_name: users.name,
        student_username: users.username,
        student_status: users.status,
        exam_kode: exams.kode_paket,
        exam_mapel: exams.mapel,
        exam_kelas: exams.kelas,
        exam_durasi: exams.durasi,
        exam_status: exams.status,
      })
      .from(exam_sessions)
      .leftJoin(users, eq(exam_sessions.user_id, users.id))
      .leftJoin(exams, eq(exam_sessions.exam_id, exams.id))
      .orderBy(desc(exam_sessions.id));

    const filtered = examId
      ? rawSessions.filter((s) => s.exam_id === examId)
      : rawSessions;

    const sessionIds = filtered.map((s) => s.id);
    const essayMap = new Map<number, number>();

    if (sessionIds.length > 0) {
      const allAnswers = await db
        .select({
          session_id: student_answers.session_id,
          skor_guru: student_answers.skor_guru,
        })
        .from(student_answers);

      for (const ans of allAnswers) {
        if (ans.skor_guru !== null && ans.skor_guru !== undefined) {
          const prev = essayMap.get(ans.session_id) || 0;
          essayMap.set(ans.session_id, prev + Number(ans.skor_guru));
        }
      }
    }

    return filtered.map((s) => {
      const nilai_essay = essayMap.get(s.id) || 0;
      const nilai_pg = Number(s.nilai_pg) || 0;
      const total_nilai = s.total_nilai !== null && s.total_nilai !== undefined
        ? Math.round(Number(s.total_nilai))
        : Math.round(nilai_pg + nilai_essay);

      return {
        ...s,
        nilai_pg,
        nilai_essay,
        total_nilai,
      };
    });
  } catch (error) {
    handleSqlError('getAllExamResults', error);
    return memStore.getAllExamResults(examId);
  }
}

export async function getSessionDetails(sessionId: number) {
  try {
    const session = await db.select().from(exam_sessions).where(eq(exam_sessions.id, sessionId)).limit(1);
    if (!session.length) return null;

    const exam = await db.select().from(exams).where(eq(exams.id, session[0].exam_id)).limit(1);
    const user = await db.select().from(users).where(eq(users.id, session[0].user_id)).limit(1);
    const answers = await db.select().from(student_answers).where(eq(student_answers.session_id, sessionId));
    const examQuestions = await db.select().from(questions).where(eq(questions.exam_id, session[0].exam_id));

    return {
      session: session[0],
      exam: exam[0] || null,
      user: user[0] ? { id: user[0].id, name: user[0].name, username: user[0].username, role: user[0].role } : null,
      answers,
      questions: examQuestions,
    };
  } catch (error) {
    handleSqlError('getSessionDetails', error);
    return memStore.getSessionDetails(sessionId);
  }
}

export async function getAllSessions() {
  try {
    return await db.select().from(exam_sessions).orderBy(desc(exam_sessions.createdAt));
  } catch (error) {
    handleSqlError('getAllSessions', error);
    return memStore.getAllSessions();
  }
}

// Seed Demo Data jika kosong
export async function seedDemoData() {
  try {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      return { message: 'Database sudah memiliki data' };
    }

    // 1. Buat User Guru dan Murid
    const guruPass = await bcrypt.hash('guru123', 10);
    const muridPass = await bcrypt.hash('siswa123', 10);

    const [guru] = await db.insert(users).values({
      username: 'guru_cbt',
      name: 'Budi Santoso, S.Pd',
      password: guruPass,
      role: 'guru',
      status: 'aktif',
    }).returning();

    const [murid1] = await db.insert(users).values({
      username: 'siswa_ahmad',
      name: 'Ahmad Fauzi',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
    }).returning();

    const [murid2] = await db.insert(users).values({
      username: 'siswa_siti',
      name: 'Siti Nurhaliza',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
    }).returning();

    const [murid3] = await db.insert(users).values({
      username: 'siswa_budi',
      name: 'Budi Pratama',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
    }).returning();

    const [murid4] = await db.insert(users).values({
      username: 'siswa_dewi',
      name: 'Dewi Anggraini',
      password: muridPass,
      role: 'murid',
      status: 'aktif',
    }).returning();

    // 2. Buat Paket Ujian
    const [ujian] = await db.insert(exams).values({
      kode_paket: 'CBT-MAT-2026-X',
      mapel: 'Matematika Terapan & Logika Komputasi',
      kelas: 'X-RPL',
      durasi: 60,
      token: 'CBT26',
      status: 'Aktif',
      tipe_penilaian: 'Otomatis',
    }).returning();

    // 3. Buat 5 Soal PG + 1 Soal Essay
    const createdQuestions = await db.insert(questions).values([
      {
        exam_id: ujian.id,
        guru_id: guru.id,
        tipe_media: 'Teks',
        pertanyaan: 'Manakah dari berikut ini yang merupakan sifat dasar dari Relational Database Management System (RDBMS)?',
        opsi_a: 'Menyimpan data tanpa skema terdefinisi (NoSQL)',
        opsi_b: 'Mendukung integritas referensial antar tabel menggunakan Foreign Key',
        opsi_c: 'Hanya dapat diakses melalui satu thread proses saja',
        opsi_d: 'Tidak mendukung transaksi ACID',
        opsi_e: 'Data hanya tersimpan di memori RAM tanpa persistensi disk',
        kunci: 'B',
        bobot_poin: 20,
      },
      {
        exam_id: ujian.id,
        guru_id: guru.id,
        tipe_media: 'Teks',
        pertanyaan: 'Dalam basis data PostgreSQL, klausa SQL apa yang digunakan untuk memastikan nilai kolom unik di seluruh baris tabel?',
        opsi_a: 'CHECK',
        opsi_b: 'FOREIGN KEY',
        opsi_c: 'UNIQUE',
        opsi_d: 'CASCADE',
        opsi_e: 'INDEX ONLY',
        kunci: 'C',
        bobot_poin: 20,
      },
      {
        exam_id: ujian.id,
        guru_id: guru.id,
        tipe_media: 'Teks',
        pertanyaan: 'Jika sebuah transaksi database memenuhi aturan ACID, huruf "I" dalam akronim tersebut merepresentasikan:',
        opsi_a: 'Integrity',
        opsi_b: 'Indexation',
        opsi_c: 'Isolation',
        opsi_d: 'Iteration',
        opsi_e: 'Inheritance',
        kunci: 'C',
        bobot_poin: 20,
      },
      {
        exam_id: ujian.id,
        guru_id: guru.id,
        tipe_media: 'Teks',
        pertanyaan: 'Pada sistem Computer Based Test (CBT), apa fungsi dari kolom "token" pada tabel Exams?',
        opsi_a: 'Menyimpan password akun guru pengawas',
        opsi_b: 'Kunci otentikasi unik yang harus dimasukkan siswa sebelum memulai sesi ujian',
        opsi_c: 'Enkripsi kunci jawaban seluruh soal',
        opsi_d: 'ID unik transaksi pembayaran ujian',
        opsi_e: 'Alamat IP server Cloud SQL',
        kunci: 'B',
        bobot_poin: 20,
      },
      {
        exam_id: ujian.id,
        guru_id: guru.id,
        tipe_media: 'Teks',
        pertanyaan: 'Perintah SQL manakah yang paling tepat untuk menghitung rata-rata nilai siswa per paket ujian?',
        opsi_a: 'SELECT AVG(total_nilai) FROM exam_sessions GROUP BY exam_id;',
        opsi_b: 'SELECT SUM(total_nilai) FROM exam_sessions WHERE status_pengerjaan = "Selesai";',
        opsi_c: 'UPDATE exam_sessions SET total_nilai = AVG(bobot_poin);',
        opsi_d: 'SELECT COUNT(*) FROM questions WHERE kunci = "A";',
        opsi_e: 'DELETE FROM student_answers WHERE is_correct = false;',
        kunci: 'A',
        bobot_poin: 20,
      },
      {
        exam_id: ujian.id,
        guru_id: guru.id,
        tipe_media: 'Teks',
        pertanyaan: 'Jelaskan perbedaan mendasar antara Database Relasional (PostgreSQL) dan Database NoSQL dalam hal konsistensi data (ACID) dan fleksibilitas skema!',
        opsi_a: '-',
        opsi_b: '-',
        opsi_c: '-',
        opsi_d: '-',
        opsi_e: '-',
        kunci: 'ESSAY',
        bobot_poin: 20,
      },
    ]).returning();

    const [demoSession] = await db.insert(exam_sessions).values({
      exam_id: ujian.id,
      user_id: murid1.id,
      status_pengerjaan: 'Selesai',
      waktu_mulai_siswa: new Date(Date.now() - 45 * 60 * 1000),
      waktu_submit: new Date(),
      benar_pg: 4,
      salah_pg: 1,
      kosong_pg: 0,
      nilai_pg: 80,
      total_nilai: 80,
      jml_pelanggaran: 0,
    }).returning();

    await db.insert(exam_sessions).values({
      exam_id: ujian.id,
      user_id: murid2.id,
      status_pengerjaan: 'Sedang Mengerjakan',
      waktu_mulai_siswa: new Date(Date.now() - 20 * 60 * 1000),
      terakhir_aktif: new Date(),
      jml_pelanggaran: 1,
      detail_pelanggaran: `[${new Date().toLocaleTimeString('id-ID')}] Peringatan: Berpindah tab browser / membuka aplikasi lain`,
    });

    await db.insert(exam_sessions).values({
      exam_id: ujian.id,
      user_id: murid3.id,
      status_pengerjaan: 'Force Submit',
      waktu_mulai_siswa: new Date(Date.now() - 30 * 60 * 1000),
      waktu_submit: new Date(),
      terakhir_aktif: new Date(),
      jml_pelanggaran: 3,
      detail_pelanggaran: `[10:00:15] Peringatan: Mencoba klik kanan (context menu)\n[10:05:22] Peringatan: Berpindah tab browser\n[10:08:44] FORCE SUBMIT: Batas 3x pelanggaran anti-cheat tercapai`,
      benar_pg: 1,
      salah_pg: 4,
      kosong_pg: 0,
      nilai_pg: 20,
      total_nilai: 20,
    });

    await db.insert(exam_sessions).values({
      exam_id: ujian.id,
      user_id: murid4.id,
      status_pengerjaan: 'Sedang Mengerjakan',
      waktu_mulai_siswa: new Date(Date.now() - 15 * 60 * 1000),
      terakhir_aktif: new Date(),
      jml_pelanggaran: 0,
      detail_pelanggaran: null,
    });

    const essayQ = createdQuestions.find(q => q.kunci === 'ESSAY');
    if (essayQ) {
      await db.insert(student_answers).values({
        session_id: demoSession.id,
        question_id: essayQ.id,
        jawaban_siswa: 'Database relasional SQL menggunakan skema kaku terstruktur (schema-first) dan menjamin konsistensi data tinggi dengan transaksi ACID penuh. Sebaliknya, database NoSQL menggunakan skema dinamis (schema-less) yang memprioritaskan ketersediaan dan fleksibilitas scaling horizontal.',
        skor_guru: null,
      });
    }

    return {
      message: 'Demo seed data created successfully',
      credentials: {
        guru: { username: 'guru_cbt', password: 'guru123' },
        murid: { username: 'siswa_ahmad', password: 'murid123' },
        examToken: 'CBT26',
      },
    };
  } catch (error) {
    handleSqlError('seedDemoData', error);
    await memStore.initDemoData();
    return {
      message: 'In-memory demo data initialized successfully',
      credentials: {
        guru: { username: 'guru_cbt', password: 'guru123' },
        murid: { username: 'siswa_ahmad', password: 'murid123' },
        examToken: 'CBT26',
      },
    };
  }
}


// ==========================================
// 5. EXPRESS APPLICATION & ROUTING
// ==========================================
export const app = express();
const PORT = 3000;

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: corsOrigin !== '*',
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ROUTES ---


// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString(), db: 'Cloud SQL / PostgreSQL (Supabase)' });
});

// 1. Auth Endpoints
const handleLogin = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : body.username;
    const password = body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Verifikasi status: Hanya izinkan user dengan status = 'aktif'
    if (user.status !== 'aktif') {
      return res.status(403).json({
        error: 'Akun berstatus tidak aktif. Hanya user dengan status aktif yang diizinkan login.',
        status: user.status,
      });
    }

    let isMatch = false;
    try {
      if (typeof user.password === 'string' && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'))) {
        isMatch = await bcrypt.compare(String(password), user.password);
      } else {
        isMatch = String(password) === String(user.password);
      }
    } catch (bcryptErr: any) {
      console.warn('bcryptjs compare warning:', bcryptErr?.message || bcryptErr);
      isMatch = String(password) === String(user.password);
    }

    // Fallback matching if seeded plain
    if (!isMatch && String(password) === String(user.password)) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...safeUser } = user;
    res.json({
      message: 'Login berhasil',
      token,
      user: safeUser,
      role: safeUser.role,
    });
  } catch (err: any) {
    console.error('Login Error message:', err?.message);
    console.error('Login Error:', err);
    res.status(500).json({
      error: err?.message || 'A server error has occurred',
      details: err?.stack || err?.toString() || 'Unknown server error',
    });
  }
};

  app.post('/login', handleLogin);
  app.post('/api/login', handleLogin);
  app.post('/api/auth/login', handleLogin);

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { username, name, password, role, status } = req.body;
      if (!username || !name || !password) {
        return res.status(400).json({ error: 'Username, name, dan password wajib diisi' });
      }

      const existing = await findUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }

      const newUser = await createUser({
        username,
        name,
        passwordPlain: password,
        role: (role === 'admin' ? 'admin' : role === 'guru' ? 'guru' : 'murid'),
        status: status || 'aktif',
      });

      const { password: _, ...safeUser } = newUser;
      res.status(201).json({ message: 'Registrasi berhasil', user: safeUser, role: safeUser.role });
    } catch (error: any) {
      console.error('Error register:', error);
      res.status(500).json({ error: error.message || 'Gagal registrasi user' });
    }
  });

  // 2. Users Management (Hak Akses Data Berdasarkan Role JWT)
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      // 1. Ekstraksi peran (role) dari JWT Header
      let callerRole: string | undefined = undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded && decoded.role) {
            callerRole = decoded.role;
          }
        } catch (jwtErr) {
          // Token expired or invalid
        }
      }

      // Fallback header / query param jika client belum menyertakan Bearer token
      if (!callerRole) {
        callerRole = (req.headers['x-user-role'] as string) || (req.query.caller_role as string) || undefined;
      }

      const explicitRole = req.query.role as 'murid' | 'guru' | 'admin' | undefined;

      // Logika Hak Akses Data:
      // - Guru: SELECT * FROM users WHERE role = 'murid'
      // - Admin: SELECT * FROM users tanpa filter role (semua murid, guru, admin)
      if (callerRole === 'admin') {
        const usersList = await getAllUsers(explicitRole);
        return res.json(usersList);
      } else if (callerRole === 'guru') {
        const usersList = await getAllUsers('murid');
        return res.json(usersList);
      } else {
        const usersList = await getAllUsers(explicitRole || 'murid');
        return res.json(usersList);
      }
    } catch (error: any) {
      console.error('Error in GET /api/users:', error);
      res.status(500).json({ error: error.message || 'Gagal mengambil data user' });
    }
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const { username, name, password, role, status } = req.body;
      if (!username || !name) {
        return res.status(400).json({ error: 'Username dan Nama wajib diisi' });
      }
      const created = await createUser({
        username: username.trim(),
        name: name.trim(),
        passwordPlain: password || 'siswa123',
        role: role || 'murid',
        status: status || 'aktif',
      });
      const { password: _, ...safeUser } = created;
      res.status(201).json(safeUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menambah user' });
    }
  });

  app.put('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID user tidak valid' });
      }

      const { name, username, role, status, password, passwordPlain } = req.body;
      const rawPassword = password !== undefined ? password : passwordPlain;

      const updatePayload: any = {};
      if (name !== undefined && typeof name === 'string' && name.trim().length > 0) {
        updatePayload.name = name.trim();
      }
      if (username !== undefined && typeof username === 'string' && username.trim().length > 0) {
        updatePayload.username = username.trim();
      }
      if (role !== undefined) {
        updatePayload.role = role;
      }
      if (status !== undefined) {
        updatePayload.status = status;
      }
      if (rawPassword !== undefined && typeof rawPassword === 'string' && rawPassword.trim().length > 0) {
        updatePayload.password = rawPassword.trim();
      }

      const updated = await updateUser(id, updatePayload);
      if (!updated) {
        return res.status(404).json({ error: 'User tidak ditemukan' });
      }

      const { password: _, ...safeUser } = updated;
      res.status(200).json(safeUser);
    } catch (error: any) {
      console.error('Error updating user in PUT /api/users/:id:', error);
      res.status(500).json({ error: error.message || 'Gagal mengupdate user' });
    }
  });

  // Soft Delete / Toggle Deactivate User (mengubah status menjadi 'tidak aktif')
  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID user tidak valid' });
      }
      const isPermanent = req.query.permanent === 'true';
      if (isPermanent) {
        const deleted = await deleteUser(id);
        return res.json({ message: 'User berhasil dihapus permanen', deleted });
      }

      // Default Soft Delete: Mengubah status user menjadi 'tidak aktif'
      const softDeleted = await softDeleteUser(id);
      const { password: _, ...safeUser } = softDeleted;
      res.json({ message: 'User berhasil dinonaktifkan (Soft Delete)', user: safeUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menonaktifkan user' });
    }
  });

  // 3. Exams Management
  app.get('/api/exams', async (_req: Request, res: Response) => {
    try {
      const list = await getAllExams();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengambil daftar ujian' });
    }
  });

  // GET /api/exams/active: Mengambil paket ujian aktif dan butir soalnya dari Cloud SQL
  app.get('/api/exams/active', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string | undefined;
      const examId = req.query.exam_id ? parseInt(req.query.exam_id as string, 10) : undefined;
      const allExams = await getAllExams();

      let activeExam = null;
      if (examId) {
        activeExam = allExams.find((e) => e.id === examId) || null;
      } else if (token) {
        activeExam = allExams.find((e) => e.token.trim().toUpperCase() === token.trim().toUpperCase()) || null;
      } else {
        activeExam = allExams.find((e) => e.status === 'Aktif') || (allExams.length > 0 ? allExams[0] : null);
      }

      if (!activeExam) {
        return res.status(404).json({ error: 'Tidak ada paket ujian aktif di database' });
      }

      const now = new Date();
      if (activeExam.waktu_mulai) {
        const startTime = new Date(activeExam.waktu_mulai);
        if (!isNaN(startTime.getTime()) && now.getTime() < startTime.getTime()) {
          return res.status(403).json({
            success: false,
            error: 'Jadwal ujian ini belum dimulai. Silakan cek kembali jadwal Anda.',
            message: 'Jadwal ujian ini belum dimulai. Silakan cek kembali jadwal Anda.',
            waktu_mulai: activeExam.waktu_mulai,
          });
        }
      }

      if (activeExam.waktu_selesai) {
        const endTime = new Date(activeExam.waktu_selesai);
        if (!isNaN(endTime.getTime()) && now.getTime() > endTime.getTime()) {
          return res.status(403).json({
            success: false,
            error: 'Jadwal ujian ini sudah berakhir dan tidak dapat diakses lagi.',
            message: 'Jadwal ujian ini sudah berakhir dan tidak dapat diakses lagi.',
            waktu_selesai: activeExam.waktu_selesai,
          });
        }
      }

      const rawQuestions = await getQuestionsByExamId(activeExam.id);
      // Sanitasi: Siswa saat ujian tidak boleh melihat kunci jawaban
      const studentQuestions = rawQuestions.map((item: any) => {
        const { kunci, ...q } = item;
        return q;
      });

      res.json({
        exam: activeExam,
        questions: studentQuestions,
        totalQuestions: studentQuestions.length,
      });
    } catch (error: any) {
      console.error('Error fetching active exam:', error);
      res.status(500).json({ error: error.message || 'Gagal mengambil soal ujian aktif' });
    }
  });

  app.get('/api/exams/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID ujian tidak valid' });
      }
      const exam = await getExamById(id);
      if (!exam) return res.status(404).json({ error: 'Ujian tidak ditemukan' });
      const questionsList = await getQuestionsByExamId(id);
      res.json({ exam, totalQuestions: questionsList.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengambil detail ujian' });
    }
  });

  app.post('/api/exams', async (req: Request, res: Response) => {
    try {
      const { kode_paket, mapel, kelas, durasi, token, status, tipe_penilaian, waktu_mulai, waktu_selesai, source_package_id } = req.body;
      const created = await createExam({
        kode_paket: kode_paket || `PKT-${Date.now().toString().slice(-4)}`,
        mapel: mapel || 'Mata Pelajaran',
        kelas: kelas || 'Semua Kelas',
        durasi: durasi ? parseInt(durasi, 10) : 60,
        token: token ? token.toString().trim().toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase(),
        status: status || 'Draft',
        tipe_penilaian: tipe_penilaian || 'Otomatis',
        waktu_mulai: waktu_mulai ? new Date(waktu_mulai) : null,
        waktu_selesai: waktu_selesai ? new Date(waktu_selesai) : null,
      });

      // Jika jadwal dibuat dari paket soal tertentu, salin butir soalnya
      if (source_package_id && created?.id) {
        const srcQuestions = await getQuestionsByExamId(parseInt(source_package_id, 10));
        for (const q of srcQuestions) {
          await createQuestion({
            exam_id: created.id,
            guru_id: q.guru_id || null,
            tipe_media: q.tipe_media || 'Teks',
            link_media: q.link_media || null,
            pertanyaan: q.pertanyaan,
            opsi_a: q.opsi_a,
            opsi_b: q.opsi_b,
            opsi_c: q.opsi_c,
            opsi_d: q.opsi_d,
            opsi_e: q.opsi_e || null,
            kunci: q.kunci || 'A',
            bobot_poin: q.bobot_poin || 20,
          });
        }
      }

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error in POST /api/exams:', error);
      res.status(500).json({ error: error.message || 'Gagal membuat ujian' });
    }
  });

  app.put('/api/exams/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = { ...req.body };
      if (data.durasi) data.durasi = parseInt(data.durasi, 10);
      if (data.waktu_mulai) data.waktu_mulai = new Date(data.waktu_mulai);
      if (data.waktu_selesai) data.waktu_selesai = new Date(data.waktu_selesai);

      const updated = await updateExam(id, data);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengupdate ujian' });
    }
  });

  app.delete('/api/exams/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await deleteExam(id);
      res.json({ message: 'Ujian berhasil dihapus', deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menghapus ujian' });
    }
  });

  // 4. Questions Management (Bank Soal)
  app.get('/api/questions', async (req: Request, res: Response) => {
    try {
      const examId = req.query.exam_id ? parseInt(req.query.exam_id as string, 10) : undefined;
      const pool = getPool();
      if (examId) {
        const result = await pool.query(
          `SELECT q.*, e.kode_paket FROM questions q LEFT JOIN exams e ON q.exam_id = e.id WHERE q.exam_id = $1 ORDER BY q.id DESC`,
          [examId]
        );
        return res.json(result.rows);
      }
      const result = await pool.query(
        `SELECT q.*, e.kode_paket FROM questions q LEFT JOIN exams e ON q.exam_id = e.id ORDER BY q.id DESC`
      );
      res.json(result.rows);
    } catch (error: any) {
      console.error('Error fetching questions from database:', error);
      try {
        const examId = req.query.exam_id ? parseInt(req.query.exam_id as string, 10) : undefined;
        const list = await getAllQuestions(examId);
        return res.json(list);
      } catch (fallbackErr: any) {
        res.status(500).json({ error: error.message || 'Gagal mengambil daftar bank soal' });
      }
    }
  });

  app.post('/api/questions', async (req: Request, res: Response) => {
    try {
      const {
        exam_id,
        guru_id,
        tipe_media,
        pertanyaan,
        opsi_a,
        opsi_b,
        opsi_c,
        opsi_d,
        opsi_e,
        kunci,
        bobot_poin,
      } = req.body;

      if (!exam_id || !pertanyaan) {
        return res.status(400).json({ error: 'Data soal belum lengkap (exam_id dan pertanyaan wajib diisi)' });
      }

      const pool = getPool();

      // Ensure columns can accept NULL for Essay questions
      try {
        await pool.query(`
          ALTER TABLE questions ALTER COLUMN opsi_a DROP NOT NULL;
          ALTER TABLE questions ALTER COLUMN opsi_b DROP NOT NULL;
          ALTER TABLE questions ALTER COLUMN opsi_c DROP NOT NULL;
          ALTER TABLE questions ALTER COLUMN opsi_d DROP NOT NULL;
          ALTER TABLE questions ALTER COLUMN opsi_e DROP NOT NULL;
          ALTER TABLE questions ALTER COLUMN kunci DROP NOT NULL;
        `);
      } catch (alterErr) {
        // Ignore if already nullable
      }

      const isEssay = kunci === 'essay' || (!opsi_a && !opsi_b);
      const safeOpsiA = opsi_a !== undefined && opsi_a !== null ? opsi_a : (isEssay ? null : '');
      const safeOpsiB = opsi_b !== undefined && opsi_b !== null ? opsi_b : (isEssay ? null : '');
      const safeOpsiC = opsi_c !== undefined && opsi_c !== null ? opsi_c : null;
      const safeOpsiD = opsi_d !== undefined && opsi_d !== null ? opsi_d : null;
      const safeOpsiE = opsi_e !== undefined && opsi_e !== null ? opsi_e : null;
      const safeKunci = kunci || (isEssay ? 'essay' : 'A');

      const insertSql = `
        INSERT INTO questions (exam_id, guru_id, tipe_media, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_poin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      let values = [
        parseInt(exam_id, 10),
        guru_id ? parseInt(guru_id, 10) : null,
        tipe_media || 'Teks',
        pertanyaan,
        safeOpsiA,
        safeOpsiB,
        safeOpsiC,
        safeOpsiD,
        safeOpsiE,
        safeKunci,
        bobot_poin ? parseFloat(bobot_poin) : 10,
      ];

      try {
        const result = await pool.query(insertSql, values);
        return res.status(201).json(result.rows[0]);
      } catch (queryErr: any) {
        // If not-null constraint violation on opsi_a, fallback to empty string and retry
        if (queryErr?.message?.includes('not-null') || queryErr?.message?.includes('opsi_a')) {
          values = [
            parseInt(exam_id, 10),
            guru_id ? parseInt(guru_id, 10) : null,
            tipe_media || 'Teks',
            pertanyaan,
            safeOpsiA ?? '',
            safeOpsiB ?? '',
            safeOpsiC ?? '',
            safeOpsiD ?? '',
            safeOpsiE ?? '',
            safeKunci ?? 'essay',
            bobot_poin ? parseFloat(bobot_poin) : 10,
          ];
          const retryResult = await pool.query(insertSql, values);
          return res.status(201).json(retryResult.rows[0]);
        }
        throw queryErr;
      }
    } catch (error: any) {
      console.error('Error creating question in database:', error);
      res.status(500).json({ error: error.message || 'Gagal menyimpan butir soal ke database' });
    }
  });

  app.get('/api/exams/:examId/questions', async (req: Request, res: Response) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      const isStudentView = req.query.studentView === 'true';
      const list = await getQuestionsByExamId(examId);

      if (isStudentView) {
        // Jangan kirim kunci jawaban ke siswa saat mengerjakan
        const studentQuestions = list.map((item: any) => {
          const { kunci, ...q } = item;
          return q;
        });
        return res.json(studentQuestions);
      }

      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengambil butir soal' });
    }
  });

  app.post('/api/exams/:examId/questions', async (req: Request, res: Response) => {
    try {
      const examId = parseInt(req.params.examId, 10);
      const {
        guru_id,
        question_type,
        tipe_media,
        link_media,
        pertanyaan,
        opsi_a,
        opsi_b,
        opsi_c,
        opsi_d,
        opsi_e,
        kunci,
        bobot_poin,
      } = req.body;

      const qType = question_type === 'essay' ? 'essay' : 'pilihan_ganda';
      const isEssay = qType === 'essay';

      const created = await createQuestion({
        exam_id: examId,
        guru_id: guru_id ? parseInt(guru_id, 10) : null,
        question_type: qType,
        tipe_media: tipe_media || 'Teks',
        link_media: link_media || null,
        pertanyaan,
        opsi_a: isEssay ? null : (opsi_a || null),
        opsi_b: isEssay ? null : (opsi_b || null),
        opsi_c: isEssay ? null : (opsi_c || null),
        opsi_d: isEssay ? null : (opsi_d || null),
        opsi_e: isEssay ? null : (opsi_e || null),
        kunci: isEssay ? 'essay' : (kunci ? kunci.trim().toUpperCase() : 'A'),
        bobot_poin: bobot_poin ? parseFloat(bobot_poin) : 20,
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menambah soal' });
    }
  });

  app.put('/api/questions/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = { ...req.body };
      if (data.bobot_poin) data.bobot_poin = parseFloat(data.bobot_poin);
      if (data.question_type === 'essay') {
        data.opsi_a = null;
        data.opsi_b = null;
        data.opsi_c = null;
        data.opsi_d = null;
        data.opsi_e = null;
        data.kunci = 'essay';
      }
      const updated = await updateQuestion(id, data);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengupdate soal' });
    }
  });

  app.delete('/api/questions/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await deleteQuestion(id);
      res.json({ message: 'Soal berhasil dihapus', deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menghapus soal' });
    }
  });

  // 5. CBT Sesi & Student Answer Operations (CBT Core REST APIs)

  // POST /start-exam & POST /verify-token: Verifikasi Token & Inisialisasi Sesi Ujian
  const handleStartExam = async (req: Request, res: Response) => {
    try {
      const { exam_id, user_id, token, username, kode_paket } = req.body;

      // Resolve User
      let targetUserId = user_id ? parseInt(user_id, 10) : null;
      if (!targetUserId && username) {
        const u = await findUserByUsername(username);
        if (u) targetUserId = u.id;
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'user_id atau username siswa wajib diisi',
          error: 'user_id atau username siswa wajib diisi',
        });
      }

      const user = await findUserById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User / Siswa tidak ditemukan di database',
          error: 'User / Siswa tidak ditemukan di database',
        });
      }

      if (user.status !== 'aktif') {
        return res.status(403).json({
          success: false,
          message: 'Akun siswa berstatus tidak aktif. Tidak dapat mengikuti ujian.',
          error: 'Akun siswa berstatus tidak aktif. Tidak dapat mengikuti ujian.',
        });
      }

      // LANGKAH 1: Cari Ujian - Query ke tabel exams berdasarkan token
      const cleanToken = token ? token.toString().trim() : '';
      if (!cleanToken && !exam_id && !kode_paket) {
        return res.status(400).json({
          success: false,
          message: 'Token ujian wajib dimasukkan',
          error: 'Token ujian wajib dimasukkan',
        });
      }

      let exam: any = null;
      const pool = getPool();

      // Query langsung ke Cloud SQL PostgreSQL berdasarkan token
      if (cleanToken) {
        try {
          const sqlRes = await pool.query(
            `SELECT id, kode_paket, mapel, kelas, waktu_mulai, waktu_selesai, durasi, token, status, tipe_penilaian FROM exams WHERE UPPER(TRIM(token)) = UPPER(TRIM($1)) LIMIT 1`,
            [cleanToken]
          );
          if (sqlRes.rows && sqlRes.rows.length > 0) {
            exam = sqlRes.rows[0];
          }
        } catch (dbErr) {
          console.warn('DB query by token error:', dbErr);
        }
      }

      // Fallback query by id jika belum ditemukan
      if (!exam && exam_id) {
        try {
          const sqlRes = await pool.query(
            `SELECT id, kode_paket, mapel, kelas, waktu_mulai, waktu_selesai, durasi, token, status, tipe_penilaian FROM exams WHERE id = $1 LIMIT 1`,
            [parseInt(exam_id, 10)]
          );
          if (sqlRes.rows && sqlRes.rows.length > 0) {
            exam = sqlRes.rows[0];
          }
        } catch (dbErr) {
          console.warn('DB query by id error:', dbErr);
        }
      }

      // Fallback memory store jika DB offline
      if (!exam) {
        const allExams = await getAllExams();
        if (cleanToken) {
          exam = allExams.find((e) => e.token && e.token.trim().toUpperCase() === cleanToken.toUpperCase()) || null;
        } else if (exam_id) {
          exam = allExams.find((e) => e.id === parseInt(exam_id, 10)) || null;
        } else if (kode_paket) {
          exam = allExams.find((e) => e.kode_paket && e.kode_paket.trim().toUpperCase() === kode_paket.toString().trim().toUpperCase()) || null;
        }
      }

      // 1. Jika tidak ada / token salah -> return 404 'Token tidak valid'
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Token ujian tidak valid. Pastikan token yang Anda masukkan sesuai dengan token dari pengawas.',
          error: 'Token ujian tidak valid. Pastikan token yang Anda masukkan sesuai dengan token dari pengawas.',
        });
      }

      if (cleanToken && exam.token && exam.token.trim().toUpperCase() !== cleanToken.toUpperCase()) {
        return res.status(404).json({
          success: false,
          message: 'Token ujian tidak valid. Pastikan token yang Anda masukkan sesuai dengan token dari pengawas.',
          error: 'Token ujian tidak valid. Pastikan token yang Anda masukkan sesuai dengan token dari pengawas.',
        });
      }

      // LANGKAH 2: Validasi Waktu Mulai (CEK INI DULU)
      // Bandingkan waktu server saat ini dengan waktu_mulai. Jika waktu saat ini < waktu_mulai, return HTTP 403:
      const now = new Date();
      if (exam.waktu_mulai) {
        const startTime = new Date(exam.waktu_mulai);
        if (!isNaN(startTime.getTime()) && now.getTime() < startTime.getTime()) {
          return res.status(403).json({
            success: false,
            message: 'Jadwal ujian ini belum dimulai. Silakan cek kembali jadwal Anda.',
            error: 'Jadwal ujian ini belum dimulai. Silakan cek kembali jadwal Anda.',
            waktu_mulai: exam.waktu_mulai,
          });
        }
      }

      // LANGKAH 3: Validasi Waktu Selesai
      // Jika waktu saat ini > waktu_selesai, return HTTP 403:
      if (exam.waktu_selesai) {
        const endTime = new Date(exam.waktu_selesai);
        if (!isNaN(endTime.getTime()) && now.getTime() > endTime.getTime()) {
          return res.status(403).json({
            success: false,
            message: 'Jadwal ujian ini sudah berakhir dan tidak dapat diakses lagi.',
            error: 'Jadwal ujian ini sudah berakhir dan tidak dapat diakses lagi.',
            waktu_selesai: exam.waktu_selesai,
          });
        }
      }

      // Validasi Status Exam
      if (exam.status && exam.status !== 'Aktif') {
        return res.status(403).json({
          success: false,
          message: `Paket ujian "${exam.mapel}" saat ini berstatus "${exam.status}". Ujian hanya dapat diikuti jika berstatus "Aktif".`,
          error: `Paket ujian "${exam.mapel}" saat ini berstatus "${exam.status}". Ujian hanya dapat diikuti jika berstatus "Aktif".`,
          exam_status: exam.status,
        });
      }

      // LANGKAH 4: Cek Riwayat Sesi (CEK INI TERAKHIR)
      // Query ke tabel exam_sessions menggunakan user_id dan exam_id. HANYA JIKA data ditemukan DAN status_pengerjaan adalah 'Selesai' atau 'Force Submit', BARU return HTTP 403:
      try {
        const sessionCheckRes = await pool.query(
          `SELECT id, status_pengerjaan FROM exam_sessions WHERE user_id = $1 AND exam_id = $2 ORDER BY id DESC`,
          [targetUserId, exam.id]
        );

        if (sessionCheckRes.rows && sessionCheckRes.rows.length > 0) {
          const finishedSession = sessionCheckRes.rows.find(
            (row: any) => row.status_pengerjaan === 'Selesai' || row.status_pengerjaan === 'Force Submit'
          );

          if (finishedSession) {
            return res.status(403).json({
              success: false,
              message: 'Anda sudah menyelesaikan ujian ini dan tidak dapat mengulangnya kembali.',
              error: 'Anda sudah menyelesaikan ujian ini dan tidak dapat mengulangnya kembali.',
            });
          }
        }
      } catch (dbCheckErr) {
        console.warn('Check exam_sessions query error:', dbCheckErr);
      }

      // Jika semua validasi lolos, buat / dapatkan sesi ujian
      const session = await startOrGetExamSession(exam.id, targetUserId, !!req.body.force_new);

      res.status(200).json({
        success: true,
        message: 'Sesi ujian berhasil dimulai / dimuat',
        session,
        exam: {
          id: exam.id,
          kode_paket: exam.kode_paket,
          mapel: exam.mapel,
          kelas: exam.kelas,
          waktu_mulai: exam.waktu_mulai,
          waktu_selesai: exam.waktu_selesai,
          durasi: exam.durasi,
          status: exam.status,
        },
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
        },
      });
    } catch (error: any) {
      console.error('Error start-exam:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal memulai sesi ujian',
        message: error.message || 'Gagal memulai sesi ujian',
      });
    }
  };

  app.post('/start-exam', handleStartExam);
  app.post('/api/start-exam', handleStartExam);
  app.post('/verify-token', handleStartExam);
  app.post('/api/verify-token', handleStartExam);
  app.post('/api/sessions/start', handleStartExam);

  // POST /auto-save & POST /api/answers/auto-save: API untuk menyimpan jawaban siswa ke tabel Student_Answers setiap kali mereka klik opsi A/B/C/D atau mengetik essay
  const handleAutoSave = async (req: Request, res: Response) => {
    try {
      const { session_id, sessionId, question_id, questionId, jawaban_siswa, jawaban, studentAnswer, user_id, userId, exam_id, examId } = req.body;
      const sId = session_id || sessionId || (req.params.id ? parseInt(req.params.id, 10) : 1);
      const qId = question_id || questionId;
      const answerVal = jawaban_siswa !== undefined ? jawaban_siswa : (jawaban !== undefined ? jawaban : studentAnswer);

      if (!qId || answerVal === undefined) {
        return res.status(400).json({
          error: 'question_id dan jawaban_siswa wajib dikirim',
        });
      }

      const sessionIdNum = parseInt(sId, 10) || 1;
      const questionIdNum = parseInt(qId, 10);
      const fallbackData = {
        user_id: user_id ? parseInt(user_id, 10) : (userId ? parseInt(userId, 10) : undefined),
        exam_id: exam_id ? parseInt(exam_id, 10) : (examId ? parseInt(examId, 10) : undefined),
      };

      const saved = await saveStudentAnswer(sessionIdNum, questionIdNum, String(answerVal), fallbackData);

      res.json({
        success: true,
        message: 'Jawaban tersimpan otomatis di PostgreSQL (Student_Answers)',
        answer: saved,
        saved_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error auto-save:', error);
      res.status(500).json({ error: error.message || 'Gagal menyimpan jawaban otomatis' });
    }
  };

  app.post('/auto-save', handleAutoSave);
  app.post('/api/auto-save', handleAutoSave);
  app.post('/api/answers/auto-save', handleAutoSave);
  app.post('/api/sessions/:id/answer', async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id, 10) || 1;
      const { question_id, questionId, jawaban_siswa, jawaban, studentAnswer, user_id, userId, exam_id, examId } = req.body;
      const qId = question_id || questionId;
      const answerVal = jawaban_siswa !== undefined ? jawaban_siswa : (jawaban !== undefined ? jawaban : studentAnswer);

      if (!qId || answerVal === undefined) {
        return res.status(400).json({ error: 'question_id dan jawaban_siswa wajib dikirim' });
      }

      const fallbackData = {
        user_id: user_id ? parseInt(user_id, 10) : (userId ? parseInt(userId, 10) : undefined),
        exam_id: exam_id ? parseInt(exam_id, 10) : (examId ? parseInt(examId, 10) : undefined),
      };

      const saved = await saveStudentAnswer(sessionId, parseInt(qId, 10), String(answerVal), fallbackData);
      res.json({ message: 'Jawaban tersimpan', answer: saved });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal menyimpan jawaban' });
    }
  });

  // POST /violation & POST /api/exams/violation: API untuk menambah 'jml_pelanggaran' +1 dan mencatat log waktu di 'detail_pelanggaran' pada tabel Exam_Sessions. Jika pelanggaran mencapai 3, ubah status_pengerjaan menjadi 'Force Submit'.
  const handleViolation = async (req: Request, res: Response) => {
    try {
      const { session_id, sessionId, reason, detail, violationType, user_id, userId, exam_id, examId } = req.body;
      const targetSessionId = session_id ? parseInt(session_id, 10) : (sessionId ? parseInt(sessionId, 10) : (req.params.id ? parseInt(req.params.id, 10) : 1));

      const fallbackData = {
        user_id: user_id ? parseInt(user_id, 10) : (userId ? parseInt(userId, 10) : undefined),
        exam_id: exam_id ? parseInt(exam_id, 10) : (examId ? parseInt(examId, 10) : undefined),
      };

      const violationReason = reason || detail || violationType || 'Meninggalkan tab / jendela ujian (Anti-Cheat)';
      const updated = await recordViolation(targetSessionId || 1, violationReason, fallbackData);

      res.json({
        success: true,
        message: updated.forceSubmitted
          ? 'Pelanggaran mencapai 3x. Sesi ujian otomatis dialihkan ke status Force Submit!'
          : 'Pelanggaran berhasil dicatat ke tabel Exam_Sessions',
        session: updated,
        jml_pelanggaran: updated.jml_pelanggaran,
        status_pengerjaan: updated.status_pengerjaan,
        forceSubmitted: !!updated.forceSubmitted,
        warning: updated.warning,
      });
    } catch (error: any) {
      console.error('Error violation:', error);
      res.status(500).json({ error: error.message || 'Gagal mencatat pelanggaran' });
    }
  };

  app.post('/violation', handleViolation);
  app.post('/api/violation', handleViolation);
  app.post('/api/exams/violation', handleViolation);
  app.post('/api/sessions/:id/violation', handleViolation);

  // POST /reset-violation & POST /api/reset-violation: Mengembalikan nilai pelanggaran siswa ke 0
  const handleResetViolation = async (req: Request, res: Response) => {
    try {
      const { session_id, sessionId, user_id, userId, exam_id, examId } = req.body;
      const targetSessionId = session_id ? parseInt(session_id, 10) : (sessionId ? parseInt(sessionId, 10) : (req.params.id ? parseInt(req.params.id, 10) : 1));

      const fallbackData = {
        user_id: user_id ? parseInt(user_id, 10) : (userId ? parseInt(userId, 10) : undefined),
        exam_id: exam_id ? parseInt(exam_id, 10) : (examId ? parseInt(examId, 10) : undefined),
      };

      const updated = await resetViolation(targetSessionId || 1, fallbackData);
      res.json({
        success: true,
        message: 'Pelanggaran siswa berhasil di-reset menjadi 0',
        session: updated,
        jml_pelanggaran: 0,
        status_pengerjaan: updated.status_pengerjaan,
      });
    } catch (error: any) {
      console.error('Error reset violation:', error);
      res.status(500).json({ error: error.message || 'Gagal mereset pelanggaran' });
    }
  };

  app.post('/reset-violation', handleResetViolation);
  app.post('/api/reset-violation', handleResetViolation);
  app.post('/api/sessions/:id/reset-violation', handleResetViolation);

  // GET /live-monitor: API untuk mengambil data Exam_Sessions secara real-time yang akan ditampilkan di panel Guru
  const handleLiveMonitor = async (req: Request, res: Response) => {
    try {
      const examId = req.query.exam_id ? parseInt(req.query.exam_id as string, 10) : undefined;
      const liveSessions = await getLiveMonitorSessions(examId);

      res.json({
        timestamp: new Date().toISOString(),
        total_sessions: liveSessions.length,
        summary: {
          mengerjakan: liveSessions.filter((s) => s.status_pengerjaan === 'Sedang Mengerjakan').length,
          selesai: liveSessions.filter((s) => s.status_pengerjaan === 'Selesai').length,
          force_submit: liveSessions.filter((s) => s.status_pengerjaan === 'Force Submit').length,
          total_pelanggaran: liveSessions.reduce((acc, curr) => acc + (curr.jml_pelanggaran || 0), 0),
        },
        sessions: liveSessions,
      });
    } catch (error: any) {
      console.error('Error live-monitor:', error);
      res.status(500).json({ error: error.message || 'Gagal mengambil data live monitor' });
    }
  };

  app.get('/live-monitor', handleLiveMonitor);
  app.get('/api/live-monitor', handleLiveMonitor);

  app.get('/api/sessions/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const details = await getSessionDetails(id);
      if (!details) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
      res.json(details);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengambil data sesi' });
    }
  });

  // POST /submit-exam & POST /api/submit-exam: Menyelesaikan ujian, mencocokkan jawaban PG, menghitung benar/salah/kosong/nilai_pg, dan menyimpan ke Exam_Sessions
  const handleSubmitExam = async (req: Request, res: Response) => {
    try {
      const { session_id, sessionId, status, user_id, userId, exam_id, examId, answers, student_answers } = req.body;
      const targetSessionId = session_id ? parseInt(session_id, 10) : (sessionId ? parseInt(sessionId, 10) : (req.params.id ? parseInt(req.params.id, 10) : null));
      const targetUserId = user_id ? parseInt(user_id, 10) : (userId ? parseInt(userId, 10) : undefined);
      const targetExamId = exam_id ? parseInt(exam_id, 10) : (examId ? parseInt(examId, 10) : undefined);
      const ansObj = answers || student_answers || undefined;

      const fallbackData = {
        user_id: targetUserId,
        exam_id: targetExamId,
        answers: ansObj,
      };

      const result = await submitExam(targetSessionId || 1, status || 'Selesai', fallbackData);
      res.json({
        success: true,
        message: 'Ujian berhasil diselesaikan dan dinilai secara otomatis',
        session: result.session,
        finalScore: result.finalScore,
        nilai_pg: result.nilai_pg,
        nilai_essay: result.nilai_essay,
        has_essay: result.has_essay,
        totalCorrect: result.totalCorrect,
        stats: result.stats,
      });
    } catch (error: any) {
      console.error('DB ERROR:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal submit ujian' });
    }
  };

  app.post('/submit-exam', handleSubmitExam);
  app.post('/api/submit-exam', handleSubmitExam);
  app.post('/api/sessions/:id/submit', handleSubmitExam);

  app.get('/api/sessions', async (_req: Request, res: Response) => {
    try {
      const all = await getAllSessions();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal mengambil sesi' });
    }
  });

  // 5. Fitur Pasca-Ujian: Koreksi Essay & Rekapitulasi Hasil Ujian

  // GET /api/essay-answers: Ambil seluruh daftar jawaban bertipe Essay untuk dinilai oleh guru
  app.get('/api/essay-answers', async (req: Request, res: Response) => {
    try {
      const examId = req.query.exam_id ? parseInt(req.query.exam_id as string, 10) : undefined;
      const sessionId = req.query.session_id ? parseInt(req.query.session_id as string, 10) : undefined;
      const list = await getAllEssayAnswers(examId, sessionId);
      res.json(list);
    } catch (error: any) {
      console.error('Error GET /api/essay-answers:', error);
      res.status(500).json({ error: error.message || 'Gagal mengambil daftar jawaban essay' });
    }
  });

  // POST /api/grade-essay & POST /api/essay-answers/:id/grade: Menyimpan skor_guru dan menghitung total_nilai (nilai_pg + nilai_essay)
  const handleGradeEssay = async (req: Request, res: Response) => {
    try {
      const answerId = req.params.id ? parseInt(req.params.id, 10) : parseInt(req.body.answer_id || req.body.id, 10);
      const skorGuru = req.body.skor_guru !== undefined ? req.body.skor_guru : req.body.score;

      if (!answerId || isNaN(answerId)) {
        return res.status(400).json({ error: 'answer_id wajib disertakan' });
      }

      if (skorGuru === undefined || isNaN(Number(skorGuru))) {
        return res.status(400).json({ error: 'skor_guru berupa angka valid wajib disertakan' });
      }

      const result = await gradeEssayAnswer(answerId, Number(skorGuru));
      res.json({
        success: true,
        message: 'Nilai essay berhasil disimpan dan total nilai ujian telah dikalkulasi ulang',
        data: result,
      });
    } catch (error: any) {
      console.error('Error grading essay:', error);
      res.status(500).json({ error: error.message || 'Gagal menyimpan nilai essay' });
    }
  };

  app.post('/api/grade-essay', handleGradeEssay);
  app.post('/api/essay-answers/:id/grade', handleGradeEssay);
  app.put('/api/essay-answers/:id', handleGradeEssay);

  // GET /api/exam-results & GET /api/recap-results: Rekapitulasi nilai seluruh siswa (Status, Nilai PG, Nilai Essay, Total Nilai)
  app.get(['/api/exam-results', '/api/recap-results'], async (req: Request, res: Response) => {
    try {
      const examId = req.query.exam_id ? parseInt(req.query.exam_id as string, 10) : undefined;
      const results = await getAllExamResults(examId);
      res.json(results);
    } catch (error: any) {
      console.error('Error GET /api/exam-results:', error);
      res.status(500).json({ error: error.message || 'Gagal mengambil rekapitulasi hasil ujian' });
    }
  });

  // 6. SQL Documentation & Schema Endpoint
  const handleSchemaInfo = (_req: Request, res: Response) => {
    const schemaDetails = {
      tables: [
        {
          name: 'Users',
          tableName: 'users',
          description: 'Menyimpan data pengguna sistem (guru dan murid) dengan password terenkripsi bcrypt.',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PRIMARY KEY', description: 'ID unik pengguna' },
            { name: 'uid', type: 'TEXT', constraints: 'UNIQUE, NULLABLE', description: 'ID integrasi Firebase Auth SSO' },
            { name: 'username', type: 'TEXT', constraints: 'NOT NULL, UNIQUE', description: 'Username unik login' },
            { name: 'name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama lengkap user' },
            { name: 'password', type: 'TEXT', constraints: 'NOT NULL', description: 'Hash password terenkripsi bcrypt' },
            { name: 'role', type: "ENUM('murid', 'guru')", constraints: "NOT NULL, DEFAULT 'murid'", description: 'Hak akses pengguna' },
            { name: 'status', type: "ENUM('aktif', 'tidak aktif')", constraints: "NOT NULL, DEFAULT 'aktif'", description: 'Status keaktifan user' },
            { name: 'created_at', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan' },
          ],
          ddlSql: `CREATE TYPE "public"."user_role" AS ENUM('murid', 'guru');
CREATE TYPE "public"."user_status" AS ENUM('aktif', 'tidak aktif');

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "uid" TEXT UNIQUE,
  "username" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'murid',
  "status" "user_status" NOT NULL DEFAULT 'aktif',
  "created_at" TIMESTAMP DEFAULT NOW()
);`,
        },
        {
          name: 'Exams',
          tableName: 'exams',
          description: 'Menyimpan paket ujian, jadwal, durasi, token otentikasi, serta status publikasi.',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PRIMARY KEY', description: 'ID unik ujian' },
            { name: 'kode_paket', type: 'TEXT', constraints: 'NOT NULL, UNIQUE', description: 'Kode unik paket soal' },
            { name: 'mapel', type: 'TEXT', constraints: 'NOT NULL', description: 'Mata pelajaran' },
            { name: 'kelas', type: 'TEXT', constraints: 'NOT NULL', description: 'Target tingkat / rombel kelas' },
            { name: 'waktu_mulai', type: 'TIMESTAMP', constraints: 'NULLABLE', description: 'Waktu mulai ujian dibuka' },
            { name: 'waktu_selesai', type: 'TIMESTAMP', constraints: 'NULLABLE', description: 'Waktu batas ujian ditutup' },
            { name: 'durasi', type: 'INTEGER', constraints: 'NOT NULL', description: 'Durasi pengerjaan dalam menit' },
            { name: 'token', type: 'TEXT', constraints: 'NOT NULL', description: 'Token verifikasi siswa' },
            { name: 'status', type: "ENUM('Aktif', 'Draft', 'Selesai')", constraints: "NOT NULL, DEFAULT 'Draft'", description: 'Status ujian' },
            { name: 'tipe_penilaian', type: 'TEXT', constraints: "NOT NULL, DEFAULT 'Otomatis'", description: 'Jenis penilaian skor' },
            { name: 'created_at', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan' },
          ],
          ddlSql: `CREATE TYPE "public"."exam_status" AS ENUM('Aktif', 'Draft', 'Selesai');

CREATE TABLE "exams" (
  "id" SERIAL PRIMARY KEY,
  "kode_paket" TEXT NOT NULL UNIQUE,
  "mapel" TEXT NOT NULL,
  "kelas" TEXT NOT NULL,
  "waktu_mulai" TIMESTAMP,
  "waktu_selesai" TIMESTAMP,
  "durasi" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "status" "exam_status" NOT NULL DEFAULT 'Draft',
  "tipe_penilaian" TEXT NOT NULL DEFAULT 'Otomatis',
  "created_at" TIMESTAMP DEFAULT NOW()
);`,
        },
        {
          name: 'Questions',
          tableName: 'questions',
          description: 'Menyimpan butir-butir soal ujian pilihan ganda (A-E), multimedia, kunci jawaban, dan bobot poin.',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PRIMARY KEY', description: 'ID butir soal' },
            { name: 'exam_id', type: 'INTEGER', constraints: 'FK -> exams(id) ON DELETE CASCADE', description: 'Relasi ke paket ujian' },
            { name: 'guru_id', type: 'INTEGER', constraints: 'FK -> users(id) ON DELETE SET NULL', description: 'Guru pembuat soal' },
            { name: 'tipe_media', type: "ENUM('Teks', 'Image', 'Audio', 'Video')", constraints: "NOT NULL, DEFAULT 'Teks'", description: 'Media pendukung soal' },
            { name: 'link_media', type: 'TEXT', constraints: 'NULLABLE', description: 'URL / path aset media' },
            { name: 'pertanyaan', type: 'TEXT', constraints: 'NOT NULL', description: 'Konten teks pertanyaan' },
            { name: 'opsi_a', type: 'TEXT', constraints: 'NOT NULL', description: 'Pilihan Jawaban A' },
            { name: 'opsi_b', type: 'TEXT', constraints: 'NOT NULL', description: 'Pilihan Jawaban B' },
            { name: 'opsi_c', type: 'TEXT', constraints: 'NOT NULL', description: 'Pilihan Jawaban C' },
            { name: 'opsi_d', type: 'TEXT', constraints: 'NOT NULL', description: 'Pilihan Jawaban D' },
            { name: 'opsi_e', type: 'TEXT', constraints: 'NULLABLE', description: 'Pilihan Jawaban E' },
            { name: 'kunci', type: 'TEXT', constraints: 'NOT NULL', description: 'Kunci jawaban benar (A/B/C/D/E)' },
            { name: 'bobot_poin', type: 'DOUBLE PRECISION', constraints: 'NOT NULL, DEFAULT 1.0', description: 'Bobot nilai per soal' },
            { name: 'created_at', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan' },
          ],
          ddlSql: `CREATE TYPE "public"."media_type" AS ENUM('Teks', 'Image', 'Audio', 'Video');

CREATE TABLE "questions" (
  "id" SERIAL PRIMARY KEY,
  "exam_id" INTEGER NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "guru_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "tipe_media" "media_type" NOT NULL DEFAULT 'Teks',
  "link_media" TEXT,
  "pertanyaan" TEXT NOT NULL,
  "opsi_a" TEXT NOT NULL,
  "opsi_b" TEXT NOT NULL,
  "opsi_c" TEXT NOT NULL,
  "opsi_d" TEXT NOT NULL,
  "opsi_e" TEXT,
  "kunci" TEXT NOT NULL,
  "bobot_poin" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "created_at" TIMESTAMP DEFAULT NOW()
);`,
        },
        {
          name: 'Exam_Sessions',
          tableName: 'exam_sessions',
          description: 'Melacak sesi ujian aktif tiap siswa, timer durasi, proctoring/deteksi pelanggaran, dan total skor akhir.',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PRIMARY KEY', description: 'ID sesi ujian' },
            { name: 'exam_id', type: 'INTEGER', constraints: 'FK -> exams(id) ON DELETE CASCADE', description: 'Paket ujian yang dikerjakan' },
            { name: 'user_id', type: 'INTEGER', constraints: 'FK -> users(id) ON DELETE CASCADE', description: 'Siswa peserta ujian' },
            { name: 'waktu_mulai_siswa', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Waktu mulai pengerjaan siswa' },
            { name: 'waktu_submit', type: 'TIMESTAMP', constraints: 'NULLABLE', description: 'Waktu siswa mengumpulkan ujian' },
            { name: 'status_pengerjaan', type: "ENUM('Sedang Mengerjakan', 'Selesai', 'Force Submit')", constraints: "NOT NULL, DEFAULT 'Sedang Mengerjakan'", description: 'Status pengerjaan' },
            { name: 'terakhir_aktif', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Heartbeat koneksi terakhir' },
            { name: 'jml_pelanggaran', type: 'INTEGER', constraints: 'NOT NULL, DEFAULT 0', description: 'Jumlah pelanggaran (pindah tab/blur)' },
            { name: 'detail_pelanggaran', type: 'TEXT', constraints: 'NULLABLE', description: 'Log catatan pelanggaran' },
            { name: 'total_nilai', type: 'DOUBLE PRECISION', constraints: 'DEFAULT 0', description: 'Nilai akhir siswa (skala 0-100)' },
            { name: 'created_at', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan sesi' },
          ],
          ddlSql: `CREATE TYPE "public"."session_status" AS ENUM('Sedang Mengerjakan', 'Selesai', 'Force Submit');

CREATE TABLE "exam_sessions" (
  "id" SERIAL PRIMARY KEY,
  "exam_id" INTEGER NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "waktu_mulai_siswa" TIMESTAMP DEFAULT NOW(),
  "waktu_submit" TIMESTAMP,
  "status_pengerjaan" "session_status" NOT NULL DEFAULT 'Sedang Mengerjakan',
  "terakhir_aktif" TIMESTAMP DEFAULT NOW(),
  "jml_pelanggaran" INTEGER NOT NULL DEFAULT 0,
  "detail_pelanggaran" TEXT,
  "total_nilai" DOUBLE PRECISION DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW()
);`,
        },
        {
          name: 'Student_Answers',
          tableName: 'student_answers',
          description: 'Menyimpan lembar jawaban butir per butir soal milik siswa beserta status kebenaran dan skor guru.',
          columns: [
            { name: 'id', type: 'SERIAL', constraints: 'PRIMARY KEY', description: 'ID lembar jawaban' },
            { name: 'session_id', type: 'INTEGER', constraints: 'FK -> exam_sessions(id) ON DELETE CASCADE', description: 'Sesi ujian terkait' },
            { name: 'question_id', type: 'INTEGER', constraints: 'FK -> questions(id) ON DELETE CASCADE', description: 'Butir soal yang dijawab' },
            { name: 'jawaban_siswa', type: 'TEXT', constraints: 'NULLABLE', description: 'Opsi yang dipilih siswa (A/B/C/D/E)' },
            { name: 'is_correct', type: 'BOOLEAN', constraints: 'NULLABLE', description: 'Apakah jawaban siswa cocok dengan kunci' },
            { name: 'skor_guru', type: 'DOUBLE PRECISION', constraints: 'NULLABLE', description: 'Poin yang diperoleh dari soal ini' },
            { name: 'created_at', type: 'TIMESTAMP', constraints: 'DEFAULT NOW()', description: 'Waktu penyimpanan jawaban' },
          ],
          ddlSql: `CREATE TABLE "student_answers" (
  "id" SERIAL PRIMARY KEY,
  "session_id" INTEGER NOT NULL REFERENCES "exam_sessions"("id") ON DELETE CASCADE,
  "question_id" INTEGER NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "jawaban_siswa" TEXT,
  "is_correct" BOOLEAN,
  "skor_guru" DOUBLE PRECISION,
  "created_at" TIMESTAMP DEFAULT NOW()
);`,
        },
      ],
      sampleQueries: [
        {
          title: '1. Mengambil Soal Ujian untuk Siswa Berdasarkan Token',
          sql: `SELECT q.id, q.pertanyaan, q.tipe_media, q.link_media, q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.opsi_e, q.bobot_poin
FROM questions q
JOIN exams e ON q.exam_id = e.id
WHERE e.token = 'CBT26' AND e.status = 'Aktif'
ORDER BY q.id ASC;`,
        },
        {
          title: '2. Menyimpan dan Menilai Otomatis Jawaban Siswa',
          sql: `INSERT INTO student_answers (session_id, question_id, jawaban_siswa, is_correct, skor_guru)
SELECT 
  1 AS session_id,
  q.id AS question_id,
  'B' AS jawaban_siswa,
  (UPPER(q.kunci) = UPPER('B')) AS is_correct,
  CASE WHEN UPPER(q.kunci) = UPPER('B') THEN q.bobot_poin ELSE 0 END AS skor_guru
FROM questions q
WHERE q.id = 1
ON CONFLICT (id) DO UPDATE 
SET jawaban_siswa = EXCLUDED.jawaban_siswa,
    is_correct = EXCLUDED.is_correct,
    skor_guru = EXCLUDED.skor_guru;`,
        },
        {
          title: '3. Rekap Nilai Siswa & Log Pelanggaran Per Ujian',
          sql: `SELECT 
  u.name AS nama_siswa,
  u.username,
  e.mapel,
  e.kode_paket,
  s.waktu_mulai_siswa,
  s.waktu_submit,
  s.status_pengerjaan,
  s.jml_pelanggaran,
  s.total_nilai,
  COUNT(a.id) FILTER (WHERE a.is_correct = true) AS jumlah_benar,
  COUNT(a.id) FILTER (WHERE a.is_correct = false) AS jumlah_salah
FROM exam_sessions s
JOIN users u ON s.user_id = u.id
JOIN exams e ON s.exam_id = e.id
LEFT JOIN student_answers a ON a.session_id = s.id
WHERE e.id = 1
GROUP BY u.name, u.username, e.mapel, e.kode_paket, s.id;`,
        },
        {
          title: '4. Deteksi Sesi Ujian dengan Indikasi Kecurangan Tertinggi',
          sql: `SELECT 
  s.id AS session_id,
  u.name AS nama_siswa,
  e.mapel,
  s.jml_pelanggaran,
  s.detail_pelanggaran,
  s.status_pengerjaan
FROM exam_sessions s
JOIN users u ON s.user_id = u.id
JOIN exams e ON s.exam_id = e.id
WHERE s.jml_pelanggaran > 0
ORDER BY s.jml_pelanggaran DESC;`,
        },
      ],
    };

    res.json(schemaDetails);
  };

  app.get('/api/db/schema-info', handleSchemaInfo);
  app.get('/api/schema-info', handleSchemaInfo);
  app.get('/api/schema', handleSchemaInfo);

  app.post('/api/db/seed', async (_req: Request, res: Response) => {
    try {
      const result = await seedDemoData();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal seeding database', details: error.stack || error.toString() });
    }
  });

// --- GLOBAL ERROR HANDLER FOR PRODUCTION DEBUGGING ---
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: err?.message || 'A server error has occurred',
    details: err?.stack || err?.toString() || 'Unknown server error',
  });
});


export default app;

