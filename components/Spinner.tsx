export default function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="spinner" aria-hidden />
      {label && <span>{label}</span>}
    </span>
  );
}

// build refresh
