
# Technical Architecture

## System Architecture
- Pattern: Microservices architecture
- Communication: REST APIs with OpenAPI 3.0

## Technology Stack
- Backend: Node.js 20 LTS with TypeScript
- Database: PostgreSQL 15 for relational data
- Cache: Redis for session management
- Framework: NestJS for enterprise structure

## Data Model
- Users table: id, email, password_hash, created_at
- Sessions table: id, user_id, token, expires_at
- Permissions table: id, name, resource

## Security
- Authentication: JWT with RSA256
- Password: Argon2 hashing
- Rate limiting: 100 requests per minute
