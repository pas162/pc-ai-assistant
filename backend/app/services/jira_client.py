"""
Jira API client for fetching Zephyr test tickets.
"""
import httpx
from typing import Optional, Dict, Any, List
from app.core.database import get_db_direct
from app.models.setting import Setting


def get_jira_config() -> tuple[str, str]:
    """
    Reads Jira base URL and token from the database.
    These are managed via the Settings UI.
    """
    db = get_db_direct()
    try:
        rows = db.query(Setting).filter(
            Setting.key.in_("jira_api_token", "jira_base_url")
        ).all()
        values = {row.key: row.value or "" for row in rows}
        base_url = values.get("jira_base_url", "")
        token = values.get("jira_api_token", "")
        return base_url, token
    finally:
        db.close()


def test_jira_connection() -> dict:
    """
    Test Jira API connection by fetching current user.
    """
    base_url, token = get_jira_config()
    
    if not base_url:
        return {"status": "error", "error": "Jira base URL is not configured. Please go to Settings."}
    if not token:
        return {"status": "error", "error": "Jira API token is not configured. Please go to Settings."}
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                f"{base_url}/rest/api/2/myself",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()
            return {
                "status": "ok",
                "displayName": data.get("displayName"),
                "email": data.get("emailAddress")
            }
    except httpx.HTTPStatusError as e:
        return {"status": "error", "error": f"HTTP {e.response.status_code}: {e.response.text}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def fetch_jira_issue(issue_key: str) -> Dict[str, Any]:
    """
    Fetch a Jira issue by key (e.g., ZEPHYR-12345).
    Returns the full issue data including fields and custom fields.
    """
    base_url, token = get_jira_config()
    
    if not base_url:
        raise ValueError("Jira base URL is not configured. Please go to Settings.")
    if not token:
        raise ValueError("Jira API token is not configured. Please go to Settings.")
    
    # Normalize the issue key
    issue_key = issue_key.strip().upper()
    
    url = f"{base_url}/rest/api/2/issue/{issue_key}"
    
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        )
        response.raise_for_status()
        return response.json()


def parse_zephyr_test_case(issue_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse Jira issue data to extract Zephyr test case information.
    
    Returns structured data:
    {
        "key": "ZEPHYR-12345",
        "name": "Test Peripheral GPIO",
        "description": "...",
        "steps": [
            {"step": "1", "description": "...", "expected": "..."}
        ],
        "precondition": "...",
        "priority": "High",
        "component": "GPIO"
    }
    """
    fields = issue_data.get("fields", {})
    
    # Basic fields
    name = fields.get("summary", "Unknown Test")
    description = fields.get("description", "")
    
    # Try to extract steps from description or custom fields
    # Zephyr test steps might be in:
    # 1. Description as numbered list
    # 2. Custom field (customfield_xxxx)
    # 3. Issue links to test step issues
    
    steps = _extract_steps(fields)
    
    # Priority and component
    priority_field = fields.get("priority")
    priority = priority_field.get("name") if priority_field else "Medium"
    
    components = fields.get("components", [])
    component = components[0].get("name") if components else ""
    
    # Precondition might be in custom fields or description
    precondition = _extract_precondition(fields)
    
    return {
        "key": issue_data.get("key", "UNKNOWN"),
        "name": name,
        "description": description,
        "steps": steps,
        "precondition": precondition,
        "priority": priority,
        "component": component,
        "raw_fields": fields  # Include raw for debugging
    }


def _extract_steps(fields: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Try to extract test steps from various possible sources.
    """
    steps = []
    
    # Look for custom fields that might contain test steps
    # Common Zephyr custom field names
    possible_step_fields = [
        "customfield_10000",  # Zephyr Test Steps
        "customfield_10300",  # Another common one
    ]
    
    for field_name in possible_step_fields:
        if field_name in fields and fields[field_name]:
            step_data = fields[field_name]
            if isinstance(step_data, list):
                for i, step in enumerate(step_data, 1):
                    steps.append({
                        "step": str(i),
                        "description": str(step.get("description", step.get("step", ""))),
                        "expected": str(step.get("expectedResult", step.get("expected", "")))
                    })
                return steps
            elif isinstance(step_data, str):
                # Parse string format
                return _parse_steps_from_text(step_data)
    
    # Fallback: try to parse from description
    description = fields.get("description", "")
    if description:
        return _parse_steps_from_text(description)
    
    return steps


def _parse_steps_from_text(text: str) -> List[Dict[str, str]]:
    """
    Parse steps from text format.
    Looks for patterns like:
    - Step 1: ... Expected: ...
    - 1. ... Expected result: ...
    """
    steps = []
    lines = text.split("\n")
    
    current_step = None
    current_desc = []
    current_expected = []
    in_expected = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for step number patterns
        import re
        step_match = re.match(r'^(?:Step\s*)?(\d+)[:.\)]\s*(.*)', line, re.IGNORECASE)
        
        if step_match:
            # Save previous step if exists
            if current_step:
                steps.append({
                    "step": current_step,
                    "description": " ".join(current_desc).strip(),
                    "expected": " ".join(current_expected).strip()
                })
            
            current_step = step_match.group(1)
            rest = step_match.group(2)
            
            # Check if expected result is on same line
            expected_split = re.split(r'(?:Expected|Expected Result|Expected Result:)[:\s]+', rest, flags=re.IGNORECASE)
            if len(expected_split) > 1:
                current_desc = [expected_split[0].strip()]
                current_expected = [expected_split[1].strip()]
                in_expected = False
            else:
                current_desc = [rest]
                current_expected = []
                in_expected = False
        
        elif re.match(r'^(?:Expected|Expected Result)[:\s]*', line, re.IGNORECASE):
            in_expected = True
            # Remove the label
            clean = re.sub(r'^(?:Expected|Expected Result)[:\s]*', '', line, flags=re.IGNORECASE)
            if clean:
                current_expected.append(clean)
        
        elif current_step:
            if in_expected:
                current_expected.append(line)
            else:
                current_desc.append(line)
    
    # Save last step
    if current_step:
        steps.append({
            "step": current_step,
            "description": " ".join(current_desc).strip(),
            "expected": " ".join(current_expected).strip()
        })
    
    return steps


def _extract_precondition(fields: Dict[str, Any]) -> str:
    """
    Extract precondition from fields.
    """
    # Check custom fields
    possible_precond_fields = [
        "customfield_10001",  # Precondition
        "customfield_10301",
    ]
    
    for field_name in possible_precond_fields:
        if field_name in fields and fields[field_name]:
            return str(fields[field_name])
    
    # Look in description for "Precondition" section
    description = fields.get("description", "")
    import re
    precond_match = re.search(
        r'(?:Precondition|Preconditions|Pre-condition|Setup)[:\s]*\n?([^\n]+(?:\n(?!(?:Step|Test|Action|\d+\.)[^\n]*)[^\n]+)*)',
        description,
        re.IGNORECASE
    )
    if precond_match:
        return precond_match.group(1).strip()
    
    return ""
