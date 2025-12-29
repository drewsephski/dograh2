# Workflow Creation API Documentation

## Overview

The Dograh platform provides an AI-powered workflow creation system that allows users to generate voice agent workflows from natural language descriptions. This document describes the workflow creation process, API endpoints, data structures, and error handling.

## Architecture

The workflow creation pipeline consists of several components:

1. **Frontend Form** - Collects user input (call type, use case, activity description)
2. **MPS API Integration** - AI service that generates workflow definitions
3. **Normalization Service** - Validates and normalizes AI-generated workflows
4. **Backend API** - Stores workflows and handles validation
5. **Database** - Persists workflow definitions and metadata

## API Endpoints

### Create Workflow from Template

**POST** `/api/v1/workflow/create/template`

Creates a new workflow using AI generation from natural language description.

#### Request Body

```json
{
  "call_type": "INBOUND" | "OUTBOUND",
  "use_case": "string",
  "activity_description": "string"
}
```

#### Response

```json
{
  "id": 1,
  "name": "Generated Workflow Name",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "workflow_definition": {
    "nodes": [...],
    "edges": [...],
    "viewport": {...}
  },
  "current_definition_id": 1,
  "template_context_variables": {},
  "call_disposition_codes": {},
  "workflow_configurations": {}
}
```

### Create Manual Workflow

**POST** `/api/v1/workflow/create/definition`

Creates a workflow from a pre-defined workflow definition.

#### Request Body

```json
{
  "name": "string",
  "workflow_definition": {
    "nodes": [...],
    "edges": [...]
  }
}
```

## Workflow Definition Structure

### Required Fields

A valid workflow definition must contain:

- **nodes**: Array of node objects (at least one)
- **edges**: Array of edge objects (can be empty)
- **viewport**: Viewport configuration with x, y, zoom

### Node Structure

```json
{
  "id": "string",
  "type": "startCall" | "endCall" | "agentNode" | "trigger" | "webhook" | "globalNode",
  "position": {
    "x": 0,
    "y": 0
  },
  "data": {
    // Required fields
    "name": "string",
    "prompt": "string", // Optional for trigger/webhook nodes
    
    // Validation fields
    "invalid": false,
    "validationMessage": null,
    
    // Node type flags
    "is_start": false,
    "is_end": false,
    "is_static": false,
    
    // Behavior fields
    "allow_interrupt": true,
    "extraction_enabled": false,
    "add_global_prompt": true,
    
    // Optional fields with defaults
    "wait_for_user_response": false,
    "wait_for_user_response_timeout": null,
    "detect_voicemail": false,
    "delayed_start": false,
    "delayed_start_duration": null,
    
    // Webhook-specific fields
    "enabled": true,
    "http_method": "POST",
    "endpoint_url": null,
    "credential_uuid": null,
    "custom_headers": [],
    "payload_template": {},
    "retry_config": {
      "enabled": false,
      "max_retries": 3,
      "retry_delay_seconds": 5
    }
  }
}
```

### Edge Structure

```json
{
  "id": "string",
  "source": "string",
  "target": "string",
  "data": {
    "label": "string",
    "condition": "string",
    "invalid": false,
    "validationMessage": null
  },
  "animated": true,
  "type": "custom",
  "selected": false
}
```

## Normalization Process

The normalization service ensures AI-generated workflows conform to the expected schema:

### Node Normalization

1. **Data Object**: Ensures `data` object exists with required fields
2. **Default Values**: Sets sensible defaults for missing optional fields
3. **Type-specific Logic**: Applies node type specific defaults
4. **Validation Fields**: Adds `invalid` and `validationMessage` fields

### Edge Normalization

1. **Data Object**: Ensures `data` object exists with required fields
2. **Required Fields**: Sets default `label` and `condition` values
3. **ReactFlow Fields**: Adds `animated`, `type`, and `selected` fields

### Structure Validation

Validates that:
- Workflow has at least one node
- Workflow has at least one start node
- Workflow has at least one end node
- All required fields are present

## Error Handling

### Error Codes

| Status Code | Description | User Message |
|-------------|-------------|--------------|
| 400 | Invalid request data | "Invalid request. Please check your input and try again." |
| 401 | Authentication required | "You are not authorized. Please log in again." |
| 403 | Permission denied | "You don't have permission to create workflows." |
| 429 | Rate limit exceeded | "Too many requests. Please wait a moment and try again." |
| 500 | Server error | "Server error. Please try again later." |
| 503 | Service unavailable | "AI service is temporarily unavailable. Please try again." |
| 504 | Timeout | "AI workflow generation timed out. Please try again." |

