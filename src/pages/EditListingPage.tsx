import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ItemForm } from '@/src/components/ItemForm';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/context/AuthContext';
import { getErrorMessage } from '@/src/services/errors';
import { getItemById, updateItem } from '@/src/services/itemsService';
import type { ItemWithOwner } from '@/src/types/database';

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<ItemWithOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let mounted = true;
    getItemById(id)
      .then((fetched) => {
        if (!mounted) return;
        if (!fetched) {
          setError('Listing not found.');
        } else if (user && fetched.owner_id !== user.id) {
          setError('You do not have permission to edit another student’s listing.');
        } else {
          setItem(fetched);
        }
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err, 'Unable to load listing.'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, user]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-96 animate-pulse rounded-xl border border-stone-200 bg-white" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          {error ?? 'Listing not found'}
        </h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/my-listings">Back to My Listings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        to="/my-listings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to My Listings</span>
      </Link>

      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
        <div className="border-b border-stone-100 pb-5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
            Edit Listing
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Update item details, availability, or upload a new photo.
          </p>
        </div>

        <div className="mt-6">
          <ItemForm
            initialValues={{
              title: item.title,
              description: item.description,
              category: item.category,
              condition: item.condition,
              pickup_location: item.pickup_location,
              listing_type: item.listing_type,
              price: item.price !== null ? String(item.price) : '',
              borrow_duration: item.borrow_duration ?? '',
              available: item.available,
            }}
            existingImageUrl={item.image_url}
            isSold={item.is_sold}
            submitLabel="Save Changes"
            onCancel={() => navigate('/my-listings')}
            onSubmit={async ({ formInput, imageFile, removeExistingImage }) => {
              try {
                await updateItem({
                  itemId: item.id,
                  ownerId: user.id,
                  formInput,
                  imageFile,
                  existingImageUrl: item.image_url,
                  removeExistingImage,
                });
                toast.success('Listing updated.');
                navigate(`/items/${item.id}`);
              } catch (err) {
                throw new Error(getErrorMessage(err, 'Failed to update listing.'));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
