export function FirebaseSetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-xl space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Firebase configuration required</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          HourlyPay is a Firebase app. The Vite dev server runs locally, but auth, data, and payroll
          features need Firebase — either the local emulator suite or a real Firebase project.
        </p>
        <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Recommended: run with local emulators (no cloud project)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Copy <code className="rounded bg-white px-1">.env.example</code> to{' '}
              <code className="rounded bg-white px-1">.env</code> and set{' '}
              <code className="rounded bg-white px-1">VITE_USE_FIREBASE_EMULATORS=true</code>
            </li>
            <li>Install Java 11+ (required for the Firestore emulator)</li>
            <li>
              Run <code className="rounded bg-white px-1">npm run dev:local</code>
            </li>
            <li>
              Seed a test admin with <code className="rounded bg-white px-1">npm run seed:emulator</code>
            </li>
            <li>Sign in at http://localhost:5173 with admin@local.test / password123</li>
          </ol>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Or connect to a real Firebase project</p>
          <p className="mt-1">
            Fill <code className="rounded bg-white px-1">.env</code> with values from Firebase Console →
            Project Settings → Your apps, set{' '}
            <code className="rounded bg-white px-1">VITE_USE_FIREBASE_EMULATORS=false</code>, then run{' '}
            <code className="rounded bg-white px-1">npm run dev</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
