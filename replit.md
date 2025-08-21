# Overview

SecureComm Pro - Una piattaforma di messaggistica istantanea sicura progettata per aziende di import/export oro con funzionalità avanzate di sicurezza, crittografia end-to-end, autenticazione 2FA e capacità di sorveglianza amministrativa. L'applicazione supporta fino a 20 utenti simultanei con aggiornamenti conversazioni in tempo reale e consegna messaggi istantanea.

# User Preferences

Preferred communication style: Simple, everyday language.
Language: Italian (primary communication)
Auto-save conversations: All chat conversations opened through search are automatically saved for all users
Message positioning: User's own messages on right (blue), received messages on left (gray)
Keyboard behavior: Never close automatically when sending messages - stays open until user manually closes
Ultra-fast refresh: Conversation list updates every 500ms for instant message visibility
Conversation UI: Blue dot indicator for new messages next to status; X button always visible but subtle (gray, 50% opacity)
Search restriction: Users cannot search for themselves in user search - applies to all user types including admins

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and React hooks for local state
- **Routing**: Single-page application with conditional screen rendering (login, chat, admin)
- **Theme System**: Custom theme provider supporting light/dark mode with CSS variables

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **WebSocket**: Real-time messaging using the `ws` library for bidirectional communication
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Conversation Cache**: Server-side caching system for all user conversations with automatic WebSocket updates

## Authentication & Security
- **Two-Factor Authentication**: Required 6-digit code validation for all user logins
- **Persistent Login**: Optional "Keep me signed in" feature with encrypted credential storage in localStorage
- **Auto-Login**: Automatic authentication on app restart when persistent login is enabled
- **Credential Security**: Simple encryption/decryption for stored credentials with 30-day expiration
- **Role-Based Access**: Admin users have elevated privileges for user management and monitoring
- **Password Storage**: All passwords stored in plain text format for all users (existing and new accounts) - complete removal of bcrypt hashing (August 21, 2025)
- **Message Encryption**: All messages marked as encrypted by default
- **Login Rate Limiting**: Completely disabled - unlimited login attempts allowed (August 21, 2025)

## Data Storage
- **Database**: PostgreSQL with Neon serverless connection for persistent data storage
- **ORM**: Drizzle ORM with migrations managed through drizzle-kit
- **Schema**: Complete entities - users, messages, invitations, savedConversations, sharedFiles, cryptoSessions, conversationStates with proper foreign key relationships
- **Storage Implementation**: DatabaseStorage class replaces MemStorage for persistent user and message data
- **Migration**: All user creation, deletion, and message operations now persist across server restarts
- **Conversation State Tracking**: Individual conversation states track message visibility and auto-destruction triggers
- **Auto-Save Conversations**: All chats opened through search are automatically saved to savedConversations table for all users (August 21, 2025)
- **Conversation Caching**: Server maintains real-time cache of user conversations updated via WebSocket on saves and messages
- **Ultra-Fast Refresh**: Client refreshes conversation list every 500ms for instant message visibility and contact updates (August 21, 2025)
- **Ephemeral Messaging**: Messages are temporary and automatically cleared when user exits chat, permanently destroyed from server when both users leave (August 21, 2025)
- **Conversation Reordering**: Fixed automatic conversation reordering by timestamp - conversations now move to top when messages are sent, regardless of cleared status (August 21, 2025)
- **Clean UI**: Removed message previews from conversation list for cleaner, more secure interface (August 21, 2025)
- **WhatsApp-style Unread Counter**: Added red circular badge with white text showing unread message count, positioned on the right side of conversations (August 21, 2025)
- **Custom Gaming Background**: Applied custom gaming-themed background image to chat messages area and conversations page with repeating pattern, dark overlay for readability, while preserving admin dashboard original appearance (August 21, 2025)

## Real-Time Communication
- **WebSocket Server**: Dedicated WebSocket server on `/ws` path for real-time messaging
- **Message Types**: Structured message protocol for authentication, chat messages, user presence, and admin functions
- **Connection Management**: Active connection tracking with user session management

## Admin Features
- **God Mode**: Admin users can view messages as any user for moderation purposes
- **User Management**: View all users, their activity status, and message counts
- **Invitation System**: Email-based user invitation system managed by admins

## UI/UX Features
- **Compact VPN Panel**: Optimized VPN connection interface with reduced height for better screen utilization
- **Responsive Security Panel**: Streamlined security center with compact card layouts
- **Login Experience**: Enhanced with persistent login options and smooth auto-authentication flow

## External Dependencies

- **Database**: Neon PostgreSQL serverless database via `@neondatabase/serverless`
- **UI Components**: Radix UI primitives for accessible component foundation
- **Styling**: Tailwind CSS with custom design system and CSS variables
- **Development**: Replit integration with cartographer plugin for development environment
- **Build Tools**: Vite for frontend bundling and esbuild for server-side compilation