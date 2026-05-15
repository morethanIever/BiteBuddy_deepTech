export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="skeleton h-4 w-1/3 mb-3" />
      <div className="skeleton h-8 w-1/2 mb-2" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100">
      <div>
        <div className="skeleton h-4 w-40 mb-2" />
        <div className="skeleton h-3 w-24" />
      </div>
      <div className="skeleton h-6 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonMap() {
  return (
    <div className="skeleton rounded-xl" style={{ height: 480 }} />
  );
}
