import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select } from '@/src/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { ACADEMIC_YEARS } from '@/src/config/campus';
import { useAuth } from '@/src/context/AuthContext';
import { useDashboardData } from '@/src/hooks/useDashboardData';
import { profileUpdateSchema } from '@/src/lib/validation';
import {
  formatPrice,
  formatTimestamp,
  getBorrowStatusLabel,
  getItemStatusInfo,
  getPurchaseStatusLabel,
} from '@/src/lib/workflows';
import { updateOwnProfile } from '@/src/services/authService';
import { getErrorMessage } from '@/src/services/errors';

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { myItems, borrowRequests, purchaseRequests, loading } = useDashboardData();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [year, setYear] = useState(profile?.year ?? ACADEMIC_YEARS[0]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setDepartment(profile.department);
      setYear(profile.year);
    }
  }, [profile]);

  if (!user) return null;

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileUpdateSchema.safeParse({
      full_name: fullName,
      department,
      year,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await updateOwnProfile(user.id, { full_name: fullName, department, year });
      await refreshProfile();
      toast.success('Student profile updated.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Signed out.');
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to sign out.'));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900">
            Student Profile
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Manage your academic details and review your marketplace activity.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={() => void handleLogout()}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Sign Out</span>
        </Button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Left: Profile Edit Card */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 lg:col-span-5">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            Academic Identity
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Your verified college email cannot be changed here.
          </p>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4" noValidate>
            <div>
              <Label htmlFor="profile-email">College Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={profile?.email ?? user.email ?? ''}
                disabled
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="profile-full-name">Full Name</Label>
              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5"
                required
              />
              {fieldErrors.full_name && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  {fieldErrors.full_name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="profile-department">Department</Label>
              <Input
                id="profile-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1.5"
                required
              />
              {fieldErrors.department && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  {fieldErrors.department}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="profile-year">Academic Year</Label>
              <Select
                id="profile-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1.5"
              >
                {ACADEMIC_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </Select>
              {fieldErrors.year && (
                <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.year}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving Profile...' : 'Save Profile Changes'}
            </Button>
          </form>
        </section>

        {/* Right: Activity Tabs (Listings, Borrow Requests, Purchase Requests) */}
        <section className="rounded-xl border border-stone-200 bg-white p-6 lg:col-span-7">
          <Tabs defaultValue="listings">
            <TabsList>
              <TabsTrigger value="listings" className="tabular-nums">
                Listings ({myItems.length})
              </TabsTrigger>
              <TabsTrigger value="borrows" className="tabular-nums">
                Borrowing ({borrowRequests.length})
              </TabsTrigger>
              <TabsTrigger value="purchases" className="tabular-nums">
                Purchases ({purchaseRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="listings">
              {loading ? (
                <div className="h-32 animate-pulse rounded-lg bg-stone-100" />
              ) : myItems.length === 0 ? (
                <p className="py-6 text-sm text-stone-500">
                  You have not created any listings yet.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {myItems.map((item) => {
                    const status = getItemStatusInfo(item);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <Link
                            to={`/items/${item.id}`}
                            className="block truncate font-medium text-zinc-900 hover:text-emerald-900"
                          >
                            {item.title}
                          </Link>
                          <span className="text-xs text-stone-500">
                            {item.category} · {status.label}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-900">
                          {item.price !== null ? formatPrice(item.price) : item.borrow_duration}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="borrows">
              {loading ? (
                <div className="h-32 animate-pulse rounded-lg bg-stone-100" />
              ) : borrowRequests.length === 0 ? (
                <p className="py-6 text-sm text-stone-500">
                  No borrowing requests yet.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {borrowRequests.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <Link
                          to="/requests"
                          className="block truncate font-medium text-zinc-900 hover:text-emerald-900"
                        >
                          {req.item?.title ?? 'Item Listing'}
                        </Link>
                        <span className="text-xs text-stone-500">
                          {req.owner_id === user.id ? 'Incoming' : 'Outgoing'} ·{' '}
                          {getBorrowStatusLabel(req.status)}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-stone-500">
                        {formatTimestamp(req.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="purchases">
              {loading ? (
                <div className="h-32 animate-pulse rounded-lg bg-stone-100" />
              ) : purchaseRequests.length === 0 ? (
                <p className="py-6 text-sm text-stone-500">
                  No purchase requests yet.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {purchaseRequests.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <Link
                          to="/requests"
                          className="block truncate font-medium text-zinc-900 hover:text-emerald-900"
                        >
                          {req.item?.title ?? 'Item Listing'}
                        </Link>
                        <span className="text-xs text-stone-500">
                          {req.owner_id === user.id ? 'Incoming Offer' : 'Outgoing Offer'} ·{' '}
                          {getPurchaseStatusLabel(req.status)}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-900">
                        {formatPrice(req.offered_price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
