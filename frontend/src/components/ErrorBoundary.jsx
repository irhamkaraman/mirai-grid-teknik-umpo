import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-[#2B1810] border border-[#4D2D1E] rounded-3xl shadow-2xl text-center text-[#FAF5EC]">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[#FAF5EC] mb-1">
            Terjadi Masalah pada Tampilan
          </h3>
          <p className="text-xs text-[#DFCDB5] mb-4">
            Komponen mengalami kendala rendering. Silakan klik tombol di bawah untuk memuat ulang.
          </p>
          <div className="p-3 bg-[#1C0F0A] border border-[#3E2316] rounded-xl text-left font-mono text-[11px] text-rose-300 mb-6 overflow-x-auto">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-2xl text-xs font-semibold bg-[#5A3521] hover:bg-[#6D4029] text-[#FAF5EC] shadow-md transition"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
