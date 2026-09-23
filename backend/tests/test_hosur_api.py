import pytest
from fastapi.testclient import TestClient

from app.main import app
from hosur.api import get_store
from hosur.store import Store


@pytest.fixture
def client(tmp_path):
    store = Store(tmp_path / "hosur.db")
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def provider(**overrides):
    return {"id": "p1", "serviceId": "plumber", "name": "Karthik Plumbing", "phone": "+919876543210", "rating": 4.8, "experience": "8 years", "area": "SIPCOT", **overrides}


def test_fresh_database_is_seeded_with_catalogue_news_and_feed(client):
    state = client.get("/api/state").json()
    assert len(state["services"]) == 79
    assert state["services"][0]["id"] == "plumber"
    assert next(s for s in state["services"] if s["id"] == "tuition")["category"] == "Tutors & coaches"
    assert [n["id"] for n in state["newsItems"]] == ["news-grt-water", "news-attibele-pipeline", "news-sipcot-power"]
    assert [p["id"] for p in state["feedPosts"]] == ["feed-1", "feed-2", "feed-3"]
    assert state["feedPosts"][0]["likedBy"] == []
    assert state["providerCatalog"] == {} and state["reviewsByProvider"] == {} and state["askedFor"] == []


def test_seed_runs_only_once(tmp_path):
    Store(tmp_path / "hosur.db").add_service({"id": "x", "name": "X", "tamil": "X", "category": "Home repair"})
    assert len(Store(tmp_path / "hosur.db").get_state()["services"]) == 80


def test_provider_lifecycle(client):
    assert client.post("/api/providers", json=provider()).json() == provider()
    assert client.post("/api/providers", json=provider(id="p2", name="karthik plumbing")).status_code == 409
    assert client.post("/api/providers", json=provider(id="p3", serviceId="no-such-service")).status_code == 409

    assert client.patch("/api/providers/p1", json={"area": "Attibele"}).json()["area"] == "Attibele"
    assert "area" not in client.patch("/api/providers/p1", json={"area": ""}).json()
    without_area = {key: value for key, value in provider().items() if key != "area"}
    assert client.get("/api/state").json()["providerCatalog"] == {"plumber": [without_area]}

    assert client.delete("/api/providers/p1").status_code == 204
    assert client.delete("/api/providers/p1").status_code == 404
    assert client.get("/api/state").json()["providerCatalog"] == {}


def test_reviews_are_listed_newest_first_per_provider(client):
    client.post("/api/providers", json=provider())
    for n in (1, 2):
        client.post("/api/reviews", json={"id": f"r{n}", "providerId": "p1", "userName": "Ravi", "rating": 5, "comment": f"Visit {n}"})
    assert client.post("/api/reviews", json={"id": "r3", "providerId": "missing", "userName": "Ravi", "rating": 5, "comment": "x"}).status_code == 409
    assert [r["id"] for r in client.get("/api/state").json()["reviewsByProvider"]["p1"]] == ["r2", "r1"]


def test_likes_count_once_per_user(client):
    for user in ("9876543210", "9876543210", "another-user"):
        post = client.post("/api/feed/feed-1/like", json={"userId": user}).json()
    assert post["likes"] == 130
    assert post["likedBy"] == ["9876543210", "another-user"]
    assert client.post("/api/feed/missing/like", json={"userId": "u"}).status_code == 404


def test_new_posts_news_services_and_requests(client):
    client.post("/api/feed", json={"id": "feed-new", "author": "Ravi Kumar", "handle": "@ravikumar", "location": "SIPCOT", "title": "Community update", "caption": "Hello", "accent": "red", "tag": "#LocalVoices"})
    client.post("/api/news", json={"id": "news-new", "badge": "Alert", "area": "Bagalur", "title": "T", "summary": "S"})
    client.post("/api/services", json={"id": "curtain-fitting", "name": "Curtain fitting", "tamil": "Curtain fitting", "category": "Home repair"})
    assert client.post("/api/asked-for", json={"query": "  drone repair "}).json() == ["drone repair"]

    state = client.get("/api/state").json()
    assert state["feedPosts"][0]["id"] == "feed-new" and state["feedPosts"][0]["likes"] == 0
    assert state["newsItems"][0]["id"] == "news-new"
    assert state["services"][-1]["id"] == "curtain-fitting"
    assert client.post("/api/services", json={"id": "curtain-fitting", "name": "Dup", "tamil": "Dup", "category": "Home repair"}).status_code == 409


def test_blank_fields_are_rejected(client):
    assert client.post("/api/asked-for", json={"query": "   "}).status_code == 422
    assert client.post("/api/providers", json=provider(rating=9)).status_code == 422
