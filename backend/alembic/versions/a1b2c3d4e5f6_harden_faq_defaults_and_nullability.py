"""Harden FAQ defaults and nullability

Revision ID: a1b2c3d4e5f6
Revises: d5eefed643de
Create Date: 2026-05-01 15:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d5eefed643de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE faqs SET hits = 0 WHERE hits IS NULL")
    op.execute("UPDATE faqs SET is_active = 1 WHERE is_active IS NULL")
    op.execute("UPDATE faqs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    op.execute("UPDATE faqs SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")

    with op.batch_alter_table("faqs") as batch_op:
        batch_op.alter_column(
            "hits",
            existing_type=sa.Integer(),
            nullable=False,
            server_default="0",
        )
        batch_op.alter_column(
            "is_active",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        )
        batch_op.alter_column(
            "created_at",
            existing_type=sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )
        batch_op.alter_column(
            "updated_at",
            existing_type=sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        )


def downgrade() -> None:
    with op.batch_alter_table("faqs") as batch_op:
        batch_op.alter_column(
            "updated_at",
            existing_type=sa.DateTime(),
            nullable=True,
            server_default=None,
        )
        batch_op.alter_column(
            "created_at",
            existing_type=sa.DateTime(),
            nullable=True,
            server_default=None,
        )
        batch_op.alter_column(
            "is_active",
            existing_type=sa.Boolean(),
            nullable=True,
            server_default=None,
        )
        batch_op.alter_column(
            "hits",
            existing_type=sa.Integer(),
            nullable=True,
            server_default=None,
        )
