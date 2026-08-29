class AppError(Exception):
    code = "INTERNAL_ERROR"
    status_code = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404


class ValidationError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 400
