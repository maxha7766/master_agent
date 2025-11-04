'use client';

/**
 * Database Connection Form
 * Form for creating/editing SQL database connections
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2 } from 'lucide-react';

interface DatabaseConnectionFormProps {
  onSubmit: (data: ConnectionFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<ConnectionFormData>;
  isLoading?: boolean;
}

export interface ConnectionFormData {
  name: string;
  description: string;
  dbType: 'postgresql' | 'mysql' | 'sqlite';
  connectionDetails: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}

export default function DatabaseConnectionForm({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
}: DatabaseConnectionFormProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    dbType: initialData?.dbType || 'postgresql',
    connectionDetails: {
      host: initialData?.connectionDetails?.host || '',
      port: initialData?.connectionDetails?.port || 5432,
      database: initialData?.connectionDetails?.database || '',
      username: initialData?.connectionDetails?.username || '',
      password: initialData?.connectionDetails?.password || '',
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (!formData.connectionDetails.host.trim()) {
      newErrors.host = 'Host is required';
    }

    if (!formData.connectionDetails.database.trim()) {
      newErrors.database = 'Database name is required';
    }

    if (!formData.connectionDetails.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.connectionDetails.password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(formData);
  };

  const updateConnectionDetail = (field: string, value: string | number) => {
    setFormData({
      ...formData,
      connectionDetails: {
        ...formData.connectionDetails,
        [field]: value,
      },
    });
    // Clear error for this field
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Connection Name */}
      <div>
        <Label htmlFor="name" className="text-white">
          Connection Name *
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          placeholder="My Production DB"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
        {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description" className="text-white">
          Description
        </Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
      </div>

      {/* Database Type */}
      <div>
        <Label htmlFor="dbType" className="text-white">
          Database Type *
        </Label>
        <select
          id="dbType"
          value={formData.dbType}
          onChange={(e) =>
            setFormData({ ...formData, dbType: e.target.value as 'postgresql' | 'mysql' | 'sqlite' })
          }
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-white focus:outline-none focus:border-gray-500"
          disabled={isLoading}
        >
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlite">SQLite</option>
        </select>
      </div>

      {/* Host */}
      <div>
        <Label htmlFor="host" className="text-white">
          Host *
        </Label>
        <Input
          id="host"
          value={formData.connectionDetails.host}
          onChange={(e) => updateConnectionDetail('host', e.target.value)}
          placeholder="localhost or db.example.com"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
        {errors.host && <p className="text-red-400 text-sm mt-1">{errors.host}</p>}
      </div>

      {/* Port */}
      <div>
        <Label htmlFor="port" className="text-white">
          Port *
        </Label>
        <Input
          id="port"
          type="number"
          value={formData.connectionDetails.port}
          onChange={(e) => updateConnectionDetail('port', parseInt(e.target.value) || 5432)}
          placeholder="5432"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
      </div>

      {/* Database Name */}
      <div>
        <Label htmlFor="database" className="text-white">
          Database Name *
        </Label>
        <Input
          id="database"
          value={formData.connectionDetails.database}
          onChange={(e) => updateConnectionDetail('database', e.target.value)}
          placeholder="myapp_production"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
        {errors.database && <p className="text-red-400 text-sm mt-1">{errors.database}</p>}
      </div>

      {/* Username */}
      <div>
        <Label htmlFor="username" className="text-white">
          Username *
        </Label>
        <Input
          id="username"
          value={formData.connectionDetails.username}
          onChange={(e) => updateConnectionDetail('username', e.target.value)}
          placeholder="readonly_user"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
        {errors.username && <p className="text-red-400 text-sm mt-1">{errors.username}</p>}
      </div>

      {/* Password */}
      <div>
        <Label htmlFor="password" className="text-white">
          Password *
        </Label>
        <Input
          id="password"
          type="password"
          value={formData.connectionDetails.password}
          onChange={(e) => updateConnectionDetail('password', e.target.value)}
          placeholder="••••••••"
          className="bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-500"
          disabled={isLoading}
        />
        {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-white hover:bg-gray-200 text-black"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Connection'
          )}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          variant="outline"
          className="flex-1 border-gray-700 text-white hover:bg-gray-800"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
