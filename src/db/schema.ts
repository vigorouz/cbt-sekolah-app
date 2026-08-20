import { relations } from 'drizzle-orm';
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

// Enums sesuai spesifikasi
export const userRoleEnum = pgEnum('user_role', ['murid', 'guru', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['aktif', 'tidak aktif']);
export const examStatusEnum = pgEnum('exam_status', ['Aktif', 'Draft', 'Selesai']);
export const mediaTypeEnum = pgEnum('media_type', ['Teks', 'Image', 'Audio', 'Video']);
export const questionTypeEnum = pgEnum('question_type', ['pilihan_ganda', 'essay']);
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
  question_type: text('question_type').notNull().default('pilihan_ganda'), // 'pilihan_ganda' | 'essay'
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
