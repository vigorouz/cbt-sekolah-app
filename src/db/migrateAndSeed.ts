import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log('=== CBT SUPABASE MIGRATION & SEEDING SCRIPT ===');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in process.env!');
    process.exit(1);
  }

  // Masked URL log for verification
  const masked = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log(`Target Database: ${masked}`);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  console.log(' Successfully connected to Supabase PostgreSQL database!');

  try {
    console.log('\n--- 1. MIGRATION: Creating Types & Tables ---');

    // Create ENUM types safely
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('murid', 'guru');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE user_status AS ENUM ('aktif', 'tidak aktif');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE exam_status AS ENUM ('Aktif', 'Draft', 'Selesai');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE media_type AS ENUM ('Teks', 'Image', 'Audio', 'Video');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE session_status AS ENUM ('Sedang Mengerjakan', 'Selesai', 'Force Submit');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✔ Custom ENUM types verified/created.');

    // Create Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT UNIQUE,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'murid',
        status user_status NOT NULL DEFAULT 'aktif',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        kode_paket TEXT NOT NULL UNIQUE,
        mapel TEXT NOT NULL,
        kelas TEXT NOT NULL,
        waktu_mulai TIMESTAMP,
        waktu_selesai TIMESTAMP,
        durasi INTEGER NOT NULL,
        token TEXT NOT NULL,
        status exam_status NOT NULL DEFAULT 'Draft',
        tipe_penilaian TEXT NOT NULL DEFAULT 'Otomatis',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        guru_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        tipe_media media_type NOT NULL DEFAULT 'Teks',
        link_media TEXT,
        pertanyaan TEXT NOT NULL,
        opsi_a TEXT NOT NULL,
        opsi_b TEXT NOT NULL,
        opsi_c TEXT NOT NULL,
        opsi_d TEXT NOT NULL,
        opsi_e TEXT,
        kunci TEXT NOT NULL,
        bobot_poin DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS exam_sessions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        waktu_mulai_siswa TIMESTAMP DEFAULT NOW(),
        waktu_submit TIMESTAMP,
        status_pengerjaan session_status NOT NULL DEFAULT 'Sedang Mengerjakan',
        terakhir_aktif TIMESTAMP DEFAULT NOW(),
        jml_pelanggaran INTEGER NOT NULL DEFAULT 0,
        detail_pelanggaran TEXT,
        benar_pg INTEGER DEFAULT 0,
        salah_pg INTEGER DEFAULT 0,
        kosong_pg INTEGER DEFAULT 0,
        nilai_pg DOUBLE PRECISION DEFAULT 0,
        total_nilai DOUBLE PRECISION DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS student_answers (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        jawaban_siswa TEXT,
        is_correct BOOLEAN,
        skor_guru DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✔ Tables (users, exams, questions, exam_sessions, student_answers) created/verified successfully.');

    console.log('\n--- 2. SEEDING: Inserting Initial CBT Demo Data ---');

    // Check existing users count
    const userCountRes = await client.query('SELECT COUNT(*) FROM users');
    const count = parseInt(userCountRes.rows[0].count, 10);
    console.log(`Current users in database: ${count}`);

    if (count === 0) {
      const guruPass = await bcrypt.hash('guru123', 10);

      // 1. Insert Guru
      const guruRes = await client.query(`
        INSERT INTO users (username, name, password, role, status)
        VALUES ('guru_cbt', 'Drs. H. Mulyadi, M.Pd.', $1, 'guru', 'aktif')
        RETURNING id;
      `, [guruPass]);
      const guruId = guruRes.rows[0].id;

      console.log('✔ Seeded initial Guru user.');

      // 2. Insert Exam Package
      const examRes = await client.query(`
        INSERT INTO exams (kode_paket, mapel, kelas, durasi, token, status, tipe_penilaian)
        VALUES ('CBT-MAT-2026-X', 'Matematika Terapan & Logika Komputasi', 'X-RPL', 60, 'CBT26', 'Aktif', 'Otomatis')
        RETURNING id;
      `);
      const examId = examRes.rows[0].id;
      console.log(`✔ Seeded Exam Package ID: ${examId} (Token: CBT26).`);

      // 3. Insert Questions (5 PG + 1 Essay)
      const qRes = await client.query(`
        INSERT INTO questions (exam_id, guru_id, tipe_media, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot_poin)
        VALUES 
        ($1, $2, 'Teks', 'Manakah dari berikut ini yang merupakan sifat dasar dari Relational Database Management System (RDBMS)?', 'Menyimpan data tanpa skema terdefinisi (NoSQL)', 'Mendukung integritas referensial antar tabel menggunakan Foreign Key', 'Hanya dapat diakses melalui satu thread proses saja', 'Tidak mendukung transaksi ACID', 'Data hanya tersimpan di memori RAM tanpa persistensi disk', 'B', 20),
        ($1, $2, 'Teks', 'Dalam basis data PostgreSQL, klausa SQL apa yang digunakan untuk memastikan nilai kolom unik di seluruh baris tabel?', 'CHECK', 'FOREIGN KEY', 'UNIQUE', 'CASCADE', 'INDEX ONLY', 'C', 20),
        ($1, $2, 'Teks', 'Jika sebuah transaksi database memenuhi aturan ACID, huruf "I" dalam akronim tersebut merepresentasikan:', 'Integrity', 'Indexation', 'Isolation', 'Iteration', 'Inheritance', 'C', 20),
        ($1, $2, 'Teks', 'Pada sistem Computer Based Test (CBT), apa fungsi dari kolom "token" pada tabel Exams?', 'Menyimpan password akun guru pengawas', 'Kunci otentikasi unik yang harus dimasukkan siswa sebelum memulai sesi ujian', 'Enkripsi kunci jawaban seluruh soal', 'ID unik transaksi pembayaran ujian', 'Alamat IP server Cloud SQL', 'B', 20),
        ($1, $2, 'Teks', 'Perintah SQL manakah yang paling tepat untuk menghitung rata-rata nilai siswa per paket ujian?', 'SELECT AVG(total_nilai) FROM exam_sessions GROUP BY exam_id;', 'SELECT SUM(total_nilai) FROM exam_sessions WHERE status_pengerjaan = "Selesai";', 'UPDATE exam_sessions SET total_nilai = AVG(bobot_poin);', 'SELECT COUNT(*) FROM questions WHERE kunci = "A";', 'DELETE FROM student_answers WHERE is_correct = false;', 'A', 20),
        ($1, $2, 'Teks', 'Jelaskan perbedaan mendasar antara Database Relasional (PostgreSQL) dan Database NoSQL dalam hal konsistensi data (ACID) dan fleksibilitas skema!', '-', '-', '-', '-', '-', 'ESSAY', 20)
        RETURNING id, kunci;
      `, [examId, guruId]);
      console.log(`✔ Seeded ${qRes.rows.length} Questions (5 Pilihan Ganda + 1 Essay).`);
    } else {
      console.log('ℹ Users table already has data. Skipping re-seed to preserve existing state.');
    }

    console.log('\n--- 3. VERIFICATION QUERY ---');
    const [uRes, eRes, qCountRes, sRes, aRes] = await Promise.all([
      client.query('SELECT COUNT(*) FROM users'),
      client.query('SELECT COUNT(*) FROM exams'),
      client.query('SELECT COUNT(*) FROM questions'),
      client.query('SELECT COUNT(*) FROM exam_sessions'),
      client.query('SELECT COUNT(*) FROM student_answers'),
    ]);

    console.log('📊 Verification Summary:');
    console.log(` - users: ${uRes.rows[0].count} rows`);
    console.log(` - exams: ${eRes.rows[0].count} rows`);
    console.log(` - questions: ${qCountRes.rows[0].count} rows`);
    console.log(` - exam_sessions: ${sRes.rows[0].count} rows`);
    console.log(` - student_answers: ${aRes.rows[0].count} rows`);

    console.log('\n🎉 ALL MIGRATION & SEEDING COMPLETED SUCCESSFULLY WITHOUT ERROR!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n❌ MIGRATION & SEEDING FAILED:', err);
  process.exit(1);
});
