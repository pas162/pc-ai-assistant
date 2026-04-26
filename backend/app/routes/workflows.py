"""
Workflow automation API endpoints.
Currently supports: SWTBot Script Generation
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.services.retriever import retrieve_relevant_chunks, build_context
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
    workspace_id: Optional[str] = Field(default=None, description="Workspace ID to retrieve attached docs as context")


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


MOCK_TICKETS: dict[str, dict] = {
    "DEMO-1": {
        "key": "DEMO-1",
        "name": "Verify GPIO pin output toggle via e² studio debug console",
        "description": "Test that a GPIO pin can be toggled high/low via the debug console in e² studio and that the state is reflected in the Renesas Smart Configurator pin view.",
        "precondition": "Project 'GPIO_Toggle_Demo' is imported and built successfully. Target board is connected via J-Link.",
        "priority": "High",
        "component": "GPIO",
        "steps": [
            {"step": "1", "description": "Launch e² studio and open the 'GPIO_Toggle_Demo' project.", "expected": "Project opens without errors and the editor shows main.c."},
            {"step": "2", "description": "Click Run > Debug As > Renesas GDB Hardware Debugging to start a debug session.", "expected": "Debug perspective opens and execution halts at main()."},
            {"step": "3", "description": "In the Debug Console, type 'set gpio_pin_state 1' and press Enter.", "expected": "Console acknowledges the command and GPIO pin P1.00 goes HIGH."},
            {"step": "4", "description": "Open the Smart Configurator pin view and inspect P1.00.", "expected": "Pin P1.00 shows output state HIGH in the pin view."},
            {"step": "5", "description": "In the Debug Console, type 'set gpio_pin_state 0' and press Enter.", "expected": "GPIO pin P1.00 goes LOW and Smart Configurator reflects the change."},
        ],
    },
    "DEMO-2": {
        "key": "DEMO-2",
        "name": "Verify project creation wizard generates correct linker script",
        "description": "Ensure the new C project wizard in e² studio produces a valid linker script for the RA6M4 target device.",
        "precondition": "e² studio 2024-04 or later is installed. FSP v5.3.0 pack is installed.",
        "priority": "Medium",
        "component": "Project Wizard",
        "steps": [
            {"step": "1", "description": "Open File > New > Renesas C/C++ Project.", "expected": "New project wizard dialog appears."},
            {"step": "2", "description": "Select 'Renesas RA' family and click Next.", "expected": "Device selection page is shown."},
            {"step": "3", "description": "Choose device 'R7FA6M4AF3CFB' (RA6M4) and click Next.", "expected": "Board selection page appears with compatible boards listed."},
            {"step": "4", "description": "Select 'EK-RA6M4' board, choose 'Blinky' as the template, and click Finish.", "expected": "Project is created and visible in the Project Explorer."},
            {"step": "5", "description": "Expand the project and open the generated linker script (.ld file).", "expected": "Linker script contains correct MEMORY regions for RA6M4 flash (1MB) and SRAM (256KB)."},
        ],
    },
    "DEMO-3": {
        "key": "DEMO-3",
        "name": "Verify SCI UART configuration via Smart Configurator",
        "description": "Test that configuring SCI channel 0 as UART in the Smart Configurator generates the correct HAL code and the serial output is visible on a terminal.",
        "precondition": "Project 'UART_Demo' exists with FSP configured. USB-Serial adapter is connected to UART0 pins.",
        "priority": "High",
        "component": "SCI/UART",
        "steps": [
            {"step": "1", "description": "Open the 'UART_Demo' project and double-click configuration.xml.", "expected": "FSP Smart Configurator opens on the Stacks tab."},
            {"step": "2", "description": "In the BSP tab, confirm the device is set to RA6M4.", "expected": "Device shows 'R7FA6M4AF3CFB'."},
            {"step": "3", "description": "On the Stacks tab, add a new stack: r_sci_uart.", "expected": "UART stack appears in the stack view with default settings."},
            {"step": "4", "description": "Configure Channel to 0, Baud Rate to 115200, Data Bits to 8, Parity to None, Stop Bits to 1.", "expected": "Settings are accepted without validation errors."},
            {"step": "5", "description": "Click 'Generate Project Content' and then build the project.", "expected": "Build succeeds with 0 errors. Generated hal_data.c contains g_uart0 instance."},
            {"step": "6", "description": "Flash and run the project. Open a serial terminal at 115200 baud.", "expected": "Terminal displays 'Hello from RA6M4 UART!' repeatedly at 1-second intervals."},
        ],
    },
}


@router.get("/jira/mock/{ticket_id}", response_model=JiraTicketResponse)
def get_mock_ticket(ticket_id: str):
    """
    Returns a local sample ticket for testing without a real Jira connection.
    Supports: DEMO-1, DEMO-2, DEMO-3
    """
    key = ticket_id.strip().upper()
    ticket = MOCK_TICKETS.get(key)
    if not ticket:
        available = ", ".join(MOCK_TICKETS.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Mock ticket '{key}' not found. Available: {available}"
        )
    return JiraTicketResponse(**ticket)


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
    If workspace_id is provided, retrieves relevant chunks from attached
    documents and injects them as additional context for the LLM.
    """
    try:
        doc_context = ""
        if request.workspace_id:
            query = f"{request.ticket_data.get('name', '')} {request.ticket_data.get('description', '')}"
            chunks = retrieve_relevant_chunks(
                question=query,
                workspace_id=request.workspace_id,
                n_results=10,
            )
            if chunks:
                doc_context = "\n\nRelevant reference material from workspace documents:\n" + build_context(chunks)

        combined_context = (request.additional_context or "") + doc_context

        code = generate_swtbot_script(
            test_case=request.ticket_data,
            additional_context=combined_context
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
