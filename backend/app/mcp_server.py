"""
MCP (Model Context Protocol) server integration for Atlas.

Implements JSON-RPC 2.0 over SSE transport in FastAPI. Provides tools
for managing infrastructure inventory items, networks, and ranges via
MCP-compatible clients.
"""

import asyncio
import json
import logging
import threading
import time

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MCP Tool Definitions
# ---------------------------------------------------------------------------

MCP_TOOLS = [
    {
        "name": "list_items",
        "description": "List inventory items with optional filters. Returns items sorted by name. Use filters to narrow results by type, platform, status, tag, parent, or free-text search.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Free-text search across name, fqdn, url, description, and tags"
                },
                "type": {
                    "type": "string",
                    "description": "Filter by item type: server, vm, container, service, device, endpoint, repository, secret, document"
                },
                "platform": {
                    "type": "string",
                    "description": "Filter by platform: proxmox, docker, digitalocean, github, gitlab, gitea, bare-metal, k8s, aws, gcp, azure, hetzner, other"
                },
                "status": {
                    "type": "string",
                    "description": "Filter by status: active, inactive, unknown"
                },
                "parent_id": {
                    "type": "integer",
                    "description": "Filter by parent item ID (for hierarchical items)"
                },
                "tag": {
                    "type": "string",
                    "description": "Filter by tag (substring match)"
                }
            }
        }
    },
    {
        "name": "get_item",
        "description": "Get detailed information about a specific inventory item by its ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "item_id": {
                    "type": "integer",
                    "description": "ID of the item to retrieve"
                }
            },
            "required": ["item_id"]
        }
    },
    {
        "name": "create_item",
        "description": "Create a new inventory item. Type and name are required. All other fields are optional.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Item type: server, vm, container, service, device, endpoint, repository, secret, document"
                },
                "name": {
                    "type": "string",
                    "description": "Display name for the item"
                },
                "url": {
                    "type": "string",
                    "description": "URL associated with the item"
                },
                "fqdn": {
                    "type": "string",
                    "description": "Fully qualified domain name"
                },
                "ips": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of IP addresses"
                },
                "protocol": {
                    "type": "string",
                    "description": "Protocol: http, https, ssh, tcp, udp, grpc, ws, wss, other"
                },
                "platform": {
                    "type": "string",
                    "description": "Platform: proxmox, docker, digitalocean, github, gitlab, gitea, bare-metal, k8s, aws, gcp, azure, hetzner, other"
                },
                "status": {
                    "type": "string",
                    "description": "Status: active, inactive, unknown"
                },
                "description": {
                    "type": "string",
                    "description": "Description of the item"
                },
                "parent_id": {
                    "type": "integer",
                    "description": "Parent item ID for hierarchical relationships"
                },
                "network_id": {
                    "type": "integer",
                    "description": "Associated network ID"
                },
                "vmid": {
                    "type": "integer",
                    "description": "Proxmox VM ID"
                },
                "ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of port strings (e.g. ['80/tcp', '443/tcp'])"
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Tags for categorization"
                },
                "openbao_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "OpenBao/Vault secret paths"
                },
                "notes": {
                    "type": "string",
                    "description": "Free-form notes"
                }
            },
            "required": ["type", "name"]
        }
    },
    {
        "name": "update_item",
        "description": "Update an existing inventory item. Only provided fields are changed.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "item_id": {
                    "type": "integer",
                    "description": "ID of the item to update"
                },
                "type": {
                    "type": "string",
                    "description": "Item type"
                },
                "name": {
                    "type": "string",
                    "description": "Display name"
                },
                "url": {
                    "type": "string",
                    "description": "URL"
                },
                "fqdn": {
                    "type": "string",
                    "description": "FQDN"
                },
                "ips": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "IP addresses"
                },
                "protocol": {
                    "type": "string",
                    "description": "Protocol"
                },
                "platform": {
                    "type": "string",
                    "description": "Platform"
                },
                "status": {
                    "type": "string",
                    "description": "Status"
                },
                "description": {
                    "type": "string",
                    "description": "Description"
                },
                "parent_id": {
                    "type": "integer",
                    "description": "Parent item ID"
                },
                "network_id": {
                    "type": "integer",
                    "description": "Network ID"
                },
                "vmid": {
                    "type": "integer",
                    "description": "Proxmox VM ID"
                },
                "ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports"
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Tags"
                },
                "openbao_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "OpenBao paths"
                },
                "notes": {
                    "type": "string",
                    "description": "Notes"
                }
            },
            "required": ["item_id"]
        }
    },
    {
        "name": "delete_item",
        "description": "Delete an inventory item by its ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "item_id": {
                    "type": "integer",
                    "description": "ID of the item to delete"
                }
            },
            "required": ["item_id"]
        }
    },
    {
        "name": "search_by_tag",
        "description": "Search for items by tag. Returns all items whose tags contain the given substring.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tag": {
                    "type": "string",
                    "description": "Tag to search for (substring match)"
                }
            },
            "required": ["tag"]
        }
    },
    {
        "name": "list_networks",
        "description": "List all networks with their IP ranges.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_network",
        "description": "Get a specific network with its IP ranges.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "network_id": {
                    "type": "integer",
                    "description": "ID of the network"
                }
            },
            "required": ["network_id"]
        }
    },
    {
        "name": "create_network",
        "description": "Create a new network.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Network name"
                },
                "cidr": {
                    "type": "string",
                    "description": "CIDR notation (e.g. 10.0.0.0/24)"
                },
                "description": {
                    "type": "string",
                    "description": "Network description"
                }
            },
            "required": ["name", "cidr"]
        }
    },
    {
        "name": "update_network",
        "description": "Update an existing network.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "network_id": {
                    "type": "integer",
                    "description": "ID of the network to update"
                },
                "name": {
                    "type": "string",
                    "description": "Network name"
                },
                "cidr": {
                    "type": "string",
                    "description": "CIDR notation"
                },
                "description": {
                    "type": "string",
                    "description": "Network description"
                }
            },
            "required": ["network_id"]
        }
    },
    {
        "name": "delete_network",
        "description": "Delete a network and all its ranges. Items in this network will be unlinked.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "network_id": {
                    "type": "integer",
                    "description": "ID of the network to delete"
                }
            },
            "required": ["network_id"]
        }
    },
    {
        "name": "create_range",
        "description": "Create an IP range within a network. Start and end IPs must be within the network CIDR.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "network_id": {
                    "type": "integer",
                    "description": "ID of the parent network"
                },
                "label": {
                    "type": "string",
                    "description": "Label for this range"
                },
                "start_ip": {
                    "type": "string",
                    "description": "Start IP address"
                },
                "end_ip": {
                    "type": "string",
                    "description": "End IP address"
                },
                "description": {
                    "type": "string",
                    "description": "Range description"
                }
            },
            "required": ["network_id", "label", "start_ip", "end_ip"]
        }
    },
    {
        "name": "delete_range",
        "description": "Delete an IP range from a network.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "network_id": {
                    "type": "integer",
                    "description": "ID of the parent network"
                },
                "range_id": {
                    "type": "integer",
                    "description": "ID of the range to delete"
                }
            },
            "required": ["network_id", "range_id"]
        }
    },
    {
        "name": "health_check",
        "description": "Check Atlas API health and connectivity.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
]

