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
      const [resProj, resGit] = await Promise.all([
        api.get('/projects'),
        api.get('/git/repositories').catch(() => ({ data: { repositories: [] } }))
      ])
      const projList = resProj.data || []
      const repoList = resGit.data?.repositories || []
      
      const repos = repoList.map(r => {
        const matchingProj = projList.find(p => 
          (r.target_project_id && p.id === r.target_project_id) || 
          p.name === r.name ||
          (p.config_json && p.config_json.includes(r.name))
        )
        return {
          id: r.id,
          name: r.name,
          owner_username: r.owner_username || 'user',
          virtual_path: r.path || `/home/${r.owner_username || 'user'}/repositories/${r.name}`,
          is_git: true,
          is_deployed: !!matchingProj,
          project_id: matchingProj?.id,
          template_type: matchingProj?.template_type,
          status: matchingProj?.status,
          language: matchingProj?.template_type || 'git',
          in_repositories: true
        }
      })

      const standalones = []
      projList.forEach(p => {
        const isRepo = repos.some(r => 
          r.name === p.name || 
          (r.project_id && r.project_id === p.id) ||
          (p.config_json && p.config_json.includes(r.name))
        )
        if (!isRepo) {
          standalones.push({
            id: p.id,
            project_id: p.id,
            name: p.name,
            owner_username: p.owner_username || 'user',
            virtual_path: `/home/${p.owner_username || 'user'}/${p.name}`,
            is_git: false,
            is_deployed: true,
            template_type: p.template_type,
            status: p.status,
            language: p.template_type || 'web',
            in_repositories: false
          })
        }
      })

      setProjects([...repos, ...standalones])
    } catch (err) {
      toast.error('Gagal memuat daftar workspace & repositori.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#E6D7BE] text-[#26160F]">
        <div className="flex flex-col items-center space-y-3 bg-[#FDFBF7] border border-[#D4C1AC] p-8 rounded-3xl shadow-xl text-[#26160F]">
          <Spinner className="h-8 w-8 text-[#946132]" />
          <p className="text-xs text-[#704D36]">Memuat File Explorer...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary onReset={fetchProjects}>
      <div className="h-full w-full flex flex-col overflow-hidden">
        <FileManager
          projects={projects}
          isHomeRoot={true}
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
