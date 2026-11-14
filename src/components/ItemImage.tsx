import { useState } from 'react';
import { Package } from 'lucide-react';
import { getCategoryFallbackImage, resolveItemImageUrl } from '@/src/lib/images';
import { cn } from '@/src/lib/utils';
import type { ItemCategory } from '@/src/types/database';

interface ItemImageProps {
  imageUrl: string | null | undefined;
  category: ItemCategory | string;
  title: string;
  className?: string;
}

export function ItemImage({ imageUrl, category, title, className }: ItemImageProps) {
  const primarySrc = resolveItemImageUrl(imageUrl, category);
  const fallbackSrc = getCategoryFallbackImage(category);
  const [src, setSrc] = useState(primarySrc);
  const [failedCompletely, setFailedCompletely] = useState(false);

  if (failedCompletely) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center bg-stone-100 p-4 text-center text-stone-500',
          className
        )}
      >
        <Package className="mb-2 h-8 w-8 text-stone-400" aria-hidden="true" />
        <span className="line-clamp-2 text-xs font-medium text-stone-600">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => {
        if (src !== fallbackSrc) {
          setSrc(fallbackSrc);
        } else {
          setFailedCompletely(true);
        }
      }}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}
