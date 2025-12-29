import hashlib
import json
from typing import Optional

from loguru import logger
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from api.db.base_client import BaseDBClient
from api.db.models import WorkflowDefinitionModel, WorkflowModel, WorkflowRunModel


class WorkflowClient(BaseDBClient):
    def _generate_workflow_hash(self, workflow_definition: dict) -> str:
        """Generate a consistent hash for workflow definition."""
        # Convert to JSON with sorted keys for consistent hashing
        json_str = json.dumps(
            workflow_definition, sort_keys=True, separators=(",", ":")
        )
        return hashlib.sha256(json_str.encode()).hexdigest()

    async def _get_or_create_workflow_definition(
        self, workflow_definition: dict, session, workflow_id: int = None
    ) -> WorkflowDefinitionModel:
        """Get existing workflow definition by hash or create a new one."""
        workflow_hash = self._generate_workflow_hash(workflow_definition)

        # Try to find existing definition
        result = await session.execute(
            select(WorkflowDefinitionModel).where(
                WorkflowDefinitionModel.workflow_hash == workflow_hash,
                WorkflowDefinitionModel.workflow_id == workflow_id,
            )
        )
        existing_definition = result.scalars().first()

        if existing_definition:
            return existing_definition

        # Create new definition if it doesn't exist
        new_definition = WorkflowDefinitionModel(
            workflow_hash=workflow_hash,
            workflow_json=workflow_definition,
            workflow_id=workflow_id,
        )
        session.add(new_definition)
        await session.flush()  # Flush to get the ID without committing
        return new_definition

    async def create_workflow(
        self,
        name: str,
        workflow_definition: dict,
        user_id: int,
        organization_id: int = None,
        skip_normalization: bool = False,
        template_context_variables: dict = None,
    ) -> WorkflowModel:
        async with self.async_session() as session:
            try:
                # Validate and normalize workflow definition unless explicitly skipped
                if not skip_normalization:
                    logger.info("Validating and normalizing workflow definition")
                    try:
                        from api.services.workflow.normalization import validate_and_normalize_workflow_definition
                        normalized_workflow_def, validation_errors = validate_and_normalize_workflow_definition(workflow_definition)
                        
                        if validation_errors:
                            logger.warning(f"Workflow validation errors: {validation_errors}")
                            # Don't fail on validation errors, but log them for debugging
                        
                        workflow_definition = normalized_workflow_def
                        logger.info("Workflow definition normalized successfully")
                    except ImportError:
                        logger.warning("Normalization service not available, skipping validation")
                    except Exception as e:
                        logger.error(f"Error during workflow normalization: {e}")
                        # Continue with original workflow_definition if normalization fails

                new_workflow = WorkflowModel(
                    name=name,
                    workflow_definition=workflow_definition,  # Keep for backwards compatibility
                    user_id=user_id,
                    organization_id=organization_id,
                    template_context_variables=template_context_variables or {},
                )
                session.add(new_workflow)
                await session.flush()  # Flush to get the workflow ID

                # Now get or create workflow definition with the workflow_id
                definition = await self._get_or_create_workflow_definition(
                    workflow_definition, session, new_workflow.id
                )

                # Mark this definition as the current one and unset others
                definition.is_current = True
                # Set any other definitions for this workflow to not current
                other_defs_result = await session.execute(
                    select(WorkflowDefinitionModel).where(
                        WorkflowDefinitionModel.workflow_id == new_workflow.id,
                        WorkflowDefinitionModel.id != definition.id,
                    )
                )
                for other_def in other_defs_result.scalars().all():
                    other_def.is_current = False

                await session.commit()
            except Exception as e:
                await session.rollback()
                raise e
            await session.refresh(new_workflow)
        return new_workflow

    async def get_all_workflows(
        self, user_id: int = None, organization_id: int = None, status: str = None
    ) -> list[WorkflowModel]:
        async with self.async_session() as session:
            query = select(WorkflowModel).options(
                selectinload(WorkflowModel.current_definition)
            )

            if organization_id:
                # Filter by organization_id when provided
                query = query.where(WorkflowModel.organization_id == organization_id)
            elif user_id:
                # Fallback to user_id for backwards compatibility
                query = query.where(WorkflowModel.user_id == user_id)

            # Filter by status if provided
            if status:
                query = query.where(WorkflowModel.status == status)

            result = await session.execute(query)
            return result.scalars().all()

    async def get_workflow(
        self, workflow_id: int, user_id: int = None, organization_id: int = None
    ) -> WorkflowModel | None:
        async with self.async_session() as session:
            query = (
                select(WorkflowModel)
                .options(selectinload(WorkflowModel.current_definition))
                .where(WorkflowModel.id == workflow_id)
            )

            if organization_id:
                # Filter by organization_id when provided
                query = query.where(WorkflowModel.organization_id == organization_id)
            elif user_id:
                # Fallback to user_id for backwards compatibility
                query = query.where(WorkflowModel.user_id == user_id)

            result = await session.execute(query)
            return result.scalars().first()

    async def get_workflow_by_id(self, workflow_id: int) -> WorkflowModel | None:
        async with self.async_session() as session:
            result = await session.execute(
                select(WorkflowModel)
                .options(selectinload(WorkflowModel.current_definition))
                .where(WorkflowModel.id == workflow_id)
            )
            return result.scalars().first()

    async def update_workflow(
        self,
        workflow_id: int,
        name: str,
        workflow_definition: dict | None,
        template_context_variables: dict | None,
        workflow_configurations: dict | None,
        user_id: int = None,
        organization_id: int = None,
    ) -> WorkflowModel:
        """
        Update an existing workflow in the database.

        Args:
            workflow_id: The ID of the workflow to update
            name: The new name for the workflow
            workflow_definition: The new workflow definition
            template_context_variables: The template context variables
            user_id: The user ID (for backwards compatibility)
            organization_id: The organization ID

        Returns:
            The updated WorkflowModel

        Raises:
            ValueError: If the workflow with the given ID is not found
        """
        async with self.async_session() as session:
            query = (
                select(WorkflowModel)
                .options(selectinload(WorkflowModel.current_definition))
                .where(WorkflowModel.id == workflow_id)
            )

            if organization_id:
                # Filter by organization_id when provided
                query = query.where(WorkflowModel.organization_id == organization_id)
            elif user_id:
                # Fallback to user_id for backwards compatibility
                query = query.where(WorkflowModel.user_id == user_id)

            result = await session.execute(query)
            workflow = result.scalars().first()
            if not workflow:
                raise ValueError(f"Workflow with ID {workflow_id} not found")

            workflow.name = name

            if template_context_variables is not None:
                workflow.template_context_variables = template_context_variables

            if workflow_configurations is not None:
                workflow.workflow_configurations = workflow_configurations

            # In case of only name update, the workflow_definition can be None
            if workflow_definition:
                # Get or create new workflow definition
                definition = await self._get_or_create_workflow_definition(
                    workflow_definition, session, workflow_id
                )

                # Update legacy field for backwards compatibility
                workflow.workflow_definition = workflow_definition

                # Mark new definition as current and reset others
                definition.is_current = True
                other_defs_result = await session.execute(
                    select(WorkflowDefinitionModel).where(
                        WorkflowDefinitionModel.workflow_id == workflow_id,
                        WorkflowDefinitionModel.id != definition.id,
                    )
                )
                for other_def in other_defs_result.scalars().all():
                    other_def.is_current = False

            try:
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise e
            await session.refresh(workflow)
        return workflow

    async def get_workflows_by_ids(
        self, workflow_ids: list[int], organization_id: int
    ) -> list[WorkflowModel]:
        """Get workflows by IDs for a specific organization"""
        async with self.async_session() as session:
            result = await session.execute(
                select(WorkflowModel)
                .join(WorkflowModel.user)
                .where(
                    WorkflowModel.id.in_(workflow_ids),
                    WorkflowModel.user.has(selected_organization_id=organization_id),
                )
            )
            return result.scalars().all()

    async def get_workflow_name(
        self, workflow_id: int, user_id: int = None, organization_id: int = None
    ) -> Optional[str]:
        """Get just the workflow name by ID"""
        async with self.async_session() as session:
            query = select(WorkflowModel.name).where(WorkflowModel.id == workflow_id)

            if organization_id:
                # Filter by organization_id when provided
                query = query.where(WorkflowModel.organization_id == organization_id)
            elif user_id:
                # Fallback to user_id for backwards compatibility
                query = query.where(WorkflowModel.user_id == user_id)

            result = await session.execute(query)
            return result.scalar_one_or_none()

    async def update_workflow_status(
        self,
        workflow_id: int,
        status: str,
        organization_id: int = None,
    ) -> WorkflowModel:
        """
        Update the status of a workflow.

        Args:
            workflow_id: The ID of the workflow to update
            status: The new status (active/archived)
            organization_id: The organization ID

        Returns:
            The updated WorkflowModel

        Raises:
            ValueError: If the workflow is not found
        """
        async with self.async_session() as session:
            query = (
                select(WorkflowModel)
                .options(selectinload(WorkflowModel.current_definition))
                .where(WorkflowModel.id == workflow_id)
            )

            if organization_id:
                query = query.where(WorkflowModel.organization_id == organization_id)

            result = await session.execute(query)
            workflow = result.scalars().first()

            if not workflow:
                raise ValueError(f"Workflow with ID {workflow_id} not found")

            workflow.status = status

            try:
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise e
            await session.refresh(workflow)
        return workflow

    async def get_workflow_run_count(self, workflow_id: int) -> int:
        """Get the count of runs for a workflow."""
        async with self.async_session() as session:
            result = await session.execute(
                select(func.count(WorkflowRunModel.id)).where(
                    WorkflowRunModel.workflow_id == workflow_id
                )
            )
            return result.scalar() or 0
