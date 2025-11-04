'use client';

/**
 * Diagnostic Page
 * Tests all system components and shows status
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { wsClient } from '../../lib/websocket';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

export default function DiagnosticPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (name: string, status: TestResult['status'], message: string, details?: any) => {
    setResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        return prev.map(r => r.name === name ? { name, status, message, details } : r);
      }
      return [...prev, { name, status, message, details }];
    });
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Environment Variables
    updateResult('env', 'pending', 'Checking environment variables...');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!apiUrl || !wsUrl || !supabaseUrl) {
      updateResult('env', 'error', 'Missing environment variables', {
        apiUrl: apiUrl || 'MISSING',
        wsUrl: wsUrl || 'MISSING',
        supabaseUrl: supabaseUrl || 'MISSING',
      });
    } else {
      updateResult('env', 'success', 'Environment variables configured', {
        apiUrl,
        wsUrl,
        supabaseUrl,
      });
    }

    // Test 2: Supabase Auth
    updateResult('auth', 'pending', 'Checking authentication...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!session) {
        updateResult('auth', 'error', 'Not logged in');
      } else {
        updateResult('auth', 'success', 'Authenticated', {
          userId: session.user.id,
          email: session.user.email,
          tokenLength: session.access_token.length,
        });
      }
    } catch (error: any) {
      updateResult('auth', 'error', error.message);
    }

    // Test 3: Backend Health
    updateResult('health', 'pending', 'Checking backend health...');
    try {
      const health = await api.healthCheck();
      updateResult('health', 'success', 'Backend is healthy', health);
    } catch (error: any) {
      updateResult('health', 'error', error.message);
    }

    // Test 4: API - Get Conversations
    updateResult('api', 'pending', 'Testing API - Get conversations...');
    try {
      const convs = await api.getConversations();
      updateResult('api', 'success', `API working - ${Array.isArray(convs) ? convs.length : 0} conversations`, {
        count: Array.isArray(convs) ? convs.length : 0,
      });
    } catch (error: any) {
      updateResult('api', 'error', `API Error: ${error.message}`, {
        statusCode: error.statusCode,
        code: error.code,
      });
    }

    // Test 5: Create Test Conversation
    updateResult('create', 'pending', 'Testing conversation creation...');
    try {
      const conv = await api.createConversation('Diagnostic Test ' + new Date().toISOString());
      updateResult('create', 'success', 'Conversation created', {
        id: conv.id,
        title: conv.title,
      });
    } catch (error: any) {
      updateResult('create', 'error', `Create Error: ${error.message}`, {
        statusCode: error.statusCode,
        code: error.code,
      });
    }

    // Test 6: WebSocket Connection
    updateResult('ws', 'pending', 'Testing WebSocket connection...');
    try {
      await wsClient.connect();

      if (wsClient.isConnected()) {
        updateResult('ws', 'success', 'WebSocket connected');
      } else {
        updateResult('ws', 'error', 'WebSocket failed to connect');
      }
    } catch (error: any) {
      updateResult('ws', 'error', `WebSocket Error: ${error.message}`);
    }

    // Test 7: Get Documents
    updateResult('docs', 'pending', 'Testing documents API...');
    try {
      const docs = await api.getDocuments();
      updateResult('docs', 'success', `Found ${docs.length} documents`, {
        count: docs.length,
        sample: docs.slice(0, 3).map(d => d.title),
      });
    } catch (error: any) {
      updateResult('docs', 'error', `Documents Error: ${error.message}`);
    }

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">System Diagnostics</h1>
          <p className="text-gray-600 mb-4">
            This page tests all system components to help diagnose issues.
          </p>
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? 'Running Tests...' : 'Run Diagnostics'}
          </Button>
        </Card>

        <div className="space-y-4">
          {results.map((result) => (
            <Card key={result.name} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-semibold">
                      {result.name.toUpperCase()}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        result.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : result.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {result.status}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{result.message}</p>
                  {result.details && (
                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {results.length > 0 && !isRunning && (
          <Card className="p-6 mt-6">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <div className="space-y-2">
              <p>
                ✅ Success: {results.filter(r => r.status === 'success').length}
              </p>
              <p>
                ❌ Errors: {results.filter(r => r.status === 'error').length}
              </p>
              <p>
                ⏳ Pending: {results.filter(r => r.status === 'pending').length}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
