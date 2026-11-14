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
        <div className="p-8 max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-xl text-center text-slate-900 font-sans">
          <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Terjadi Masalah pada Tampilan
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Komponen mengalami kendala rendering. Silakan klik tombol di bawah untuk memuat ulang.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left font-mono text-[11px] text-rose-600 mb-6 overflow-x-auto">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
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
