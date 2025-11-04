'use client';

/**
 * Password Reset Page
 * Two-step password recovery: request reset link and set new password
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'request' | 'reset'>(
    searchParams.get('access_token') ? 'reset' : 'request'
  );

  // Step 1: Request reset link
  const [email, setEmail] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState('');

  // Step 2: Set new password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestLoading(true);
    setRequestError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });

      if (error) {
        setRequestError(error.message);
        return;
      }

      setRequestSuccess(true);
    } catch (error) {
      setRequestError('An unexpected error occurred');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');

    // Validate password match
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      setResetLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      setResetLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setResetError(error.message);
        return;
      }

      setResetSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      setResetError('An unexpected error occurred');
    } finally {
      setResetLoading(false);
    }
  };

  // Step 1: Request reset link
  if (step === 'request') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8 bg-white shadow-lg text-black">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-black">Reset Password</h1>
            <p className="text-gray-700 mt-2">
              Enter your email to receive a password reset link
            </p>
          </div>

          {requestSuccess ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
              <p className="font-medium">Check your email!</p>
              <p className="text-sm mt-1">
                We've sent a password reset link to {email}
              </p>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-6 text-black">
              {requestError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {requestError}
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
                  disabled={requestLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={requestLoading}>
                {requestLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm space-y-2">
            <p className="text-black">
              Remember your password?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-semibold">
                Sign in
              </Link>
            </p>
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

  // Step 2: Set new password
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md p-8 bg-white shadow-lg text-black">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black">Set New Password</h1>
          <p className="text-gray-700 mt-2">
            Choose a strong password for your account
          </p>
        </div>

        {resetSuccess ? (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
            <p className="font-medium">Password updated!</p>
            <p className="text-sm mt-1">
              Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6 text-black">
            {resetError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                {resetError}
              </div>
            )}

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-black mb-2"
              >
                New Password
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={resetLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-black mb-2"
              >
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={resetLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={resetLoading}>
              {resetLoading ? 'Updating password...' : 'Update Password'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <p className="text-black">
            Remember your password?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
