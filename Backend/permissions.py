# Everyone in the room, whatever their role, can chat and send reactions.
EVERYONE = {"chat", "react"}

# Queue powers: host and moderators only.
# Participants and viewers send a request_change with action "queue_add" instead,
# and a host or moderator approves it (same approval flow as play, pause, seek).
QUEUE_CONTROL = {"queue_add", "queue_remove", "queue_play", "video_ended"}

# Which role can do which action. The server checks this before every event.
PERMISSIONS = {
    "host": {
        "play", "pause", "seek", "change_video",
        "assign_role", "remove_participant", "transfer_host",
        "approve_request", "reject_request",
    } | QUEUE_CONTROL | EVERYONE,
    "moderator": {
        "play", "pause", "seek", "change_video",
        "approve_request", "reject_request",
    } | QUEUE_CONTROL | EVERYONE,
    "participant": {"request_change"} | EVERYONE,
    "viewer": {"request_change"} | EVERYONE,
}


def can(role, action):
    return action in PERMISSIONS.get(role, set())