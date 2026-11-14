import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ItemForm } from '@/src/components/ItemForm';
import { useAuth } from '@/src/context/AuthContext';
import { getErrorMessage } from '@/src/services/errors';
import { createItem } from '@/src/services/itemsService';

export function NewListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

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
            Create New Listing
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            List an academic item for campus students to borrow, buy, or both.
          </p>
        </div>

        <div className="mt-6">
          <ItemForm
            submitLabel="Publish Listing"
            onCancel={() => navigate('/my-listings')}
            onSubmit={async ({ formInput, imageFile }) => {
              try {
                const created = await createItem(user.id, formInput, imageFile);
                toast.success('Listing published to CampusConnect.');
                navigate(`/items/${created.id}`);
              } catch (err) {
                throw new Error(getErrorMessage(err, 'Failed to publish listing.'));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
