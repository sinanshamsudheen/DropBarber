def check_in(column: str, values: tuple[str, ...]) -> str:
    """Builds a `column IN ('a', 'b', ...)` CHECK constraint expression."""
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"
