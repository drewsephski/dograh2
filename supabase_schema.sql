-- Basic Dograh Schema for Supabase
-- Run this in Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization-Users association
CREATE TABLE IF NOT EXISTS organization_users (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, organization_id)
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id INTEGER REFERENCES organizations(id),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow runs table
CREATE TABLE IF NOT EXISTS workflow_runs (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_workflows_organization_id ON workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON api_keys(organization_id);