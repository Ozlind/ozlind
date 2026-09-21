import React, { createContext, useContext, useState, useEffect } from 'react';
import supabase from '../lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  isDemo: boolean;
  loginAsDemo: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isDemo: false,
  loginAsDemo: () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(false);

  useEffect(() => {
    // Check if demo mode was previously enabled
    const demoActive = localStorage.getItem('ozlind_demo_mode') === 'true';
    if (demoActive) {
      setIsDemo(true);
      setUser({
        id: 'athul-owner-id',
        email: 'athul@ozlind.ai',
        user_metadata: { full_name: 'Athul (Owner)' }
      });
      setSession({ access_token: 'demo-token' });
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser((session?.user as unknown as UserProfile) ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser((session?.user as unknown as UserProfile) ?? null);
      if (session) setIsDemo(false);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginAsDemo = () => {
    localStorage.setItem('ozlind_demo_mode', 'true');
    setIsDemo(true);
    setUser({
      id: 'athul-owner-id',
      email: 'athul@ozlind.ai',
      user_metadata: { full_name: 'Athul (Owner)' }
    });
    setSession({ access_token: 'demo-token' });
  };

  const logout = async () => {
    localStorage.removeItem('ozlind_demo_mode');
    setIsDemo(false);
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isDemo, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
