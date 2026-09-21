import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AuthPage from './components/Auth';
import ChatPage from './components/ChatPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-ozlind-dark">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ozlind-cyan" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <ChatPage />
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
