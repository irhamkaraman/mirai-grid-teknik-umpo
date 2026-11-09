import React, { useState, useEffect } from 'react'
import { Folder, Layers, Plus, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { SkeletonCard, SkeletonTable } from '../components/Skeletons'
import FileManager from '../components/FileManager'
import ErrorBoundary from '../components/ErrorBoundary'

export default function FilesView({ onNavigate, isStandalone = false }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data || [])
      if (res.data && res.data.length > 0) {
        setSelectedProjectId(res.data[0].id)
      }
    } catch (err) {
      toast.error('Gagal memuat daftar project.')
    } finally {
      setLoading(false)
    }
  }

  // Fallback to first project if selectedProjectId is null or not found
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || (projects.length > 0 ? projects[0] : null)

  return (
    <ErrorBoundary onReset={fetchProjects}>
      <div className="space-y-5 animate-in fade-in duration-200">
        {/* Header (Standalone layout header with Back to MiraiGrid button) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div className="flex items-center space-x-3">
            {isStandalone && (
              <button
                onClick={() => onNavigate('/dashboard')}
                className="p-2.5 rounded-2xl bg-[#DECDBD] hover:bg-[#D1BDAB] text-[#26160F] transition shadow-sm cursor-pointer shrink-0"
                title="Kembali ke Dashboard Utama MiraiGrid"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-serif font-bold text-[#26160F] flex items-center space-x-2">
                <Folder className="h-6 w-6 text-[#5A3521]" />
                <span>File Manager</span>
              </h2>
              <p className="text-xs text-[#5C3B29] mt-0.5 font-sans">
                {isStandalone ? 'Ruang kerja berkas mandiri • Akses aman dan terisolasi untuk direktori proyek Anda.' : 'Kelola direktori & source code praktikum Anda secara terisolasi.'}
              </p>
            </div>
          </div>


        </div>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : projects.length === 0 ? (
          /* Empty State: Belum ada project */
          <div className="text-center py-16 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-8 shadow-2xl text-[#FAF5EC]">
            <Layers className="h-10 w-10 text-[#A47E65] mx-auto mb-3" />
            <h4 className="text-base font-serif font-bold text-[#FAF5EC]">Belum Ada Workspace Project</h4>
            <p className="text-xs text-[#DFCDB5] max-w-sm mx-auto mt-1 mb-6">
              Anda belum memiliki project aplikasi. Silakan buat project terlebih dahulu di menu Deploy untuk mulai mengelola file praktikum.
            </p>
            <button
              onClick={() => onNavigate('/deploy')}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] shadow-lg transition"
            >
              <span>Buka Menu Deploy</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : selectedProject ? (
          /* Dedicated File Manager Environment */
          <FileManager
            key={selectedProject.id}
            project={selectedProject}
            onClose={() => onNavigate('/dashboard')}
          />
        ) : (
          <div className="text-center py-12 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl p-6 text-[#FAF5EC]">
            <p className="text-xs text-[#DFCDB5]">Pilih project pada menu dropdown di atas untuk melihat file.</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
