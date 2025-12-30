-- PayTabs Onboarding Tracker - Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor

-- Insert 6 weeks curriculum
INSERT INTO weeks (week_number, title, description) VALUES
(1, 'Go Fundamentals & Core Technologies', 'Master Go basics, Gin framework, GORM, PostgreSQL, and Redis'),
(2, 'Advanced Go & Development Practices', 'Concurrency, clean architecture, testing, Docker'),
(3, 'System Design & Security', 'Distributed systems, microservices, security best practices'),
(4, 'Payment Systems & Integration', 'Payment processing, compliance, real-world projects'),
(5, 'Capstone Project - Development', 'Build comprehensive payment gateway system'),
(6, 'Capstone Project - Finalization', 'Testing, documentation, presentation');

-- Week 1 Tasks
INSERT INTO tasks (week_id, title, description, category, order_index) VALUES
-- Day 1-2: Go Basics
(1, 'Go syntax and data types', 'Variables, types, control flow, functions', 'learning', 1),
(1, 'Pointers, structs, interfaces', 'Memory management and OOP concepts', 'learning', 2),
(1, 'Error handling patterns', 'Go-style error handling', 'learning', 3),
(1, 'Build CLI calculator', 'Practice basic Go syntax', 'exercise', 4),

-- Day 3-4: Gin Framework
(1, 'Gin routing and middleware', 'HTTP handlers, route groups, middleware chain', 'learning', 5),
(1, 'Request/Response handling', 'JSON binding, validation, response formatting', 'learning', 6),
(1, 'Build REST API endpoints', 'CRUD operations with Gin', 'exercise', 7),

-- Day 5: GORM & PostgreSQL
(1, 'GORM models and migrations', 'Define models, run migrations', 'learning', 8),
(1, 'CRUD operations with GORM', 'Create, Read, Update, Delete patterns', 'learning', 9),
(1, 'Relationships and transactions', 'One-to-many, many-to-many, transactions', 'learning', 10),
(1, 'PostgreSQL with Docker', 'Setup and connect PostgreSQL', 'exercise', 11),

-- Day 6-7: Redis
(1, 'Redis fundamentals', 'Data structures, commands, use cases', 'learning', 12),
(1, 'Caching strategies', 'Cache-aside, write-through patterns', 'learning', 13),
(1, 'Session management with Redis', 'Implement session storage', 'exercise', 14),
(1, 'Build user management API', 'Mini project combining all technologies', 'project', 15);

-- Week 2 Tasks
INSERT INTO tasks (week_id, title, description, category, order_index) VALUES
-- Day 1-2: Concurrency
(2, 'Goroutines and channels', 'Concurrent programming fundamentals', 'learning', 1),
(2, 'Select statements and patterns', 'Channel multiplexing, timeouts', 'learning', 2),
(2, 'sync package', 'Mutexes, WaitGroups, atomic operations', 'learning', 3),
(2, 'Build concurrent web scraper', 'Practice goroutines and channels', 'exercise', 4),

-- Day 3-4: Clean Architecture
(2, 'Clean architecture principles', 'Layers, dependency inversion', 'learning', 5),
(2, 'Repository pattern', 'Database abstraction layer', 'learning', 6),
(2, 'Service layer implementation', 'Business logic separation', 'learning', 7),
(2, 'Refactor Week 1 project', 'Apply clean architecture patterns', 'exercise', 8),

-- Day 5-6: Testing
(2, 'Unit testing with testify', 'Writing effective unit tests', 'learning', 9),
(2, 'Mocking and test doubles', 'Isolating dependencies in tests', 'learning', 10),
(2, 'Integration testing', 'Testing with real database', 'learning', 11),
(2, 'Achieve 80% code coverage', 'Write comprehensive tests', 'exercise', 12),

-- Day 7: Docker
(2, 'Docker fundamentals', 'Images, containers, volumes', 'learning', 13),
(2, 'Multi-stage builds', 'Optimize Go Docker images', 'learning', 14),
(2, 'Docker Compose', 'Multi-container applications', 'learning', 15),
(2, 'Containerize Week 1 project', 'Create production-ready Docker setup', 'project', 16);

