/**
 * Conversation Service
 * Manages conversations and messages
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';
import { ValidationError, NotFoundError } from '../../lib/errors.js';
import type { Database } from '../../models/database.types';
import { conversationTitleGenerator } from './title-generator.js';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  title?: string
): Promise<Conversation> {
  try {
    const conversationData: ConversationInsert = {
      user_id: userId,
      title: title || 'New Conversation',
    };

    const { data, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      log.error('Failed to create conversation');
      throw new ValidationError('Failed to create conversation');
    }

    log.info('Conversation created');

    return data;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    log.error('Error creating conversation');
    throw new ValidationError('Failed to create conversation');
  }
}

/**
 * Get all conversations for a user
 */
export async function getConversations(
  userId: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      log.error('Failed to get conversations');
      throw new ValidationError('Failed to retrieve conversations');
    }

    return data || [];
  } catch (error) {
    log.error('Error getting conversations');
    throw new ValidationError('Failed to retrieve conversations');
  }
}

/**
 * Get a specific conversation with messages
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<ConversationWithMessages> {
  try {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      log.warn('Conversation not found', { conversationId, userId });
      throw new NotFoundError('Conversation not found');
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) {
      log.error('Failed to get messages');
      throw new ValidationError('Failed to retrieve messages');
    }

    return {
      ...conversation,
      messages: messages || [],
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    log.error('Error getting conversation');
    throw new ValidationError('Failed to retrieve conversation');
  }
}

/**
 * Update conversation
 */
export async function updateConversation(
  conversationId: string,
  userId: string,
  updates: { title?: string }
): Promise<Conversation> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      log.error('Failed to update conversation');
      throw new NotFoundError('Conversation not found');
    }

    log.info('Conversation updated', { conversationId, updates });

    return data;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    log.error('Error updating conversation');
    throw new ValidationError('Failed to update conversation');
  }
}

/**
 * Delete conversation
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to delete conversation', { conversationId, userId, error });
      throw new NotFoundError('Conversation not found');
    }

    log.info('Conversation deleted', { conversationId, userId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    log.error('Error deleting conversation');
    throw new ValidationError('Failed to delete conversation');
  }
}

/**
 * Save a message to the database
 */
export async function saveMessage(
  messageData: Omit<MessageInsert, 'id' | 'created_at'>
): Promise<Message> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      log.error('Failed to save message', { messageData, error });
      throw new ValidationError('Failed to save message');
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', messageData.conversation_id);

    return data;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    log.error('Error saving message', { messageData, error });
    throw new ValidationError('Failed to save message');
  }
}

/**
 * Get recent messages for context window
 */
export async function getRecentMessages(
  conversationId: string,
  limit: number = 20
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get recent messages', { conversationId, error });
      return [];
    }

    // Return in ascending order (oldest first)
    return (data || []).reverse();
  } catch (error) {
    log.error('Error getting recent messages', { conversationId, error });
    return [];
  }
}

/**
 * Generate and update conversation title based on messages
 */
export async function generateConversationTitle(
  conversationId: string,
  userId: string
): Promise<string | null> {
  try {
    log.info('Generating conversation title', { conversationId, userId });

    // Get recent messages
    const messages = await getRecentMessages(conversationId, 6);

    if (messages.length === 0) {
      log.warn('No messages found for title generation', { conversationId });
      return null;
    }

    // Convert to format expected by title generator
    const formattedMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.created_at,
    }));

    // Generate title
    const titleResult = await conversationTitleGenerator.generateTitle(
      formattedMessages,
      conversationId
    );

    // Update conversation with generated title
    await updateConversation(conversationId, userId, {
      title: titleResult.title,
    });

    log.info('Conversation title generated and saved', {
      conversationId,
      title: titleResult.title,
      confidence: titleResult.confidence,
    });

    return titleResult.title;
  } catch (error) {
    log.error('Failed to generate conversation title', {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if conversation needs a title (has messages but no title)
 */
export async function needsTitle(conversationId: string): Promise<boolean> {
  try {
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('title')
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return false;
    }

    // Needs title if current title is null or "New Conversation"
    return !conversation.title || conversation.title === 'New Conversation';
  } catch (error) {
    log.error('Error checking if conversation needs title', {
      conversationId,
      error,
    });
    return false;
  }
}
