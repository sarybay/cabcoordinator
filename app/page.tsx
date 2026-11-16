import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">Cab Coordinator</span>
        </div>
        <Link
          href="/auth/login"
          className="text-sm font-medium text-gray-700 hover:text-black border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-400 transition-colors"
        >
          Log in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center py-24">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight max-w-2xl mb-5">
          Turn a WhatsApp chat into a pickup plan
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10">
          Upload a group chat export, let AI extract passenger details, and get
          drivers assigned to cabs automatically — in under two minutes.
        </p>
        <Link
          href="/auth/login"
          className="bg-black text-white rounded-xl px-8 py-3.5 text-base font-medium hover:bg-gray-800 transition-colors"
        >
          Get started →
        </Link>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400">
        <span>Contact: <a href="mailto:hello@cabcoordinator.app" className="hover:text-gray-700 transition-colors">hello@cabcoordinator.app</a></span>
        <span>© {new Date().getFullYear()} Cab Coordinator</span>
      </footer>
    </div>
  )
}
