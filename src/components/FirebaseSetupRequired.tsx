export function FirebaseSetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-xl space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Firebase configuration required</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          HourlyPay uses Firebase for auth and data, plus a Node.js API for employee creation and email.
          Configure both before running the app.
        </p>
        <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Quick start (Spark / free plan)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Copy <code className="rounded bg-white px-1">.env.example</code> to{' '}
              <code className="rounded bg-white px-1">.env</code> and fill in Firebase web app config
            </li>
            <li>
              Copy <code className="rounded bg-white px-1">server/.env.example</code> to{' '}
              <code className="rounded bg-white px-1">server/.env</code> with SMTP + service account
            </li>
            <li>
              Set <code className="rounded bg-white px-1">VITE_API_URL=http://localhost:3001</code>
            </li>
            <li>
              Run <code className="rounded bg-white px-1">npm run dev:app</code>
            </li>
          </ol>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Optional: local Firebase emulators</p>
          <p className="mt-1">
            Set <code className="rounded bg-white px-1">VITE_USE_FIREBASE_EMULATORS=true</code>, then run{' '}
            <code className="rounded bg-white px-1">npm run dev:local</code> and{' '}
            <code className="rounded bg-white px-1">npm run seed:emulator</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
