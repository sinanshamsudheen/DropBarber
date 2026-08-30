from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int


class Page(BaseModel, Generic[T]):
    """Standard list response shape: `{"data": [...], "pagination": {...}}`."""

    data: list[T]
    pagination: Pagination


class Envelope(BaseModel, Generic[T]):
    """Standard single-resource response shape: `{"data": ...}`."""

    data: T


def envelope(data: T) -> Envelope[T]:
    """Wraps a single resource in the standard `{"data": ...}` response shape,
    as a real `Envelope[T]` instance — not a bare dict — so a route's return
    type annotation can name the exact shape it returns and a type checker
    can verify it."""
    return Envelope(data=data)


class StatusOut(BaseModel):
    """Shared response shape for status-toggle-only routes (deactivate, etc.)."""

    id: UUID
    status: str
