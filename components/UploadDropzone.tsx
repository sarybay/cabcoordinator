'use client'

import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
}

export default function UploadDropzone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); onFile(f) }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) { setFile(f); onFile(f) }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors ${
        dragging ? 'border-black bg-gray-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${file ? 'bg-green-100' : 'bg-white'} shadow-sm`}>
        {file ? (
          <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="24" height="24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        )}
      </div>

      {file ? (
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-sm">{file.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB · tap to change</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-sm">Tap to select file</p>
          <p className="text-xs text-gray-500 mt-0.5">WhatsApp export · .txt</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handleChange}
      />
    </button>
  )
}
