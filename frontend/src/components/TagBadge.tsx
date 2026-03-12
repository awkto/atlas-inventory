import { useNavigate } from "react-router-dom";

interface Props {
  tag: string;
}

export default function TagBadge({ tag }: Props) {
  const nav = useNavigate();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); nav(`/search?tag=${encodeURIComponent(tag)}`); }}
      className="inline-block bg-[var(--bg-tag)] text-[var(--text-tag)] rounded px-1.5 py-0.5 text-xs mr-1 border border-[var(--border-card)] hover:border-[var(--accent-text)] hover:text-[var(--accent-text)] transition cursor-pointer"
    >
      {tag}
    </button>
  );
}
