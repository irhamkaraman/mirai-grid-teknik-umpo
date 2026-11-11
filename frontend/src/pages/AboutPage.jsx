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
  Building2
} from 'lucide-react'

export default function AboutPage({ user, onNavigate }) {
  const categories = [
    {
      id: 'security',
      title: 'Keamanan & Pertahanan Siber',
      subtitle: 'Multi-layer security, WAF, IPS, malware quarantine, dan isolasi sandbox kernel',
      icon: ShieldCheck,
      iconColor: 'text-[#F95959]',
      items: [
        {
          id: 'crowdsec',
          name: 'CrowdSec IPS',
          logo: '/logos/crowdsec.svg',
          icon: ShieldAlert,
          iconColor: 'text-[#F95959]',
        },
        {
          id: 'modsecurity',
          name: 'ModSecurity WAF',
          logo: '/logos/modsecurity.svg',
          icon: ShieldCheck,
          iconColor: 'text-[#00C0FF]',
        },
        {
          id: 'maldet',
          name: 'Maldet & Anti-Malware',
          logo: '/logos/maldet.svg',
          icon: FileSearch,
          iconColor: 'text-[#10B981]',
        },
        {
          id: 'apparmor',
          name: 'AppArmor & Seccomp',
          logo: '/logos/apparmor.svg',
          icon: Lock,
          iconColor: 'text-[#F59E0B]',
        },
      ],
    },
    {
      id: 'system',
      title: 'Sistem & Virtualisasi',
      subtitle: 'Pondasi operating system, kernel namespace, container runtime, dan orkestrasi stack',
      icon: Server,
      iconColor: 'text-[#E95420]',
      items: [
        {
          id: 'ubuntu',
          name: 'Ubuntu Linux Enterprise',
          logo: '/logos/ubuntu.svg',
          icon: Server,
          iconColor: 'text-[#E95420]',
        },
        {
          id: 'lxc',
          name: 'LXC (Linux Containers)',
          logo: '/logos/lxc.svg',
          icon: Cpu,
          iconColor: 'text-[#F29111]',
        },
        {
          id: 'docker',
          name: 'Docker Engine',
          logo: '/logos/docker.svg',
          icon: Boxes,
          iconColor: 'text-[#2496ED]',
        },
        {
          id: 'portainer',
          name: 'Portainer CE',
          logo: '/logos/portainer.svg',
          icon: Boxes,
          iconColor: 'text-[#13BEF9]',
        },
      ],
    },
    {
      id: 'storage',
      title: 'Penyimpanan & Basis Data',
      subtitle: 'Klaster multi-tenant relational database, in-memory cache, dan object storage',
      icon: Database,
      iconColor: 'text-[#336791]',
      items: [
        {
          id: 'databases',
          name: 'PostgreSQL & MariaDB',
          logo: '/logos/postgres.svg',
          icon: Database,
          iconColor: 'text-[#336791]',
        },
        {
          id: 'redis',
          name: 'Redis™ In-Memory Store',
          logo: '/logos/redis.svg',
          icon: Database,
          iconColor: 'text-red-500',
        },
        {
          id: 'minio',
          name: 'MinIO Object Storage',
          logo: '/logos/minio.svg',
          icon: Cloud,
          iconColor: 'text-[#EA3B50]',
        },
      ],
    },
    {
      id: 'network',
      title: 'Jaringan & Ingress Edge',
      subtitle: 'Perutean HTTPS murni, edge reverse proxy cerdas, dan gateway laboratorium',
      icon: Globe,
      iconColor: 'text-[#009639]',
      items: [
        {
          id: 'nginx-cloudflare',
          name: 'Nginx & Cloudflare Edge',
          logo: '/logos/nginx.svg',
          icon: Globe,
          iconColor: 'text-[#009639]',
        },
        {
          id: 'mikrotik',
          name: 'MikroTik RouterOS',
          logo: '/logos/mikrotik.svg',
          icon: Router,
          iconColor: 'text-slate-200',
        },
      ],
    },
    {
      id: 'development',
      title: 'Core API & Pengembangan',
      subtitle: 'Arsitektur microservices asinkronus, antarmuka modern, dan version control Git',
      icon: Code2,
      iconColor: 'text-[#009688]',
      items: [
        {
          id: 'fastapi',
          name: 'FastAPI & Python',
          logo: '/logos/fastapi.svg',
          icon: Code2,
          iconColor: 'text-[#009688]',
        },
        {
          id: 'nextjs',
          name: 'Next.js & React',
          logo: '/logos/react.svg',
          icon: Layers,
          iconColor: 'text-[#61DAFB]',
        },
        {
          id: 'git',
          name: 'Git™ Version Control',
          logo: '/logos/git.svg',
          icon: Workflow,
          iconColor: 'text-[#F05032]',
        },
      ],
    },
  ]

  const pillars = [
    {
      title: 'Multi-Tenant Sandboxing',
      subtitle: 'Isolasi Komputasi & File Ketat',
      description: 'Setiap mahasiswa memiliki direktori kerja mandiri (/home/nim) dan resource terisolasi penuh, menjamin tidak adanya konflik dependensi maupun interferensi antar proyek tugas.',
      icon: Lock,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Zero-Port Public Ingress',
      subtitle: 'Akses Domain Tanpa Port Mentah',
      description: 'Seluruh akses web publik, dashboard, dan GUI basis data dilewatkan melalui perutean subdomain resmi HTTPS murni, menjaga keamanan infrastruktur internal dari pemindaian port.',
      icon: ShieldCheck,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Independent Runtime Stacks',
      subtitle: 'Siklus Hidup Layanan Mandiri',
      description: 'Mahasiswa dapat menjalankan aplikasi berbasis PHP, Node.js, atau Python secara independen dengan restart runtime otomatis, integrasi Git repositori, dan isolasi memori/CPU.',
      icon: Workflow,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Cloud-Native Lab Workflow',
      subtitle: 'Pengalaman Praktikum Modern',
      description: 'Menyediakan perkakas setara platform cloud industri: Desktop File Explorer, terminal console terisolasi, manajemen cron job, dan visualisasi penggunaan storage terpusat.',
      icon: Cloud,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
  ]

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

      {/* 3. MODERN ENTERPRISE TECH STACK SHOWCASE (KATEGORI TERPISAH DENGAN LOGO & NAMA) */}
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

        {/* Masing-masing kategori ditampilkan secara terpisah */}
        {categories.map((category) => {
          const CategoryIcon = category.icon
          return (
            <div key={category.id} className="space-y-3.5">
              {/* Category Header */}
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

              {/* Grid of Clean Minimalist Cards: Logo + Nama Saja (Tanpa Badge, Tanpa Deskripsi, Tanpa Tags) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {category.items.map((tech) => {
                  const IconComponent = tech.icon
                  return (
                    <div
                      key={tech.id}
                      className="bg-[#2B1810] border border-[#4D2D1E] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl hover:border-[#C49767]/60 hover:-translate-y-0.5 transition-all duration-200 flex items-center space-x-3.5 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-20 h-20 bg-[#C49767]/5 rounded-full blur-xl group-hover:bg-[#C49767]/10 transition-colors pointer-events-none" />

                      {/* Logo / Icon Container */}
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

                      {/* Nama Teknologi Saja */}
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
