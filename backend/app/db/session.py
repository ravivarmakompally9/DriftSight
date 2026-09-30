from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import settings
from app.core.security import DEMO_USERS
from app.db.models import User

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        for email, rec in DEMO_USERS.items():
            if s.exec(select(User).where(User.email == email)).first():
                continue
            u = rec["user"]
            s.add(User(email=u.email, name=u.name, role=u.role, org=u.org, team=u.team))
        s.commit()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