# ---------------------------------------------------------------------------
# MCP Session Management
# ---------------------------------------------------------------------------

class McpSession:
    """Tracks a single MCP SSE session with an async message queue."""

    def __init__(self, session_id: str, loop: asyncio.AbstractEventLoop):
        self.session_id = session_id
        self.loop = loop
        self.queue: asyncio.Queue = asyncio.Queue()
        self.created_at = time.time()

    def push(self, event: str, data: str):
        """Thread-safe push: schedule put on the event loop that owns the queue."""
        self.loop.call_soon_threadsafe(self.queue.put_nowait, (event, data))


# Active sessions keyed by session_id
_sessions: dict[str, McpSession] = {}
_sessions_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Auth Helper
# ---------------------------------------------------------------------------

def validate_bearer_token(authorization: str) -> bool:
    """Validate Bearer token against the Atlas auth system."""
    if not authorization or not authorization.startswith("Bearer "):
        return False

    from app.config import NOAUTH
    if NOAUTH:
        return True

    raw_token = authorization[7:]
    from app.auth import validate_bearer
    return validate_bearer(raw_token)

# ---------------------------------------------------------------------------
# Settings Helper
# ---------------------------------------------------------------------------

def is_mcp_enabled() -> bool:
    """Check if MCP is enabled via env var."""
    import os
    return os.environ.get("MCP_ENABLED", "").lower() in ("true", "1", "yes")

