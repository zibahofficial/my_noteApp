from sqlalchemy import create_engine, Column, String, Text, DateTime, func, ForeignKey, Table, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os
import logging
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/notes_app")

logger = logging.getLogger("notes-db")

Base = declarative_base()

note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", String(36), ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag", String(50), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "createdAt": int(self.created_at.timestamp() * 1000) if self.created_at else 0,
        }

class Note(Base):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True)
    title = Column(String(200), nullable=False, default="Untitled Note")
    content = Column(Text, nullable=False, default="")
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="notes")
    tags = relationship(
        "Tag",
        secondary=note_tags,
        back_populates="notes",
        primaryjoin="Note.id == note_tags.c.note_id",
        secondaryjoin="note_tags.c.tag == Tag.name",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "tags": sorted(t.name for t in self.tags),
            "createdAt": int(self.created_at.timestamp() * 1000) if self.created_at else 0,
            "updatedAt": int(self.updated_at.timestamp() * 1000) if self.updated_at else 0,
        }

class Tag(Base):
    __tablename__ = "tags"

    name = Column(String(50), primary_key=True)
    notes = relationship(
        "Note",
        secondary=note_tags,
        back_populates="tags",
        primaryjoin="Tag.name == note_tags.c.tag",
        secondaryjoin="note_tags.c.note_id == Note.id",
    )

def get_engine():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    with engine.connect():
        pass
    return engine

engine = get_engine()
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)
    migrate_existing_notes()

def migrate_existing_notes():
    with engine.begin() as conn:
        exists = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'notes' AND column_name = 'user_id'"
        )).fetchone()
        if not exists:
            logger.info("Adding user_id column to notes table...")
            conn.execute(text(
                "ALTER TABLE notes ADD COLUMN user_id VARCHAR(36) "
                "REFERENCES users(id) ON DELETE CASCADE"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_notes_user_id ON notes(user_id)"
            ))
            logger.info("user_id column added to notes table.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()