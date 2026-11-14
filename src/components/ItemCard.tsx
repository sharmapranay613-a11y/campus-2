import { Link } from 'react-router-dom';
import { ItemImage } from '@/src/components/ItemImage';
import { formatPrice, getItemStatusInfo, getListingTypeLabel } from '@/src/lib/workflows';
import type { ItemWithOwner } from '@/src/types/database';

interface ItemCardProps {
  item: ItemWithOwner;
}

export function ItemCard({ item }: ItemCardProps) {
  const status = getItemStatusInfo(item);

  return (
    <Link
      to={`/items/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
        <ItemImage
          imageUrl={item.image_url}
          category={item.category}
          title={item.title}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
          <span className="truncate font-medium uppercase tracking-wide text-stone-500">
            {item.category}
          </span>
          <span
            className={
              status.tone === 'available'
                ? 'shrink-0 font-semibold text-emerald-800'
                : status.tone === 'sold'
                ? 'shrink-0 font-semibold text-red-700'
                : 'shrink-0 font-semibold text-amber-700'
            }
          >
            {status.label}
          </span>
        </div>

        <h3 className="mt-2 line-clamp-1 font-display text-base font-semibold text-zinc-900 group-hover:text-emerald-900">
          {item.title}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <span>{item.condition}</span>
          <span aria-hidden="true">·</span>
          <span>{getListingTypeLabel(item.listing_type)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{item.pickup_location}</span>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-baseline justify-between gap-3 border-t border-stone-100 pt-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {item.price !== null && (
                <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                  {formatPrice(item.price)}
                </span>
              )}
              {item.borrow_duration && (
                <span className="text-xs font-medium text-stone-600">
                  Borrow up to {item.borrow_duration}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-stone-500">
              {item.owner?.full_name ?? 'Campus Student'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
