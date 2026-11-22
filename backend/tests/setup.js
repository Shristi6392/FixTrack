process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://fixtrack:fixtrack@localhost:5432/fixtrack_test';
process.env.JWT_SECRET = 'test-secret';
