import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from participant import Participant
from permissions import can
from room import (
    MAX_CHAT_LENGTH,
    MAX_QUEUE,
    clean_action,
    describe_action,
    is_valid_emoji,
)
from room_manager import RoomManager
from youtube import extract_video_id

app = FastAPI()
manager = RoomManager()

ASSIGNABLE_ROLES = {"moderator", "participant", "viewer"}   # "host" is only given by transfer
AUTO_ADVANCE_GUARD = 3   # seconds. Ignore "video ended" reports right after a video started


def clean_username(value):
    name = str(value or "").strip()[:30]
    return name or "Guest"


def joined_message(room, participant):
    return {
        "type": "room_joined",
        "roomId": room.code,
        "userId": participant.user_id,
        "role": participant.role,
        "participants": room.participant_list(),
        "pendingRequests": room.request_list(),
        "chatHistory": room.chat_history,
        "queue": room.queue,
    }


async def broadcast_queue(room, action, by, item):
    await room.broadcast({
        "type": "queue_updated",
        "queue": room.queue,
        "action": action,      # added | removed | played | advanced
        "by": by,
        "item": item,
    })


async def broadcast_playback(room, action, by):
    await room.broadcast({"type": "sync_state", **room.get_state(), "action": action, "by": by})


async def queue_video(room, user_id, username, video_id):
    """Adds a video to the queue, or starts it right away if nothing is loaded yet.
    Only call this for allowed people: a host/moderator, or a request a host/moderator approved.
    Returns False if the queue is full."""
    if room.video_id is None:
        room.apply_action("change_video", {"videoId": video_id})
        room.log(f"{username} {describe_action('change_video', {'videoId': video_id})}")
        await broadcast_playback(room, "change_video", username)
        return True

    item = room.add_to_queue(user_id, username, video_id)
    if item is None:
        return False
    room.log(f"{username} added {video_id} to the queue")
    await broadcast_queue(room, "added", username, item)
    return True



async def announce_cancelled(room, cancelled_requests):
    for request in cancelled_requests:
        await room.broadcast({
            "type": "request_resolved",
            "requestId": request["requestId"],
            "status": "cancelled",
            "by": None,
            "request": request,
            "pendingRequests": room.request_list(),
        })


