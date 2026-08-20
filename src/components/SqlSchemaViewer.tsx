import React, { useState } from 'react';
import { SchemaTableInfo, SampleQueryInfo } from '../types.ts';
import { Database, Copy, Check, Code2, Layers, Key, FileCode, CheckCircle2, Server } from 'lucide-react';

interface Props {
  tables: SchemaTableInfo[];
  sampleQueries: SampleQueryInfo[];
}

export const SqlSchemaViewer: React.FC<Props> = ({ tables, sampleQueries }) => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tables' | 'ddl' | 'queries' | 'diagram'>('tables');
  const [selectedTable, setSelectedTable] = useState<string>(tables[0]?.tableName || 'users');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const activeTableData = tables.find((t) => t.tableName === selectedTable) || tables[0];

  const fullDdlScript = tables
    .map(
      (t) =>
        `-- =========================================\n-- Table: ${t.name} (${t.tableName})\n-- Description: ${t.description}\n-- =========================================\n${t.ddlSql}\n`
    )
    .join('\n\n');

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-green-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              PostgreSQL Cloud SQL • Active
            </span>
            <span className="text-xs text-slate-500 font-mono">Drizzle ORM Dialect</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Database Schema Visualizer</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            5 Tabel relasional CBT: Users, Exams, Questions, Exam_Sessions, Student_Answers.
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              id="tab-tables-btn"
              onClick={() => setActiveTab('tables')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'tables' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Skema Tabel
            </button>
            <button
              id="tab-ddl-btn"
              onClick={() => setActiveTab('ddl')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'ddl' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              SQL DDL Script
            </button>
            <button
              id="tab-queries-btn"
              onClick={() => setActiveTab('queries')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'queries' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Query CBT (DML)
            </button>
            <button
              id="tab-diagram-btn"
              onClick={() => setActiveTab('diagram')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'diagram' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              ERD Relasi
            </button>
          </div>

          <button
            onClick={() => copyToClipboard(fullDdlScript, 'export-ddl')}
            className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 font-medium text-slate-700 flex items-center gap-1.5"
          >
            {copiedIndex === 'export-ddl' ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" /> DDL Tersalin!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Export DDL
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Detailed Table Columns Explorer */}
      {activeTab === 'tables' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Visualizer Cards Grid */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-semibold text-sm text-slate-900">Relational Tables Architecture</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                5 Tables • PostgreSQL
              </div>
            </div>

            {/* Grid of Tables mimicking the design visualizer */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Table 1: Users */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs hover:border-slate-300 transition-colors">
                <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold border-b border-slate-200 flex justify-between items-center text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> TABLE: Users
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">PK: id</span>
                </div>
                <div className="p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">username</span>
                    <span className="text-slate-500">varchar (UNIQUE)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">password</span>
                    <span className="text-slate-500">text (bcrypt hash)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">role</span>
                    <span className="text-blue-600 font-semibold">enum(murid, guru)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">status</span>
                    <span className="text-blue-600 font-semibold">enum(aktif, ...)</span>
                  </div>
                </div>
              </div>

              {/* Table 2: Exams */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs hover:border-slate-300 transition-colors">
                <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold border-b border-slate-200 flex justify-between items-center text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> TABLE: Exams
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">PK: id</span>
                </div>
                <div className="p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">kode_paket</span>
                    <span className="text-slate-500">varchar (UNIQUE)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">mapel</span>
                    <span className="text-slate-500">varchar</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">durasi</span>
                    <span className="text-slate-500">integer (menit)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">token</span>
                    <span className="text-blue-600 font-bold">varchar</span>
                  </div>
                  <div className="flex justify-between font-semibold text-blue-600">
                    <span>status</span>
                    <span>enum(Aktif, Draft, Selesai)</span>
                  </div>
                </div>
              </div>

              {/* Table 3: Questions */}
              <div className="border border-blue-200 bg-blue-50/20 rounded-lg overflow-hidden border-dashed col-span-1 md:col-span-2">
                <div className="bg-blue-100/60 px-3 py-1.5 text-[11px] font-bold border-b border-blue-200 flex justify-between items-center text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> TABLE: Questions (Bank Soal Pilihan Ganda A-E)
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">PK: id</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between border-b border-blue-100 pb-1">
                    <span className="font-medium text-slate-800">exam_id</span>
                    <span className="text-orange-600 font-semibold">FK → Exams.id</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-1">
                    <span className="font-medium text-slate-800">guru_id</span>
                    <span className="text-orange-600 font-semibold">FK → Users.id</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-1">
                    <span className="font-medium text-slate-800">tipe_media</span>
                    <span className="text-blue-600 font-semibold">enum(Teks, Image, Audio, Video)</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-1">
                    <span className="font-medium text-slate-800">link_media</span>
                    <span className="text-slate-500">text</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-1">
                    <span className="font-medium text-slate-800">opsi_a s/d e</span>
                    <span className="text-slate-500">text</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-1">
                    <span className="font-medium text-slate-800">kunci & bobot</span>
                    <span className="text-emerald-700 font-bold">char(1) & double</span>
                  </div>
                </div>
              </div>

              {/* Table 4: Exam_Sessions */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs hover:border-slate-300 transition-colors">
                <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold border-b border-slate-200 flex justify-between items-center text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> TABLE: Exam_Sessions
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">PK: id</span>
                </div>
                <div className="p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">exam_id / user_id</span>
                    <span className="text-orange-600">FK → Exams/Users</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">status_pengerjaan</span>
                    <span className="text-blue-600 font-semibold">enum(...)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">jml_pelanggaran</span>
                    <span className="text-rose-600 font-bold">int (anti-cheat)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">total_nilai</span>
                    <span className="text-emerald-600 font-bold">double precision</span>
                  </div>
                </div>
              </div>

              {/* Table 5: Student_Answers */}
              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs hover:border-slate-300 transition-colors">
                <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold border-b border-slate-200 flex justify-between items-center text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> TABLE: Student_Answers
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">PK: id</span>
                </div>
                <div className="p-3 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">session_id</span>
                    <span className="text-orange-600">FK → Exam_Sessions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">question_id</span>
                    <span className="text-orange-600">FK → Questions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">jawaban_siswa</span>
                    <span className="text-slate-500">text</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">is_correct / skor</span>
                    <span className="text-emerald-600 font-bold">boolean & double</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel: Active Query Snippet & Cloud SQL Health */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
            {/* Active Query Snippet */}
            <div className="bg-slate-900 rounded-xl p-4 flex-1 shadow-lg border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="text-blue-400 text-[11px] font-bold font-mono tracking-widest uppercase">
                  Active DDL Snippet
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60"></div>
                </div>
              </div>
              <div className="font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto">
                <span className="text-pink-400">CREATE TABLE</span> <span className="text-blue-300">exam_sessions</span> (<br />
                &nbsp;&nbsp;id <span className="text-yellow-400">SERIAL PRIMARY KEY</span>,<br />
                &nbsp;&nbsp;exam_id <span className="text-yellow-400">INT REFERENCES</span> exams(id),<br />
                &nbsp;&nbsp;user_id <span className="text-yellow-400">INT REFERENCES</span> users(id),<br />
                &nbsp;&nbsp;waktu_mulai_siswa <span className="text-yellow-400">TIMESTAMP</span>,<br />
                &nbsp;&nbsp;status_pengerjaan <span className="text-pink-400">session_status</span>,<br />
                &nbsp;&nbsp;jml_pelanggaran <span className="text-yellow-400">INT DEFAULT 0</span>,<br />
                &nbsp;&nbsp;total_nilai <span className="text-yellow-400">DOUBLE PRECISION</span><br />
                );
              </div>
            </div>

            {/* Cloud SQL Health */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Cloud SQL Health</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Database Engine</span>
                    <span className="font-bold text-slate-900">PostgreSQL 15</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-full w-[100%]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Region Ingress</span>
                    <span className="font-bold text-green-700">asia-southeast1</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-green-500 h-full w-[100%]"></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                  <span>Pool Active Connections:</span>
                  <span className="text-blue-600 font-bold">10 Max</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Full DDL SQL Script */}
      {activeTab === 'ddl' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-400" />
                Lengkap: SQL DDL 5 Tabel PostgreSQL CBT
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dapat dieksekusi langsung pada PostgreSQL / psql client atau dikelola melalui Drizzle Kit.
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(fullDdlScript, 'full-ddl')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {copiedIndex === 'full-ddl' ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Berhasil Disalin!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Salin Seluruh SQL DDL
                </>
              )}
            </button>
          </div>
          <pre className="p-4 bg-slate-900/90 text-emerald-300 font-mono text-xs rounded-lg overflow-x-auto border border-slate-800 max-h-[600px] leading-relaxed">
            {fullDdlScript}
          </pre>
        </div>
      )}

      {/* Tab 3: Sample CBT Queries (DML) */}
      {activeTab === 'queries' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sampleQueries.map((query, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200">
                      {idx + 1}
                    </span>
                    {query.title}
                  </h4>
                  <button
                    onClick={() => copyToClipboard(query.sql, `query-${idx}`)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                    title="Salin SQL"
                  >
                    {copiedIndex === `query-${idx}` ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 text-blue-200 font-mono text-xs rounded-lg overflow-x-auto border border-slate-800 leading-relaxed">
                  {query.sql}
                </pre>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-mono">
                <span>PostgreSQL ANSI-Compliant</span>
                <span className="text-green-600 font-semibold">Ready to execute</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: ER Diagram Visual Representation */}
      {activeTab === 'diagram' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Diagram Relasi Antar Tabel (Entity Relationship)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Visualisasi foreign key cascade dan relasi 1:N antar entitas pengguna, ujian, bank soal, sesi pengerjaan, dan jawaban siswa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Box 1: Users */}
            <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 pb-2 border-b border-slate-200">
                <Database className="w-3.5 h-3.5 text-blue-600" /> users
              </div>
              <ul className="text-[11px] font-mono mt-2 space-y-1 text-slate-700">
                <li className="font-bold text-amber-600">🔑 id (PK)</li>
                <li>username (UQ)</li>
                <li>name</li>
                <li>password (hash)</li>
                <li className="text-blue-600 font-medium">role (enum)</li>
                <li className="text-blue-600 font-medium">status (enum)</li>
              </ul>
            </div>

            {/* Box 2: Exams */}
            <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 pb-2 border-b border-slate-200">
                <Database className="w-3.5 h-3.5 text-blue-600" /> exams
              </div>
              <ul className="text-[11px] font-mono mt-2 space-y-1 text-slate-700">
                <li className="font-bold text-amber-600">🔑 id (PK)</li>
                <li>kode_paket (UQ)</li>
                <li>mapel</li>
                <li>kelas</li>
                <li>durasi</li>
                <li>token</li>
                <li className="text-blue-600 font-medium">status (enum)</li>
              </ul>
            </div>

            {/* Box 3: Questions */}
            <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900 pb-2 border-b border-blue-200">
                <Database className="w-3.5 h-3.5 text-blue-600" /> questions
              </div>
              <ul className="text-[11px] font-mono mt-2 space-y-1 text-slate-700">
                <li className="font-bold text-amber-600">🔑 id (PK)</li>
                <li className="text-blue-600 font-semibold">🔗 exam_id (FK)</li>
                <li className="text-blue-600 font-semibold">🔗 guru_id (FK)</li>
                <li>tipe_media (enum)</li>
                <li>pertanyaan</li>
                <li>opsi_a s/d e</li>
                <li>kunci</li>
                <li>bobot_poin</li>
              </ul>
            </div>

            {/* Box 4: Exam_Sessions */}
            <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 pb-2 border-b border-slate-200">
                <Database className="w-3.5 h-3.5 text-blue-600" /> exam_sessions
              </div>
              <ul className="text-[11px] font-mono mt-2 space-y-1 text-slate-700">
                <li className="font-bold text-amber-600">🔑 id (PK)</li>
                <li className="text-blue-600 font-semibold">🔗 exam_id (FK)</li>
                <li className="text-blue-600 font-semibold">🔗 user_id (FK)</li>
                <li>status_pengerjaan</li>
                <li className="text-rose-600 font-medium">jml_pelanggaran</li>
                <li>detail_pelanggaran</li>
                <li className="font-bold text-emerald-600">total_nilai</li>
              </ul>
            </div>

            {/* Box 5: Student_Answers */}
            <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 pb-2 border-b border-slate-200">
                <Database className="w-3.5 h-3.5 text-blue-600" /> student_answers
              </div>
              <ul className="text-[11px] font-mono mt-2 space-y-1 text-slate-700">
                <li className="font-bold text-amber-600">🔑 id (PK)</li>
                <li className="text-blue-600 font-semibold">🔗 session_id (FK)</li>
                <li className="text-blue-600 font-semibold">🔗 question_id (FK)</li>
                <li>jawaban_siswa</li>
                <li>is_correct (bool)</li>
                <li>skor_guru</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900">Alur Integritas Data CBT:</strong>
            <ol className="list-decimal list-inside mt-1.5 space-y-1">
              <li>
                Akun <strong>Guru</strong> membuat paket <strong>Exams</strong> dan butir <strong>Questions</strong> (FK:{' '}
                <code className="font-mono">exam_id</code>, <code className="font-mono">guru_id</code>).
              </li>
              <li>
                Siswa login akun <strong>Users</strong> dan mengklaim token untuk membuka <strong>Exam_Sessions</strong> (FK:{' '}
                <code className="font-mono">exam_id</code>, <code className="font-mono">user_id</code>).
              </li>
              <li>
                Setiap interaksi jawaban disimpan ke <strong>Student_Answers</strong> (FK:{' '}
                <code className="font-mono">session_id</code>, <code className="font-mono">question_id</code>) dengan evaluasi otomatis.
              </li>
              <li>
                Kecurangan terdeteksi mencatat increment <code className="font-mono">jml_pelanggaran</code> di{' '}
                <strong>Exam_Sessions</strong> secara otomatis.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
