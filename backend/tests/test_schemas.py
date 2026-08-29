import pytest
from pydantic import ValidationError

from app.schemas import DESCRIPTION_MAX_LENGTH, TodoCreate


@pytest.mark.parametrize(
    "raw",
    ["", "   ", "\t\n ", "  " + "x" * (DESCRIPTION_MAX_LENGTH + 1) + "  "],
)
def test_descriptions_outside_the_bounds_are_rejected(raw: str) -> None:
    with pytest.raises(ValidationError):
        TodoCreate(description=raw)


@pytest.mark.parametrize("length", [1, DESCRIPTION_MAX_LENGTH])
def test_descriptions_are_trimmed_before_the_bounds_are_checked(length: int) -> None:
    payload = TodoCreate(description="  " + "x" * length + "  ")

    assert payload.description == "x" * length
