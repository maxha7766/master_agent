/**
 * Temporal Context Service
 * Provides time awareness and context for the AI agent
 */

export interface TimeGap {
  minutes: number;
  hours: number;
  days: number;
  category: 'immediate' | 'brief' | 'moderate' | 'long' | 'very_long' | 'new_session';
  shouldAcknowledge: boolean;
  contextLikelyShifted: boolean;
}

export interface TemporalContext {
  currentTime: Date;
  currentTimeFormatted: string;
  timeOfDay: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  dayOfWeek: string;
  timeSinceLastMessage?: TimeGap;
  conversationDuration?: {
    minutes: number;
    hours: number;
  };
  sessionContext: string;
}

/**
 * Calculate time gap between two dates
 */
export function calculateTimeGap(earlierDate: Date, laterDate: Date): TimeGap {
  const diffMs = laterDate.getTime() - earlierDate.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let category: TimeGap['category'];
  let shouldAcknowledge = false;
  let contextLikelyShifted = false;

  if (minutes < 5) {
    category = 'immediate';
  } else if (minutes < 30) {
    category = 'brief';
    shouldAcknowledge = false;
  } else if (minutes < 120) {
    category = 'moderate';
    shouldAcknowledge = true;
    contextLikelyShifted = true;
  } else if (hours < 8) {
    category = 'long';
    shouldAcknowledge = true;
    contextLikelyShifted = true;
  } else if (hours < 24) {
    category = 'very_long';
    shouldAcknowledge = true;
    contextLikelyShifted = true;
  } else {
    category = 'new_session';
    shouldAcknowledge = true;
    contextLikelyShifted = true;
  }

  return {
    minutes,
    hours,
    days,
    category,
    shouldAcknowledge,
    contextLikelyShifted,
  };
}

/**
 * Get time of day category
 */
export function getTimeOfDay(date: Date): TemporalContext['timeOfDay'] {
  const hour = date.getHours();

  if (hour >= 4 && hour < 7) return 'early_morning';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 && hour < 23) return 'night';
  return 'late_night';
}

/**
 * Get day of week
 */
export function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Format date for display
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generate temporal context for the agent
 */
export function generateTemporalContext(
  lastMessageTime?: Date,
  conversationStartTime?: Date
): TemporalContext {
  const now = new Date();
  const timeOfDay = getTimeOfDay(now);
  const dayOfWeek = getDayOfWeek(now);
  const currentTimeFormatted = formatDateTime(now);

  const context: TemporalContext = {
    currentTime: now,
    currentTimeFormatted,
    timeOfDay,
    dayOfWeek,
    sessionContext: getSessionContext(timeOfDay, dayOfWeek),
  };

  if (lastMessageTime) {
    context.timeSinceLastMessage = calculateTimeGap(lastMessageTime, now);
  }

  if (conversationStartTime) {
    const diffMs = now.getTime() - conversationStartTime.getTime();
    context.conversationDuration = {
      minutes: Math.floor(diffMs / 60000),
      hours: Math.floor(diffMs / 3600000),
    };
  }

  return context;
}

/**
 * Get contextual session description
 */
function getSessionContext(
  timeOfDay: TemporalContext['timeOfDay'],
  dayOfWeek: string
): string {
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
  const timeContexts: Record<TemporalContext['timeOfDay'], string> = {
    early_morning: isWeekend ? 'early weekend morning' : 'early morning (work day)',
    morning: isWeekend ? 'weekend morning' : 'morning (work hours)',
    afternoon: isWeekend ? 'weekend afternoon' : 'afternoon (work hours)',
    evening: 'evening',
    night: 'night',
    late_night: 'late night',
  };

  return timeContexts[timeOfDay];
}

/**
 * Format temporal context for AI prompt (refined, natural language)
 */
export function formatTemporalContextForPrompt(context: TemporalContext): string {
  let prompt = `**Current Context:**\n`;
  prompt += `- Current Time: ${context.currentTimeFormatted}\n`;
  prompt += `- Time of Day: ${context.sessionContext}\n`;

  if (context.timeSinceLastMessage) {
    const gap = context.timeSinceLastMessage;

    // Only mention gaps >= 30 minutes, and be subtle
    if (gap.category === 'moderate') {
      prompt += `- Time since last message: ${gap.minutes} minutes\n`;
      prompt += `  Note: User may have shifted context. If continuing a previous topic, consider a brief acknowledgment.\n`;
    } else if (gap.category === 'long') {
      prompt += `- Time since last message: ${gap.hours} hours\n`;
      prompt += `  Note: Significant time has passed. User likely shifted focus. Brief acknowledgment may help re-establish context.\n`;
    } else if (gap.category === 'very_long') {
      prompt += `- Time since last message: ${gap.hours} hours\n`;
      prompt += `  Note: This feels like a new session. Consider welcoming user back if contextually appropriate.\n`;
    } else if (gap.category === 'new_session') {
      prompt += `- Time since last message: ${gap.days} day(s)\n`;
      prompt += `  Note: New session. Acknowledge time gap naturally if it fits the conversation flow.\n`;
    }
    // Don't mention immediate or brief gaps at all
  }

  if (context.conversationDuration) {
    const dur = context.conversationDuration;
    if (dur.hours > 0) {
      prompt += `- Conversation Duration: ${dur.hours}h ${dur.minutes % 60}m\n`;
    } else {
      prompt += `- Conversation Duration: ${dur.minutes}m\n`;
    }
  }

  return prompt;
}

/**
 * Generate time-aware greeting or acknowledgment
 */
export function getTimeAwareGreeting(context: TemporalContext): string | null {
  const gap = context.timeSinceLastMessage;

  if (!gap || !gap.shouldAcknowledge) {
    return null;
  }

  const timeOfDayGreeting = {
    early_morning: 'Good early morning',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good evening',
    late_night: 'Hello',
  }[context.timeOfDay];

  if (gap.category === 'moderate') {
    return `${timeOfDayGreeting}! It's been about ${gap.minutes} minutes.`;
  } else if (gap.category === 'long') {
    return `${timeOfDayGreeting}! Welcome back - it's been ${gap.hours} hours.`;
  } else if (gap.category === 'very_long') {
    return `${timeOfDayGreeting}! Welcome back after ${gap.hours} hours.`;
  } else if (gap.category === 'new_session') {
    if (gap.days === 1) {
      return `${timeOfDayGreeting}! Good to see you again.`;
    } else {
      return `${timeOfDayGreeting}! It's been ${gap.days} days - welcome back!`;
    }
  }

  return null;
}
