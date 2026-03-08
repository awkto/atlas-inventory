from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import AUTH_TOKEN

security = HTTPBearer(auto_error=False)


def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not AUTH_TOKEN:
        return  # no token configured = auth disabled
    if not credentials or credentials.credentials != AUTH_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
