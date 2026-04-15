"""initial schema (已降级为 baseline 的下游存根，升级逻辑已合并到 0001_baseline_schema)

此文件仅作链条衔接用途：
  - 旧链：None → fe77249f9144 → 454b5c374e8a
  - 新基线：None → 0001_baseline_schema（全量建表）
  - 修复后链：0001_baseline_schema → fe77249f9144(noop) → 454b5c374e8a(noop)

新环境从零开始只需 flask db upgrade，会走 0001_baseline_schema 全量建表，
fe77249f9144 / 454b5c374e8a 都是 noop，不会重复建表。
已有数据库（alembic_version = 454b5c374e8a）直接保持不动，无需操作。

Revision ID: fe77249f9144
Revises: 0001_baseline_schema
Create Date: 2026-04-13 13:32:39.637830

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'fe77249f9144'
down_revision = '0001_baseline_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 表已由 0001_baseline_schema 建好，此处为空操作
    pass


def downgrade():
    # 对应 upgrade 为空，downgrade 也为空
    pass
