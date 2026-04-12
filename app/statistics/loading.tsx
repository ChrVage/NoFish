export default function StatisticsLoading() {
  return (
    <div className="min-h-screen bg-ocean-50 flex items-center justify-center">
      <div className="text-center" role="status" aria-label="Loading statistics">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ocean-500 mx-auto mb-3" aria-hidden="true" />
        <p className="text-ocean-700 text-sm">Loading statistics…</p>
      </div>
    </div>
  );
}
