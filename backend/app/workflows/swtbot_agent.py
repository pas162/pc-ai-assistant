"""
SWTBot Test Script Generator Agent.
Converts Jira/Zephyr test cases into SWTBot Java automation code.
"""
from typing import Dict, Any, List
from app.core.llm_client import chat_with_llm


SWTBOT_SYSTEM_PROMPT = """You are an expert in SWTBot test automation for the Eclipse e² studio IDE.
Your task is to generate complete, runnable SWTBot Java test code from test case descriptions.

SWTBot API Reference:
- bot.button("Label") - Find button by label
- bot.textWithLabel("Label") - Find text field by its label
- bot.tree() - Get the SWT tree widget
- bot.menu("Menu") - Access menu items
- bot.toolbarButtonWithTooltip("Tooltip") - Find toolbar button
- bot.sleep(milliseconds) - Wait for UI updates
- bot.waitUntil(condition, timeout) - Wait for conditions
- SWTBotPreferences.TIMEOUT = 5000 - Set default timeout

Renesas e² studio specific:
- Use "Window" > "Perspective" > "Open Perspective" > "..." to switch perspectives
- Project Explorer is a tree widget showing projects
- Right-click context menus: bot.tree().select("project").contextMenu("menu").click()
- Build progress is shown in Console view

Code Structure:
1. Package declaration (assume org.eclipse.swtbot.test)
2. Import statements (org.eclipse.swtbot.*, org.junit.*)
3. Test class with @RunWith(SWTBotJunit4ClassRunner.class)
4. @Before method to set up bot and preferences
5. @Test method containing the test steps
6. @After method for cleanup

Requirements:
- Handle waits appropriately after UI actions (bot.sleep or bot.waitUntil)
- Add descriptive comments for each major action
- Use try-catch for error-prone operations
- Include assertions to verify expected results
- Use meaningful variable names
- Format code with proper indentation (4 spaces)

Return ONLY the complete Java code, no explanations outside code comments.
"""


def generate_swtbot_script(
    test_case: Dict[str, Any],
    additional_context: str = ""
) -> str:
    """
    Generate SWTBot Java test script from a parsed test case.
    
    Args:
        test_case: Parsed Jira/Zephyr test case with name, description, steps, etc.
        additional_context: Optional additional instructions or context
    
    Returns:
        Complete Java source code as string
    """
    # Build the user prompt
    steps_text = _format_steps(test_case.get("steps", []))
    
    user_prompt = f"""Generate SWTBot test code for the following test case:

Test Name: {test_case.get('name', 'Unknown Test')}
Test Key: {test_case.get('key', 'UNKNOWN')}
Priority: {test_case.get('priority', 'Medium')}
Component: {test_case.get('component', 'General')}

Description:
{test_case.get('description', 'No description provided.')}

Preconditions:
{test_case.get('precondition', 'None specified.')}

Test Steps:
{steps_text}

{additional_context}

Please generate a complete Java class with:
1. Class name: {test_case.get('key', 'Test').replace('-', '_')}Test
2. Proper SWTBot imports
3. Setup for e² studio environment
4. All test steps implemented with appropriate waits
5. Assertions to verify expected results
"""

    # Call LLM
    messages = [
        {"role": "system", "content": SWTBOT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        generated_code = chat_with_llm(messages)
        return _clean_generated_code(generated_code)
    except Exception as e:
        return f"// Error generating code: {str(e)}\n// Please check LLM configuration and try again."


def refine_swtbot_script(
    original_code: str,
    refinement_request: str,
    test_case: Dict[str, Any]
) -> str:
    """
    Refine existing SWTBot code based on user feedback.
    
    Args:
        original_code: The previously generated Java code
        refinement_request: What changes the user wants
        test_case: Original test case context
    
    Returns:
        Updated Java source code
    """
    user_prompt = f"""Refine the following SWTBot test code based on this request:

Request: {refinement_request}

Original Test Case: {test_case.get('name')}

Current Code:
```java
{original_code}
```

Please provide the updated complete Java class.
"""

    messages = [
        {"role": "system", "content": SWTBOT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        refined_code = chat_with_llm(messages)
        return _clean_generated_code(refined_code)
    except Exception as e:
        return f"// Error refining code: {str(e)}\n// Original code preserved below:\n{original_code}"


def _format_steps(steps: List[Dict[str, str]]) -> str:
    """Format test steps for the prompt."""
    if not steps:
        return "No specific steps provided."
    
    lines = []
    for step in steps:
        step_num = step.get('step', '?')
        desc = step.get('description', 'No description')
        expected = step.get('expected', '')
        
        lines.append(f"{step_num}. {desc}")
        if expected:
            lines.append(f"   Expected: {expected}")
    
    return "\n".join(lines)


def _clean_generated_code(code: str) -> str:
    """Clean up LLM output - remove markdown code blocks if present."""
    # Remove ```java and ``` markers if present
    code = code.strip()
    if code.startswith("```java"):
        code = code[7:]
    elif code.startswith("```"):
        code = code[3:]
    
    if code.endswith("```"):
        code = code[:-3]
    
    return code.strip()


# Template for common SWTBot patterns that can be used as few-shot examples
SWTBOT_EXAMPLES = {
    "open_perspective": """
        // Open a perspective
        bot.menu("Window").menu("Perspective").menu("Open Perspective").menu("Other...").click();
        bot.table().select("C/C++");
        bot.button("Open").click();
        bot.sleep(1000);
    """,
    
    "create_project": """
        // Create a new project
        bot.menu("File").menu("New").menu("C/C++ Project").click();
        bot.textWithLabel("Project name:").setText("MyTestProject");
        bot.button("Finish").click();
        bot.waitUntil(Conditions.shellCloses(bot.activeShell()), 30000);
    """,
    
    "build_project": """
        // Build the project
        bot.tree().select("MyTestProject").contextMenu("Build Project").click();
        bot.sleep(2000); // Wait for build to start
        // Wait for build to complete
        bot.waitUntil(new ProjectBuiltCondition("MyTestProject"), 60000);
    """,
    
    "open_console": """
        // Open Console view
        bot.menu("Window").menu("Show View").menu("Console").click();
        bot.sleep(500);
    """
}


def get_swtbot_template(template_name: str) -> str:
    """Get a common SWTBot code pattern."""
    return SWTBOT_EXAMPLES.get(template_name, "")
