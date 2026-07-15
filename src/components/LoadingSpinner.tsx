export function LoadingSpinner({ fullPage }: { fullPage?: boolean }) {
  const spinner = (
    <div
      className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
      role="status"
      aria-label="Loading"
    />
  )

  if (fullPage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {spinner}
      </div>
    )
  }

  return <div className="flex justify-center py-12">{spinner}</div>
}
