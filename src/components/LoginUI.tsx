import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileText,
  HelpCircle,
  X,
  LogIn,
} from 'lucide-react';
import { CBTUser } from '../types.ts';
import { apiFetch, parseJsonResponse } from '../utils/api.ts';

interface LoginUIProps {
  onLoginSuccess?: (user: CBTUser, role: 'guru' | 'murid' | 'admin') => void;
  onNavigateToTab?: (tab: 'schema' | 'teacher' | 'student' | 'api') => void;
}

export const LoginUI: React.FC<LoginUIProps> = ({
  onLoginSuccess,
  onNavigateToTab,
}) => {
  const usernameRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successUser, setSuccessUser] = useState<{ user: CBTUser; role: 'guru' | 'murid' | 'admin' } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Auto-focus on initial mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Harap masukkan username dan password');
      setUsername('');
      setPassword('');
      usernameRef.current?.focus();
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await parseJsonResponse(res);

      if (data.token) {
        localStorage.setItem('cbt_token', data.token);
      }
      const resolvedRole = data.role || data.user?.role || 'murid';
      localStorage.setItem('cbt_user_role', resolvedRole);

      setSuccessUser({
        user: data.user,
        role: resolvedRole,
      });

      // Teruskan data user & role ke callback onLoginSuccess dari props App.tsx
      if (onLoginSuccess) {
        onLoginSuccess(data.user, resolvedRole);
      }
    } catch (err: any) {
      let message = 'Gagal terhubung ke server autentikasi. Pastikan koneksi backend atau DATABASE_URL aktif.';
      if (typeof err === 'string') {
        message = err;
      } else if (err && typeof err === 'object') {
        if (typeof err.message === 'string' && err.message.trim() && err.message !== '[object Object]') {
          message = err.message;
        } else if (typeof err.error === 'string' && err.error.trim() && err.error !== '[object Object]') {
          message = err.error;
        } else {
          try {
            const str = JSON.stringify(err);
            if (str && str !== '{}') message = str;
          } catch {
            message = String(err);
          }
        }
      }
      setErrorMsg(message);

      // Peningkatan UX: Kosongkan state username dan password, lalu kembalikan fokus ke kolom pertama
      setUsername('');
      setPassword('');
      setTimeout(() => {
        usernameRef.current?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Decorative Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: 'radial-gradient(#dce1ff 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header: Suppressed Navbar Brand Anchor (Responsive: Centered on mobile, Left on desktop) */}
      <header className="relative w-full z-10 flex flex-col sm:flex-row justify-between items-center px-4 sm:px-8 py-4 sm:py-6 gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Academic Excellence Portal"
            className="w-10 h-10 object-contain rounded-md"
          />
          <div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-[#00236f]">
              Academic Excellence Portal
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              CBT System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium hidden md:inline">Terhubung ke Database:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-200 font-semibold text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Cloud SQL PostgreSQL
          </span>
        </div>
      </header>

      {/* Main Content: Centered Login Card */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200/90 shadow-[0px_10px_25px_-5px_rgba(30,58,138,0.07)] p-6 sm:p-8 flex flex-col gap-6">
          
          {/* Header Section */}
          <div className="text-center">
            {/* Academic School Icon Emblem (Mobile & Desktop Merge) */}
            <div className="w-16 h-16 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-center mx-auto mb-3 shadow-inner p-2">
              <img
                src="/logo.png"
                alt="Logo Academic Excellence Portal"
                className="w-full h-full object-contain rounded-md"
              />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#00236f]">
              Selamat Datang
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
              Silakan masuk untuk mengakses portal akademik & ujian CBT Anda.
            </p>
          </div>

          {/* Success State Banner */}
          {successUser && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-xs text-green-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Autentikasi Berhasil!</span>
              </div>
              <p>
                Selamat datang, <strong>{successUser.user.name}</strong>. Anda terautentikasi sebagai{' '}
                <span className="uppercase font-mono font-bold px-1.5 py-0.5 bg-green-100 rounded text-green-800">
                  {successUser.role}
                </span>.
              </p>
              {onNavigateToTab && (
                <div className="pt-2 flex gap-2">
                  {successUser.role === 'guru' ? (
                    <button
                      onClick={() => onNavigateToTab('teacher')}
                      className="w-full py-2 px-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Buka Panel Guru</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigateToTab('student')}
                      className="w-full py-2 px-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Buka Simulasi Siswa</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username / NIS Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs sm:text-sm font-semibold text-slate-700"
              >
                Username / NIS
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="Masukkan Username atau NIS"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full h-12 pl-10 pr-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/10 transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs sm:text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full h-12 pl-10 pr-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/10 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#1e3a8a] hover:bg-[#2563eb] active:bg-[#1d4ed8] text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi kredensial...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Portal</span>
                </>
              )}
            </button>

            {/* Error Alert Banner: Di Bawah Form Login */}
            {errorMsg && (
              <div className="mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed w-full overflow-hidden">
                  <span className="font-bold block text-rose-900 mb-0.5">Autentikasi Ditolak / Error Server:</span>
                  <div className="whitespace-pre-wrap font-mono text-[11px] bg-rose-100/70 p-2 rounded-lg border border-rose-200/60 max-h-48 overflow-y-auto break-all text-rose-950">
                    {errorMsg}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>

      {/* Footer: Merged Responsive Footer (Stacked on mobile, Row on desktop) */}
      <footer className="relative z-10 w-full py-6 px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4 mt-auto bg-slate-100/80 border-t border-slate-200 text-xs text-slate-600">
        <div className="font-semibold text-[#00236f] flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Logo Academic Excellence Portal"
            className="w-5 h-5 object-contain rounded"
          />
          <span>Academic Excellence Portal</span>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-slate-500">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="hover:text-[#00236f] transition-colors cursor-pointer font-medium"
          >
            Help Center
          </button>
          <button
            type="button"
            onClick={() => setIsPrivacyOpen(true)}
            className="hover:text-[#00236f] transition-colors cursor-pointer font-medium"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setIsTermsOpen(true)}
            className="hover:text-[#00236f] transition-colors cursor-pointer font-medium"
          >
            Terms of Service
          </button>
        </div>

        <div className="text-slate-400 text-center md:text-right text-[11px]">
          © 2026 Academic Excellence Portal. All rights reserved.
        </div>
      </footer>

      {/* 1. Help Center Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-[#00236f]">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>Pusat Bantuan & Akun</span>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Untuk menjaga integritas ujian CBT, akun siswa dan guru dikelola secara terpusat oleh Administrator/Proktor Sekolah.
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700">
              <div><strong>1. Akun Guru:</strong> Hubungi Tim IT / Proktor CBT sekolah untuk pembuatan akun atau pembaruan hak akses.</div>
              <div><strong>2. Akun Siswa:</strong> Reset password dan aktivasi akun dapat dilakukan langsung oleh guru melalui menu manajemen guru.</div>
              <div><strong>3. Masalah Teknis Ujian:</strong> Jika sesi ujian terputus atau token tidak valid, laporkan langsung ke pengawas ruang.</div>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2.5 bg-[#1e3a8a] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* 2. Privacy Policy Modal */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-[#00236f]">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>Kebijakan Privasi (Privacy Policy)</span>
              </div>
              <button
                onClick={() => setIsPrivacyOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Kebijakan privasi ini menjelaskan bagaimana data dan aktivitas peserta ujian dikelola dalam sistem CBT Sekolah.
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5 text-slate-700 max-h-80 overflow-y-auto leading-relaxed">
              <div>
                <strong className="text-slate-900">1. Data Pengguna:</strong> Informasi berupa NIS/NIP, nama lengkap, dan peran hanya digunakan untuk keperluan autentikasi dan rekapitulasi nilai akademik.
              </div>
              <div>
                <strong className="text-slate-900">2. Keamanan Kredensial:</strong> Seluruh kata sandi akun disimpan secara terenkripsi menggunakan algoritma <em>hashing</em> yang aman.
              </div>
              <div>
                <strong className="text-slate-900">3. Log Integritas Ujian:</strong> Sistem secara otomatis mencatat waktu pengerjaan, respon jawaban, dan deteksi perpindahan jendela/tab untuk audit pengawasan ujian.
              </div>
              <div>
                <strong className="text-slate-900">4. Kerahasiaan Nilai:</strong> Hasil evaluasi ujian hanya dapat diakses oleh siswa bersangkutan, guru pengampu mata pelajaran, dan pihak sekolah yang berwenang.
              </div>
            </div>

            <button
              onClick={() => setIsPrivacyOpen(false)}
              className="w-full py-2.5 bg-[#1e3a8a] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* 3. Terms of Service Modal */}
      {isTermsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-[#00236f]">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Syarat & Ketentuan (Terms of Service)</span>
              </div>
              <button
                onClick={() => setIsTermsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dengan mengakses dan menggunakan sistem Computer Based Test (CBT), pengguna menyetujui ketentuan berikut:
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5 text-slate-700 max-h-80 overflow-y-auto leading-relaxed">
              <div>
                <strong className="text-slate-900">1. Integritas & Kejujuran:</strong> Peserta wajib mengerjakan seluruh soal secara mandiri tanpa bantuan pihak lain atau materi yang tidak diizinkan.
              </div>
              <div>
                <strong className="text-slate-900">2. Protokol Anti-Kecurangan:</strong> Sistem menerapkan pembatasan perpindahan layar/tab. Pelanggaran berulang (melebihi 3 kali) akan memicu penguncian atau <em>Force Submit</em> otomatis.
              </div>
              <div>
                <strong className="text-slate-900">3. Token & Akses Sesi:</strong> Token ujian bersifat rahasia dan hanya berlaku selama jadwal sesi yang ditetapkan oleh proktor/pengawas.
              </div>
              <div>
                <strong className="text-slate-900">4. Penanganan Kendala:</strong> Apabila terjadi gangguan perangkat atau jaringan, jawaban yang telah tersimpan tidak akan hilang. Peserta dipersilakan melapor ke pengawas untuk melanjutkan ujian.
              </div>
            </div>

            <button
              onClick={() => setIsTermsOpen(false)}
              className="w-full py-2.5 bg-[#1e3a8a] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