-- Week 3 Tasks
INSERT INTO tasks (week_id, title, description, category, order_index) VALUES
-- Day 1-2: Distributed Systems
(3, 'CAP theorem and trade-offs', 'Consistency, Availability, Partition tolerance', 'learning', 1),
(3, 'Distributed transactions', 'Saga pattern, 2PC', 'learning', 2),
(3, 'Message queues (RabbitMQ)', 'Async communication patterns', 'learning', 3),
(3, 'Implement event-driven system', 'Practice message queue patterns', 'exercise', 4),

-- Day 3-4: Microservices
(3, 'Microservices patterns', 'Service discovery, circuit breaker', 'learning', 5),
(3, 'API Gateway patterns', 'Rate limiting, authentication', 'learning', 6),
(3, 'gRPC fundamentals', 'Protocol buffers, service definitions', 'learning', 7),
(3, 'Build microservices demo', 'Two services communicating via gRPC', 'exercise', 8),

-- Day 5-6: Security
(3, 'OWASP Top 10', 'Common vulnerabilities and prevention', 'learning', 9),
(3, 'JWT authentication', 'Token-based auth implementation', 'learning', 10),
(3, 'Input validation and sanitization', 'Preventing injection attacks', 'learning', 11),
(3, 'Secure coding practices', 'Code review for security', 'learning', 12),
(3, 'Security audit practice', 'Find and fix vulnerabilities', 'exercise', 13),

-- Day 7: Review
(3, 'Week 3 comprehensive review', 'System design documentation', 'project', 14);

-- Week 4 Tasks
INSERT INTO tasks (week_id, title, description, category, order_index) VALUES
-- Day 1-2: Payment Processing
(4, 'Payment flow fundamentals', 'Authorization, capture, settlement', 'learning', 1),
(4, 'Card network basics', 'Visa, Mastercard processing', 'learning', 2),
(4, 'Idempotency in payments', 'Preventing duplicate transactions', 'learning', 3),
(4, 'Payment gateway simulation', 'Implement basic payment flow', 'exercise', 4),

-- Day 3-4: Compliance
(4, 'PCI-DSS requirements', 'Data security standards', 'learning', 5),
(4, 'Data encryption at rest/transit', 'Encryption implementation', 'learning', 6),
(4, 'Audit logging', 'Compliance-ready logging', 'learning', 7),
(4, 'Implement secure data handling', 'Apply PCI-DSS principles', 'exercise', 8),

-- Day 5-7: Real Projects
(4, 'Transaction reconciliation', 'Matching and balancing transactions', 'learning', 9),
(4, 'Webhook handling', 'Reliable webhook processing', 'learning', 10),
(4, 'Error handling in payments', 'Graceful degradation strategies', 'learning', 11),
(4, 'Build payment processor module', 'End-to-end payment processing', 'project', 12);

-- Week 5 Tasks (Capstone Development)
INSERT INTO tasks (week_id, title, description, category, order_index) VALUES
(5, 'Project planning and architecture', 'Design the payment gateway system', 'project', 1),
(5, 'Database schema design', 'Create comprehensive data model', 'project', 2),
(5, 'Core API implementation', 'Build main endpoints', 'project', 3),
(5, 'Payment processing logic', 'Implement transaction handling', 'project', 4),
(5, 'Redis caching layer', 'Add caching for performance', 'project', 5),
(5, 'Message queue integration', 'Async processing for webhooks', 'project', 6),
(5, 'Security implementation', 'Auth, encryption, validation', 'project', 7),
(5, 'Daily progress check-in', 'Track development progress', 'exercise', 8);

-- Week 6 Tasks (Capstone Finalization)
INSERT INTO tasks (week_id, title, description, category, order_index) VALUES
(6, 'Complete unit tests', 'Achieve 80%+ coverage', 'project', 1),
(6, 'Integration tests', 'End-to-end test scenarios', 'project', 2),
(6, 'Performance testing', 'Load testing and optimization', 'project', 3),
(6, 'API documentation', 'OpenAPI/Swagger docs', 'project', 4),
(6, 'README and setup guide', 'Project documentation', 'project', 5),
(6, 'Code review preparation', 'Clean up and refactor', 'project', 6),
(6, 'Presentation preparation', 'Create demo slides', 'project', 7),
(6, 'Final presentation', 'Present to team leads', 'project', 8);
