import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { computeDashboardStats } from '@/src/lib/workflows';
import { getErrorMessage } from '@/src/services/errors';
import {
  countAvailableMarketplaceItems,
  listUserItems,
} from '@/src/services/itemsService';
import {
  listUserBorrowRequests,
  listUserPurchaseRequests,
} from '@/src/services/requestsService';
import type {
  BorrowRequestWithDetails,
  DashboardStats,
  Item,
  PurchaseRequestWithDetails,
} from '@/src/types/database';

export function useDashboardData() {
  const { user, isConfigured } = useAuth();
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequestWithDetails[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestWithDetails[]>([]);
  const [totalMarketplaceListings, setTotalMarketplaceListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user || !isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [itemsData, borrowsData, purchasesData, totalCount] = await Promise.all([
        listUserItems(user.id),
        listUserBorrowRequests(user.id),
        listUserPurchaseRequests(user.id),
        countAvailableMarketplaceItems(),
      ]);

      setMyItems(itemsData);
      setBorrowRequests(borrowsData);
      setPurchaseRequests(purchasesData);
      setTotalMarketplaceListings(totalCount);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load dashboard records.'));
    } finally {
      setLoading(false);
    }
  }, [user, isConfigured]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats: DashboardStats = user
    ? computeDashboardStats({
        totalMarketplaceListings,
        myListings: myItems,
        borrowRequests,
        purchaseRequests,
        userId: user.id,
      })
    : {
        totalListings: 0,
        myActiveListings: 0,
        incomingBorrowRequests: 0,
        outgoingBorrowRequests: 0,
        incomingPurchaseRequests: 0,
        outgoingPurchaseRequests: 0,
        pendingActionsCount: 0,
      };

  return {
    myItems,
    borrowRequests,
    purchaseRequests,
    stats,
    loading,
    error,
    reload,
  };
}
