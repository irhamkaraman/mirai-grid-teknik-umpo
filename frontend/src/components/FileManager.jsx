import React, { useState, useEffect } from 'react'
import { Folder, FileText, ArrowLeft, Plus, Upload, Trash2, Edit3, Save, X, RefreshCw, FileCode, Check, CornerLeftUp } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../api/client'
import { Spinner, SkeletonTable } from './Skeletons'
import ConfirmModal from './ConfirmModal'
import ModalPortal from './ModalPortal'

export default function FileManager({ project, onClose }) {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Editor states
  const [editingFile, setEditingFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [savingFile, setSavingFile] = useState(false)

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [isNewDir, setIsNewDir] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [creatingItem, setCreatingItem] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState({ open: false, path: '', name: '' })

  useEffect(() => {
    fetchDirectory(currentPath)
  }, [currentPath])

  const fetchDirectory = async (subpath) => {
    setLoading(true)
    try {
      const res = await api.get(`/projects/${project.id}/files?path=${encodeURIComponent(subpath || '')}`)
      setItems(res.data.items || [])
      setCurrentPath(res.data.current_path || '')
    } catch (err) {
      toast.error('Gagal memuat direktori file.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFolder = (folderPath) => {
    setCurrentPath(folderPath)
  }

  const handleGoUp = () => {
    if (!currentPath) return
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  const handleOpenFile = async (file) => {
    setEditingFile(file)
    setEditorLoading(true)
    try {
      const res = await api.get(`/projects/${project.id}/files/content?path=${encodeURIComponent(file.path)}`)
      setFileContent(res.data.content || '')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuka file.')
      setEditingFile(null)
    } finally {
      setEditorLoading(false)
    }
  }

  const handleSaveFile = async () => {
    if (!editingFile) return
    setSavingFile(true)
    const toastId = toast.loading('Menyimpan perubahan file...')
    try {
      await api.post(`/projects/${project.id}/files/save`, {
        path: editingFile.path,
        content: fileContent,
      })
      toast.success('File berhasil disimpan!', { id: toastId })
    } catch (err) {
      toast.error('Gagal menyimpan file.', { id: toastId })
    } finally {
      setSavingFile(false)
    }
  }

  const handleCreateNewItem = async (e) => {
    e.preventDefault()
    if (!newItemName) return
    setCreatingItem(true)
    try {
      await api.post(`/projects/${project.id}/files/new`, {
        path: currentPath,
        name: newItemName.trim(),
        is_dir: isNewDir,
      })
      toast.success(`${isNewDir ? 'Folder' : 'File'} berhasil dibuat!`)
      setShowNewModal(false)
      setNewItemName('')
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat item baru.')
    } finally {
      setCreatingItem(false)
    }
  }

  const handleUploadFile = async (e) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    const toastId = toast.loading('Meng-upload file ke workspace...')
    const formData = new FormData()
    formData.append('path', currentPath)
    formData.append('file', uploadFile)

    try {
      const res = await api.post(`/projects/${project.id}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(res.data.message || 'File berhasil di-upload!', { id: toastId })
      setShowUploadModal(false)
      setUploadFile(null)
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal upload file.', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const executeDelete = async () => {
    const toastId = toast.loading(`Menghapus ${confirmDelete.name}...`)
    try {
      await api.delete(`/projects/${project.id}/files?path=${encodeURIComponent(confirmDelete.path)}`)
      toast.success('Berhasil dihapus.', { id: toastId })
      fetchDirectory(currentPath)
    } catch (err) {
      toast.error('Gagal menghapus.', { id: toastId })
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* File Manager Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#2B1810] border border-[#4D2D1E] p-4 sm:p-5 rounded-3xl shadow-xl text-[#FAF5EC]">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] transition"
            title="Kembali ke Daftar Project"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
              <Folder className="h-4 w-4 text-[#E8DCB8]" />
              <span>File Manager: {project.name}</span>
            </h3>
            <p className="text-[11px] text-[#DFCDB5] font-mono">
              Workspace: /{currentPath || ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {currentPath && (
            <button
              onClick={handleGoUp}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#DFCDB5] flex items-center space-x-1.5 transition"
            >
              <CornerLeftUp className="h-3.5 w-3.5" />
              <span>Up</span>
            </button>
          )}

          <button
            onClick={() => { setIsNewDir(false); setNewItemName(''); setShowNewModal(true); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] flex items-center space-x-1.5 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ File</span>
          </button>

          <button
            onClick={() => { setIsNewDir(true); setNewItemName(''); setShowNewModal(true); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3A2115] hover:bg-[#482A1B] text-[#E8DCB8] flex items-center space-x-1.5 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Folder</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition shadow-sm"
          >
            <Upload className="h-3.5 w-3.5 text-[#E8DCB8]" />
            <span>Upload</span>
          </button>

          <button
            onClick={() => fetchDirectory(currentPath)}
            className="p-1.5 rounded-xl text-[#DFCDB5] hover:text-white hover:bg-[#3A2115] transition"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main File Manager Table */}
      <div className="bg-[#2B1810] border border-[#4D2D1E] rounded-3xl overflow-hidden shadow-2xl text-[#FAF5EC]">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={4} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 p-6">
            <Folder className="h-10 w-10 text-[#5A3521] mx-auto mb-2" />
            <p className="text-xs text-[#DFCDB5]">Folder ini kosong.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C0F0A] text-[#DFCDB5] uppercase text-[10px] tracking-wider border-b border-[#3E2316]">
                <tr>
                  <th className="p-4">Nama File / Folder</th>
                  <th className="p-4">Ukuran</th>
                  <th className="p-4">Terakhir Diubah</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3E2316]">
                {items.map((item) => (
                  <tr key={item.path} className="hover:bg-[#361E13] transition">
                    <td className="p-4">
                      {item.is_dir ? (
                        <button
                          onClick={() => handleOpenFolder(item.path)}
                          className="flex items-center space-x-2.5 font-bold text-[#E8DCB8] hover:underline"
                        >
                          <Folder className="h-4 w-4 text-[#C49767] shrink-0" />
                          <span>{item.name}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenFile(item)}
                          className="flex items-center space-x-2.5 text-[#FAF5EC] hover:text-[#E8DCB8] transition"
                        >
                          <FileCode className="h-4 w-4 text-[#A47E65] shrink-0" />
                          <span className="font-mono">{item.name}</span>
                        </button>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[#DFCDB5]/70">
                      {item.is_dir ? '-' : formatBytes(item.size)}
                    </td>
                    <td className="p-4 text-[#DFCDB5]/70 font-mono text-[11px]">
                      {new Date(item.modified * 1000).toLocaleString('id-ID')}
                    </td>
                    <td className="p-4 text-right space-x-1.5">
                      {!item.is_dir && (
                        <button
                          onClick={() => handleOpenFile(item)}
                          title="Edit Kode"
                          className="p-1.5 text-[#DFCDB5] hover:text-[#E8DCB8] hover:bg-[#3E2316] rounded-lg transition"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete({ open: true, path: item.path, name: item.name })}
                        title="Hapus"
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code Editor Modal */}
      <ModalPortal isOpen={Boolean(editingFile)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 flex flex-col max-h-[85vh] text-[#FAF5EC]">
            <div className="flex items-center justify-between pb-3 border-b border-[#3E2316] mb-3">
              <div>
                <h4 className="text-base font-serif font-bold text-[#FAF5EC] flex items-center space-x-2">
                  <Edit3 className="h-4 w-4 text-[#E8DCB8]" />
                  <span>Editor: {editingFile?.name}</span>
                </h4>
                <p className="text-[11px] text-[#DFCDB5] font-mono">{editingFile?.path}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5 text-[#E8DCB8]" />
                  <span>{savingFile ? 'Menyimpan...' : 'Simpan (Ctrl+S)'}</span>
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-2 rounded-xl text-[#DFCDB5] hover:text-white hover:bg-[#3E2316] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-2xl border border-[#3E2316]">
              {editorLoading ? (
                <div className="p-8 text-center text-xs text-[#DFCDB5]">Memuat isi file...</div>
              ) : (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                      e.preventDefault()
                      handleSaveFile()
                    }
                  }}
                  className="w-full h-96 p-4 font-mono text-xs bg-[#1C0F0A] text-[#FAF5EC] focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* New File / Folder Modal */}
      <ModalPortal isOpen={showNewModal}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">
              {isNewDir ? 'Buat Folder Baru' : 'Buat File Baru'}
            </h4>
            <p className="text-xs text-[#DFCDB5] mb-4">Lokasi: /{currentPath || ''}</p>

            <form onSubmit={handleCreateNewItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#DFCDB5] mb-1">Nama</label>
                <input
                  type="text"
                  required
                  placeholder={isNewDir ? 'nama-folder' : 'index.php'}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-[#1C0F0A] border border-[#3E2316] rounded-xl px-3.5 py-2 text-xs text-[#FAF5EC] focus:outline-none focus:border-[#C49767]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingItem}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition disabled:opacity-50"
                >
                  {creatingItem ? 'Membuat...' : 'Buat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Upload File / ZIP Modal */}
      <ModalPortal isOpen={showUploadModal}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl p-6 text-[#FAF5EC]">
            <h4 className="text-base font-serif font-bold text-[#FAF5EC] mb-1">Upload File / ZIP</h4>
            <p className="text-xs text-[#DFCDB5] mb-4">
              File ZIP akan otomatis diekstrak ke dalam folder /{currentPath || ''}.
            </p>

            <form onSubmit={handleUploadFile} className="space-y-4">
              <div className="border-2 border-dashed border-[#4D2D1E] hover:border-[#C49767] rounded-3xl p-6 text-center transition bg-[#1C0F0A]/70">
                <Upload className="h-8 w-8 text-[#A47E65] mx-auto mb-2" />
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="hidden"
                  id="fm-upload-input"
                />
                <label
                  htmlFor="fm-upload-input"
                  className="cursor-pointer text-xs font-semibold text-[#E8DCB8] hover:underline block"
                >
                  {uploadFile ? uploadFile.name : 'Pilih file atau file .ZIP'}
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#DFCDB5] hover:text-[#FAF5EC] hover:bg-[#3A2115] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] transition disabled:opacity-50"
                >
                  {uploading ? 'Meng-upload...' : 'Upload Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Hapus Item?"
        message={`Hapus '${confirmDelete.name}' dari workspace project? Tindakan ini permanen.`}
        confirmText="Hapus"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ open: false, path: '', name: '' })}
      />
    </div>
  )
}
