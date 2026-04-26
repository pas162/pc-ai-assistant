"""
Workflow automation API endpoints.
Currently supports: SWTBot Script Generation
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.services.jira_client import (
    fetch_jira_issue,
    parse_zephyr_test_case,
    test_jira_connection,
    get_jira_config
)
from app.workflows.swtbot_agent import generate_swtbot_script, refine_swtbot_script

router = APIRouter(prefix="/workflows", tags=["workflows"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class JiraTicketRequest(BaseModel):
    """Request to fetch a Jira ticket."""
    ticket_id: str = Field(..., description="Jira ticket key (e.g., ZEPHYR-12345)")


class JiraTicketResponse(BaseModel):
    """Response containing parsed Jira/Zephyr test case."""
    key: str
    name: str
    description: str
    steps: list[dict]
    precondition: str
    priority: str
    component: str


class GenerateScriptRequest(BaseModel):
    """Request to generate SWTBot script."""
    ticket_data: Dict[str, Any] = Field(..., description="Parsed test case from /jira/fetch")
    additional_context: Optional[str] = Field(default="", description="Additional instructions")


class GenerateScriptResponse(BaseModel):
    """Response containing generated SWTBot Java code."""
    code: str
    test_key: str
    test_name: str


class RefineScriptRequest(BaseModel):
    """Request to refine existing SWTBot script."""
    original_code: str = Field(..., description="Current Java code")
    refinement_request: str = Field(..., description="What changes to make")
    ticket_data: Dict[str, Any] = Field(..., description="Original test case context")


class RefineScriptResponse(BaseModel):
    """Response containing refined SWTBot Java code."""
    code: str


class JiraConfigCheck(BaseModel):
    """Jira configuration status."""
    configured: bool
    message: str


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/jira/status", response_model=JiraConfigCheck)
def check_jira_status():
    """
    Check if Jira is properly configured.
    Returns configuration status and test connection result.
    """
    base_url, token = get_jira_config()
    
    if not base_url or not token:
        return JiraConfigCheck(
            configured=False,
            message="Jira not configured. Please set JIRA_BASE_URL and JIRA_API_TOKEN in Settings."
        )
    
    # Test connection
    result = test_jira_connection()
    if result.get("status") == "ok":
        return JiraConfigCheck(
            configured=True,
            message=f"Connected to Jira as {result.get('displayName')}"
        )
    else:
        return JiraConfigCheck(
            configured=False,
            message=f"Jira configuration error: {result.get('error')}"
        )


@router.post("/jira/fetch", response_model=JiraTicketResponse)
def fetch_jira_ticket(request: JiraTicketRequest):
    """
    Fetch and parse a Jira/Zephyr test ticket.
    
    - Fetches the issue from Jira API
    - Parses test case information including steps
    - Returns structured data for SWTBot generation
    """
    try:
        # Fetch from Jira
        issue_data = fetch_jira_issue(request.ticket_id)
        
        # Parse into test case structure
        test_case = parse_zephyr_test_case(issue_data)
        
        return JiraTicketResponse(
            key=test_case["key"],
            name=test_case["name"],
            description=test_case["description"],
            steps=test_case["steps"],
            precondition=test_case["precondition"],
            priority=test_case["priority"],
            component=test_case["component"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch ticket: {str(e)}")


@router.post("/swtbot/generate", response_model=GenerateScriptResponse)
def generate_swtbot(request: GenerateScriptRequest):
    """
    Generate SWTBot Java test script from a Jira test case.
    
    Takes parsed ticket data and generates complete, runnable Java code
    for SWTBot test automation in e² studio.
    """
    try:
        code = generate_swtbot_script(
            test_case=request.ticket_data,
            additional_context=request.additional_context
        )
        
        return GenerateScriptResponse(
            code=code,
            test_key=request.ticket_data.get("key", "UNKNOWN"),
            test_name=request.ticket_data.get("name", "Unknown Test")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")


@router.post("/swtbot/refine", response_model=RefineScriptResponse)
def refine_swtbot(request: RefineScriptRequest):
    """
    Refine an existing SWTBot script based on user feedback.
    
    Allows iterative improvement of generated code through natural language
    requests (e.g., "Add error handling", "Change this to use menu instead").
    """
    try:
        refined_code = refine_swtbot_script(
            original_code=request.original_code,
            refinement_request=request.refinement_request,
            test_case=request.ticket_data
        )
        
        return RefineScriptResponse(code=refined_code)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code refinement failed: {str(e)}")
