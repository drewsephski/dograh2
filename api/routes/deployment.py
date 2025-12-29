"""
Deployment routes for workflow phone deployment.
"""

from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel

from api.db import db_client
from api.db.models import UserModel
from api.services.auth.depends import get_user
from api.services.telephony.factory import get_telephony_provider

router = APIRouter()


class DeployRequest(BaseModel):
    action: Literal["provision_number", "use_existing"]
    phone_number: Optional[str] = None
    area_code: Optional[str] = None  # For number provisioning


@router.post("/{workflow_id}/deploy")
async def deploy_workflow(
    workflow_id: int,
    request: DeployRequest,
    user: UserModel = Depends(get_user),
):
    """
    Deploy a workflow to a phone number.
    
    Args:
        workflow_id: The ID of the workflow to deploy
        request: The deployment request containing action and phone number
        user: The authenticated user
    
    Returns:
        Deployment information including the phone number
    """
    # Get workflow
    workflow = await db_client.get_workflow(workflow_id, organization_id=user.selected_organization_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get telephony provider for organization
    try:
        provider = await get_telephony_provider(user.selected_organization_id)
    except Exception as e:
        logger.error(f"Failed to get telephony provider: {e}")
        raise HTTPException(
            status_code=400, 
            detail="Telephony not configured for this organization. Please configure Twilio settings."
        )
    
    if request.action == "provision_number":
        # Provision a new number from Twilio
        try:
            phone_number = await provider.purchase_phone_number(area_code=request.area_code)
            if not phone_number:
                raise HTTPException(
                    status_code=400, 
                    detail="Failed to provision phone number. Please try a different area code."
                )
            
            # Configure the number's webhook to point to our endpoint
            await provider.configure_number_webhook(phone_number, workflow_id)
            
            # Create agent trigger
            trigger_path = f"trigger-{uuid4()}"
            await db_client.create_agent_trigger(
                trigger_path=trigger_path,
                workflow_id=workflow_id,
                organization_id=user.selected_organization_id,
                provider=provider.PROVIDER_NAME,
                phone_number=phone_number,
            )
            
            logger.info(f"Successfully provisioned and configured number {phone_number} for workflow {workflow_id}")
            
            return {
                "phone_number": phone_number,
                "trigger_path": trigger_path,
                "status": "deployed",
                "message": "Workflow deployed successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to provision Twilio number: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to provision phone number: {str(e)}"
            )
    
    elif request.action == "use_existing":
        if not request.phone_number:
            raise HTTPException(status_code=400, detail="Phone number is required for existing number deployment")
        
        # Validate that the number belongs to the organization's Twilio account
        try:
            available_numbers = await provider.get_available_phone_numbers()
            if request.phone_number not in available_numbers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Phone number {request.phone_number} is not available in your Twilio account"
                )
            
            # Configure the number's webhook to point to our endpoint
            await provider.configure_number_webhook(request.phone_number, workflow_id)
            
            # Create agent trigger for existing number
            trigger_path = f"trigger-{uuid4()}"
            await db_client.create_agent_trigger(
                trigger_path=trigger_path,
                workflow_id=workflow_id,
                organization_id=user.selected_organization_id,
                provider=provider.PROVIDER_NAME,
                phone_number=request.phone_number,
            )
            
            logger.info(f"Successfully configured existing number {request.phone_number} for workflow {workflow_id}")
            
            return {
                "phone_number": request.phone_number,
                "trigger_path": trigger_path,
                "status": "deployed",
                "message": "Workflow deployed successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to configure existing Twilio number: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to configure phone number: {str(e)}"
            )
    
    else:
        raise HTTPException(status_code=400, detail="Invalid deployment action")