# ---------------------------------------------------------------------------
# Item Serialization Helper
# ---------------------------------------------------------------------------

def _serialize_item(item) -> dict:
    """Convert an Item model to a JSON-safe dict."""
    data = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    for field in ("ips", "openbao_paths", "tags", "ports"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    # Convert datetimes to ISO strings
    for dt_field in ("created_at", "updated_at"):
        val = data.get(dt_field)
        if val:
            data[dt_field] = val.isoformat()
    return data

# ---------------------------------------------------------------------------
# Tool Dispatch
# ---------------------------------------------------------------------------

def call_tool(name: str, arguments: dict) -> dict:
    """Dispatch an MCP tool call to the appropriate handler."""
    import ipaddress
    from sqlalchemy import or_
    from app.database import SessionLocal
    from app.models import Item, Network, Range

    db = SessionLocal()
    try:
        # --- Items ---
        if name == "list_items":
            q = db.query(Item)
            search = arguments.get("search")
            if search:
                pattern = f"%{search}%"
                q = q.filter(or_(
                    Item.name.ilike(pattern),
                    Item.fqdn.ilike(pattern),
                    Item.url.ilike(pattern),
                    Item.description.ilike(pattern),
                    Item.tags.ilike(pattern),
                ))
            for filter_field in ("type", "platform", "status"):
                val = arguments.get(filter_field)
                if val:
                    q = q.filter(getattr(Item, filter_field) == val)
            if "parent_id" in arguments:
                q = q.filter(Item.parent_id == arguments["parent_id"])
            tag = arguments.get("tag")
            if tag:
                q = q.filter(Item.tags.ilike(f"%{tag}%"))
            items = q.order_by(Item.name).all()
            result = [_serialize_item(i) for i in items]
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}

        elif name == "get_item":
            item = db.get(Item, arguments["item_id"])
            if not item:
                return {"content": [{"type": "text", "text": "Item not found"}], "isError": True}
            return {"content": [{"type": "text", "text": json.dumps(_serialize_item(item), indent=2)}]}

        elif name == "create_item":
            item_type = arguments.get("type", "")
            item_name = arguments.get("name", "")
            if not item_type or not item_name:
                return {"content": [{"type": "text", "text": "type and name are required"}], "isError": True}
            data = {}
            for field in ("type", "name", "url", "fqdn", "protocol", "platform", "status",
                          "description", "parent_id", "network_id", "vmid", "notes"):
                if field in arguments:
                    data[field] = arguments[field]
            for json_field in ("ips", "openbao_paths", "tags", "ports"):
                if json_field in arguments:
                    data[json_field] = json.dumps(arguments[json_field])
            item = Item(**data)
            db.add(item)
            db.commit()
            db.refresh(item)
            return {"content": [{"type": "text", "text": json.dumps(_serialize_item(item), indent=2)}]}

        elif name == "update_item":
            item = db.get(Item, arguments["item_id"])
            if not item:
                return {"content": [{"type": "text", "text": "Item not found"}], "isError": True}
            for field in ("type", "name", "url", "fqdn", "protocol", "platform", "status",
                          "description", "parent_id", "network_id", "vmid", "notes"):
                if field in arguments:
                    setattr(item, field, arguments[field])
            for json_field in ("ips", "openbao_paths", "tags", "ports"):
                if json_field in arguments:
                    setattr(item, json_field, json.dumps(arguments[json_field]))
            db.commit()
            db.refresh(item)
            return {"content": [{"type": "text", "text": json.dumps(_serialize_item(item), indent=2)}]}

        elif name == "delete_item":
            item = db.get(Item, arguments["item_id"])
            if not item:
                return {"content": [{"type": "text", "text": "Item not found"}], "isError": True}
            item_name = item.name
            db.delete(item)
            db.commit()
            return {"content": [{"type": "text", "text": f"Deleted item '{item_name}'"}]}

        elif name == "search_by_tag":
            tag = arguments.get("tag", "")
            if not tag:
                return {"content": [{"type": "text", "text": "tag is required"}], "isError": True}
            pattern = f"%{tag}%"
            items = db.query(Item).filter(Item.tags.ilike(pattern)).order_by(Item.name).all()
            result = [_serialize_item(i) for i in items]
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}

        # --- Networks ---
        elif name == "list_networks":
            networks = db.query(Network).order_by(Network.name).all()
            result = []
            for n in networks:
                ranges = db.query(Range).filter(Range.network_id == n.id).all()
                ranges.sort(key=lambda r: ipaddress.ip_address(r.start_ip))
                result.append({
                    "id": n.id, "name": n.name, "cidr": n.cidr,
                    "description": n.description,
                    "ranges": [{
                        "id": r.id, "label": r.label,
                        "start_ip": r.start_ip, "end_ip": r.end_ip,
                        "description": r.description,
                    } for r in ranges],
                })
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}

        elif name == "get_network":
            network = db.get(Network, arguments["network_id"])
            if not network:
                return {"content": [{"type": "text", "text": "Network not found"}], "isError": True}
            ranges = db.query(Range).filter(Range.network_id == network.id).all()
            ranges.sort(key=lambda r: ipaddress.ip_address(r.start_ip))
            result = {
                "id": network.id, "name": network.name, "cidr": network.cidr,
                "description": network.description,
                "ranges": [{
                    "id": r.id, "label": r.label,
                    "start_ip": r.start_ip, "end_ip": r.end_ip,
                    "description": r.description,
                } for r in ranges],
            }
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}

        elif name == "create_network":
            n_name = arguments.get("name", "")
            cidr = arguments.get("cidr", "")
            if not n_name or not cidr:
                return {"content": [{"type": "text", "text": "name and cidr are required"}], "isError": True}
            try:
                ipaddress.ip_network(cidr, strict=False)
            except ValueError as e:
                return {"content": [{"type": "text", "text": f"Invalid CIDR: {e}"}], "isError": True}
            network = Network(name=n_name, cidr=cidr, description=arguments.get("description"))
            db.add(network)
            db.commit()
            db.refresh(network)
            return {"content": [{"type": "text", "text": json.dumps({
                "id": network.id, "name": network.name, "cidr": network.cidr,
                "description": network.description, "ranges": [],
            }, indent=2)}]}

        elif name == "update_network":
            network = db.get(Network, arguments["network_id"])
            if not network:
                return {"content": [{"type": "text", "text": "Network not found"}], "isError": True}
            for field in ("name", "cidr", "description"):
                if field in arguments:
                    if field == "cidr":
                        try:
                            ipaddress.ip_network(arguments[field], strict=False)
                        except ValueError as e:
                            return {"content": [{"type": "text", "text": f"Invalid CIDR: {e}"}], "isError": True}
                    setattr(network, field, arguments[field])
            db.commit()
            db.refresh(network)
            return {"content": [{"type": "text", "text": json.dumps({
                "id": network.id, "name": network.name, "cidr": network.cidr,
                "description": network.description,
            }, indent=2)}]}

        elif name == "delete_network":
            network = db.get(Network, arguments["network_id"])
            if not network:
                return {"content": [{"type": "text", "text": "Network not found"}], "isError": True}
            net_name = network.name
            db.delete(network)
            db.commit()
            return {"content": [{"type": "text", "text": f"Deleted network '{net_name}' and all its ranges"}]}

        # --- Ranges ---
        elif name == "create_range":
            network = db.get(Network, arguments["network_id"])
            if not network:
                return {"content": [{"type": "text", "text": "Network not found"}], "isError": True}
            start_ip = arguments.get("start_ip", "")
            end_ip = arguments.get("end_ip", "")
            label = arguments.get("label", "")
            if not label or not start_ip or not end_ip:
                return {"content": [{"type": "text", "text": "label, start_ip, and end_ip are required"}], "isError": True}
            try:
                net = ipaddress.ip_network(network.cidr, strict=False)
                s = ipaddress.ip_address(start_ip)
                e = ipaddress.ip_address(end_ip)
                if s not in net or e not in net:
                    return {"content": [{"type": "text", "text": f"IPs must be within {network.cidr}"}], "isError": True}
                if s > e:
                    return {"content": [{"type": "text", "text": "start_ip must be <= end_ip"}], "isError": True}
            except ValueError as ex:
                return {"content": [{"type": "text", "text": f"Invalid IP: {ex}"}], "isError": True}
            r = Range(network_id=network.id, label=label, start_ip=start_ip, end_ip=end_ip,
                      description=arguments.get("description"))
            db.add(r)
            db.commit()
            db.refresh(r)
            return {"content": [{"type": "text", "text": json.dumps({
                "id": r.id, "network_id": r.network_id, "label": r.label,
                "start_ip": r.start_ip, "end_ip": r.end_ip, "description": r.description,
            }, indent=2)}]}

        elif name == "delete_range":
            r = db.query(Range).filter(
                Range.id == arguments["range_id"],
                Range.network_id == arguments["network_id"]
            ).first()
            if not r:
                return {"content": [{"type": "text", "text": "Range not found"}], "isError": True}
            range_label = r.label
            db.delete(r)
            db.commit()
            return {"content": [{"type": "text", "text": f"Deleted range '{range_label}'"}]}

        # --- Health ---
        elif name == "health_check":
            return {"content": [{"type": "text", "text": json.dumps({"status": "healthy", "service": "atlas"}, indent=2)}]}

        else:
            return {"content": [{"type": "text", "text": f"Unknown tool: {name}"}], "isError": True}

    except Exception as e:
        logger.exception(f"MCP tool {name} failed")
        return {"content": [{"type": "text", "text": f"Error: {str(e)}"}], "isError": True}
    finally:
        db.close()

