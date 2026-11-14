import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';
import { AuthProvider } from '@/src/context/AuthContext';
import { AppLayout } from '@/src/layouts/AppLayout';
import { EditListingPage } from '@/src/pages/EditListingPage';
import { ExplorePage } from '@/src/pages/ExplorePage';
import { HomePage } from '@/src/pages/HomePage';
import { ItemDetailsPage } from '@/src/pages/ItemDetailsPage';
import { LoginPage } from '@/src/pages/LoginPage';
import { MyListingsPage } from '@/src/pages/MyListingsPage';
import { NewListingPage } from '@/src/pages/NewListingPage';
import { ProfilePage } from '@/src/pages/ProfilePage';
import { RegisterPage } from '@/src/pages/RegisterPage';
import { RequestsPage } from '@/src/pages/RequestsPage';
import { TransactionsPage } from '@/src/pages/TransactionsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/items/:id" element={<ItemDetailsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              path="/items/new"
              element={
                <ProtectedRoute>
                  <NewListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/items/:id/edit"
              element={
                <ProtectedRoute>
                  <EditListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-listings"
              element={
                <ProtectedRoute>
                  <MyListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <RequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <TransactionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
        <Toaster position="bottom-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
