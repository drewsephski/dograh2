"""
Workflow normalization service for ensuring AI-generated workflows conform to expected schema.

This module provides functions to validate and normalize workflow definitions,
ensuring all required fields are present and have sensible defaults.
"""

from typing import List, Tuple
from loguru import logger


def normalize_workflow_definition(workflow_def: dict) -> dict:
    """
    Main normalization function for workflow definitions.
    
    Args:
        workflow_def: The workflow definition to normalize
        
    Returns:
        Normalized workflow definition
    """
    if not workflow_def:
        workflow_def = {}
    
    # Ensure viewport exists with default
    if "viewport" not in workflow_def:
        workflow_def["viewport"] = {"x": 0, "y": 0, "zoom": 1}
    
    # Normalize nodes
    if "nodes" in workflow_def and workflow_def["nodes"]:
        workflow_def["nodes"] = [normalize_node(node) for node in workflow_def["nodes"]]
    else:
        workflow_def["nodes"] = []
    
    # Normalize edges
    if "edges" in workflow_def and workflow_def["edges"]:
        workflow_def["edges"] = [normalize_edge(edge) for edge in workflow_def["edges"]]
    else:
        workflow_def["edges"] = []
    
    return workflow_def


def normalize_node(node: dict) -> dict:
    """
    Normalize a single node to ensure all required fields are present.
    
    Args:
        node: The node to normalize
        
    Returns:
        Normalized node
    """
    if not node:
        return {}
    
    # Ensure data object exists
    if "data" not in node or not node["data"]:
        node["data"] = {}
    
    data = node["data"]
    
    # Set default allow_interrupt based on node type
    if "allow_interrupt" not in data:
        node_type = node.get("type", "")
        data["allow_interrupt"] = get_default_allow_interrupt(node_type)
    
    # Set validation defaults
    if "invalid" not in data:
        data["invalid"] = False
    if "validationMessage" not in data:
        data["validationMessage"] = None
    
    # Set node type flags
    node_type = node.get("type", "")
    if node_type == "startCall":
        data["is_start"] = True
        data["is_end"] = False
        data["is_static"] = False
    elif node_type == "endCall":
        data["is_start"] = False
        data["is_end"] = True
        data["is_static"] = False
    elif node_type == "trigger":
        data["is_start"] = True
        data["is_end"] = False
        data["is_static"] = False
    elif node_type == "webhook":
        data["is_start"] = False
        data["is_end"] = False
        data["is_static"] = False
    else:
        # Default for agent nodes and others
        data["is_start"] = False
        data["is_end"] = False
        data["is_static"] = False
    
    # Set ReactFlow specific defaults
    if "measured" not in node:
        node["measured"] = {"width": 200, "height": 100}
    if "selected" not in node:
        node["selected"] = False
    if "dragging" not in node:
        node["dragging"] = False
    
    # Set default values for common fields
    if "extraction_enabled" not in data:
        data["extraction_enabled"] = False
    if "add_global_prompt" not in data:
        data["add_global_prompt"] = True
    if "wait_for_user_response" not in data:
        data["wait_for_user_response"] = False
    if "detect_voicemail" not in data:
        data["detect_voicemail"] = False
    if "delayed_start" not in data:
        data["delayed_start"] = False
    
    # Webhook-specific defaults
    if node_type == "webhook":
        if "enabled" not in data:
            data["enabled"] = True
        if "http_method" not in data:
            data["http_method"] = "POST"
        if "custom_headers" not in data:
            data["custom_headers"] = []
        if "retry_config" not in data:
            data["retry_config"] = {"enabled": False, "max_retries": 3, "retry_delay_seconds": 5}
    
    return node


def normalize_edge(edge: dict) -> dict:
    """
    Normalize a single edge to ensure all required fields are present.
    
    Args:
        edge: The edge to normalize
        
    Returns:
        Normalized edge
    """
    if not edge:
        return {}
    
    # Ensure data object exists
    if "data" not in edge or not edge["data"]:
        edge["data"] = {}
    
    data = edge["data"]
    
    # Set required data fields
    if "label" not in data:
        data["label"] = ""
    if "condition" not in data:
        data["condition"] = ""
    
    # Set validation defaults
    if "invalid" not in data:
        data["invalid"] = False
    if "validationMessage" not in data:
        data["validationMessage"] = None
    
    # Set ReactFlow specific defaults
    if "animated" not in edge:
        edge["animated"] = True
    if "type" not in edge:
        edge["type"] = "custom"
    if "selected" not in edge:
        edge["selected"] = False
    
    return edge


def validate_workflow_structure(workflow_def: dict) -> Tuple[bool, List[str]]:
    """
    Validate the structure of a workflow definition.
    
    Args:
        workflow_def: The workflow definition to validate
        
    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []
    
    # Check that nodes is a non-empty array
    if "nodes" not in workflow_def:
        errors.append("Workflow must have a 'nodes' array")
    elif not isinstance(workflow_def["nodes"], list):
        errors.append("'nodes' must be an array")
    elif len(workflow_def["nodes"]) == 0:
        errors.append("Workflow must have at least one node")
    
    # Check that edges is an array
    if "edges" not in workflow_def:
        errors.append("Workflow must have an 'edges' array")
    elif not isinstance(workflow_def["edges"], list):
        errors.append("'edges' must be an array")
    
    # Check for at least one start node
    if "nodes" in workflow_def and isinstance(workflow_def["nodes"], list):
        start_nodes = [node for node in workflow_def["nodes"] 
                      if node.get("data", {}).get("is_start", False)]
        if not start_nodes:
            errors.append("Workflow must have at least one start node")
    
    # Check for at least one end node
    if "nodes" in workflow_def and isinstance(workflow_def["nodes"], list):
        end_nodes = [node for node in workflow_def["nodes"] 
                    if node.get("data", {}).get("is_end", False)]
        if not end_nodes:
            errors.append("Workflow must have at least one end node")
    
    return len(errors) == 0, errors


def get_default_allow_interrupt(node_type: str) -> bool:
    """
    Get the default allow_interrupt value for a node type.
    
    Args:
        node_type: The type of node
        
    Returns:
        Default allow_interrupt value
    """
    switch_type_mapping = {
        "agentNode": True,    # Agents can be interrupted
        "startCall": False,   # Start messages should not be interrupted
        "endCall": False,     # End messages should not be interrupted
        "trigger": False,     # Trigger nodes should not be interrupted
        "webhook": False,     # Webhook nodes should not be interrupted
        "globalNode": False,  # Global nodes should not be interrupted
    }
    
    return switch_type_mapping.get(node_type, False)


def validate_and_normalize_workflow_definition(workflow_def: dict) -> Tuple[dict, List[str]]:
    """
    Validate and normalize a workflow definition.
    
    Args:
        workflow_def: The workflow definition to validate and normalize
        
    Returns:
        Tuple of (normalized_workflow_def, error_messages)
    """
    errors = []
    
    # First validate the structure
    is_valid, validation_errors = validate_workflow_structure(workflow_def)
    if not is_valid:
        errors.extend(validation_errors)
    
    # Then normalize the workflow
    normalized_def = normalize_workflow_definition(workflow_def)
    
    # Log any normalization changes
    if workflow_def != normalized_def:
        logger.info("Workflow definition was normalized")
        logger.debug(f"Original: {workflow_def}")
        logger.debug(f"Normalized: {normalized_def}")
    
    return normalized_def, errors
