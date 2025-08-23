# OOO BNAL BANK Digital Banking Platform

## Overview

This is a comprehensive digital banking platform for OOO BNAL BANK that includes traditional banking services integrated with modern NFT marketplace functionality. The system provides user authentication, card management (virtual and crypto cards), transaction processing, exchange rate management, and a fully featured NFT marketplace with support for major collections like Bored Ape Yacht Club and Mutant Ape Yacht Club.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development practices
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS for utility-first styling approach
- **State Management**: React hooks and context for local state management
- **Routing**: React Router for client-side navigation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API development
- **Language**: TypeScript for type safety across the entire stack
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based authentication system
- **File Serving**: Express static middleware with custom NFT image server on port 8080/8081

### Data Storage Solutions
- **Primary Database**: PostgreSQL for production deployments (Render.com, Neon)
- **Development Database**: SQLite for local development and Replit environments
- **Database Migration**: Drizzle Kit for schema migrations and management
- **Backup Strategy**: Automated backup system with multiple formats (JSON, ZIP, SQL dumps)

### Database Schema Design
- **Users**: User profiles, authentication, and banking information
- **Cards**: Virtual cards and cryptocurrency wallets with address validation
- **Transactions**: Financial transaction history and processing
- **Exchange Rates**: Currency conversion rates and cryptocurrency pricing
- **NFT Collections**: Marketplace collections (Bored Ape, Mutant Ape, etc.)
- **NFTs**: Individual NFT items with metadata, attributes, and ownership tracking

### NFT Marketplace Architecture
- **Image Storage**: Multiple directory structure supporting various NFT collections
- **Image Processing**: Dynamic image serving with fallback mechanisms
- **Rarity System**: Algorithm-based rarity determination (common, uncommon, rare, epic, legendary)
- **Attribute System**: JSON-based attribute storage with power, wisdom, luck, agility stats

### Authentication and Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-based Access**: Admin, regulator, and user permission levels
- **Crypto Address Validation**: Bitcoin and Ethereum address validation for crypto cards

### Deployment Architecture
- **Production Platform**: Render.com with PostgreSQL database
- **Development Environment**: Replit with SQLite database
- **Database Migration**: Automated migration between SQLite and PostgreSQL
- **File Storage**: Persistent disk volumes for image assets and database files

## External Dependencies

### Core Dependencies
- **@napi-rs/canvas**: Canvas API for image processing and NFT image generation
- **drizzle-orm**: Type-safe ORM for database operations
- **postgres**: PostgreSQL client for production database connections
- **@neondatabase/serverless**: Neon PostgreSQL serverless database client
- **bcryptjs**: Password hashing and authentication security
- **jsonwebtoken**: JWT token generation and validation
- **sharp**: High-performance image processing library

### Development Dependencies
- **drizzle-kit**: Database schema management and migrations
- **tsx**: TypeScript execution for development scripts
- **@types/node**: Node.js type definitions
- **typescript**: TypeScript compiler and language support

### Third-party Services
- **Render.com**: Cloud hosting platform for production deployment
- **Neon Database**: Serverless PostgreSQL database hosting
- **GitHub**: Source code repository and version control
- **OpenSea API**: NFT metadata and collection information (referenced in scripts)

### NFT Image Sources
- **IPFS Gateways**: For official NFT collection images
- **Local Image Server**: Custom HTTP server for serving NFT images
- **CDN Integration**: Image optimization and delivery

### Backup and Migration Tools
- **PostgreSQL pg_dump**: Database backup and restoration
- **JSON Export/Import**: Cross-platform data migration
- **ZIP Compression**: Backup file compression and archiving