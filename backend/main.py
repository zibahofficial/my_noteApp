from fastapi import FastAPI, HTTPException, Depends, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from database import get_db, init_db, Note, Tag, User, note_tags, engine
import uuid
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notes-api")

app = FastAPI(title="Notes API", version="1.0.0")

def _cors_origins():
    raw = os.getenv("CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(user_id: str):
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class NoteCreate(BaseModel):
    title: Optional[str] = "Untitled Note"
    content: Optional[str] = ""
    tags: Optional[List[str]] = []

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None

@app.on_event("startup")
def startup():
    init_db()
    logger.info(f"Database initialized: {engine.url.drivername}://...")

@app.get("/api/health")
def health():
    return {"status": "ok", "database": engine.url.drivername}

@app.post("/api/auth/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict(),
    }

@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user.to_dict(),
    }

@app.post("/api/auth/logout")
def logout():
    return {"ok": True}

@app.get("/api/auth/me")
def auth_me(current_user: User = Depends(get_current_user)):
    return current_user.to_dict()

def get_owned_note_or_404(note_id: str, user: User, db: Session):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@app.get("/api/notes")
def list_notes(
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Note).filter(Note.user_id == current_user.id).order_by(Note.updated_at.desc())
    if tag:
        query = query.filter(Note.tags.any(Tag.name == tag))
    notes = query.all()
    if q:
        q = q.lower()
        notes = [n for n in notes if q in n.title.lower() or q in n.content.lower() or any(q in t.name.lower() for t in n.tags)]
    return [n.to_dict() for n in notes]

@app.post("/api/notes")
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = Note(
        id=str(uuid.uuid4()),
        title=payload.title or "Untitled Note",
        content=payload.content or "",
        user_id=current_user.id,
    )
    db.add(note)
    db.flush()
    if payload.tags:
        for name in set(payload.tags):
            tag = db.query(Tag).filter(Tag.name == name).first()
            if not tag:
                tag = Tag(name=name)
                db.add(tag)
            note.tags.append(tag)
    db.commit()
    db.refresh(note)
    return note.to_dict()

@app.get("/api/notes/{note_id}")
def get_note(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = get_owned_note_or_404(note_id, current_user, db)
    return note.to_dict()

@app.put("/api/notes/{note_id}")
def update_note(
    note_id: str,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = get_owned_note_or_404(note_id, current_user, db)
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.tags is not None:
        note.tags = []
        db.flush()
        for name in set(payload.tags):
            tag = db.query(Tag).filter(Tag.name == name).first()
            if not tag:
                tag = Tag(name=name)
                db.add(tag)
            note.tags.append(tag)
    db.commit()
    db.refresh(note)
    return note.to_dict()

@app.post("/api/notes/{note_id}/duplicate")
def duplicate_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = get_owned_note_or_404(note_id, current_user, db)
    new_note = Note(
        id=str(uuid.uuid4()),
        title=note.title + " (copy)",
        content=note.content,
        user_id=current_user.id,
    )
    new_note.tags = note.tags[:]
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note.to_dict()

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = get_owned_note_or_404(note_id, current_user, db)
    db.delete(note)
    db.commit()
    return {"ok": True}

@app.get("/api/tags")
def list_tags(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_note_ids = [n.id for n in db.query(Note).filter(Note.user_id == current_user.id).all()]
    if not user_note_ids:
        return []
    tags = (
        db.query(Tag)
        .join(note_tags, Tag.name == note_tags.c.tag)
        .filter(note_tags.c.note_id.in_(user_note_ids))
        .order_by(Tag.name)
        .all()
    )
    return [t.name for t in tags]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)