"""Team workspaces: create teams, invite members by email, manage roles."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import rate_limited_user
from ..models import Team, TeamMember, User
from ..schemas.team import TeamCreate, TeamInvite, TeamMemberOut, TeamOut

router = APIRouter(prefix="/teams", tags=["teams"])


async def _team_out(db: AsyncSession, team: Team) -> TeamOut:
    members_result = await db.execute(
        select(TeamMember, User).join(User, User.id == TeamMember.user_id).where(TeamMember.team_id == team.id)
    )
    members = []
    for member, user in members_result.all():
        members.append(
            TeamMemberOut(user_id=user.id, email=user.email, name=user.name, role=member.role)
        )
    return TeamOut(
        id=team.id,
        name=team.name,
        owner_id=team.owner_id,
        members=members,
        created_at=team.created_at,
    )


@router.post("", response_model=TeamOut, status_code=201)
async def create_team(body: TeamCreate, user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    team = Team(name=body.name.strip(), owner_id=user.id)
    db.add(team)
    await db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role="owner"))
    await db.commit()
    await db.refresh(team)
    return await _team_out(db, team)


@router.get("", response_model=list[TeamOut])
async def list_teams(user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team).join(TeamMember, TeamMember.team_id == Team.id).where(TeamMember.user_id == user.id)
    )
    teams = result.scalars().all()
    return [await _team_out(db, team) for team in teams]


@router.get("/{team_id}", response_model=TeamOut)
async def get_team(team_id: uuid.UUID, user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    team = await _member_team(db, team_id, user)
    return await _team_out(db, team)


@router.post("/{team_id}/invite", response_model=TeamOut, status_code=201)
async def invite_member(
    team_id: uuid.UUID,
    body: TeamInvite,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    team = await _member_team(db, team_id, user, allow_roles={"owner", "editor"})
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="No user with that email exists yet. They must sign up first.")
    existing = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == target.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member.")
    db.add(TeamMember(team_id=team.id, user_id=target.id, role=body.role))
    await db.commit()
    return await _team_out(db, team)


@router.delete("/{team_id}/members/{member_user_id}", status_code=204)
async def remove_member(
    team_id: uuid.UUID,
    member_user_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    team = await _member_team(db, team_id, user, allow_roles={"owner"})
    result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == member_user_id)
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found.")
    if member.user_id == team.owner_id:
        raise HTTPException(status_code=400, detail="The owner cannot be removed.")
    await db.delete(member)
    await db.commit()


async def _member_team(
    db: AsyncSession,
    team_id: uuid.UUID,
    user: User,
    allow_roles: set[str] | None = None,
) -> Team:
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found.")
    result = await db.execute(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id))
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=403, detail="You are not a member of this team.")
    if allow_roles and member.role not in allow_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return team
