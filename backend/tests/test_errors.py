from app.errors import AppError, NotFoundError, ValidationError

EXPECTED = {
    AppError: (500, "INTERNAL_ERROR"),
    NotFoundError: (404, "NOT_FOUND"),
    ValidationError: (400, "VALIDATION_ERROR"),
}


def descendants(cls: type[AppError]) -> set[type[AppError]]:
    found = {cls}
    for subclass in cls.__subclasses__():
        found |= descendants(subclass)
    return found


def test_every_app_error_maps_to_its_status_and_code() -> None:
    assert descendants(AppError) == set(EXPECTED)

    for cls, (status_code, code) in EXPECTED.items():
        error = cls("Something went wrong.")
        assert (error.status_code, error.code) == (status_code, code)
        assert error.message == "Something went wrong."
        assert str(error) == "Something went wrong."
        assert isinstance(error, AppError)


def test_subclasses_do_not_share_a_status_or_a_code() -> None:
    assert len({status for status, _ in EXPECTED.values()}) == len(EXPECTED)
    assert len({code for _, code in EXPECTED.values()}) == len(EXPECTED)
    assert {code for _, code in EXPECTED.values()} == {
        "INTERNAL_ERROR",
        "NOT_FOUND",
        "VALIDATION_ERROR",
    }
