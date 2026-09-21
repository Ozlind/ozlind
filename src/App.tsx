import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Workspace from './pages/Workspace';
import Login from './pages/Login';
import { handleGoogleRedirect } from './lib/googleAuth';

// Initialize Google redirect callback handler
handleGoogleRedirect();

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <Workspace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
