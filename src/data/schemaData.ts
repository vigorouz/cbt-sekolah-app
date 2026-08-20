import { SchemaTableInfo, SampleQueryInfo } from '../types.ts';

export const fallbackSchemaData: {
  tables: SchemaTableInfo[];
  sampleQueries: SampleQueryInfo[];
} = {
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
        { name: 'benar_pg', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah jawaban PG benar' },
        { name: 'salah_pg', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah jawaban PG salah' },
        { name: 'kosong_pg', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah jawaban PG kosong' },
        { name: 'nilai_pg', type: 'DOUBLE PRECISION', constraints: 'DEFAULT 0', description: 'Skor nilai pilihan ganda' },
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
  "benar_pg" INTEGER DEFAULT 0,
  "salah_pg" INTEGER DEFAULT 0,
  "kosong_pg" INTEGER DEFAULT 0,
  "nilai_pg" DOUBLE PRECISION DEFAULT 0,
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
        { name: 'jawaban_siswa', type: 'TEXT', constraints: 'NULLABLE', description: 'Opsi yang dipilih siswa (A/B/C/D/E) atau teks essay' },
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
