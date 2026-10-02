import uuid


class Participant:
    def __init__(self, username, websocket, role="participant", account_id=None):
        self.user_id = str(uuid.uuid4())[:8]   # short random ID (only for this room)
        self.account_id = account_id           # the id in the users table
        self.username = username
        self.websocket = websocket
        self.role = role

    def to_dict(self):
        # the version of this person that is safe to send to browsers
        return {"userId": self.user_id, "username": self.username, "role": self.role}

    async def send(self, data):
        try:
            await self.websocket.send_json(data)
        except Exception:
            pass   # their connection is already closed, nothing to do