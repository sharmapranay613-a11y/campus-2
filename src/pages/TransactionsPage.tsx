import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/context/AuthContext';
import { useDashboardData } from '@/src/hooks/useDashboardData';
import {
  formatPrice,
  formatTimestamp,
  getBorrowStatusLabel,
  getPurchaseStatusLabel,
} from '@/src/lib/workflows';

export function TransactionsPage() {
  const { user } = useAuth();
  const { borrowRequests, purchaseRequests, loading, error } = useDashboardData();
  const [filterType, setFilterType] = useState<'all' | 'borrow' | 'purchase'>('all');

  if (!user) return null;

  const combinedRows = [
    ...borrowRequests.map((req) => ({
      id: req.id,
      kind: 'Borrow' as const,
      itemId: req.item_id,
      itemTitle: req.item?.title ?? 'Item Listing',
      role: req.owner_id === user.id ? 'Lender' : 'Borrower',
      counterparty:
        req.owner_id === user.id
          ? req.borrower?.full_name ?? 'Student'
          : req.owner?.full_name ?? 'Student',
      amountOrDuration: req.item?.borrow_duration ?? 'Borrow',
      statusLabel: getBorrowStatusLabel(req.status),
      rawStatus: req.status,
      timestamp: req.returned_at || req.borrowed_at || req.updated_at || req.created_at,
    })),
    ...purchaseRequests.map((req) => ({
      id: req.id,
      kind: 'Purchase' as const,
      itemId: req.item_id,
      itemTitle: req.item?.title ?? 'Item Listing',
      role: req.owner_id === user.id ? 'Seller' : 'Buyer',
      counterparty:
        req.owner_id === user.id
          ? req.buyer?.full_name ?? 'Student'
          : req.owner?.full_name ?? 'Student',
      amountOrDuration: formatPrice(req.offered_price),
      statusLabel: getPurchaseStatusLabel(req.status),
      rawStatus: req.status,
      timestamp: req.confirmed_at || req.updated_at || req.created_at,
    })),
  ]
    .filter((row) => {
      if (filterType === 'borrow') return row.kind === 'Borrow';
      if (filterType === 'purchase') return row.kind === 'Purchase';
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/requests"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back to Requests</span>
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900">
            Transactions Ledger
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Complete audit history of your borrowing and purchase transactions.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1">
          {(['all', 'borrow', 'purchase'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterType(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterType === mode
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-stone-600 hover:text-zinc-900'
              }`}
            >
              {mode === 'all' ? 'All Transactions' : mode === 'borrow' ? 'Borrows' : 'Purchases'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 h-64 animate-pulse rounded-xl border border-stone-200 bg-white" />
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          {error}
        </div>
      ) : combinedRows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-900">
            No transactions recorded yet
          </h2>
          <p className="mt-1.5 text-sm text-stone-600">
            Borrow and purchase requests appear here with full timestamp history.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/explore">Explore Marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Your Role</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Terms / Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {combinedRows.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="hover:bg-stone-50/70">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link
                      to={`/items/${row.itemId}`}
                      className="hover:text-emerald-900 hover:underline"
                    >
                      {row.itemTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{row.kind}</td>
                  <td className="px-4 py-3 text-stone-600">{row.role}</td>
                  <td className="px-4 py-3 text-zinc-900">{row.counterparty}</td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-zinc-900">
                    {row.amountOrDuration}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.rawStatus === 'sold' || row.rawStatus === 'returned'
                          ? 'font-semibold text-emerald-800'
                          : row.rawStatus === 'rejected' || row.rawStatus === 'cancelled'
                          ? 'font-medium text-red-700'
                          : 'font-medium text-amber-800'
                      }
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-stone-500">
                    {formatTimestamp(row.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
