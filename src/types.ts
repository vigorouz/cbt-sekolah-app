export interface CBTUser {
  id: number;
  uid?: string | null;
  username: string;
  name: string;
  role: 'murid' | 'guru' | 'admin';
  status: 'aktif' | 'tidak aktif';
  created_at?: string;
}

export interface CBTExam {
  id: number;
  kode_paket: string;
  mapel: string;
  kelas: string;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  durasi: number;
  token: string;
  status: 'Aktif' | 'Draft' | 'Selesai';
  tipe_penilaian: string;
  created_at?: string;
}

export interface CBTQuestion {
  id: number;
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
  bobot_poin: number;
  created_at?: string;
}

export interface CBTExamSession {
  id: number;
  exam_id: number;
  user_id: number;
  waktu_mulai_siswa: string;
  waktu_submit?: string | null;
  status_pengerjaan: 'Sedang Mengerjakan' | 'Selesai' | 'Force Submit';
  terakhir_aktif: string;
  jml_pelanggaran: number;
  detail_pelanggaran?: string | null;
  benar_pg?: number | null;
  salah_pg?: number | null;
  kosong_pg?: number | null;
  nilai_pg?: number | null;
  total_nilai: number;
  created_at?: string;
}

export interface CBTStudentAnswer {
  id: number;
  session_id: number;
  question_id: number;
  jawaban_siswa: string | null;
  is_correct?: boolean | null;
  skor_guru?: number | null;
  created_at?: string;
}

export interface CBTEssayAnswer {
  id: number;
  session_id: number;
  question_id: number;
  jawaban_siswa: string | null;
  is_correct?: boolean | null;
  skor_guru?: number | null;
  createdAt?: string;
  pertanyaan: string;
  tipe_media: string;
  link_media?: string | null;
  kunci: string;
  bobot_poin: number;
  opsi_a?: string;
  opsi_b?: string;
  student_id: number;
  student_name: string;
  student_username: string;
  exam_id: number;
  exam_kode: string;
  exam_mapel: string;
  exam_kelas: string;
  session_status: string;
  nilai_pg?: number | null;
  total_nilai?: number | null;
}

export interface CBTExamResult {
  id: number;
  user_id: number;
  exam_id: number;
  waktu_mulai_siswa: string;
  waktu_submit?: string | null;
  status_pengerjaan: 'Sedang Mengerjakan' | 'Selesai' | 'Force Submit';
  terakhir_aktif: string;
  jml_pelanggaran: number;
  detail_pelanggaran?: string | null;
  benar_pg: number;
  salah_pg: number;
  kosong_pg: number;
  nilai_pg: number;
  nilai_essay: number;
  total_nilai: number;
  created_at: string;
  student_name: string;
  student_username: string;
  student_status: string;
  exam_kode: string;
  exam_mapel: string;
  exam_kelas: string;
  exam_durasi: number;
  exam_status: string;
}

export interface SchemaTableInfo {
  name: string;
  tableName: string;
  description: string;
  columns: {
    name: string;
    type: string;
    constraints: string;
    description: string;
  }[];
  ddlSql: string;
}

export interface SampleQueryInfo {
  title: string;
  sql: string;
}
