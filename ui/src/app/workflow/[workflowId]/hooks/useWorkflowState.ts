import {
  applyEdgeChanges,
  applyNodeChanges,
  EdgeChange,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowInstance,
} from "@xyflow/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useWorkflowStore } from "@/app/workflow/[workflowId]/stores/workflowStore";
import {
  createWorkflowRunApiV1WorkflowWorkflowIdRunsPost,
  updateWorkflowApiV1WorkflowWorkflowIdPut,
  validateWorkflowApiV1WorkflowWorkflowIdValidatePost,
} from "@/client";
import { WorkflowError } from "@/client/types.gen";
import { FlowEdge, FlowNode, NodeType } from "@/components/flow/types";
import logger from "@/lib/logger";
import { getNextNodeId, getRandomId } from "@/lib/utils";
import { WorkflowConfigurations } from "@/types/workflow-configurations";

export function getDefaultAllowInterrupt(
  type: string = NodeType.START_CALL
): boolean {
  switch (type) {
    case NodeType.AGENT_NODE:
      return true; // Agents can be interrupted
    case NodeType.START_CALL:
    case NodeType.END_CALL:
      return false; // Start/End messages should not be interrupted
    default:
      return false;
  }
}

const normalizeWorkflowData = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const normalizedNodes = nodes.map((node) => {
    const normalizedNode = { ...node };
    
    // Ensure data object exists with required properties
    if (!normalizedNode.data) {
      normalizedNode.data = {
        prompt: "",
        name: "",
        allow_interrupt: getDefaultAllowInterrupt(node.type),
        invalid: false,
        validationMessage: null,
        extraction_enabled: false,
        add_global_prompt: true,
      };
    } else {
      // Set default allow_interrupt based on node type
      if (normalizedNode.data.allow_interrupt === undefined) {
        normalizedNode.data.allow_interrupt = getDefaultAllowInterrupt(node.type);
      }

      // Ensure required properties exist
      if (normalizedNode.data.prompt === undefined) {
        normalizedNode.data.prompt = "";
      }
      if (normalizedNode.data.name === undefined) {
        normalizedNode.data.name = "";
      }

      // Set validation defaults
      if (normalizedNode.data.invalid === undefined) {
        normalizedNode.data.invalid = false;
      }
      if (normalizedNode.data.validationMessage === undefined) {
        normalizedNode.data.validationMessage = null;
      }

      // Set other common defaults
      if (normalizedNode.data.extraction_enabled === undefined) {
        normalizedNode.data.extraction_enabled = false;
      }
      if (normalizedNode.data.add_global_prompt === undefined) {
        normalizedNode.data.add_global_prompt = true;
      }
    }

    // Log warnings for any missing fields that were normalized
    const missingFields = [];
    if (node.data.allow_interrupt === undefined) missingFields.push('allow_interrupt');
    if (node.data.invalid === undefined) missingFields.push('invalid');
    if (node.data.validationMessage === undefined) missingFields.push('validationMessage');
    if (node.data.extraction_enabled === undefined) missingFields.push('extraction_enabled');
    if (node.data.add_global_prompt === undefined) missingFields.push('add_global_prompt');

    if (missingFields.length > 0) {
      logger.warn(`Node ${node.id} was missing fields: ${missingFields.join(', ')}`);
    }

    return normalizedNode;
  });

  const normalizedEdges = edges.map((edge) => {
    const normalizedEdge = { ...edge };
    
    // Ensure data object exists with required properties
    if (!normalizedEdge.data) {
      normalizedEdge.data = {
        label: "",
        condition: "",
        invalid: false,
        validationMessage: null,
      };
    } else {
      // Set required data fields
      if (normalizedEdge.data.label === undefined) {
        normalizedEdge.data.label = "";
      }
      if (normalizedEdge.data.condition === undefined) {
        normalizedEdge.data.condition = "";
      }

      // Set validation defaults
      if (normalizedEdge.data.invalid === undefined) {
        normalizedEdge.data.invalid = false;
      }
      if (normalizedEdge.data.validationMessage === undefined) {
        normalizedEdge.data.validationMessage = null;
      }
    }

    return normalizedEdge;
  });

  return { normalizedNodes, normalizedEdges };
};

