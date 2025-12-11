'use client';

/**
 * Login Page
 * User authentication with email and password
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.user && data.session) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
        });
        setSession(data.session);
        router.push('/');
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8 bg-white shadow-lg text-black">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black">Welcome Back</h1>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">Sign in to Bob</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 text-black">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-black mb-2"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-black mb-2"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end mb-4">
            <Link
              href="/reset"
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-black">
            Don't have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline font-semibold">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
