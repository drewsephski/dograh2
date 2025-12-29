"""
Integration tests for workflow creation pipeline.

Tests cover:
- MPS API response normalization with various edge cases
- Workflow creation with missing optional fields
- Workflow creation with invalid structures
- Error handling for MPS API failures
- Workflow creation with minimal valid data
- Workflow creation with complete data
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from httpx import HTTPStatusError, Response

from api.app import app
from api.services.workflow.normalization import (
    normalize_workflow_definition,
    normalize_node,
    normalize_edge,
    validate_workflow_structure,
    validate_and_normalize_workflow_definition,
    get_default_allow_interrupt
)


class TestWorkflowNormalization:
    """Test workflow normalization functions."""

    def test_normalize_empty_workflow(self):
        """Test normalizing an empty workflow definition."""
        result = normalize_workflow_definition({})
        
        assert result["viewport"] == {"x": 0, "y": 0, "zoom": 1}
        assert result["nodes"] == []
        assert result["edges"] == []

    def test_normalize_workflow_with_existing_data(self):
        """Test normalizing workflow with existing valid data."""
        workflow = {
            "viewport": {"x": 100, "y": 50, "zoom": 0.8},
            "nodes": [
                {
                    "id": "1",
                    "type": "agentNode",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "name": "Test Node",
                        "prompt": "Test prompt",
                        "allow_interrupt": True
                    }
                }
            ],
            "edges": [
                {
                    "id": "e1-2",
                    "source": "1",
                    "target": "2",
                    "data": {
                        "label": "Test Edge",
                        "condition": "always"
                    }
                }
            ]
        }
        
        result = normalize_workflow_definition(workflow)
        
        # Should preserve existing data
        assert result["viewport"] == {"x": 100, "y": 50, "zoom": 0.8}
        assert len(result["nodes"]) == 1
        assert len(result["edges"]) == 1
        assert result["nodes"][0]["data"]["allow_interrupt"] is True

    def test_normalize_node_missing_data(self):
        """Test normalizing a node with missing data object."""
        node = {
            "id": "1",
            "type": "agentNode",
            "position": {"x": 0, "y": 0}
        }
        
        result = normalize_node(node)
        
        assert "data" in result
        assert result["data"]["allow_interrupt"] is True  # Default for agentNode
        assert result["data"]["invalid"] is False
        assert result["data"]["validationMessage"] is None
        assert result["data"]["extraction_enabled"] is False
        assert result["data"]["add_global_prompt"] is True

    def test_normalize_edge_missing_data(self):
        """Test normalizing an edge with missing data object."""
        edge = {
            "id": "e1-2",
            "source": "1",
            "target": "2"
        }
        
        result = normalize_edge(edge)
        
        assert "data" in result
        assert result["data"]["label"] == ""
        assert result["data"]["condition"] == ""
        assert result["data"]["invalid"] is False
        assert result["data"]["validationMessage"] is None
        assert result["animated"] is True
        assert result["type"] == "custom"

    def test_validate_workflow_structure_valid(self):
        """Test validating a valid workflow structure."""
        workflow = {
            "nodes": [
                {
                    "id": "1",
                    "type": "startCall",
                    "data": {"is_start": True}
                },
                {
                    "id": "2", 
                    "type": "endCall",
                    "data": {"is_end": True}
                }
            ],
            "edges": []
        }
        
        is_valid, errors = validate_workflow_structure(workflow)
        
        assert is_valid is True
        assert len(errors) == 0

    def test_validate_workflow_structure_missing_nodes(self):
        """Test validating workflow with missing nodes."""
        workflow = {
            "edges": []
        }
        
        is_valid, errors = validate_workflow_structure(workflow)
        
        assert is_valid is False
        assert any("nodes" in error for error in errors)

    def test_validate_workflow_structure_no_start_node(self):
        """Test validating workflow without start node."""
        workflow = {
            "nodes": [
                {
                    "id": "1",
                    "type": "agentNode",
                    "data": {"is_start": False, "is_end": False}
                }
            ],
            "edges": []
        }
        
        is_valid, errors = validate_workflow_structure(workflow)
        
        assert is_valid is False
        assert any("start node" in error for error in errors)

    def test_validate_and_normalize_workflow(self):
        """Test the combined validate and normalize function."""
        workflow = {
            "nodes": [
                {
                    "id": "1",
                    "type": "agentNode",
                    "position": {"x": 0, "y": 0}
                    # Missing data object
                }
            ],
            "edges": []
        }
        
        normalized_workflow, errors = validate_and_normalize_workflow_definition(workflow)
        
        # Should have normalized the node
        assert "data" in normalized_workflow["nodes"][0]
        assert normalized_workflow["nodes"][0]["data"]["allow_interrupt"] is True
        
        # Should have validation error for missing start node
        assert len(errors) > 0
        assert any("start node" in error for error in errors)

    def test_get_default_allow_interrupt(self):
        """Test getting default allow_interrupt values."""
        assert get_default_allow_interrupt("agentNode") is True
        assert get_default_allow_interrupt("startCall") is False
        assert get_default_allow_interrupt("endCall") is False
        assert get_default_allow_interrupt("trigger") is False
        assert get_default_allow_interrupt("webhook") is False
        assert get_default_allow_interrupt("unknown") is False


class TestWorkflowCreationAPI:
    """Test workflow creation API endpoints."""

    def setup_method(self):
        """Set up test client."""
        self.client = TestClient(app)

    @patch('api.routes.workflow.mps_service_key_client.call_workflow_api')
    @patch('api.routes.workflow.db_client.create_workflow')
    @patch('api.routes.workflow.db_client.sync_triggers_for_workflow')
    def test_create_workflow_from_template_success(self, mock_sync, mock_create, mock_mps):
        """Test successful workflow creation from template."""
        # Mock MPS API response
        mock_mps.return_value = {
            "name": "Test Workflow",
            "workflow_definition": {
                "nodes": [
                    {
                        "id": "1",
                        "type": "startCall",
                        "position": {"x": 0, "y": 0},
                        "data": {"name": "Start", "is_start": True}
                    }
                ],
                "edges": []
            }
        }
        
        # Mock database creation
        mock_workflow = AsyncMock()
        mock_workflow.id = 1
        mock_workflow.name = "Test Workflow"
        mock_workflow.status = "active"
        mock_workflow.created_at = "2024-01-01T00:00:00"
        mock_workflow.workflow_definition_with_fallback = {}
        mock_workflow.current_definition_id = None
        mock_workflow.template_context_variables = None
        mock_workflow.call_disposition_codes = None
        mock_workflow.workflow_configurations = None
        mock_create.return_value = mock_workflow

        response = self.client.post("/api/v1/workflow/create/template", json={
            "call_type": "INBOUND",
            "use_case": "Test Use Case",
            "activity_description": "Test activity description"
        }, headers={"Authorization": "Bearer test_token"})

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Workflow"
        assert data["id"] == 1

    @patch('api.routes.workflow.mps_service_key_client.call_workflow_api')
    def test_create_workflow_from_template_mps_error(self, mock_mps):
        """Test workflow creation when MPS API fails."""
        # Mock MPS API error
        mock_mps.side_effect = HTTPStatusError("MPS API Error", response=Response(500, text="Internal Server Error"))

        response = self.client.post("/api/v1/workflow/create/template", json={
            "call_type": "INBOUND",
            "use_case": "Test Use Case", 
            "activity_description": "Test activity description"
        }, headers={"Authorization": "Bearer test_token"})

        assert response.status_code == 500
        assert "MPS API is unavailable" in response.json()["detail"]

    @patch('api.routes.workflow.mps_service_key_client.call_workflow_api')
    def test_create_workflow_from_template_empty_response(self, mock_mps):
        """Test workflow creation when MPS returns empty response."""
        mock_mps.return_value = None

        response = self.client.post("/api/v1/workflow/create/template", json={
            "call_type": "INBOUND",
            "use_case": "Test Use Case",
            "activity_description": "Test activity description"
        }, headers={"Authorization": "Bearer test_token"})

        assert response.status_code == 500
        assert "empty response" in response.json()["detail"]

    @patch('api.routes.workflow.mps_service_key_client.call_workflow_api')
    def test_create_workflow_from_template_missing_workflow_definition(self, mock_mps):
        """Test workflow creation when MPS response lacks workflow_definition."""
        mock_mps.return_value = {"name": "Test Workflow"}

        response = self.client.post("/api/v1/workflow/create/template", json={
            "call_type": "INBOUND",
            "use_case": "Test Use Case",
            "activity_description": "Test activity description"
        }, headers={"Authorization": "Bearer test_token"})

        assert response.status_code == 500
        assert "workflow_definition" in response.json()["detail"]

    @patch('api.routes.workflow.db_client.create_workflow')
    def test_create_workflow_manual_success(self, mock_create):
        """Test successful manual workflow creation."""
        mock_workflow = AsyncMock()
        mock_workflow.id = 1
        mock_workflow.name = "Manual Workflow"
        mock_workflow.status = "active"
        mock_workflow.created_at = "2024-01-01T00:00:00"
        mock_workflow.workflow_definition_with_fallback = {}
        mock_workflow.current_definition_id = None
        mock_workflow.template_context_variables = None
        mock_workflow.call_disposition_codes = None
        mock_workflow.workflow_configurations = None
        mock_create.return_value = mock_workflow

        response = self.client.post("/api/v1/workflow/create/definition", json={
            "name": "Manual Workflow",
            "workflow_definition": {
                "nodes": [
                    {
                        "id": "1",
                        "type": "startCall",
                        "position": {"x": 0, "y": 0},
                        "data": {"name": "Start", "is_start": True}
                    }
                ],
                "edges": []
            }
        }, headers={"Authorization": "Bearer test_token"})

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Manual Workflow"
        assert data["id"] == 1


class TestWorkflowCreationEdgeCases:
    """Test edge cases in workflow creation."""

    def test_normalize_webhook_node(self):
        """Test normalizing a webhook node with specific fields."""
        node = {
            "id": "webhook1",
            "type": "webhook",
            "position": {"x": 0, "y": 0}
        }
        
        result = normalize_node(node)
        
        assert result["data"]["enabled"] is True
        assert result["data"]["http_method"] == "POST"
        assert result["data"]["custom_headers"] == []
        assert result["data"]["retry_config"]["enabled"] is False
        assert result["data"]["retry_config"]["max_retries"] == 3
        assert result["data"]["retry_config"]["retry_delay_seconds"] == 5

    def test_normalize_trigger_node(self):
        """Test normalizing a trigger node."""
        node = {
            "id": "trigger1",
            "type": "trigger",
            "position": {"x": 0, "y": 0}
        }
        
        result = normalize_node(node)
        
        assert result["data"]["is_start"] is True
        assert result["data"]["is_end"] is False
        assert result["data"]["allow_interrupt"] is False
        assert "trigger_path" in result["data"]

    def test_normalize_minimal_valid_workflow(self):
        """Test normalizing a workflow with minimal valid data."""
        workflow = {
            "nodes": [
                {
                    "id": "1",
                    "type": "startCall",
                    "position": {"x": 0, "y": 0}
                },
                {
                    "id": "2",
                    "type": "endCall", 
                    "position": {"x": 100, "y": 0}
                }
            ],
            "edges": [
                {
                    "id": "e1-2",
                    "source": "1",
                    "target": "2"
                }
            ]
        }
        
        result = normalize_workflow_definition(workflow)
        
        assert len(result["nodes"]) == 2
        assert len(result["edges"]) == 1
        assert result["nodes"][0]["data"]["is_start"] is True
        assert result["nodes"][1]["data"]["is_end"] is True
        assert result["edges"][0]["data"]["label"] == ""
        assert result["edges"][0]["data"]["condition"] == ""

    def test_normalize_complete_workflow(self):
        """Test normalizing a workflow with complete data."""
        workflow = {
            "viewport": {"x": 50, "y": 25, "zoom": 1.2},
            "nodes": [
                {
                    "id": "1",
                    "type": "agentNode",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "name": "Complete Node",
                        "prompt": "Complete prompt",
                        "allow_interrupt": True,
                        "invalid": False,
                        "validationMessage": None,
                        "extraction_enabled": True,
                        "add_global_prompt": False
                    }
                }
            ],
            "edges": [
                {
                    "id": "e1-2",
                    "source": "1",
                    "target": "2",
                    "data": {
                        "label": "Complete Edge",
                        "condition": "always",
                        "invalid": False,
                        "validationMessage": None
                    }
                }
            ]
        }
        
        result = normalize_workflow_definition(workflow)
        
        # Should preserve all existing data
        assert result["viewport"] == {"x": 50, "y": 25, "zoom": 1.2}
        assert result["nodes"][0]["data"]["name"] == "Complete Node"
        assert result["nodes"][0]["data"]["allow_interrupt"] is True
        assert result["edges"][0]["data"]["label"] == "Complete Edge"
        assert result["edges"][0]["data"]["condition"] == "always"


if __name__ == "__main__":
    pytest.main([__file__])