const defaultNodes: FlowNode[] = [
  {
    id: "1",
    type: NodeType.START_CALL,
    position: { x: 200, y: 200 },
    data: {
      prompt: "",
      name: "",
      allow_interrupt: getDefaultAllowInterrupt(NodeType.START_CALL),
    },
  },
];

const getNewNode = (
  type: string,
  position: { x: number; y: number },
  existingNodes: FlowNode[]
) => {
  // Base node configuration
  const baseNode = {
    id: getNextNodeId(existingNodes),
    type,
    position,
    data: {
      prompt:
        {
          [NodeType.GLOBAL_NODE]:
            "You are a helpful assistant whose mode of interaction with the user is voice. So don't use any special characters which can not be pronounced. Use short sentences and simple language.",
        }[type] || "",
      name:
        {
          [NodeType.GLOBAL_NODE]: "Global Node",
          [NodeType.START_CALL]: "Start Call",
          [NodeType.END_CALL]: "End Call",
          [NodeType.WEBHOOK]: "Webhook",
        }[type] || "",
      allow_interrupt: getDefaultAllowInterrupt(type),
    },
  };

  // Add webhook-specific defaults
  if (type === NodeType.WEBHOOK) {
    return {
      ...baseNode,
      data: {
        ...baseNode.data,
        enabled: true,
        http_method: "POST" as const,
        endpoint_url: "",
        custom_headers: [],
        payload_template: {
          call_id: "{{workflow_run_id}}",
          first_name: "{{initial_context.first_name}}",
          rsvp: "{{gathered_context.rsvp}}",
          duration: "{{cost_info.call_duration_seconds}}",
          recording_url: "{{recording_url}}",
          transcript_url: "{{transcript_url}}",
        },
      },
    };
  }

  return baseNode;
};