async def handle_leave(room, participant):
    """Runs when someone disconnects. Also handles auto host handover."""
    if room.remove_participant(participant.user_id) is None:
        return   # they were already removed (for example, kicked by the host)

    if room.is_empty():
        manager.delete_room(room.code)
        return

    cancelled = room.cancel_requests_from(participant.user_id)
    room.log(f"{participant.username} left")

    new_host = None
    if participant.role == "host":
        new_host = room.pick_successor()
        new_host.role = "host"
        room.log(f"{new_host.username} became the host because {participant.username} left")

    await room.broadcast({
        "type": "user_left",
        "username": participant.username,
        "userId": participant.user_id,
        "participants": room.participant_list(),
    })

    if new_host:
        await room.broadcast({
            "type": "role_assigned",
            "userId": new_host.user_id,
            "username": new_host.username,
            "role": "host",
            "reason": "host_left",
            "participants": room.participant_list(),
        })

    await announce_cancelled(room, cancelled)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    participant = None    # who this connection is
    room = None           # which room they are in

    try:
        while True:
            try:
                data = await ws.receive_json()
            except ValueError:
                await ws.send_json({"type": "error", "message": "Messages must be valid JSON"})
                continue
            if not isinstance(data, dict):
                await ws.send_json({"type": "error", "message": "Message must be a JSON object"})
                continue

            event = data.get("type")

            # ---------- create / join ----------
            if event == "create_room":
                if participant is not None:
                    await ws.send_json({"type": "error", "message": "You are already in a room"})
                    continue
                room = manager.create_room()
                participant = Participant(clean_username(data.get("username")), ws, role="host")
                room.add_participant(participant)
                room.log(f"{participant.username} created the room")
                await participant.send(joined_message(room, participant))
                await participant.send({"type": "sync_state", **room.get_state()})

            elif event == "join_room":
                if participant is not None:
                    await ws.send_json({"type": "error", "message": "You are already in a room"})
                    continue
                found = manager.get_room(str(data.get("roomId", "")).upper())
                if found is None:
                    await ws.send_json({"type": "error", "message": "Room not found"})
                    continue
                room = found
                participant = Participant(clean_username(data.get("username")), ws)
                room.add_participant(participant)
                room.log(f"{participant.username} joined")
                await participant.send(joined_message(room, participant))
                await participant.send({"type": "sync_state", **room.get_state()})
                await room.broadcast({
                    "type": "user_joined",
                    "username": participant.username,
                    "userId": participant.user_id,
                    "role": participant.role,
                    "participants": room.participant_list(),
                })

            # ---------- leaving ----------
            elif event == "leave_room":
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue
                await handle_leave(room, participant)   # same cleanup as a dropped connection
                break

            # ---------- playback controls (host / moderator) ----------
            elif event in ("play", "pause", "seek", "change_video"):
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue

                if not can(participant.role, event):
                    await participant.send({
                        "type": "error",
                        "message": f"Your role ({participant.role}) is not allowed to {event}. "
                                   f"You can send a request_change instead.",
                    })
                    continue

                clean, error = clean_action(event, data)
                if error:
                    await participant.send({"type": "error", "message": error})
                    continue

                room.apply_action(event, clean)
                room.log(f"{participant.username} {describe_action(event, clean)}")
                await room.broadcast({
                    "type": "sync_state",
                    **room.get_state(),
                    "action": event,
                    "by": participant.username,
                })

            # ---------- chat and reactions (everyone) ----------
            elif event in ("chat", "react"):
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue

                if not can(participant.role, event):
                    await participant.send({"type": "error", "message": f"You are not allowed to {event}"})
                    continue

                gap = 0.5 if event == "chat" else 0.3
                if not room.allow(participant.user_id, event, gap):
                    await participant.send({"type": "error", "message": "You are doing that too fast"})
                    continue

                if event == "chat":
                    text = str(data.get("text", "")).strip()
                    if not text:
                        await participant.send({"type": "error", "message": "Message is empty"})
                        continue
                    if len(text) > MAX_CHAT_LENGTH:
                        await participant.send({
                            "type": "error",
                            "message": f"Message is too long (max {MAX_CHAT_LENGTH} characters)",
                        })
                        continue
                    message = room.add_chat(participant, text)
                    await room.broadcast({"type": "chat_message", **message})

                else:
                    emoji = data.get("emoji")
                    if not is_valid_emoji(emoji):
                        await participant.send({
                            "type": "error",
                            "message": "Reactions must be an emoji (send text through chat instead)",
                        })
                        continue
                    await room.broadcast({
                        "type": "reaction",
                        "userId": participant.user_id,
                        "username": participant.username,
                        "emoji": emoji,
                        "videoTime": room.get_state()["currentTime"],
                    })

            # ---------- approval flow ----------
            elif event == "request_change":
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue

                if not can(participant.role, "request_change"):
                    await participant.send({
                        "type": "error",
                        "message": "You can change the video directly, no request needed",
                    })
                    continue

                action = str(data.get("action", ""))
                clean, error = clean_action(action, data)
                if error:
                    await participant.send({"type": "error", "message": error})
                    continue

                request = room.add_request(participant, action, clean)
                if request is None:
                    await participant.send({
                        "type": "error",
                        "message": "You already have too many pending requests. Wait for a reply.",
                    })
                    continue

                room.log(f"{participant.username} requested a change: {action.replace('_', ' ')}")
                await room.broadcast({
                    "type": "change_requested",
                    "request": request,
                    "pendingRequests": room.request_list(),
                })

            elif event in ("approve_request", "reject_request"):
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue

                if not can(participant.role, event):
                    await participant.send({
                        "type": "error",
                        "message": "Only the host or a moderator can approve or reject requests",
                    })
                    continue

                request = room.pop_request(str(data.get("requestId", "")))
                if request is None:
                    await participant.send({"type": "error", "message": "That request no longer exists"})
                    continue

                status = "approved" if event == "approve_request" else "rejected"
                if status == "approved":
                    if request["action"] == "queue_add":
                        added = await queue_video(room, request["userId"], request["username"], request["params"]["videoId"])
                        if not added:
                            status = "rejected"
                            await participant.send({
                                "type": "error",
                                "message": f"The queue is full (max {MAX_QUEUE} videos)",
                            })
                    else:
                        room.apply_action(request["action"], request["params"])
                room.log(
                    f"{participant.username} {status} {request['username']}'s request "
                    f"({request['action'].replace('_', ' ')})"
                )

                await room.broadcast({
                    "type": "request_resolved",
                    "requestId": request["requestId"],
                    "status": status,
                    "by": participant.username,
                    "request": request,
                    "pendingRequests": room.request_list(),
                })

                # queue_add changes the queue, not the playback, so it sends no sync_state
                if status == "approved" and request["action"] != "queue_add":
                    await room.broadcast({
                        "type": "sync_state",
                        **room.get_state(),
                        "action": request["action"],
                        "by": f"{request['username']} (approved by {participant.username})",
                    })

            # ---------- video queue ----------
            elif event in ("queue_add", "queue_remove", "queue_play", "video_ended"):
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue

                if not can(participant.role, event):
                    await participant.send({
                        "type": "error",
                        "message": f"Your role ({participant.role}) is not allowed to {event}",
                    })
                    continue

                if event == "queue_add":
                    if not room.allow(participant.user_id, event, 0.5):
                        await participant.send({"type": "error", "message": "You are doing that too fast"})
                        continue
                    video_id = extract_video_id(data.get("videoId", ""))
                    if video_id is None:
                        await participant.send({"type": "error", "message": "That is not a valid YouTube link or video ID"})
                        continue

                    if not await queue_video(room, participant.user_id, participant.username, video_id):
                        await participant.send({
                            "type": "error",
                            "message": f"The queue is full (max {MAX_QUEUE} videos)",
                        })

                elif event == "queue_remove":
                    item = room.remove_from_queue(str(data.get("queueId", "")))
                    if item is None:
                        await participant.send({"type": "error", "message": "That video is no longer in the queue"})
                        continue
                    room.log(f"{participant.username} removed {item['videoId']} from the queue")
                    await broadcast_queue(room, "removed", participant.username, item)

                elif event == "queue_play":
                    item = room.remove_from_queue(str(data.get("queueId", "")))
                    if item is None:
                        await participant.send({"type": "error", "message": "That video is no longer in the queue"})
                        continue
                    room.play_queue_item(item)
                    room.log(f"{participant.username} played {item['videoId']} from the queue")
                    await broadcast_queue(room, "played", participant.username, item)
                    await broadcast_playback(room, "change_video", participant.username)

                elif event == "video_ended":
                    # Every host/moderator browser reports this, but only the first report counts:
                    # after it, room.video_id and updated_at have changed, so the others are ignored.
                    if data.get("videoId") != room.video_id:
                        continue
                    if time.time() - room.updated_at < AUTO_ADVANCE_GUARD:
                        continue
                    item = room.pop_next()
                    if item is None:
                        continue
                    room.play_queue_item(item)
                    room.log(f"Next in queue: {item['videoId']}")
                    await broadcast_queue(room, "advanced", None, item)
                    await broadcast_playback(room, "next_video", "The queue")

            # ---------- host powers ----------
            elif event in ("assign_role", "remove_participant", "transfer_host"):
                if participant is None:
                    await ws.send_json({"type": "error", "message": "Join a room first"})
                    continue

                if not can(participant.role, event):
                    await participant.send({
                        "type": "error",
                        "message": f"Only the host can {event}",
                    })
                    continue

                target = room.participants.get(str(data.get("userId", "")))
                if target is None:
                    await participant.send({"type": "error", "message": "That person is not in this room"})
                    continue
                if target.user_id == participant.user_id:
                    await participant.send({"type": "error", "message": "You can't do that to yourself"})
                    continue

                if event == "assign_role":
                    new_role = str(data.get("role", ""))
                    if new_role not in ASSIGNABLE_ROLES:
                        await participant.send({"type": "error", "message": "Invalid role"})
                        continue
                    target.role = new_role
                    room.log(f"{participant.username} made {target.username} a {new_role}")
                    await room.broadcast({
                        "type": "role_assigned",
                        "userId": target.user_id,
                        "username": target.username,
                        "role": new_role,
                        "participants": room.participant_list(),
                    })

                elif event == "remove_participant":
                    room.remove_participant(target.user_id)
                    cancelled = room.cancel_requests_from(target.user_id)
                    room.log(f"{participant.username} removed {target.username}")
                    payload = {
                        "type": "participant_removed",
                        "userId": target.user_id,
                        "username": target.username,
                        "participants": room.participant_list(),
                    }
                    await target.send(payload)       # tell the removed person
                    await room.broadcast(payload)    # tell everyone who is left
                    await announce_cancelled(room, cancelled)
                    try:
                        await target.websocket.close()
                    except Exception:
                        pass

                elif event == "transfer_host":
                    participant.role = "moderator"   # the old host becomes a moderator
                    target.role = "host"
                    room.log(f"{participant.username} made {target.username} the host")
                    await room.broadcast({
                        "type": "host_transferred",
                        "oldHostId": participant.user_id,
                        "newHostId": target.user_id,
                        "newHostName": target.username,
                        "participants": room.participant_list(),
                    })

        await ws.close()   # we only get here after leave_room

    except WebSocketDisconnect:
        if room and participant:
            await handle_leave(room, participant)