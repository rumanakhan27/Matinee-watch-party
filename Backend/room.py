import time
import uuid

from youtube import extract_video_id

MAX_PENDING_PER_USER = 3
MAX_QUEUE = 20              # how many videos can wait in the queue
MAX_EMOJI_LENGTH = 16       # some emojis (like families) are built from many characters
MAX_CHAT_LENGTH = 500
CHAT_HISTORY_LIMIT = 50     # how many recent chat messages the room remembers
ACTIVITY_LIMIT = 100        # how many recent room events the room remembers


def is_valid_time(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0


def is_valid_emoji(value):
    """Accepts any emoji, but rejects plain text so reactions can't be used as a second chat."""
    if not isinstance(value, str) or not value or len(value) > MAX_EMOJI_LENGTH:
        return False
    for ch in value:
        # emojis are never plain keyboard characters, letters, or spaces
        if ord(ch) < 128 or ch.isalpha() or ch.isspace():
            return False
    return True


def format_time(seconds):
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


def describe_action(action, params):
    """A short human-readable description, used by the activity log."""
    if action == "play":
        return "pressed play"
    if action == "pause":
        return "paused the video"
    if action == "seek":
        return f"jumped to {format_time(params['time'])}"
    if action == "change_video":
        return f"changed the video to {params['videoId']}"
    if action == "queue_add":
        return f"added {params['videoId']} to the queue"
    return action


def clean_action(action, data):
    """Checks the input for a playback action.
    Returns (clean_params, None) if fine, or (None, error_message) if not."""
    if action in ("play", "pause"):
        at_time = data.get("time")
        if at_time is not None and not is_valid_time(at_time):
            return None, "Invalid time"
        return {"time": at_time}, None

    if action == "seek":
        at_time = data.get("time")
        if not is_valid_time(at_time):
            return None, "Invalid seek time"
        return {"time": at_time}, None

    if action in ("change_video", "queue_add"):
        video_id = extract_video_id(data.get("videoId", ""))
        if video_id is None:
            return None, "That is not a valid YouTube link or video ID"
        return {"videoId": video_id}, None

    return None, "Unknown action"


class Room:
    def __init__(self, code):
        self.code = code
        self.participants = {}        # user_id -> Participant
        self.pending_requests = {}    # request_id -> request
        self.chat_history = []        # recent chat messages
        self.queue = []               # videos waiting to play, first one plays next
        self.activity = []            # recent room events (used later by "Catch me up")
        self._last_seen = {}          # (user_id, kind) -> time, for spam control
        self.video_id = None
        self.play_state = "paused"
        self.current_time = 0.0       # video position (seconds) at updated_at
        self.updated_at = time.time()

    # ---------- people ----------
    def add_participant(self, participant):
        self.participants[participant.user_id] = participant

    def remove_participant(self, user_id):
        return self.participants.pop(user_id, None)

    def participant_list(self):
        return [p.to_dict() for p in self.participants.values()]

    def is_empty(self):
        return len(self.participants) == 0

    async def broadcast(self, data):
        for p in list(self.participants.values()):
            await p.send(data)

    # ---------- video state ----------
    def get_state(self):
        position = self.current_time
        if self.play_state == "playing":
            # video kept moving since the last update, so add that time
            position += time.time() - self.updated_at
        return {
            "playState": self.play_state,
            "currentTime": round(position, 2),
            "videoId": self.video_id,
        }

    def play(self, at_time=None):
        self.current_time = at_time if at_time is not None else self.get_state()["currentTime"]
        self.play_state = "playing"
        self.updated_at = time.time()

    def pause(self, at_time=None):
        self.current_time = at_time if at_time is not None else self.get_state()["currentTime"]
        self.play_state = "paused"
        self.updated_at = time.time()

    def seek(self, to_time):
        self.current_time = to_time
        self.updated_at = time.time()

    def change_video(self, video_id):
        self.video_id = video_id
        self.current_time = 0.0
        self.play_state = "paused"
        self.updated_at = time.time()

    def apply_action(self, action, params):
        """Applies a checked playback action (see clean_action)."""
        if action == "play":
            self.play(params.get("time"))
        elif action == "pause":
            self.pause(params.get("time"))
        elif action == "seek":
            self.seek(params["time"])
        elif action == "change_video":
            self.change_video(params["videoId"])

    # ---------- change requests (approval flow) ----------
    def add_request(self, participant, action, params):
        mine = [r for r in self.pending_requests.values() if r["userId"] == participant.user_id]
        if len(mine) >= MAX_PENDING_PER_USER:
            return None
        request = {
            "requestId": str(uuid.uuid4())[:8],
            "userId": participant.user_id,
            "username": participant.username,
            "action": action,
            "params": params,
        }
        self.pending_requests[request["requestId"]] = request
        return request

    def pop_request(self, request_id):
        return self.pending_requests.pop(request_id, None)

    def request_list(self):
        return list(self.pending_requests.values())

    def cancel_requests_from(self, user_id):
        ids = [rid for rid, r in self.pending_requests.items() if r["userId"] == user_id]
        return [self.pending_requests.pop(rid) for rid in ids]

    # ---------- video queue ----------
    def add_to_queue(self, user_id, username, video_id):
        if len(self.queue) >= MAX_QUEUE:
            return None
        item = {
            "queueId": str(uuid.uuid4())[:8],
            "videoId": video_id,
            "userId": user_id,
            "username": username,
        }
        self.queue.append(item)
        return item

    def find_queue_item(self, queue_id):
        for item in self.queue:
            if item["queueId"] == queue_id:
                return item
        return None

    def remove_from_queue(self, queue_id):
        item = self.find_queue_item(queue_id)
        if item is not None:
            self.queue.remove(item)
        return item

    def pop_next(self):
        return self.queue.pop(0) if self.queue else None

    def play_queue_item(self, item):
        """Starts a video that was taken out of the queue, from the beginning."""
        self.change_video(item["videoId"])
        self.play(0.0)

    # ---------- chat, activity log, spam control ----------
    def add_chat(self, participant, text):
        message = {
            "messageId": str(uuid.uuid4())[:8],
            "userId": participant.user_id,
            "username": participant.username,
            "role": participant.role,
            "text": text,
            "sentAt": round(time.time(), 2),
        }
        self.chat_history.append(message)
        del self.chat_history[:-CHAT_HISTORY_LIMIT]   # keep only the most recent ones
        return message

    def log(self, text):
        self.activity.append({"time": round(time.time(), 2), "text": text})
        del self.activity[:-ACTIVITY_LIMIT]

    def allow(self, user_id, kind, min_gap):
        """Returns False if this person did the same kind of thing less than min_gap seconds ago."""
        now = time.time()
        key = (user_id, kind)
        if now - self._last_seen.get(key, 0) < min_gap:
            return False
        self._last_seen[key] = now
        return True

    # ---------- host handover ----------
    def pick_successor(self):
        # Moderators first, then participants, then viewers.
        # Within a role, whoever joined earliest is chosen.
        for wanted_role in ("moderator", "participant", "viewer"):
            for p in self.participants.values():
                if p.role == wanted_role:
                    return p
        return None