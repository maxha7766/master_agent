/**
 * Database Connections API Routes
 * Manages PostgreSQL database connections for SQL Agent
 */

import { Router, Response } from 'express';
import { supabase } from '../../models/database.js';
import { encryptConnectionString, validateConnectionString, decryptConnectionString } from '../../services/database/encryption.js';
import { databaseConnector } from '../../services/database/connector.js';
import { discoverSchema } from '../../services/database/schema.js';
import { log } from '../../lib/logger.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/database-connections
 * Add a new database connection
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, connectionString } = req.body;

  if (!name || !connectionString) {
    return res.status(400).json({
      error: 'Missing required fields: name, connectionString'
    });
  }

  try {
    // Validate connection string format
    validateConnectionString(connectionString);

    // Encrypt connection string
    const encryptedConnectionString = encryptConnectionString(connectionString);

    // Create database record
    const { data: connection, error: createError } = await supabase
      .from('database_connections')
      .insert({
        user_id: userId,
        name,
        encrypted_connection_string: encryptedConnectionString,
        active: true,
      })
      .select()
      .single();

    if (createError || !connection) {
      log.error('Failed to create database connection', {
        error: createError?.message,
        userId,
        name,
      });
      return res.status(500).json({ error: 'Failed to create database connection' });
    }

    // Test connection
    const testSuccess = await databaseConnector.testConnection({
      id: connection.id,
      name: connection.name,
      encryptedConnectionString: connection.encrypted_connection_string,
      userId: connection.user_id,
    });

    if (!testSuccess) {
      // Connection test failed, mark as inactive
      await supabase
        .from('database_connections')
        .update({ active: false })
        .eq('id', connection.id);

      log.warn('Database connection test failed', {
        connectionId: connection.id,
        userId,
        name,
      });

      return res.status(400).json({
        error: 'Connection test failed. Please check your connection string.',
        connection: {
          id: connection.id,
          name: connection.name,
          active: false,
          created_at: connection.created_at,
        },
      });
    }

    log.info('Database connection created successfully', {
      connectionId: connection.id,
      userId,
      name,
    });

    res.status(201).json({
      id: connection.id,
      name: connection.name,
      active: connection.active,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
    });
  } catch (error) {
    log.error('Database connection creation failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      name,
    });

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create database connection'
    });
  }
});

/**
 * GET /api/database-connections
 * List all database connections for authMiddlewared user
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: connections, error } = await supabase
      .from('database_connections')
      .select('id, name, active, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch database connections', {
        error: error.message,
        userId,
      });
      return res.status(500).json({ error: 'Failed to fetch database connections' });
    }

    res.json({ connections: connections || [] });
  } catch (error) {
    log.error('Database connections list failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    res.status(500).json({ error: 'Failed to list database connections' });
  }
});

/**
 * GET /api/database-connections/:id
 * Get details about a specific database connection
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const connectionId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: connection, error } = await supabase
      .from('database_connections')
      .select('id, name, active, created_at, updated_at')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Database connection not found' });
    }

    res.json(connection);
  } catch (error) {
    log.error('Database connection fetch failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      connectionId,
    });
    res.status(500).json({ error: 'Failed to fetch database connection' });
  }
});

/**
 * POST /api/database-connections/:id/test
 * Test a database connection
 */
router.post('/:id/test', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const connectionId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get connection
    const { data: connection, error } = await supabase
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Database connection not found' });
    }

    // Test connection
    const testSuccess = await databaseConnector.testConnection({
      id: connection.id,
      name: connection.name,
      encryptedConnectionString: connection.encrypted_connection_string,
      userId: connection.user_id,
    });

    if (testSuccess) {
      log.info('Database connection test successful', {
        connectionId,
        userId,
      });
      res.json({ success: true, message: 'Connection test successful' });
    } else {
      log.warn('Database connection test failed', {
        connectionId,
        userId,
      });
      res.status(400).json({ success: false, message: 'Connection test failed' });
    }
  } catch (error) {
    log.error('Database connection test error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      connectionId,
    });
    res.status(500).json({ error: 'Failed to test database connection' });
  }
});

/**
 * POST /api/database-connections/:id/schema
 * Discover schema for a database connection
 */
router.post('/:id/schema', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const connectionId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get connection
    const { data: connection, error } = await supabase
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Database connection not found' });
    }

    // Discover schema
    const schema = await discoverSchema({
      id: connection.id,
      name: connection.name,
      encryptedConnectionString: connection.encrypted_connection_string,
      userId: connection.user_id,
    });

    log.info('Schema discovery successful', {
      connectionId,
      userId,
      tableCount: schema.totalTables,
    });

    res.json({
      totalTables: schema.totalTables,
      tables: schema.tables.map((t) => ({
        schema: t.schema,
        name: t.name,
        columnCount: t.columns.length,
        rowCount: t.rowCount,
        description: t.description,
      })),
      discoveredAt: schema.discoveredAt,
    });
  } catch (error) {
    log.error('Schema discovery failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      connectionId,
    });
    res.status(500).json({ error: 'Failed to discover schema' });
  }
});

/**
 * PUT /api/database-connections/:id
 * Update a database connection
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const connectionId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, connectionString, active } = req.body;

  try {
    // Verify connection belongs to user
    const { data: existing } = await supabase
      .from('database_connections')
      .select('id')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Database connection not found' });
    }

    // Build update object
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (connectionString !== undefined) {
      validateConnectionString(connectionString);
      updates.encrypted_connection_string = encryptConnectionString(connectionString);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update connection
    const { data: connection, error: updateError } = await supabase
      .from('database_connections')
      .update(updates)
      .eq('id', connectionId)
      .select('id, name, active, created_at, updated_at')
      .single();

    if (updateError || !connection) {
      log.error('Failed to update database connection', {
        error: updateError?.message,
        userId,
        connectionId,
      });
      return res.status(500).json({ error: 'Failed to update database connection' });
    }

    log.info('Database connection updated', {
      connectionId,
      userId,
      updatedFields: Object.keys(updates),
    });

    res.json(connection);
  } catch (error) {
    log.error('Database connection update failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      connectionId,
    });
    res.status(500).json({ error: 'Failed to update database connection' });
  }
});

/**
 * DELETE /api/database-connections/:id
 * Delete a database connection
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const connectionId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify connection belongs to user
    const { data: connection } = await supabase
      .from('database_connections')
      .select('id')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (!connection) {
      return res.status(404).json({ error: 'Database connection not found' });
    }

    // Close active connection pool if exists
    await databaseConnector.closeConnection(connectionId);

    // Delete connection
    const { error: deleteError } = await supabase
      .from('database_connections')
      .delete()
      .eq('id', connectionId);

    if (deleteError) {
      log.error('Failed to delete database connection', {
        error: deleteError.message,
        connectionId,
        userId,
      });
      return res.status(500).json({ error: 'Failed to delete database connection' });
    }

    log.info('Database connection deleted', {
      connectionId,
      userId,
    });

    res.json({ message: 'Database connection deleted successfully' });
  } catch (error) {
    log.error('Database connection deletion failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      connectionId,
    });
    res.status(500).json({ error: 'Failed to delete database connection' });
  }
});

export default router;
