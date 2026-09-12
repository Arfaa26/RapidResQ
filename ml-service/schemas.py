from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

CATEGORIES = ['FIRE', 'ACCIDENT', 'FLOOD', 'MEDICAL', 'CRIME', 'CIVIC']
PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']


class Point(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    accuracyMeters: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    address: str = Field(default='', max_length=500)


class Report(BaseModel):
    model_config = ConfigDict(extra='ignore')
    id: str = Field(max_length=100)
    title: str = Field(default='', max_length=500)
    description: str = Field(default='', max_length=10000)
    category: str = Field(default='HAZARD', max_length=30)
    location: Point
    createdAt: datetime
    imageHash: str | None = Field(default=None, pattern=r'^[a-f0-9]{16}$')


class DuplicateRequest(BaseModel):
    report: Report
    candidates: list[Report] = Field(max_length=500)


class HotspotRequest(BaseModel):
    incidents: list[Report] = Field(max_length=5000)
    days: Literal[1, 7, 30] = 7
    radiusMeters: float = Field(default=500, ge=50, le=5000)
    minSamples: int = Field(default=3, ge=2, le=100)
