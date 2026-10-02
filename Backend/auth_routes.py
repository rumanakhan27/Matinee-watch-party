from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import check_password, create_token, hash_password
from database import get_db
from models import User

router = APIRouter()


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=6, max_length=72)


@router.post("/register")
async def register(body: Credentials, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.username == body.username))
    if existing:
        raise HTTPException(status_code=400, detail="That username is already taken")

    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:   # two people grabbed the same name at the same moment
        await db.rollback()
        raise HTTPException(status_code=400, detail="That username is already taken")

    return {"token": create_token(user.id, user.username), "username": user.username}


@router.post("/login")
async def login(body: Credentials, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == body.username))
    # same message for "no such user" and "wrong password", so nobody can probe for names
    if user is None or not check_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong username or password")

    return {"token": create_token(user.id, user.username), "username": user.username}