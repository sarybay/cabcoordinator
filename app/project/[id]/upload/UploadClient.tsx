'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadDropzone from '@/components/UploadDropzone'
import { createClient } from '@/lib/supabase'

export default function UploadClient({ projectId }: { projectId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noNewMessages, setNoNewMessages] = useState(false)
  const [showDiffWarning, setShowDiffWarning] = useState(false)
  const router = useRouter()

  async function handleParse(forceMerge = false) {
    if (!file) return
    setLoading(true)
    setError(null)
    setNoNewMessages(false)
    setShowDiffWarning(false)

    try {
      const supabase = createClient()
      const filePath = `${projectId}/${Date.now()}.txt`

      const { error: uploadError } = await supabase.storage
        .from('chat-exports')
        .upload(filePath, file)

      if (uploadError) throw new Error(uploadError.message)

      const res = await fetch('/api/parse-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, filePath, forceMerge }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Parse failed (${res.status})`)
      }

      const body = await res.json()

      if (body.noNewMessages) {
        setNoNewMessages(true)
        setLoading(false)
        return
      }

      if (body.warning === 'different_chat') {
        setShowDiffWarning(true)
        setLoading(false)
        return
      }

      router.push(`/project/${projectId}?imported=${body.count}&cancelled=${body.cancelled ?? 0}&updated=${body.updated ?? 0}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-lg">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-400 hover:text-gray-700 mb-6 flex items-center gap-1 transition-colors"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="mb-7">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Upload chat export</h1>
          <p className="text-sm text-gray-500">
            In WhatsApp, open the group → ⋮ menu → More → Export chat → Without media. Upload the .txt file.
          </p>
        </div>

        {showDiffWarning ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-amber-900 mb-1">Different group chat detected</p>
            <p className="text-sm text-amber-700 mb-4">
              None of the existing passengers were found in this export — it may be from a different group. Merge passengers into this project anyway?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleParse(true)}
                disabled={loading}
                className="flex-1 bg-amber-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Merging…' : 'Yes, merge'}
              </button>
              <button
                onClick={() => { setShowDiffWarning(false); setFile(null) }}
                className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                No, cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <UploadDropzone onFile={(f) => { setFile(f); setNoNewMessages(false) }} />

            {noNewMessages && (
              <p className="mt-4 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                No new messages found since the last import. The passenger list is already up to date.
              </p>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => handleParse(false)}
                disabled={!file || loading}
                className="flex-1 bg-black text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-30 hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2a10 10 0 1 0 10 10" />
                    </svg>
                    Parsing chat…
                  </>
                ) : (
                  'Parse chat →'
                )}
              </button>
              {!file && (
                <span className="text-xs text-gray-400">Select a file to continue</span>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
