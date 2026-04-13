# Import all models here so Alembic can find them
# when generating migrations
from app.models.workspace import Workspace
from app.models.document import Document
from app.models.chat import ChatSession, ChatMessage
from app.models.setting import Setting
