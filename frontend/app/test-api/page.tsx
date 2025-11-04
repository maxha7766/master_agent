'use client';

/**
 * API Connection Test Page
 */

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function TestAPIPage() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (msg: string) => {
    setResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runTests = async () => {
    setResults([]);
    setLoading(true);

    // Test 1: Check environment variables
    addResult('=== ENVIRONMENT VARIABLES ===');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

    addResult(`API_URL: ${apiUrl || '❌ NOT SET'}`);
    addResult(`WS_URL: ${wsUrl || '❌ NOT SET'}`);

    if (!apiUrl) {
      addResult('❌ CRITICAL: NEXT_PUBLIC_API_URL not set!');
      addResult('Using fallback: http://localhost:3001');
    }

    const effectiveApiUrl = apiUrl || 'http://localhost:3001';

    // Test 2: Backend health check
    addResult('\n=== BACKEND HEALTH CHECK ===');
    try {
      const response = await fetch(`${effectiveApiUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        addResult(`✅ Backend healthy: ${JSON.stringify(data)}`);
      } else {
        addResult(`❌ Backend returned ${response.status}`);
      }
    } catch (error: any) {
      addResult(`❌ Backend unreachable: ${error.message}`);
    }

    // Test 3: Get auth token
    addResult('\n=== AUTHENTICATION ===');
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      addResult('❌ Not logged in');
      setLoading(false);
      return;
    }

    addResult(`✅ Logged in as: ${session.user.email}`);
    addResult(`Token length: ${session.access_token.length}`);

    // Test 4: CORS preflight
    addResult('\n=== CORS PREFLIGHT ===');
    try {
      const preflightResponse = await fetch(`${effectiveApiUrl}/api/documents`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      });

      const corsHeaders = {
        'access-control-allow-origin': preflightResponse.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': preflightResponse.headers.get('access-control-allow-methods'),
        'access-control-allow-credentials': preflightResponse.headers.get('access-control-allow-credentials'),
      };

      addResult(`Preflight status: ${preflightResponse.status}`);
      addResult(`CORS headers: ${JSON.stringify(corsHeaders, null, 2)}`);

      if (corsHeaders['access-control-allow-origin'] === window.location.origin) {
        addResult('✅ CORS configured correctly');
      } else {
        addResult(`❌ CORS issue - origin ${window.location.origin} not allowed`);
      }
    } catch (error: any) {
      addResult(`❌ Preflight failed: ${error.message}`);
    }

    // Test 5: Actual API call
    addResult('\n=== API CALL /api/documents ===');
    try {
      const response = await fetch(`${effectiveApiUrl}/api/documents`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      addResult(`Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const docs = await response.json();
        addResult(`✅ SUCCESS! Got ${docs.length} documents`);
        if (docs.length > 0) {
          addResult(`Sample: ${docs.slice(0, 3).map((d: any) => d.title || d.file_name).join(', ')}`);
        }
      } else {
        const errorText = await response.text();
        addResult(`❌ API Error: ${errorText}`);
      }
    } catch (error: any) {
      addResult(`❌ Fetch failed: ${error.message}`);
      addResult(`Error name: ${error.name}`);
      addResult(`Error stack: ${error.stack?.split('\n')[0]}`);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">API Connection Test</h1>

        <button
          onClick={runTests}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50 mb-6"
        >
          {loading ? 'Running Tests...' : 'Run Tests'}
        </button>

        <div className="bg-gray-800 rounded-lg p-6 font-mono text-sm overflow-auto max-h-[600px]">
          {results.length === 0 ? (
            <p className="text-gray-400">Click "Run Tests" to start</p>
          ) : (
            results.map((result, i) => (
              <div key={i} className="mb-1 whitespace-pre-wrap">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
