import { eq, desc, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, getPool } from './index';
import {
  users,
  exams,
  questions,
  exam_sessions,
  student_answers,
} from './schema';
import { memStore } from './memoryStore';

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
  const pool = (await import('./index')).getPool();
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
  const pool = (await import('./index')).getPool();
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
  const pool = (await import('./index')).getPool();
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
  const pool = (await import('./index')).getPool();
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
  const pool = (await import('./index')).getPool();
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
  const pool = (await import('./index')).getPool();
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
  const pool = (await import('./index')).getPool();
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
    const pool = (await import('./index')).getPool();
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
    const result = await db.insert(questions).values({
      exam_id: data.exam_id,
      guru_id: data.guru_id || null,
      question_type: qType,
      tipe_media: data.tipe_media,
      link_media: data.link_media || null,
      pertanyaan: data.pertanyaan,
      opsi_a: isEssay ? null : (data.opsi_a || null),
      opsi_b: isEssay ? null : (data.opsi_b || null),
      opsi_c: isEssay ? null : (data.opsi_c || null),
      opsi_d: isEssay ? null : (data.opsi_d || null),
      opsi_e: isEssay ? null : (data.opsi_e || null),
      kunci: isEssay ? 'essay' : (data.kunci ? data.kunci.toUpperCase() : 'A'),
      bobot_poin: data.bobot_poin ?? 20,
    }).returning();
    return result[0];
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
    const result = await db.update(questions).set(data).where(eq(questions.id, id)).returning();
    return result[0];
  } catch (error) {
    handleSqlError('updateQuestion', error);
    return memStore.updateQuestion(id, data);
  }
}

export async function deleteQuestion(id: number) {
  try {
    const result = await db.delete(questions).where(eq(questions.id, id)).returning();
    return result[0];
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
    if (!hasDbConfig) {
      return memStore.submitExam(sessionId, status, fallbackData);
    }
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
