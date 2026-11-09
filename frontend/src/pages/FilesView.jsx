import React, { useState, useEffect } from 'react'
import { Folder, Layers, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner } from '../components/Skeletons'
import FileManager from '../components/FileManager'
import ErrorBoundary from '../components/ErrorBoundary'

export default function FilesView({ onNavigate, isStandalone = false }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data || [])
    } catch (err) {
      toast.error('Gagal memuat daftar project.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#1C0F0A] text-[#FAF5EC]">
        <div className="flex flex-col items-center space-y-3">
          <Spinner className="h-8 w-8 text-[#C49767]" />
          <p className="text-xs text-[#DFCDB5]">Memuat File Explorer...</p>
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#1C0F0A] p-6 text-[#FAF5EC]">
        <div className="text-center max-w-md bg-[#24140C] border border-[#3E2316] rounded-2xl p-8 shadow-2xl">
          <Layers className="h-12 w-12 text-[#A47E65] mx-auto mb-3" />
          <h4 className="text-lg font-serif font-bold text-[#FAF5EC]">Belum Ada Workspace Project</h4>
          <p className="text-xs text-[#DFCDB5] mt-1.5 mb-6">
            Anda belum memiliki project aplikasi aktif. Silakan buat project terlebih dahulu di menu Deploy untuk mulai mengelola file praktikum.
          </p>
          <button
            onClick={() => onNavigate('/deploy')}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition"
          >
            <span>Buka Menu Deploy</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary onReset={fetchProjects}>
      <div className="h-full w-full">
        <FileManager
          projects={projects}
          onClose={() => {
            if (window.opener) {
              window.close()
            } else {
              onNavigate('/dashboard')
            }
          }}
        />
      </div>
    </ErrorBoundary>
  )
}
