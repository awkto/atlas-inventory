import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Repository
from app.schemas import RepositoryCreate, RepositoryOut, RepositoryUpdate

router = APIRouter(prefix="/api/repositories", tags=["repositories"], dependencies=[Depends(verify_token)])


def _serialize_json_fields(repo: Repository) -> dict:
    data = {c.name: getattr(repo, c.name) for c in repo.__table__.columns}
    for field in ("tags", "openbao_paths"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    return data


def _repo_to_out(repo: Repository) -> RepositoryOut:
    return RepositoryOut.model_validate(_serialize_json_fields(repo))


def _set_json_fields(data: dict) -> dict:
    for field in ("tags", "openbao_paths"):
        if field in data and data[field] is not None:
            data[field] = json.dumps(data[field])
    return data


@router.get("", response_model=list[RepositoryOut])
def list_repositories(
    search: str | None = Query(None),
    platform: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Repository)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Repository.name.ilike(pattern),
                Repository.url.ilike(pattern),
                Repository.description.ilike(pattern),
                Repository.tags.ilike(pattern),
            )
        )
    if platform:
        q = q.filter(Repository.platform == platform)
    return [_repo_to_out(r) for r in q.order_by(Repository.name).all()]


@router.get("/{repo_id}", response_model=RepositoryOut)
def get_repository(repo_id: int, db: Session = Depends(get_db)):
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(404, "Repository not found")
    return _repo_to_out(repo)


@router.post("", response_model=RepositoryOut, status_code=201)
def create_repository(payload: RepositoryCreate, db: Session = Depends(get_db)):
    data = _set_json_fields(payload.model_dump())
    repo = Repository(**data)
    db.add(repo)
    db.commit()
    db.refresh(repo)
    return _repo_to_out(repo)


@router.put("/{repo_id}", response_model=RepositoryOut)
def update_repository(repo_id: int, payload: RepositoryUpdate, db: Session = Depends(get_db)):
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(404, "Repository not found")
    data = _set_json_fields(payload.model_dump(exclude_unset=True))
    for key, val in data.items():
        setattr(repo, key, val)
    db.commit()
    db.refresh(repo)
    return _repo_to_out(repo)


@router.delete("/{repo_id}", status_code=204)
def delete_repository(repo_id: int, db: Session = Depends(get_db)):
    repo = db.get(Repository, repo_id)
    if not repo:
        raise HTTPException(404, "Repository not found")
    db.delete(repo)
    db.commit()