interface UseWorkflowStateProps {
  initialWorkflowName: string;
  workflowId: number;
  initialFlow?: {
    nodes: FlowNode[];
    edges: FlowEdge[];
    viewport: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  initialTemplateContextVariables?: Record<string, string>;
  initialWorkflowConfigurations?: WorkflowConfigurations;
  user: { id: string; email?: string }; // Minimal user type needed
  getAccessToken: () => Promise<string>;
}

export const useWorkflowState = ({
  initialWorkflowName,
  workflowId,
  initialFlow,
  initialTemplateContextVariables,
  initialWorkflowConfigurations,
  user,
  getAccessToken,
}: UseWorkflowStateProps) => {
  const router = useRouter();
  const rfInstance = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

  // Get state and actions from the store
  const {
    nodes,
    edges,
    workflowName,
    isDirty,
    isAddNodePanelOpen,
    workflowValidationErrors,
    templateContextVariables,
    workflowConfigurations,
    initializeWorkflow,
    setNodes,
    setEdges,
    setWorkflowName,
    setIsDirty,
    setIsAddNodePanelOpen,
    setWorkflowValidationErrors,
    setTemplateContextVariables,
    setWorkflowConfigurations,
    clearValidationErrors,
    markNodeAsInvalid,
    markEdgeAsInvalid,
    setRfInstance,
  } = useWorkflowStore();

  // Get undo/redo functions from the store
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const canUndo = useWorkflowStore((state) => state.canUndo());
  const canRedo = useWorkflowStore((state) => state.canRedo());

  // Initialize workflow on mount
  useEffect(() => {
    let initialNodes = defaultNodes;
    let initialEdges: FlowEdge[] = [];

    if (initialFlow?.nodes?.length) {
      const { normalizedNodes, normalizedEdges } = normalizeWorkflowData(
        initialFlow.nodes,
        initialFlow.edges || []
      );
      initialNodes = normalizedNodes;
      initialEdges = normalizedEdges;
    }

    initializeWorkflow(
      workflowId,
      initialWorkflowName,
      initialNodes,
      initialEdges,
      initialTemplateContextVariables,
      initialWorkflowConfigurations
    );
  }, [
    workflowId,
    initialWorkflowName,
    initialFlow?.nodes,
    initialFlow?.edges,
    initialTemplateContextVariables,
    initialWorkflowConfigurations,
    initializeWorkflow,
  ]);

  // Set up keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      }
      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") ||
        ((e.metaKey || e.ctrlKey) && e.key === "y")
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const handleNodeSelect = useCallback(
    (nodeType: string) => {
      if (!rfInstance.current) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode = {
        ...getNewNode(nodeType, position, nodes),
        selected: true, // Mark the new node as selected
      };

      // Use addNodes from ReactFlow instance
      rfInstance.current.addNodes([newNode]);
      setIsAddNodePanelOpen(false);
    },
    [nodes, setIsAddNodePanelOpen]
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkflowName(e.target.value);
    setIsDirty(true);
  };

  // Validate workflow function
  const validateWorkflow = useCallback(async () => {
    if (!user) return;
    try {
      const accessToken = await getAccessToken();
      const response =
        await validateWorkflowApiV1WorkflowWorkflowIdValidatePost({
          path: {
            workflow_id: workflowId,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

      // Clear validation errors first
      clearValidationErrors();

      // Check if we have validation errors
      if (response.error) {
        let errors: WorkflowError[] = [];
        const errorResponse = response.error as {
          is_valid?: boolean;
          errors?: WorkflowError[];
          detail?: { errors: WorkflowError[] };
        };

        if (errorResponse.is_valid === false && errorResponse.errors) {
          errors = errorResponse.errors;
        } else if (errorResponse.detail?.errors) {
          errors = errorResponse.detail.errors;
        }

        if (errors.length > 0) {
          // Update nodes with validation state
          errors.forEach((error) => {
            if (error.kind === "node" && error.id) {
              markNodeAsInvalid(error.id, error.message);
            } else if (error.kind === "edge" && error.id) {
              markEdgeAsInvalid(error.id, error.message);
            }
          });

          setWorkflowValidationErrors(errors);
        }
      } else if (response.data) {
        if (response.data.is_valid === false && response.data.errors) {
          const errors = response.data.errors;

          errors.forEach((error) => {
            if (error.kind === "node" && error.id) {
              markNodeAsInvalid(error.id, error.message);
            } else if (error.kind === "edge" && error.id) {
              markEdgeAsInvalid(error.id, error.message);
            }
          });

          setWorkflowValidationErrors(errors);
        } else {
          logger.info("Workflow is valid");
        }
      }
    } catch (error) {
      logger.error(`Unexpected validation error: ${error}`);
    }
  }, [
    workflowId,
    user,
    getAccessToken,
    clearValidationErrors,
    markNodeAsInvalid,
    markEdgeAsInvalid,
    setWorkflowValidationErrors,
  ]);

  // Save workflow function
  const saveWorkflow = useCallback(
    async (updateWorkflowDefinition: boolean = true) => {
      if (!user || !rfInstance.current) return;
      const flow = rfInstance.current.toObject();
      const accessToken = await getAccessToken();
      try {
        await updateWorkflowApiV1WorkflowWorkflowIdPut({
          path: {
            workflow_id: workflowId,
          },
          body: {
            name: workflowName,
            workflow_definition: updateWorkflowDefinition ? flow : null,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setIsDirty(false);
      } catch (error) {
        logger.error(`Error saving workflow: ${error}`);
      }

      // Validate after saving
      await validateWorkflow();
    },
    [
      workflowId,
      workflowName,
      setIsDirty,
      user,
      getAccessToken,
      validateWorkflow,
    ]
  );

  const onConnect: OnConnect = useCallback((connection) => {
    if (!rfInstance.current) return;

    // Use addEdges from ReactFlow instance
    rfInstance.current.addEdges([
      {
        ...connection,
        id: `${connection.source}-${connection.target}`,
        data: {
          label: "",
          condition: "",
        },
      },
    ]);
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const currentEdges = useWorkflowStore.getState().edges;
      const newEdges = applyEdgeChanges(changes, currentEdges) as FlowEdge[];
      // Cast changes to FlowEdge type - safe because setEdges only uses the type field
      // to determine history tracking, not the actual item data
      setEdges(newEdges, changes as EdgeChange<FlowEdge>[]);
    },
    [setEdges]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const currentNodes = useWorkflowStore.getState().nodes;
      const newNodes = applyNodeChanges(changes, currentNodes) as FlowNode[];
      // Cast changes to FlowNode type - safe because setNodes only uses the type field
      // to determine history tracking, not the actual item data
      setNodes(newNodes, changes as NodeChange<FlowNode>[]);
    },
    [setNodes]
  );

  const onRun = async (mode: string) => {
    if (!user) return;
    const workflowRunName = `WR-${getRandomId()}`;
    const accessToken = await getAccessToken();
    const response = await createWorkflowRunApiV1WorkflowWorkflowIdRunsPost({
      path: {
        workflow_id: workflowId,
      },
      body: {
        mode,
        name: workflowRunName,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    router.push(`/workflow/${workflowId}/run/${response.data?.id}`);
  };

  // Save template context variables
  const saveTemplateContextVariables = useCallback(
    async (variables: Record<string, string>) => {
      if (!user) return;
      const accessToken = await getAccessToken();
      try {
        await updateWorkflowApiV1WorkflowWorkflowIdPut({
          path: {
            workflow_id: workflowId,
          },
          body: {
            name: workflowName,
            workflow_definition: null,
            template_context_variables: variables,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setTemplateContextVariables(variables);
        logger.info("Template context variables saved successfully");
      } catch (error) {
        logger.error(`Error saving template context variables: ${error}`);
        throw error;
      }
    },
    [
      workflowId,
      workflowName,
      user,
      getAccessToken,
      setTemplateContextVariables,
    ]
  );

  // Save workflow configurations
  const saveWorkflowConfigurations = useCallback(
    async (configurations: WorkflowConfigurations, newWorkflowName: string) => {
      if (!user) return;
      const accessToken = await getAccessToken();
      try {
        await updateWorkflowApiV1WorkflowWorkflowIdPut({
          path: {
            workflow_id: workflowId,
          },
          body: {
            name: newWorkflowName,
            workflow_definition: null,
            workflow_configurations: configurations as Record<string, unknown>,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        setWorkflowConfigurations(configurations);
        setWorkflowName(newWorkflowName);
        logger.info("Workflow configurations saved successfully");
      } catch (error) {
        logger.error(`Error saving workflow configurations: ${error}`);
        throw error;
      }
    },
    [
      workflowId,
      user,
      getAccessToken,
      setWorkflowConfigurations,
      setWorkflowName,
    ]
  );

  // Update rfInstance when it changes
  useEffect(() => {
    if (rfInstance.current) {
      setRfInstance(rfInstance.current);
    }
  }, [setRfInstance]);

  // Validate workflow on mount
  useEffect(() => {
    validateWorkflow();
  }, [validateWorkflow]);

  return {
    rfInstance,
    nodes,
    edges,
    isAddNodePanelOpen,
    workflowName,
    isDirty,
    workflowValidationErrors,
    templateContextVariables,
    workflowConfigurations,
    setNodes,
    setIsDirty,
    setIsAddNodePanelOpen,
    handleNodeSelect,
    handleNameChange,
    saveWorkflow,
    onConnect,
    onEdgesChange,
    onNodesChange,
    onRun,
    saveTemplateContextVariables,
    saveWorkflowConfigurations,
    // Export undo/redo state
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
