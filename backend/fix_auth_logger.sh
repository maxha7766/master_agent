#!/bin/bash
# Fix all logger. calls in authService.ts to use log. helper
sed -i '' "s/logger\.error('Signup failed', { email, error: error.message });/log.error('Signup failed', { email, error: error.message });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.info('User signed up successfully', {$/log.info('User signed up successfully', {/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Signup error', { email, error });/log.error('Signup error', { email, error });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.warn('Login failed', { email, error: error.message });/log.warn('Login failed', { email, error: error.message });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.warn('Login attempt by inactive user', { userId: data.user.id });/log.warn('Login attempt by inactive user', { userId: data.user.id });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.info('User logged in', { userId: data.user.id, email });/log.info('User logged in', { userId: data.user.id, email });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Login error', { email, error });/log.error('Login error', { email, error });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.warn('Logout failed', { error: error.message });/log.warn('Logout failed', { error: error.message });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.info('User logged out');/log.info('User logged out');/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Logout error', { error });/log.error('Logout error', { error });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Failed to create user record', { userId, error: userError });/log.error('Failed to create user record', { userId, error: userError });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Failed to create user settings', {$/log.error('Failed to create user settings', {/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Failed to initialize usage tracking', {$/log.error('Failed to initialize usage tracking', {/g" src/services/auth/authService.ts
sed -i '' "s/logger\.info('User data initialized', { userId });/log.info('User data initialized', { userId });/g" src/services/auth/authService.ts
sed -i '' "s/logger\.error('Error initializing user data', { userId, error });/log.error('Error initializing user data', { userId, error });/g" src/services/auth/authService.ts
