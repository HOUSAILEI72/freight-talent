from pydantic import BaseModel


class ChartPoint(BaseModel):
    period: str
    count: int


class ChartResponse(BaseModel):
    data: list[ChartPoint]
    total: int
    granularity: str
    tag_groups: list[list[int]]
    fetched_at: str
