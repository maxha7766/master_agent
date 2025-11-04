'use client';

/**
 * Database Connection List
 * Displays and manages database connections
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Database, Trash2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface DatabaseConnection {
  id: string;
  name: string;
  description?: string;
  db_type: 'postgresql' | 'mysql' | 'sqlite';
  status: 'active' | 'inactive' | 'error';
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseConnectionListProps {
  connections: DatabaseConnection[];
  onDelete: (id: string) => Promise<void>;
  onSelect?: (connection: DatabaseConnection) => void;
}

export default function DatabaseConnectionList({
  connections,
  onDelete,
  onSelect,
}: DatabaseConnectionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this connection? This action cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'inactive':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getDbTypeLabel = (dbType: string) => {
    switch (dbType) {
      case 'postgresql':
        return 'PostgreSQL';
      case 'mysql':
        return 'MySQL';
      case 'sqlite':
        return 'SQLite';
      default:
        return dbType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (connections.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <p className="text-gray-400">No database connections yet</p>
        <p className="text-gray-500 text-sm mt-2">Create your first connection to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((connection) => (
        <Card
          key={connection.id}
          className="p-4 bg-[#1a1a1a] border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
          onClick={() => onSelect?.(connection)}
        >
          <div className="flex items-center gap-3">
            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(connection.id);
              }}
              disabled={deletingId === connection.id}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            {/* Database Icon */}
            <Database className="w-5 h-5 text-blue-400 flex-shrink-0" />

            {/* Connection Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{connection.name}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                <span>{getDbTypeLabel(connection.db_type)}</span>
                <span>•</span>
                <span>Created {formatDate(connection.created_at)}</span>
                {connection.last_connected_at && (
                  <>
                    <span>•</span>
                    <span className="text-green-400">
                      Last connected {formatDate(connection.last_connected_at)}
                    </span>
                  </>
                )}
              </div>
              {connection.description && (
                <p className="text-gray-400 text-sm mt-1 truncate">{connection.description}</p>
              )}
            </div>

            {/* Status Icon */}
            <div className="flex-shrink-0">{getStatusIcon(connection.status)}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
