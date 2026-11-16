import React, { useState } from 'react'
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
  Users,
} from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'

function TechLogo({ tech }) {
  const [hasError, setHasError] = useState(false)
  const IconComponent = tech.icon

  if (!tech.logo || hasError) {
    return <IconComponent className={`h-6 w-6 ${tech.iconColor}`} />
  }

  return (
    <img
      src={tech.logo}
      alt={tech.name}
      className="h-full w-full object-contain"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

export default function AboutPage({ user, onNavigate }) {

  const categories = [
    {
      id: 'security',
      title: 'Keamanan & Pertahanan Siber',
      subtitle: 'Multi-layer security, WAF, IPS, malware quarantine, dan isolasi sandbox kernel',
      icon: ShieldCheck,
      iconColor: 'text-rose-600',
      items: [
        {
          id: 'crowdsec',
          name: 'CrowdSec IPS',
          logo: '/logos/crowdsec.svg',
          icon: ShieldAlert,
          iconColor: 'text-rose-600',
        },
        {
          id: 'modsecurity',
          name: 'ModSecurity WAF',
          logo: '/logos/modsecurity.svg',
          icon: ShieldCheck,
          iconColor: 'text-cyan-600',
        },
        {
          id: 'maldet',
          name: 'Maldet & Anti-Malware',
          logo: '/logos/maldet.svg',
          icon: FileSearch,
          iconColor: 'text-emerald-600',
        },
        {
          id: 'apparmor',
          name: 'AppArmor & Seccomp',
          logo: '/logos/apparmor.svg',
          icon: Lock,
          iconColor: 'text-amber-600',
        },
      ],
    },
    {
      id: 'system',
      title: 'Sistem & Virtualisasi',
      subtitle: 'Pondasi operating system, kernel namespace, container runtime, dan orkestrasi stack',
      icon: Server,
      iconColor: 'text-orange-600',
      items: [
        {
          id: 'ubuntu',
          name: 'Ubuntu Linux Enterprise',
          logo: '/logos/ubuntu.svg',
          icon: Server,
          iconColor: 'text-orange-600',
        },
        {
          id: 'lxc',
          name: 'LXC (Linux Containers)',
          logo: '/logos/lxc.svg',
          icon: Cpu,
          iconColor: 'text-amber-600',
        },
        {
          id: 'docker',
          name: 'Docker Engine',
          logo: '/logos/docker.svg',
          icon: Boxes,
          iconColor: 'text-blue-600',
        },
        {
          id: 'portainer',
          name: 'Portainer CE',
          logo: '/logos/portainer.svg',
          icon: Boxes,
          iconColor: 'text-sky-600',
        },
      ],
    },
    {
      id: 'storage',
      title: 'Basis Data & Penyimpanan',
      subtitle: 'Relational database engine, object storage, dan in-memory cache berkecepatan tinggi',
      icon: Database,
      iconColor: 'text-emerald-600',
      items: [
        {
          id: 'postgres',
          name: 'PostgreSQL 16',
          logo: '/logos/postgres.svg',
          icon: Database,
          iconColor: 'text-indigo-600',
        },
        {
          id: 'mariadb',
          name: 'MariaDB 11 Jammy',
          logo: '/logos/mariadb.svg',
          icon: Database,
          iconColor: 'text-amber-700',
        },
        {
          id: 'redis',
          name: 'Redis In-Memory Cache',
          logo: '/logos/redis.svg',
          icon: HardDrive,
          iconColor: 'text-rose-600',
        },
        {
          id: 'minio',
          name: 'MinIO S3 Object Storage',
          logo: '/logos/minio.svg',
          icon: HardDrive,
          iconColor: 'text-rose-700',
        },
      ],
    },
    {
      id: 'network',
      title: 'Jaringan & Gateway Ingress',
      subtitle: 'Zero Trust tunnel, dynamic routing, DNS manajemen, dan load balancer',
      icon: Router,
      iconColor: 'text-cyan-600',
      items: [
        {
          id: 'cloudflare',
          name: 'Cloudflare Zero Trust',
          logo: '/logos/cloudflare.svg',
          icon: Globe,
          iconColor: 'text-amber-600',
        },
        {
          id: 'nginx',
          name: 'Nginx Reverse Proxy',
          logo: '/logos/nginx.svg',
          icon: Globe,
          iconColor: 'text-emerald-600',
        },
        {
          id: 'openlitespeed',
          name: 'OpenLiteSpeed (OLS)',
          logo: '/logos/openlitespeed.png',
          icon: Globe,
          iconColor: 'text-blue-600',
        },
      ],
    },
    {
      id: 'runtime',
      title: 'Lingkungan Eksekusi & IDE',
      subtitle: 'Multi-runtime language, web code editor standalone, dan Git continuous development',
      icon: Code2,
      iconColor: 'text-purple-600',
      items: [
        {
          id: 'php',
          name: 'PHP 8.2 / 8.3 & OpenLiteSpeed LSPHP',
          logo: '/logos/php.svg',
          icon: Code2,
          iconColor: 'text-indigo-600',
        },
        {
          id: 'nodejs',
          name: 'Node.js 20 LTS & NPM',
          logo: '/logos/nodejs.png',
          icon: Code2,
          iconColor: 'text-emerald-600',
        },
        {
          id: 'python',
          name: 'Python 3.11 & FastAPI',
          logo: '/logos/python.svg',
          icon: Code2,
          iconColor: 'text-blue-600',
        },
        {
          id: 'git',
          name: 'Git Version Control',
          logo: '/logos/git.svg',
          icon: Workflow,
          iconColor: 'text-orange-600',
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
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    },
    {
      title: 'Independent Runtime Stacks',
      subtitle: 'Siklus Hidup Layanan Mandiri',
      description:
        'Mahasiswa dapat menjalankan aplikasi berbasis PHP, Node.js, atau Python secara independen dengan restart runtime otomatis, integrasi Git repositori, dan isolasi memori/CPU.',
      icon: Workflow,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      title: 'Cloud-Native Lab Workflow',
      subtitle: 'Pengalaman Praktikum Modern',
      description:
        'Menyediakan perkakas setara platform cloud industri: Desktop File Explorer, terminal console terisolasi, manajemen cron job, dan visualisasi penggunaan storage terpusat.',
      icon: Cloud,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
  ]

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
                          <TechLogo tech={tech} />
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

        {/* 5.5 TIM PENGEMBANG */}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Tim Pengembang — Rombongan Split
                  </h3>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    3 Developer
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mahasiswa Magang Semester 7 • Program Studi Teknik Informatika Angkatan 2023
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-xs text-slate-600 leading-relaxed">
              Platform MiraiGrid dirancang dan dibangun oleh tim <span className="font-semibold text-slate-800">Rombongan Split</span> yang beranggotakan <span className="font-semibold text-slate-800">3 developer mahasiswa Teknik Informatika</span> angkatan 2023 dalam program magang semester 7 di Laboratorium Komputer Teknik Informatika Universitas Muhammadiyah Ponorogo.
            </p>
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
