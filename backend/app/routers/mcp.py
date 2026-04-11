"""MCP (Model Context Protocol) SSE transport routes for FastAPI."""

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse

from app.mcp_server import (
    McpSession, _sessions, _sessions_lock,
    validate_bearer_token, is_mcp_enabled,
    handle_mcp_message, render_mcpdocs,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mcp"])


@router.get("/mcpdocs", response_class=HTMLResponse)
def mcpdocs():
    """MCP tool documentation page."""
    return render_mcpdocs()


@router.get("/mcp/sse")
async def mcp_sse(request: Request):
    """SSE endpoint for MCP session establishment."""
    if not is_mcp_enabled():
        return JSONResponse(
            {"error": "MCP is not enabled. Set MCP_ENABLED=true to use MCP endpoints."},
            status_code=404,
        )

    auth_header = request.headers.get("authorization", "")
    if not validate_bearer_token(auth_header):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    loop = asyncio.get_event_loop()
    session_id = str(uuid.uuid4())
    session = McpSession(session_id, loop)
    with _sessions_lock:
        _sessions[session_id] = session

    logger.info(f"MCP SSE session created: {session_id}")

    async def event_stream():
        try:
            yield f"event: endpoint\ndata: /mcp/messages?session_id={session_id}\n\n"

            while True:
                try:
                    event, data = await asyncio.wait_for(session.queue.get(), timeout=30)
                    yield f"event: {event}\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

                if await request.is_disconnected():
                    break
        finally:
            with _sessions_lock:
                _sessions.pop(session_id, None)
            logger.info(f"MCP SSE session closed: {session_id}")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/mcp/messages")
async def mcp_messages(request: Request, session_id: str):
    """JSON-RPC message handler for MCP."""
    if not is_mcp_enabled():
        return JSONResponse(
            {"error": "MCP is not enabled. Set MCP_ENABLED=true to use MCP endpoints."},
            status_code=404,
        )

    auth_header = request.headers.get("authorization", "")
    if not validate_bearer_token(auth_header):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    with _sessions_lock:
        session = _sessions.get(session_id)
    if not session:
        return JSONResponse({"error": "Invalid or missing session_id"}, status_code=400)

    message = await request.json()
    logger.info(f"MCP message [{session_id}]: method={message.get('method')}")

    response = handle_mcp_message(message)

    if response is not None:
        session.push("message", json.dumps(response))

    return JSONResponse(content=None, status_code=202)
