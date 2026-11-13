import React, { useState, useEffect } from 'react'
import {
  Globe,
  Plus,
  Trash2,
  Copy,
  Check,
  ArrowLeft,
  Server,
  Database,
  ShieldCheck,
  Info,
  Terminal,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard } from '../components/Skeletons'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'
import Card from '../components/Card'
import DataTable from '../components/DataTable'

export default function RemoteDatabasePage({ user, onNavigate }) {
  const { isV2 } = useTheme()
  const [accessHosts, setAccessHosts] = useState(() => {
    try {
      const saved = localStorage.getItem('miraigrid_remote_access_hosts')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return [
      { id: 1, host: '127.0.0.1', comment: 'Localhost (Container Internal)', addedAt: 'Sistem Default' },
      { id: 2, host: '%', comment: 'Semua Jaringan Kampus / Publik (Terisolasi Role)', addedAt: 'Sistem Default' },
    ]
  })

  const [newHostIp, setNewHostIp] = useState('')
  const [newHostComment, setNewHostComment] = useState('')
  const [copiedSnippet, setCopiedSnippet] = useState(null)
  const [myDatabases, setMyDatabases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDatabases()
  }, [])

  const fetchDatabases = async () => {
    try {
      const res = await api.get('/databases')
      setMyDatabases(res.data || [])
    } catch (err) {
      console.error('Failed to load databases', err)
    } finally {
      setLoading(false)
    }
  }

  const copyText = (text, snippetId, label) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch (e) {}
    setCopiedSnippet(snippetId)
    toast.success(`${label} disalin ke clipboard!`)
    setTimeout(() => setCopiedSnippet(null), 3000)
  }

  const handleAddHost = (e) => {
    e.preventDefault()
    const ip = newHostIp.trim()
    if (!ip) {
      toast.error('Masukkan alamat IP atau pola wildcard (misal: % atau 192.168.1.%)')
      return
    }

    if (accessHosts.some((h) => h.host === ip)) {
      toast.error(`Host '${ip}' sudah ada dalam daftar yang diizinkan.`)
      return
    }

    const newEntry = {
      id: Date.now(),
      host: ip,
      comment: newHostComment.trim() || 'Akses Personal',
      addedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    }
    const updated = [...accessHosts, newEntry]
    setAccessHosts(updated)
    localStorage.setItem('miraigrid_remote_access_hosts', JSON.stringify(updated))
    setNewHostIp('')
    setNewHostComment('')
    toast.success(`Host IP '${ip}' berhasil diizinkan untuk akses database!`)
  }

  const handleDeleteHost = (id, host) => {
    const filtered = accessHosts.filter((h) => h.id !== id)
    setAccessHosts(filtered)
    localStorage.setItem('miraigrid_remote_access_hosts', JSON.stringify(filtered))
    toast.success(`Akses untuk host '${host}' telah dihapus.`)
  }

  const hostServer = window.location.hostname || '76.76.76.189'

  if (isV2) {
    const hostColumns = [
      {
        key: 'host',
        label: 'Host / IP Address',
        render: (val) => (
          <span className="font-mono font-bold text-emerald-600 text-sm">
            {val}
          </span>
        ),
      },
      {
        key: 'comment',
        label: 'Keterangan Label',
        render: (val) => <span className="text-slate-700">{val}</span>,
      },
      {
        key: 'addedAt',
        label: 'Tanggal Ditambahkan',
        render: (val) => <span className="font-mono text-xs text-slate-500">{val}</span>,
      },
    ]

    return (
      <div className="space-y-6 font-sans pb-12 animate-in fade-in duration-200">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={() => onNavigate('/dashboard')}
            >
              Kembali
            </Button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                  Network Security
                </span>
                <span className="text-xs text-slate-500">/ Tools</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2 mt-0.5">
                <Globe className="h-5 w-5 text-emerald-600" />
                <span>Remote Database Access (Perizinan IP Host)</span>
              </h1>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={Database}
            onClick={() => onNavigate('/databases')}
          >
            Lihat Kredensial Database Saya
          </Button>
        </div>

        {/* Server Endpoint Information Card */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Server className="h-4 w-4 text-emerald-600" />
                <span>Informasi Endpoint & Port Koneksi Remote Server</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Parameter koneksi resmi untuk menghubungkan aplikasi eksternal ke database engine Lab TI.
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 flex items-center space-x-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Port Terbuka / Siap Remote</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider">HOST SERVER / IP</span>
              <strong className="text-base text-slate-900 truncate block font-bold">{hostServer}</strong>
              <span className="text-[10px] text-emerald-600 block">DNS / Public Gateway</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider">PORT POSTGRESQL</span>
              <strong className="text-base text-cyan-600 block font-bold">5432</strong>
              <span className="text-[10px] text-slate-500 block">PostgreSQL 16 Enterprise</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider">PORT MYSQL / MARIADB</span>
              <strong className="text-base text-amber-600 block font-bold">3306</strong>
              <span className="text-[10px] text-slate-500 block">MySQL / MariaDB 11 Jammy</span>
            </div>
          </div>
        </Card>

        {/* Add Access Host Form */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Plus className="h-4 w-4 text-emerald-600" />
              <span>Tambah Access Host (Alamat IP atau Wildcard %)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Daftarkan alamat IP laptop/komputer Anda untuk mengizinkan sambungan langsung. Gunakan tanda persen (<code className="text-emerald-700 bg-emerald-50 px-1 rounded font-mono">%</code>) untuk mengizinkan semua IP yang memegang kredensial sah.
            </p>
          </div>

          <form onSubmit={handleAddHost} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-700 font-semibold mb-1.5 font-mono">
                  HOST / IP ADDRESS (%)
                </label>
                <input
                  type="text"
                  value={newHostIp}
                  onChange={(e) => setNewHostIp(e.target.value)}
                  placeholder="Contoh: % atau 192.168.1.%"
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 font-mono outline-none shadow-xs"
                />
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-[10px] text-slate-500">Preset cepat:</span>
                  <button
                    type="button"
                    onClick={() => setNewHostIp('%')}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                  >
                    % (Semua Host)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewHostIp('127.0.0.1')}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                  >
                    127.0.0.1 (Localhost)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-semibold mb-1.5 font-mono">
                  KETERANGAN / LABEL PENGGUNA
                </label>
                <input
                  type="text"
                  value={newHostComment}
                  onChange={(e) => setNewHostComment(e.target.value)}
                  placeholder="Misal: Laptop Pribadi / DBeaver Kos"
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 outline-none shadow-xs"
                />
                <p className="text-[10px] text-slate-500 mt-2">
                  Catatan untuk mengingat perangkat apa yang diberikan akses host ini.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Plus}
              >
                Tambah Host Diizinkan
              </Button>
            </div>
          </form>
        </Card>

        {/* Host List Table using modular DataTable */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Daftar Host Yang Diizinkan Mengakses Database</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hanya koneksi yang berasal dari alamat host berikut yang dapat menembus firewall database praktikum.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">{accessHosts.length} Host Aktif</span>
          </div>

          <DataTable
            columns={hostColumns}
            data={accessHosts}
            rowKey="id"
            actions={(row) => {
              if (row.host === '127.0.0.1') {
                return <span className="text-xs text-slate-400 font-mono">Host Permanen</span>
              }
              return (
                <Button
                  variant="danger"
                  size="xs"
                  icon={Trash2}
                  onClick={() => handleDeleteHost(row.id, row.host)}
                >
                  Hapus
                </Button>
              )
            }}
          />
        </Card>

        {/* External Connection Guides */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-emerald-600" />
              <span>Panduan Sambungan Klien Eksternal (DBeaver / TablePlus / Python / Node.js)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan format URI koneksi di bawah ini dengan menyertakan username dan password database Anda:
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Postgres URI */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-700 font-bold">URI POSTGRESQL (DBeaver / Prisma / SQLAlchemy)</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      `postgresql://<db_user>:<db_password>@${hostServer}:5432/<db_name>`,
                      'pg-uri',
                      'URI PostgreSQL'
                    )
                  }
                  className="text-slate-500 hover:text-slate-900 flex items-center space-x-1 text-[10px] cursor-pointer"
                >
                  {copiedSnippet === 'pg-uri' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Salin URI</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-slate-800 break-all select-all bg-white p-2.5 rounded-md border border-slate-200">
                postgresql://&lt;db_user&gt;:&lt;db_password&gt;@{hostServer}:5432/&lt;db_name&gt;
              </div>
            </div>

            {/* MySQL / MariaDB URI */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-700 font-bold">URI MYSQL / MARIADB (TypeORM / Sequelize / mysql2)</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      `mysql://<db_user>:<db_password>@${hostServer}:3306/<db_name>`,
                      'mysql-uri',
                      'URI MySQL'
                    )
                  }
                  className="text-slate-500 hover:text-slate-900 flex items-center space-x-1 text-[10px] cursor-pointer"
                >
                  {copiedSnippet === 'mysql-uri' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Salin URI</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-slate-800 break-all select-all bg-white p-2.5 rounded-md border border-slate-200">
                mysql://&lt;db_user&gt;:&lt;db_password&gt;@{hostServer}:3306/&lt;db_name&gt;
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="p-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] text-[#E8DCB8] hover:text-white transition shadow-md group"
            title="Kembali ke Tools Dashboard"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-700/60">
                Network Security
              </span>
              <span className="text-xs text-[#A47E65]">/ Tools</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2.5 mt-0.5">
              <Globe className="h-6 w-6 text-emerald-700" />
              <span>Remote Database Access (Perizinan IP Host)</span>
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/databases')}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#2B1810] hover:bg-[#3E2316] border border-[#4D2D1E] text-xs font-semibold text-[#E8DCB8] hover:text-white transition shadow-md"
        >
          <Database className="h-3.5 w-3.5 text-[#E8C58D]" />
          <span>Lihat Kredensial Database Saya</span>
        </button>
      </div>

      {/* Server Endpoint Information Card */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#3E2316] pb-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
              <Server className="h-4 w-4 text-[#C49767]" />
              <span>Informasi Endpoint & Port Koneksi Remote Server</span>
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-0.5">
              Parameter koneksi resmi untuk menghubungkan aplikasi eksternal ke database engine Lab TI.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1.5 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-700/60">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Port Terbuka / Siap Remote</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
            <span className="text-[10px] text-[#A47E65] block uppercase tracking-wider">HOST SERVER / IP</span>
            <strong className="text-base text-[#FAF5EC] truncate block font-bold">{hostServer}</strong>
            <span className="text-[10px] text-[#C49767] block">DNS / Public Gateway</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
            <span className="text-[10px] text-[#A47E65] block uppercase tracking-wider">PORT POSTGRESQL</span>
            <strong className="text-base text-cyan-400 block font-bold">5432</strong>
            <span className="text-[10px] text-[#DFCDB5]/70 block">PostgreSQL 16 Enterprise</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1">
            <span className="text-[10px] text-[#A47E65] block uppercase tracking-wider">PORT MYSQL / MARIADB</span>
            <strong className="text-base text-[#E8C58D] block font-bold">3306</strong>
            <span className="text-[10px] text-[#DFCDB5]/70 block">MySQL / MariaDB 11 Jammy</span>
          </div>
        </div>
      </div>

      {/* Add Access Host Form */}
      <form onSubmit={handleAddHost} className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
            <Plus className="h-4 w-4 text-[#C49767]" />
            <span>Tambah Access Host (Alamat IP atau Wildcard %)</span>
          </h3>
          <p className="text-xs text-[#DFCDB5]/80 mt-1">
            Daftarkan alamat IP laptop/komputer Anda untuk mengizinkan sambungan langsung. Gunakan tanda persen (<code className="text-[#E8DCB8] font-mono">%</code>) untuk mengizinkan semua IP yang memegang kredensial sah.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#DFCDB5] font-semibold mb-1.5 font-mono">
              HOST / IP ADDRESS (%)
            </label>
            <input
              type="text"
              value={newHostIp}
              onChange={(e) => setNewHostIp(e.target.value)}
              placeholder="Contoh: % atau 192.168.1.%"
              className="w-full bg-[#1C0F0A] border border-[#3E2316] focus:border-[#C49767] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] font-mono outline-none shadow-inner"
            />
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-[10px] text-[#A47E65]">Preset cepat:</span>
              <button
                type="button"
                onClick={() => setNewHostIp('%')}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1C0F0A] hover:bg-[#3E2316] text-[#E8DCB8] border border-[#3E2316]"
              >
                % (Semua Host)
              </button>
              <button
                type="button"
                onClick={() => setNewHostIp('127.0.0.1')}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1C0F0A] hover:bg-[#3E2316] text-[#E8DCB8] border border-[#3E2316]"
              >
                127.0.0.1 (Localhost)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#DFCDB5] font-semibold mb-1.5 font-mono">
              KETERANGAN / LABEL PENGGUNA
            </label>
            <input
              type="text"
              value={newHostComment}
              onChange={(e) => setNewHostComment(e.target.value)}
              placeholder="Misal: Laptop Pribadi / DBeaver Kos"
              className="w-full bg-[#1C0F0A] border border-[#3E2316] focus:border-[#C49767] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF5EC] outline-none shadow-inner"
            />
            <p className="text-[10px] text-[#A47E65] mt-2">
              Catatan untuk mengingat perangkat apa yang diberikan akses host ini.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-gradient-to-r from-chocolate-700 to-chocolate-600 hover:from-chocolate-600 hover:to-terracotta-600 text-xs font-semibold text-[#FAF5EC] rounded-xl transition shadow-md border border-chocolate-500/40 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Host Diizinkan</span>
          </button>
        </div>
      </form>

      {/* Host List Table */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#3E2316] pb-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Daftar Host Yang Diizinkan Mengakses Database</span>
            </h3>
            <p className="text-xs text-[#DFCDB5]/80 mt-0.5">
              Hanya koneksi yang berasal dari alamat host berikut yang dapat menembus firewall database praktikum.
            </p>
          </div>
          <span className="text-xs font-mono text-[#A47E65]">{accessHosts.length} Host Aktif</span>
        </div>

        <div className="border border-[#3E2316] rounded-2xl overflow-hidden bg-[#1C0F0A]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#180D08] border-b border-[#3E2316] text-[#A47E65] font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Host / IP Address</th>
                <th className="p-3.5">Keterangan Label</th>
                <th className="p-3.5">Tanggal Ditambahkan</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2F1A10]">
              {accessHosts.map((h) => (
                <tr key={h.id} className="hover:bg-[#25150E] transition">
                  <td className="p-3.5 font-mono font-bold text-emerald-400 text-sm">
                    {h.host}
                  </td>
                  <td className="p-3.5 text-[#DFCDB5]">
                    {h.comment}
                  </td>
                  <td className="p-3.5 text-[#A47E65] font-mono text-[11px]">
                    {h.addedAt}
                  </td>
                  <td className="p-3.5 text-right">
                    {h.host !== '127.0.0.1' ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteHost(h.id, h.host)}
                        className="inline-flex items-center space-x-1 text-red-400 hover:text-red-300 text-xs px-2.5 py-1 rounded-lg hover:bg-red-950/40 border border-transparent hover:border-red-800/40 transition font-mono"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Hapus</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#A47E65] font-mono">Host Permanen</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* External Connection Guides */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC] shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-[#C49767]" />
            <span>Panduan Sambungan Klien Eksternal (DBeaver / TablePlus / Python / Node.js)</span>
          </h3>
          <p className="text-xs text-[#DFCDB5]/80 mt-1">
            Gunakan format URI koneksi di bawah ini dengan menyertakan username dan password database Anda:
          </p>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {/* Postgres URI */}
          <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-cyan-400 font-bold">URI POSTGRESQL (DBeaver / Prisma / SQLAlchemy)</span>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    `postgresql://<db_user>:<db_password>@${hostServer}:5432/<db_name>`,
                    'pg-uri',
                    'URI PostgreSQL'
                  )
                }
                className="text-[#A47E65] hover:text-[#FAF5EC] flex items-center space-x-1 text-[10px]"
              >
                {copiedSnippet === 'pg-uri' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Salin URI</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[#E8DCB8] break-all select-all bg-[#120A07] p-2 rounded-xl border border-[#2E1A11]">
              postgresql://&lt;db_user&gt;:&lt;db_password&gt;@{hostServer}:5432/&lt;db_name&gt;
            </div>
          </div>

          {/* MySQL / MariaDB URI */}
          <div className="p-3.5 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#E8C58D] font-bold">URI MYSQL / MARIADB (TypeORM / Sequelize / mysql2)</span>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    `mysql://<db_user>:<db_password>@${hostServer}:3306/<db_name>`,
                    'mysql-uri',
                    'URI MySQL'
                  )
                }
                className="text-[#A47E65] hover:text-[#FAF5EC] flex items-center space-x-1 text-[10px]"
              >
                {copiedSnippet === 'mysql-uri' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Salin URI</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[#E8DCB8] break-all select-all bg-[#120A07] p-2 rounded-xl border border-[#2E1A11]">
              mysql://&lt;db_user&gt;:&lt;db_password&gt;@{hostServer}:3306/&lt;db_name&gt;
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