### Error Response Format

```json
{
  "detail": "User-friendly error message"
}
```

## Frontend Integration

### Form Validation

The frontend implements real-time validation:

- **Use Case**: Minimum 3 characters, required
- **Activity Description**: Minimum 10 characters, required
- **Character Limits**: Use case (50 chars), Activity description (500 chars)
- **Inline Errors**: Show validation errors as user types

### Loading States

Progressive loading with stages:
1. "Analyzing your requirements..." (0-2s)
2. "Generating workflow structure..." (2-5s)
3. "Creating agent nodes..." (5-8s)
4. "Finalizing your workflow..." (8s+)

### Error Handling

- **Specific Messages**: Different messages for different error types
- **Retry Functionality**: Retry button for transient errors
- **Timeout Handling**: Warning after 15s, failure after 30s

## Examples

### Valid Minimal Workflow

```json
{
  "nodes": [
    {
      "id": "start-1",
      "type": "startCall",
      "position": {"x": 100, "y": 100},
      "data": {
        "name": "Start Call",
        "prompt": "Hello, how can I help you today?",
        "is_start": true
      }
    },
    {
      "id": "end-1", 
      "type": "endCall",
      "position": {"x": 300, "y": 100},
      "data": {
        "name": "End Call",
        "prompt": "Thank you for calling. Goodbye!",
        "is_end": true
      }
    }
  ],
  "edges": [
    {
      "id": "start-to-end",
      "source": "start-1",
      "target": "end-1",
      "data": {
        "label": "Continue",
        "condition": "always"
      }
    }
  ],
  "viewport": {"x": 0, "y": 0, "zoom": 1}
}
```

### Complete Workflow with All Fields

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": {"x": 100, "y": 100},
      "data": {
        "name": "Phone Call Trigger",
        "trigger_path": "550e8400-e29b-41d4-a716-446655440000",
        "is_start": true,
        "is_end": false,
        "is_static": false,
        "allow_interrupt": false,
        "invalid": false,
        "validationMessage": null,
        "extraction_enabled": false,
        "add_global_prompt": true
      }
    },
    {
      "id": "agent-1",
      "type": "agentNode", 
      "position": {"x": 300, "y": 100},
      "data": {
        "name": "Main Agent",
        "prompt": "You are a helpful assistant for customer service.",
        "is_start": false,
        "is_end": false,
        "is_static": false,
        "allow_interrupt": true,
        "invalid": false,
        "validationMessage": null,
        "extraction_enabled": true,
        "extraction_prompt": "Extract customer information",
        "extraction_variables": [
          {
            "name": "customer_name",
            "type": "string",
            "prompt": "Extract the customer's name"
          }
        ],
        "add_global_prompt": true,
        "wait_for_user_response": true,
        "wait_for_user_response_timeout": 30.0
      }
    }
  ],
  "edges": [
    {
      "id": "trigger-to-agent",
      "source": "trigger-1",
      "target": "agent-1",
      "data": {
        "label": "Start Conversation",
        "condition": "call_started",
        "invalid": false,
        "validationMessage": null
      },
      "animated": true,
      "type": "custom",
      "selected": false
    }
  ],
  "viewport": {"x": 0, "y": 0, "zoom": 1}
}
```

## Troubleshooting

### Common Issues

1. **"Generated workflow structure is invalid"**
   - Check that the workflow has at least one start and end node
   - Verify all nodes have required fields
   - Ensure node IDs are unique

2. **"AI service is temporarily unavailable"**
   - Check MPS API service status
   - Verify API keys and credentials
   - Check network connectivity

3. **"Workflow validation failed"**
   - Review validation error messages
   - Check for missing required fields
   - Verify node and edge connections

### Debugging

Enable debug logging to see detailed information:
- Backend: Check log files for normalization and validation details
- Frontend: Use browser console for client-side errors
- Network: Check API responses in browser dev tools

### Performance Considerations

- Workflow normalization is performed synchronously but is typically fast
- Large workflows (>100 nodes) may take longer to process
- MPS API calls can take 5-15 seconds depending on complexity
- Consider caching for frequently used workflow templates

## Security Notes

- All API endpoints require authentication
- Workflow definitions are validated before storage
- MPS API calls use secure authentication
- User input is sanitized before processing
- Sensitive data in prompts should be handled carefully
