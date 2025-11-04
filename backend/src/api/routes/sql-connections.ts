/**
 * SQL Connections API Routes - MVP Version
 * Manages external database connections for SQL Agent
 *
 * Note: This is a simplified MVP implementation.
 * TODO: Add encryption service, schema discovery, and connection testing.
 */

import { Router } from 'express';
import { supabase } from '../../models/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { log } from '../../lib/logger.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/sql-connections
 * List all database connections for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data: connections, error } = await supabase
      .from('database_connections')
      .select('id, name, description, db_type, status, last_connected_at, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to list database connections', { userId, error });
      return res.status(500).json({ error: 'Failed to list connections' });
    }

    res.json({ connections: connections || [] });
  } catch (error) {
    log.error('Error listing database connections', { userId: req.user?.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sql-connections/:id
 * Get a specific database connection
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: connection, error } = await supabase
      .from('database_connections')
      .select('id, name, description, db_type, status, last_connected_at, last_error, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      log.error('Connection not found', { userId, connectionId: id, error });
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ connection });
  } catch (error) {
    log.error('Error fetching connection', { userId: req.user?.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sql-connections
 * Create a new database connection
 *
 * Note: For MVP, storing connection details as plain JSON.
 * In production, these should be encrypted using the encryption service.
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, description, dbType, connectionDetails } = req.body;

    // Validate required fields
    if (!name || !dbType || !connectionDetails) {
      return res.status(400).json({ error: 'Missing required fields: name, dbType, connectionDetails' });
    }

    // Validate db_type
    if (!['postgresql', 'mysql', 'sqlite'].includes(dbType)) {
      return res.status(400).json({ error: 'Invalid dbType. Must be postgresql, mysql, or sqlite' });
    }

    // For MVP: Store connection details as JSON in description field
    // TODO: Implement proper encryption using encryption service
    const connectionData = {
      id: undefined, // Let database generate
      user_id: userId,
      name,
      description: description || null,
      db_type: dbType,
      status: 'active',
      // Store connection details temporarily in connection_string_encrypted field
      // In production, encrypt these fields individually
      connection_string_encrypted: JSON.stringify(connectionDetails),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: connection, error } = await supabase
      .from('database_connections')
      .insert(connectionData)
      .select()
      .single();

    if (error) {
      log.error('Failed to create connection', { userId, error });
      return res.status(500).json({ error: 'Failed to create connection' });
    }

    log.info('Database connection created', { userId, connectionId: connection.id, dbType });

    res.status(201).json({ connection });
  } catch (error) {
    log.error('Error creating connection', { userId: req.user?.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/sql-connections/:id
 * Update a database connection
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, status } = req.body;

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      if (!['active', 'inactive', 'error'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be active, inactive, or error' });
      }
      updates.status = status;
    }

    const { data: connection, error } = await supabase
      .from('database_connections')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !connection) {
      log.error('Failed to update connection', { userId, connectionId: id, error });
      return res.status(404).json({ error: 'Connection not found' });
    }

    log.info('Database connection updated', { userId, connectionId: id });

    res.json({ connection });
  } catch (error) {
    log.error('Error updating connection', { userId: req.user?.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/sql-connections/:id
 * Delete a database connection
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('database_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to delete connection', { userId, connectionId: id, error });
      return res.status(500).json({ error: 'Failed to delete connection' });
    }

    log.info('Database connection deleted', { userId, connectionId: id });

    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting connection', { userId: req.user?.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sql-connections/test
 * Test a database connection before saving
 *
 * For MVP: Just validates the connection details format
 * TODO: Implement actual connection testing
 */
router.post('/test', async (req, res) => {
  try {
    const { dbType, connectionDetails } = req.body;

    // Validate required fields
    if (!dbType || !connectionDetails) {
      return res.status(400).json({ error: 'Missing required fields: dbType, connectionDetails' });
    }

    // Validate db_type
    if (!['postgresql', 'mysql', 'sqlite'].includes(dbType)) {
      return res.status(400).json({ error: 'Invalid dbType' });
    }

    // Validate connection details structure
    const requiredFields = ['host', 'port', 'database', 'username', 'password'];
    const missingFields = requiredFields.filter(field => !connectionDetails[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing connection details fields',
        missingFields
      });
    }

    // For MVP: Return success without actually connecting
    // TODO: Implement actual connection test using database connector service
    log.info('Connection test requested (MVP - validation only)', {
      dbType,
      host: connectionDetails.host
    });

    res.json({
      success: true,
      message: 'Connection details validated successfully'
    });
  } catch (error) {
    log.error('Error testing connection', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sql-connections/:id/schema
 * Get the cached schema for a database connection
 *
 * For MVP: Returns empty schema
 * TODO: Implement schema discovery service
 */
router.get('/:id/schema', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { refresh } = req.query;

    const { data: connection, error } = await supabase
      .from('database_connections')
      .select('id, schema_cache, last_schema_refresh')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // For MVP: Return empty schema
    // TODO: Implement schema discovery and caching
    const schema = connection.schema_cache || {
      tables: [],
      lastRefresh: connection.last_schema_refresh,
      message: 'Schema discovery not yet implemented'
    };

    log.info('Schema retrieved', { userId, connectionId: id, refresh: !!refresh });

    res.json({ schema });
  } catch (error) {
    log.error('Error retrieving schema', { userId: req.user?.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
