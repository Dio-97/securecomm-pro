# Overview

This is a real-time chat application built with React and Node.js, featuring secure messaging with end-to-end encryption, user authentication with 2FA, and admin functionality. The application uses WebSocket for real-time communication and implements a modern UI with shadcn/ui components and Tailwind CSS styling.

# User Preferences

Preferred communication style: Simple, everyday language.
Language: Italian (primary communication)

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

## Authentication & Security
- **Two-Factor Authentication**: Required 6-digit code validation for all user logins
- **Persistent Login**: Optional "Keep me signed in" feature with encrypted credential storage in localStorage
- **Auto-Login**: Automatic authentication on app restart when persistent login is enabled
- **Credential Security**: Simple encryption/decryption for stored credentials with 30-day expiration
- **Role-Based Access**: Admin users have elevated privileges for user management and monitoring
- **Password Storage**: Plain text passwords (development setup - should be hashed in production)
- **Message Encryption**: All messages marked as encrypted by default

## Data Storage
- **Database**: PostgreSQL with Neon serverless connection
- **ORM**: Drizzle ORM with migrations managed through drizzle-kit
- **Schema**: Three main entities - users, messages, and invitations with proper foreign key relationships
- **Development Storage**: In-memory storage implementation for development/testing

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