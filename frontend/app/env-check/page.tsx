'use client';

/**
 * Environment Variables Check Page
 * Shows what environment variables are actually available
 */

export default function EnvCheckPage() {
  const envVars = {
    'NEXT_PUBLIC_API_URL': process.env.NEXT_PUBLIC_API_URL,
    'NEXT_PUBLIC_WS_URL': process.env.NEXT_PUBLIC_WS_URL,
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Environment Variables</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="border-b pb-4 last:border-b-0">
              <h3 className="font-mono text-sm font-bold text-gray-700 mb-2">{key}</h3>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                {value || <span className="text-red-500">❌ NOT SET</span>}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-bold text-yellow-800 mb-2">Expected Values:</h2>
          <ul className="text-sm text-yellow-700 space-y-1 font-mono">
            <li>NEXT_PUBLIC_API_URL = https://masteragent-production-9a9b.up.railway.app</li>
            <li>NEXT_PUBLIC_WS_URL = wss://masteragent-production-9a9b.up.railway.app</li>
            <li>NEXT_PUBLIC_SUPABASE_URL = https://omjwoyyhpdawjxsbpamc.supabase.co</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
