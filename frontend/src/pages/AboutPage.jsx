import React from 'react'
import {
  ArrowLeft,
  Server,
  Database,
  Cpu,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Boxes,
  Workflow,
  Lock,
  Cloud,
  HardDrive,
  Router,
  Code2,
  FileSearch,
  Sparkles,
  Building2,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import Button from '../components/Button'
import Card from '../components/Card'

export default function AboutPage({ user, onNavigate }) {
  const { isV2 } = useTheme()

  const categories = [
    {
      id: 'security',
      title: 'Keamanan & Pertahanan Siber',
      subtitle: 'Multi-layer security, WAF, IPS, malware quarantine, dan isolasi sandbox kernel',
      icon: ShieldCheck,
      iconColor: isV2 ? 'text-rose-600' : 'text-[#F95959]',
      items: [
        {
          id: 'crowdsec',
          name: 'CrowdSec IPS',
          logo: '/logos/crowdsec.svg',
          icon: ShieldAlert,
          iconColor: isV2 ? 'text-rose-600' : 'text-[#F95959]',
        },
        {
          id: 'modsecurity',
          name: 'ModSecurity WAF',
          logo: '/logos/modsecurity.svg',
          icon: ShieldCheck,
          iconColor: isV2 ? 'text-cyan-600' : 'text-[#00C0FF]',
        },
        {
          id: 'maldet',
          name: 'Maldet & Anti-Malware',
          logo: '/logos/maldet.svg',
          icon: FileSearch,
          iconColor: isV2 ? 'text-emerald-600' : 'text-[#10B981]',
        },
        {
          id: 'apparmor',
          name: 'AppArmor & Seccomp',
          logo: '/logos/apparmor.svg',
          icon: Lock,
          iconColor: isV2 ? 'text-amber-600' : 'text-[#F59E0B]',
        },
      ],
    },
    {
      id: 'system',
      title: 'Sistem & Virtualisasi',
      subtitle: 'Pondasi operating system, kernel namespace, container runtime, dan orkestrasi stack',
      icon: Server,
      iconColor: isV2 ? 'text-orange-600' : 'text-[#E95420]',
      items: [
        {
          id: 'ubuntu',
          name: 'Ubuntu Linux Enterprise',
          logo: '/logos/ubuntu.svg',
          icon: Server,
          iconColor: isV2 ? 'text-orange-600' : 'text-[#E95420]',
        },
        {
          id: 'lxc',
          name: 'LXC (Linux Containers)',
          logo: '/logos/lxc.svg',
          icon: Cpu,
          iconColor: isV2 ? 'text-amber-600' : 'text-[#F29111]',
        },
        {
          id: 'docker',
          name: 'Docker Engine',
          logo: '/logos/docker.svg',
          icon: Boxes,
          iconColor: isV2 ? 'text-blue-600' : 'text-[#2496ED]',
        },
        {
          id: 'portainer',
          name: 'Portainer CE',
          logo: '/logos/portainer.svg',
          icon: Boxes,
          iconColor: isV2 ? 'text-sky-600' : 'text-[#13BEF9]',
        },
      ],
    },
    {
      id: 'storage',
      title: 'Basis Data & Penyimpanan',
      subtitle: 'Relational database engine, object storage, dan in-memory cache berkecepatan tinggi',
      icon: Database,
      iconColor: isV2 ? 'text-emerald-600' : 'text-[#10B981]',
      items: [
        {
          id: 'postgres',
          name: 'PostgreSQL 16',
          logo: '/logos/postgres.svg',
          icon: Database,
          iconColor: isV2 ? 'text-indigo-600' : 'text-[#336791]',
        },
        {
          id: 'mariadb',
          name: 'MariaDB 11 Jammy',
          logo: '/logos/mariadb.svg',
          icon: Database,
          iconColor: isV2 ? 'text-amber-700' : 'text-[#003545]',
        },
        {
          id: 'redis',
          name: 'Redis In-Memory Cache',
          logo: '/logos/redis.svg',
          icon: HardDrive,
          iconColor: isV2 ? 'text-rose-600' : 'text-[#DC382D]',
        },
        {
          id: 'minio',
          name: 'MinIO S3 Object Storage',
          logo: '/logos/minio.svg',
          icon: HardDrive,
          iconColor: isV2 ? 'text-rose-700' : 'text-[#C72C48]',
        },
      ],
    },
    {
      id: 'network',
      title: 'Jaringan & Gateway Ingress',
      subtitle: 'Zero Trust tunnel, MikroTik dynamic routing, DNS manajemen, dan load balancer',
      icon: Router,
      iconColor: isV2 ? 'text-cyan-600' : 'text-[#00C0FF]',
      items: [
        {
          id: 'cloudflare',
          name: 'Cloudflare Zero Trust',
          logo: '/logos/cloudflare.svg',
          icon: Globe,
          iconColor: isV2 ? 'text-amber-600' : 'text-[#F38020]',
        },
        {
          id: 'mikrotik',
          name: 'MikroTik RouterOS',
          logo: '/logos/mikrotik.svg',
          icon: Router,
          iconColor: isV2 ? 'text-blue-700' : 'text-[#285785]',
        },
        {
          id: 'nginx',
          name: 'Nginx Reverse Proxy',
          logo: '/logos/nginx.svg',
          icon: Globe,
          iconColor: isV2 ? 'text-emerald-600' : 'text-[#009639]',
        },
        {
          id: 'tailscale',
          name: 'Tailscale Mesh VPN',
          logo: '/logos/tailscale.svg',
          icon: Globe,
          iconColor: isV2 ? 'text-slate-800' : 'text-[#2D3748]',
        },
      ],
    },
    {
      id: 'runtime',
      title: 'Lingkungan Eksekusi & IDE',
      subtitle: 'Multi-runtime language, web code editor standalone, dan Git continuous development',
      icon: Code2,
      iconColor: isV2 ? 'text-purple-600' : 'text-[#A855F7]',
      items: [
        {
          id: 'php',
          name: 'PHP 8.2 / 8.3 & Composer',
          logo: '/logos/php.svg',
          icon: Code2,
          iconColor: isV2 ? 'text-indigo-600' : 'text-[#777BB4]',
        },
        {
          id: 'nodejs',
          name: 'Node.js 20 LTS & NPM',
          logo: '/logos/nodejs.svg',
          icon: Code2,
          iconColor: isV2 ? 'text-emerald-600' : 'text-[#339933]',
        },
        {
          id: 'python',
          name: 'Python 3.11 & FastAPI',
          logo: '/logos/python.svg',
          icon: Code2,
          iconColor: isV2 ? 'text-blue-600' : 'text-[#3776AB]',
        },
        {
          id: 'git',
          name: 'Git Version Control',
          logo: '/logos/git.svg',
          icon: Workflow,
          iconColor: isV2 ? 'text-orange-600' : 'text-[#F05032]',
        },
      ],
    },
  ]

  const pillars = [
    {
      title: 'Enterprise Isolated Sandboxing',
      subtitle: 'Isolasi Komputasi Multi-Tenant',
      description:
        'Setiap mahasiswa mendapatkan container terisolasi secara kernel namespace dan cgroup v2, menjamin lingkungan praktikum tidak saling bentrok maupun mempengaruhi server utama.',
      icon: Layers,
      color: isV2
        ? 'text-cyan-600 bg-cyan-50 border-cyan-200'
        : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Independent Runtime Stacks',
      subtitle: 'Siklus Hidup Layanan Mandiri',
      description:
        'Mahasiswa dapat menjalankan aplikasi berbasis PHP, Node.js, atau Python secara independen dengan restart runtime otomatis, integrasi Git repositori, dan isolasi memori/CPU.',
      icon: Workflow,
      color: isV2
        ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Cloud-Native Lab Workflow',
      subtitle: 'Pengalaman Praktikum Modern',
      description:
        'Menyediakan perkakas setara platform cloud industri: Desktop File Explorer, terminal console terisolasi, manajemen cron job, dan visualisasi penggunaan storage terpusat.',
      icon: Cloud,
      color: isV2
        ? 'text-rose-600 bg-rose-50 border-rose-200'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
  ]

  if (isV2) {
    return (
      <div className="w-full space-y-8 font-sans pb-12 animate-in fade-in duration-200">
        {/* 1. HERO BANNER: MODERN SAAS V2 */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-6 sm:p-8">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center space-x-5">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-slate-50 p-2.5 border border-slate-200 shrink-0 flex items-center justify-center">
                <img
                  src="/logos/miraigrid-logo.svg"
                  alt="MiraiGrid Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 tracking-tight">
                    MiraiGrid
                  </h1>
                  <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Cloud Infrastructure
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  Infrastruktur Cloud Laboratorium Teknik Informatika — Universitas Muhammadiyah Ponorogo.
                  Platform komputasi mandiri dan PaaS modern berbasis microservices & containerization terisolasi.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-600" />
                    <span>Fakultas Teknik UMPO</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Multi-Tenant Sandboxing</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Globe className="h-3.5 w-3.5 text-cyan-600" />
                    <span>Zero-Port HTTPS Ingress</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2.5">
              <Button
                variant="primary"
                size="md"
                icon={Sparkles}
                onClick={() => onNavigate('/dashboard')}
              >
                Buka Tools Praktikum
              </Button>
            </div>
          </div>
        </div>

        {/* 3. MODERN ENTERPRISE TECH STACK SHOWCASE */}
        <div className="space-y-8">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Boxes className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Arsitektur & Tech Stack Modern
                </h2>
                <p className="text-xs text-slate-500">
                  Teknologi komputasi awan berstandar industri yang menggerakkan infrastruktur praktikum MiraiGrid
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex text-[11px] font-mono text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
              Enterprise Cloud Architecture
            </span>
          </div>

          {/* Categories Grid */}
          {categories.map((category) => {
            const CategoryIcon = category.icon
            return (
              <div key={category.id} className="space-y-3.5">
                <div className="flex items-center space-x-2.5 px-1">
                  <div className={`p-1.5 rounded-lg bg-slate-100 border border-slate-200 ${category.iconColor}`}>
                    <CategoryIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                      {category.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-sans">
                      {category.subtitle}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {category.items.map((tech) => {
                    const IconComponent = tech.icon
                    return (
                      <Card
                        key={tech.id}
                        hover
                        padding="sm"
                        className="flex items-center space-x-3.5 bg-white border border-slate-200/90 rounded-xl group relative overflow-hidden"
                      >
                        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 p-2 group-hover:border-slate-300 transition-colors relative z-10">
                          {tech.logo ? (
                            <img
                              src={tech.logo}
                              alt={tech.name}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <IconComponent className={`h-6 w-6 ${tech.iconColor}`} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 relative z-10">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors leading-snug">
                            {tech.name}
                          </h4>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* 4. PILAR ARSITEKTUR INFRASTRUKTUR */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Pilar Keandalan & Keamanan Sistem
              </h2>
              <p className="text-xs text-slate-500">
                Prinsip perancangan sistem terdistribusi untuk menjamin integritas data dan ketersediaan layanan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon
              return (
                <Card
                  key={idx}
                  hover
                  padding="md"
                  className="space-y-3 relative overflow-hidden group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${pillar.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{pillar.title}</h3>
                      <p className="text-[11px] text-slate-500 font-mono">{pillar.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {pillar.description}
                  </p>
                </Card>
              )
            })}
          </div>
        </div>

        {/* 5. INFORMASI LABORATORIUM & KAMPUS */}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Laboratorium Komputer Teknik Informatika
              </h3>
              <p className="text-[11px] text-slate-500">
                Fakultas Teknik • Universitas Muhammadiyah Ponorogo
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Kampus Utama</span>
              <p className="text-xs font-bold text-slate-900">Universitas Muhammadiyah Ponorogo</p>
              <p className="text-[10px] text-slate-500">Jl. Budi Utomo No. 10, Ronowijayan, Ponorogo</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Fasilitas Praktikum</span>
              <p className="text-xs font-bold text-slate-900">Infrastruktur Cloud & Jaringan</p>
              <p className="text-[10px] text-slate-500">Dedicated Enterprise Server & Network Edge</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Portal Layanan Resmi</span>
              <p className="text-xs font-bold text-emerald-700">miraigrid.web.id</p>
              <p className="text-[10px] text-emerald-600">Zero-Port HTTPS Ingress (Cloudflare Tunnel)</p>
            </div>
          </div>
        </Card>

        {/* 6. FOOTER */}
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
          <p className="text-xs text-slate-600 font-sans">
            Infrastruktur Cloud Laboratorium Teknik Informatika • Universitas Muhammadiyah Ponorogo.
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            © {new Date().getFullYear()} MiraiGrid Cloud Platform • Dedicated to Educational & Engineering Excellence.
          </p>
        </div>
      </div>
    )
  }

  // V1 VINTAGE THEME RENDER (100% PRESERVED EXACTLY AS ORIGINAL)
  return (
    <div className="w-full space-y-8 font-sans pb-12">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={() => onNavigate('/dashboard')}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-[#2B1810] hover:bg-[#3E2316] text-[#DFCDB5] hover:text-[#FAF5EC] border border-[#4D2D1E] shadow-sm transition-all duration-200 group text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 text-[#C49767]" />
          <span>Kembali ke Tools</span>
        </button>
      </div>

      {/* 2. HERO BANNER: ENTERPRISE CLOUD ARCHITECTURE */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2B1810] via-[#24130B] to-[#1A0D07] border border-[#4D2D1E] shadow-2xl p-6 sm:p-10">
        <div className="absolute -right-16 -top-16 w-72 h-72 bg-[#C49767]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-72 h-72 bg-[#5A3521]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-5">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl bg-white p-2.5 shadow-2xl border border-white/20 shrink-0 flex items-center justify-center">
              <img
                src="/logos/miraigrid-logo.svg"
                alt="MiraiGrid Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-serif font-extrabold text-[#FAF5EC] tracking-wide">
                  MiraiGrid
                </h1>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-[#3D2316] text-[#E8DCB8] border border-[#5A3521]">
                  Cloud Infrastructure
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#DFCDB5] max-w-2xl leading-relaxed">
                Infrastruktur Cloud Laboratorium Teknik Informatika — Universitas Muhammadiyah Ponorogo.
                Platform komputasi mandiri dan PaaS modern berbasis microservices & containerization terisolasi.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#A47E65]">
                <span className="flex items-center space-x-1">
                  <Building2 className="h-3.5 w-3.5 text-[#C49767]" />
                  <span>Fakultas Teknik UMPO</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Multi-Tenant Sandboxing</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Globe className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Zero-Port HTTPS Ingress</span>
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#C49767] to-[#A47454] hover:from-[#D4A777] hover:to-[#B48464] text-[#180D07] font-bold text-xs shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Buka Tools Praktikum</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. MODERN ENTERPRISE TECH STACK SHOWCASE */}
      <div className="space-y-8">
        <div className="flex items-center justify-between pb-2 border-b border-[#D8C7B2]/40">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#3A2116] border border-[#523120] flex items-center justify-center text-[#E8DCB8]">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-[#26160F] tracking-wide">
                Arsitektur & Tech Stack Modern
              </h2>
              <p className="text-xs text-[#704D36]">
                Teknologi komputasi awan berstandar industri yang menggerakkan infrastruktur praktikum MiraiGrid
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-mono text-[#8C6D58] bg-[#FDFBF7] px-3 py-1 rounded-xl border border-[#D4C1AC]">
            Enterprise Cloud Architecture
          </span>
        </div>

        {categories.map((category) => {
          const CategoryIcon = category.icon
          return (
            <div key={category.id} className="space-y-3.5">
              <div className="flex items-center space-x-2.5 px-1">
                <div className={`p-1.5 rounded-xl bg-[#2B1810] border border-[#4D2D1E] ${category.iconColor}`}>
                  <CategoryIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#26160F] tracking-tight">
                    {category.title}
                  </h3>
                  <p className="text-[11px] text-[#704D36] font-sans">
                    {category.subtitle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {category.items.map((tech) => {
                  const IconComponent = tech.icon
                  return (
                    <div
                      key={tech.id}
                      className="bg-[#2B1810] border border-[#4D2D1E] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl hover:border-[#C49767]/60 hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-[#C49767]/5 rounded-full blur-xl group-hover:bg-[#C49767]/10 transition-colors pointer-events-none" />

                      <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#1C0F0A] border border-[#3E2316] flex items-center justify-center shrink-0 p-2.5 group-hover:border-[#C49767]/40 shadow-inner transition-colors relative z-10">
                        {tech.logo ? (
                          <img
                            src={tech.logo}
                            alt={tech.name}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <IconComponent className={`h-6 w-6 ${tech.iconColor}`} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 relative z-10">
                        <h4 className="text-xs sm:text-sm font-bold text-[#FAF5EC] tracking-tight group-hover:text-[#E8DCB8] transition-colors leading-snug">
                          {tech.name}
                        </h4>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 4. PILAR ARSITEKTUR INFRASTRUKTUR */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#3A2116] border border-[#523120] flex items-center justify-center text-[#E8DCB8]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-[#26160F] tracking-wide">
              Pilar Keandalan & Keamanan Sistem
            </h2>
            <p className="text-xs text-[#704D36]">
              Prinsip perancangan sistem terdistribusi untuk menjamin integritas data dan ketersediaan layanan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon
            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl space-y-3 relative overflow-hidden group hover:border-[#6B3F25] transition-all"
              >
                <div className="flex items-center space-x-3.5">
                  <div className={`h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0 ${pillar.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#FAF5EC]">{pillar.title}</h3>
                    <p className="text-[11px] text-[#A47E65] font-mono">{pillar.subtitle}</p>
                  </div>
                </div>
                <p className="text-xs text-[#DFCDB5] leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 5. INFORMASI LABORATORIUM & KAMPUS */}
      <div className="rounded-3xl bg-[#2B1810] border border-[#4D2D1E] shadow-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-2xl bg-[#3A2116] border border-[#523120] flex items-center justify-center text-[#E8DCB8]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF5EC]">
              Laboratorium Komputer Teknik Informatika
            </h3>
            <p className="text-[11px] text-[#A47E65]">
              Fakultas Teknik • Universitas Muhammadiyah Ponorogo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-[#201109] border border-[#3D2316] space-y-1">
            <span className="text-[10px] uppercase font-mono text-[#A47E65]">Kampus Utama</span>
            <p className="text-xs font-bold text-[#FAF5EC]">Universitas Muhammadiyah Ponorogo</p>
            <p className="text-[10px] text-[#DFCDB5]">Jl. Budi Utomo No. 10, Ronowijayan, Ponorogo</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#201109] border border-[#3D2316] space-y-1">
            <span className="text-[10px] uppercase font-mono text-[#A47E65]">Fasilitas Praktikum</span>
            <p className="text-xs font-bold text-[#FAF5EC]">Infrastruktur Cloud & Jaringan</p>
            <p className="text-[10px] text-[#DFCDB5]">Dedicated Enterprise Server & Network Edge</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#201109] border border-[#3D2316] space-y-1">
            <span className="text-[10px] uppercase font-mono text-[#A47E65]">Portal Layanan Resmi</span>
            <p className="text-xs font-bold text-amber-300">miraigrid.web.id</p>
            <p className="text-[10px] text-emerald-400">Zero-Port HTTPS Ingress (Cloudflare Tunnel)</p>
          </div>
        </div>
      </div>

      {/* 6. FOOTER */}
      <div className="p-6 rounded-3xl bg-[#23130C] border border-[#3D2316] text-center space-y-1.5">
        <p className="text-xs text-[#DFCDB5]">
          Infrastruktur Cloud Laboratorium Teknik Informatika • Universitas Muhammadiyah Ponorogo.
        </p>
        <p className="text-[10px] text-[#A47E65] font-mono">
          © {new Date().getFullYear()} MiraiGrid Cloud Platform • Dedicated to Educational & Engineering Excellence.
        </p>
      </div>
    </div>
  )
}
