import random
import string

from room import Room


class RoomManager:
    def __init__(self):
        self.rooms = {}               # code -> Room

    def create_room(self):
        code = self._generate_code()
        room = Room(code)
        self.rooms[code] = room
        return room

    def get_room(self, code):
        return self.rooms.get(code)

    def delete_room(self, code):
        self.rooms.pop(code, None)

    def _generate_code(self):
        while True:
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in self.rooms:    # make sure it's unique
                return code