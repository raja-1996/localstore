"""
Unit tests for shared pagination schemas in app/schemas/common.py.

No HTTP client or Supabase mocking needed — these are pure Pydantic model tests.
"""
import pytest
from pydantic import ValidationError

from app.schemas.common import CursorParams, PaginatedResponse


class TestCursorParams:
    def test_defaults(self):
        params = CursorParams()
        assert params.limit == 20
        assert params.before is None

    def test_custom_limit(self):
        params = CursorParams(limit=50)
        assert params.limit == 50

    def test_custom_before(self):
        params = CursorParams(before="cursor-abc")
        assert params.before == "cursor-abc"

    def test_limit_minimum_valid(self):
        params = CursorParams(limit=1)
        assert params.limit == 1

    def test_limit_maximum_valid(self):
        params = CursorParams(limit=100)
        assert params.limit == 100

    def test_limit_below_minimum_raises(self):
        with pytest.raises(ValidationError):
            CursorParams(limit=0)

    def test_limit_above_maximum_raises(self):
        with pytest.raises(ValidationError):
            CursorParams(limit=101)

    def test_limit_negative_raises(self):
        with pytest.raises(ValidationError):
            CursorParams(limit=-1)


class TestPaginatedResponse:
    def test_int_data_serialization(self):
        resp = PaginatedResponse[int](data=[1, 2, 3], has_more=True, next_cursor="abc")
        assert resp.data == [1, 2, 3]
        assert resp.has_more is True
        assert resp.next_cursor == "abc"

    def test_int_data_model_dump(self):
        resp = PaginatedResponse[int](data=[10, 20], has_more=False)
        dumped = resp.model_dump()
        assert dumped == {"data": [10, 20], "has_more": False, "next_cursor": None}

    def test_empty_data(self):
        resp = PaginatedResponse[int](data=[], has_more=False)
        assert resp.data == []
        assert resp.has_more is False
        assert resp.next_cursor is None

    def test_empty_data_model_dump(self):
        resp = PaginatedResponse[str](data=[], has_more=False)
        dumped = resp.model_dump()
        assert dumped["data"] == []
        assert dumped["has_more"] is False
        assert dumped["next_cursor"] is None

    def test_dict_items(self):
        items = [{"id": "1", "name": "Shop A"}, {"id": "2", "name": "Shop B"}]
        resp = PaginatedResponse[dict](data=items, has_more=True, next_cursor="xyz")
        assert len(resp.data) == 2
        assert resp.data[0]["name"] == "Shop A"
        assert resp.next_cursor == "xyz"

    def test_dict_items_model_dump(self):
        items = [{"id": "abc", "value": 42}]
        resp = PaginatedResponse[dict](data=items, has_more=False)
        dumped = resp.model_dump()
        assert dumped["data"] == [{"id": "abc", "value": 42}]
        assert dumped["has_more"] is False

    def test_next_cursor_defaults_to_none(self):
        resp = PaginatedResponse[int](data=[1], has_more=False)
        assert resp.next_cursor is None

    def test_has_more_false_with_cursor(self):
        """has_more=False with a cursor is valid — cursor presence is independent."""
        resp = PaginatedResponse[int](data=[1], has_more=False, next_cursor="end")
        assert resp.has_more is False
        assert resp.next_cursor == "end"
