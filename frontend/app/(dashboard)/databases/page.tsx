'use client';

/**
 * Database Connections Management Page
 * Allows users to add, test, and manage external PostgreSQL database connections
 */

import { useState, useEffect } from 'react';
import { api, DatabaseConnection } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Database, Trash2, TestTube2, Plus, X } from 'lucide-react';

export default function DatabasesPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formConnectionString, setFormConnectionString] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load connections
  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDatabaseConnections();
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddConnection(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      await api.createDatabaseConnection(formName, formConnectionString);
      setFormName('');
      setFormConnectionString('');
      setShowAddForm(false);
      await loadConnections();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add connection');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleTestConnection(id: string) {
    setTestingId(id);
    try {
      const result = await api.testDatabaseConnection(id);
      if (result.success) {
        alert('✅ Connection successful!');
      } else {
        alert('❌ Connection failed: ' + result.message);
      }
    } catch (err) {
      alert('❌ Test failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDeleteConnection(id: string, name: string) {
    if (!confirm(`Delete connection "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteDatabaseConnection(id);
      await loadConnections();
    } catch (err) {
      alert('Failed to delete connection: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading connections...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6" />
              Database Connections
            </h1>
            <p className="text-gray-400 mt-1">
              Connect external PostgreSQL databases to query with natural language
            </p>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Add Connection Form */}
        {showAddForm && (
          <div className="bg-[#2f2f2f] border border-gray-700 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Database Connection</h2>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-900/20 border border-red-700 text-red-400 p-3 rounded mb-4 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddConnection} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-white">Connection Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Production DB"
                  required
                  className="bg-[#1a1a1a] border-gray-600 text-white mt-1"
                />
              </div>

              <div>
                <Label htmlFor="connectionString" className="text-white">
                  PostgreSQL Connection String
                </Label>
                <Input
                  id="connectionString"
                  type="password"
                  value={formConnectionString}
                  onChange={(e) => setFormConnectionString(e.target.value)}
                  placeholder="postgresql://user:password@host:5432/database"
                  required
                  className="bg-[#1a1a1a] border-gray-600 text-white mt-1 font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Format: postgresql://username:password@hostname:port/database
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {formSubmitting ? 'Adding...' : 'Add Connection'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError(null);
                  }}
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white hover:bg-[#252525]"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Connections List */}
        {connections.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No database connections</h3>
            <p className="text-gray-400 mb-4">
              Add a PostgreSQL connection to query your databases with natural language
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Connection
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-[#2f2f2f] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">
                        {connection.name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          connection.active
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {connection.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      <div>Added: {new Date(connection.created_at).toLocaleDateString()}</div>
                      {connection.updated_at !== connection.created_at && (
                        <div>
                          Updated: {new Date(connection.updated_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleTestConnection(connection.id)}
                      disabled={testingId === connection.id}
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-gray-600 text-white hover:bg-[#252525]"
                    >
                      <TestTube2 className="w-4 h-4 mr-2" />
                      {testingId === connection.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteConnection(connection.id, connection.name)}
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-red-600 text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