# ---------------------------------------------------------------------------
# JSON-RPC Message Handler
# ---------------------------------------------------------------------------

def handle_mcp_message(message: dict) -> dict | None:
    """Process a single JSON-RPC 2.0 MCP message and return a response (or None for notifications)."""
    method = message.get("method", "")
    msg_id = message.get("id")

    is_notification = msg_id is None

    if method == "initialize":
        result = {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {"listChanged": False},
            },
            "serverInfo": {
                "name": "atlas-mcp",
                "version": "1.0.0",
            },
        }
        return {"jsonrpc": "2.0", "id": msg_id, "result": result}

    elif method == "notifications/initialized":
        return None

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": MCP_TOOLS},
        }

    elif method == "tools/call":
        tool_name = message.get("params", {}).get("name", "")
        tool_args = message.get("params", {}).get("arguments", {})
        result = call_tool(tool_name, tool_args)
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": result,
        }

    elif method == "ping":
        return {"jsonrpc": "2.0", "id": msg_id, "result": {}}

    else:
        if is_notification:
            return None
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }

# ---------------------------------------------------------------------------
# MCP Documentation Page
# ---------------------------------------------------------------------------

MCPDOCS_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas - MCP Tools</title>
<style>
  :root { --bg: #0f1117; --surface: #1a1d27; --border: #2d3148; --text: #e1e4ed; --muted: #8b8fa3; --accent: #6c8cff; --accent2: #4fc1a6; --danger: #f87171; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--muted); margin-bottom: 2rem; font-size: 0.95rem; }
  .endpoint-info { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
  .endpoint-info code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-size: 0.9rem; color: var(--accent); }
  .tool { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
  .tool-name { font-size: 1.1rem; font-weight: 600; color: var(--accent2); font-family: monospace; }
  .tool-desc { color: var(--muted); margin: 0.5rem 0; font-size: 0.9rem; }
  .params { margin-top: 0.75rem; }
  .params-title { font-size: 0.8rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 0.4rem; }
  .param { display: flex; gap: 0.75rem; padding: 0.3rem 0; font-size: 0.88rem; }
  .param-name { font-family: monospace; color: var(--accent); min-width: 120px; }
  .param-type { color: var(--muted); min-width: 70px; }
  .param-desc { color: var(--text); }
  .required { color: var(--danger); font-size: 0.75rem; margin-left: 4px; }
  .no-params { color: var(--muted); font-size: 0.85rem; font-style: italic; }
  a { color: var(--accent); }
  .disabled-banner { background: #b91c1c; color: #fff; padding: 0.75rem 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; font-weight: 600; }
</style>
</head>
<body>
<h1>Atlas MCP Server</h1>
<p class="subtitle">Model Context Protocol tools for managing infrastructure inventory — items, networks, and IP ranges</p>

DISABLED_BANNER

<div class="endpoint-info">
  <strong>SSE Endpoint:</strong> <code>GET /mcp/sse</code><br>
  <strong>Messages Endpoint:</strong> <code>POST /mcp/messages?session_id=...</code><br>
  <strong>Auth:</strong> Bearer token required (same API token as REST API). See <a href="/apidocs">/apidocs</a> for REST API docs.
</div>

TOOL_LIST_PLACEHOLDER
</body>
</html>"""


def render_mcpdocs() -> str:
    """Build the /mcpdocs HTML from tool definitions."""
    parts = []
    for tool in MCP_TOOLS:
        schema = tool.get("inputSchema", {})
        props = schema.get("properties", {})
        required = set(schema.get("required", []))

        if props:
            rows = []
            for pname, pinfo in props.items():
                req_badge = '<span class="required">required</span>' if pname in required else ""
                ptype = pinfo.get("type", "any")
                pdesc = pinfo.get("description", "")
                rows.append(
                    f'<div class="param">'
                    f'<span class="param-name">{pname}{req_badge}</span>'
                    f'<span class="param-type">{ptype}</span>'
                    f'<span class="param-desc">{pdesc}</span>'
                    f'</div>'
                )
            params_html = (
                '<div class="params">'
                '<div class="params-title">Parameters</div>'
                + "".join(rows)
                + '</div>'
            )
        else:
            params_html = '<div class="params"><span class="no-params">No parameters</span></div>'

        parts.append(
            f'<div class="tool">'
            f'<div class="tool-name">{tool["name"]}</div>'
            f'<div class="tool-desc">{tool["description"]}</div>'
            f'{params_html}'
            f'</div>'
        )

    disabled_banner = ""
    if not is_mcp_enabled():
        disabled_banner = (
            '<div class="disabled-banner">'
            'MCP is currently disabled. Set MCP_ENABLED=true to use MCP endpoints.</div>'
        )

    html = MCPDOCS_HTML.replace("TOOL_LIST_PLACEHOLDER", "\n".join(parts))
    html = html.replace("DISABLED_BANNER", disabled_banner)
    return html
