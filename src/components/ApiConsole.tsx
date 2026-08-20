import React, { useState } from 'react';
import { Terminal, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../utils/api.ts';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  defaultBody?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/login',
    description: 'POST /login: Verifikasi username & password. Hanya izinkan user dengan status = "aktif". Return role.',
    defaultBody: JSON.stringify({ username: 'guru_cbt', password: 'guru123' }, null, 2),
  },
  {
    method: 'POST',
    path: '/start-exam',
    description: 'POST /start-exam: Cek Token valid & status exam "Aktif". Buat baris baru di tabel Exam_Sessions.',
    defaultBody: JSON.stringify(
      {
        exam_id: 1,
        user_id: 2,
        token: 'CBT26',
      },
      null,
      2
    ),
  },
  {
    method: 'POST',
    path: '/auto-save',
    description: 'POST /auto-save: Simpan jawaban siswa ke tabel Student_Answers setiap kali klik opsi A/B/C/D atau essay.',
    defaultBody: JSON.stringify(
      {
        session_id: 1,
        question_id: 1,
        jawaban_siswa: 'B',
      },
      null,
      2
    ),
  },
  {
    method: 'POST',
    path: '/violation',
    description: 'POST /violation: Tambah jml_pelanggaran +1 & catat log waktu. Jika mencapai 3, otomatis Force Submit.',
    defaultBody: JSON.stringify(
      {
        session_id: 1,
        reason: 'Berpindah aplikasi / membuka tab baru browser',
      },
      null,
      2
    ),
  },
  {
    method: 'GET',
    path: '/live-monitor',
    description: 'GET /live-monitor: Ambil data Exam_Sessions secara real-time untuk ditampilkan di panel Guru.',
  },
  {
    method: 'GET',
    path: '/api/health',
    description: 'GET /api/health: Cek status server Express & koneksi Cloud SQL PostgreSQL',
  },
  {
    method: 'GET',
    path: '/api/exams',
    description: 'GET /api/exams: Mengambil seluruh daftar paket ujian dari tabel Exams',
  },
  {
    method: 'GET',
    path: '/api/users',
    description: 'GET /api/users: Mengambil daftar pengguna (Guru/Murid) dari tabel Users',
  },
  {
    method: 'GET',
    path: '/api/db/schema-info',
    description: 'GET /api/db/schema-info: Mengambil representasi skema 5 tabel relasional dan SQL DDL/DML',
  },
];

export const ApiConsole: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState<string>(selectedEndpoint.defaultBody || '');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseData, setResponseData] = useState<any>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSelectEndpoint = (ep: Endpoint) => {
    setSelectedEndpoint(ep);
    setRequestBody(ep.defaultBody || '');
    setResponseData(null);
    setResponseStatus(null);
  };

  const handleExecute = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (['POST', 'PUT', 'DELETE'].includes(selectedEndpoint.method) && requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await apiFetch(selectedEndpoint.path, options);
      const end = performance.now();
      setResponseTime(Math.round(end - start));
      setResponseStatus(res.status);

      const json = await res.json();
      setResponseData(json);
    } catch (err: any) {
      setResponseStatus(500);
      setResponseData({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-600" />
          Node.js Express REST API Tester
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Uji langsung respon endpoint API backend CBT yang terhubung dengan PostgreSQL Cloud SQL.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Endpoint Selector */}
        <div className="lg:col-span-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pilih Endpoint API</h4>
          {ENDPOINTS.map((ep, idx) => {
            const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
            return (
              <button
                key={idx}
                onClick={() => handleSelectEndpoint(ep)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 text-blue-950 font-medium shadow-xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      ep.method === 'GET'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono font-semibold">{ep.path}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">{ep.description}</p>
              </button>
            );
          })}
        </div>

        {/* Console Request / Response */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs shadow-md">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 mr-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60"></div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedEndpoint.method === 'GET' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono text-green-400 font-bold">{selectedEndpoint.path}</span>
              </div>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors text-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                {loading ? 'Mengirim...' : 'Eksekusi Request'}
              </button>
            </div>

            {['POST', 'PUT', 'DELETE'].includes(selectedEndpoint.method) && (
              <div className="mt-3">
                <label className="block text-slate-400 font-mono text-[11px] mb-1">Request Body (JSON):</label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 text-slate-200 font-mono text-xs rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Response Output */}
          {responseData && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2 shadow-md">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">HTTP Response:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      responseStatus && responseStatus < 400
                        ? 'bg-green-950 text-green-400 border border-green-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    Status {responseStatus}
                  </span>
                </div>
                {responseTime && <span className="font-mono text-slate-400">{responseTime} ms</span>}
              </div>

              <pre className="p-3 bg-slate-900 text-green-300 font-mono text-xs rounded-lg overflow-x-auto max-h-80 leading-relaxed">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
