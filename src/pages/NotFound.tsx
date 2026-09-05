import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/Primitives'

export function NotFound() {
  return (
    <EmptyState
      icon={<Compass size={28} />}
      title="Nothing here"
      description="That page does not exist in Dompet."
      action={
        <Link
          to="/"
          className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-ink"
        >
          Back to dashboard
        </Link>
      }
    />
  )
}
