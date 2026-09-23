import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from hosur import api
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


def shutdown(**overrides):
    return {
        "id": "shutdown-1",
        "title": "Scheduled maintenance",
        "areas": ["SIPCOT", "Bagalur"],
        "startsAt": "2026-01-10T09:00:00+05:30",
        "endsAt": "2026-01-10T17:00:00+05:30",
        "reason": "Substation maintenance",
        "sourceUrl": "https://example.com/notices/1",
        "verifiedAt": "2026-01-01",
        **overrides,
    }


def charging_station(**overrides):
    return {
        "id": "station-1",
        "name": "Test charging station",
        "area": "SIPCOT",
        "address": "1 Test Road, Hosur",
        "connectors": "CCS2, Type 2",
        "hours": "24 hours",
        "sourceUrl": "https://example.com/stations/1",
        "verifiedAt": "2026-01-01",
        **overrides,
    }


def civic_alert(**overrides):
    return {
        "id": "alert-1",
        "title": "Supply maintenance",
        "category": "water",
        "areas": ["SIPCOT", "ஓசூர்"],
        "route": "",
        "message": "Store water before the maintenance window.",
        "startsAt": "2026-01-10T09:00:00+05:30",
        "expiresAt": "2026-01-10T17:00:00+05:30",
        "sourceUrl": "https://example.com/civic/1",
        "verifiedAt": "2026-01-01",
        **overrides,
    }


def traffic_alert(**overrides):
    return civic_alert(**{"category": "traffic", "areas": [], "route": "NH 44", **overrides})


def waste_alert(**overrides):
    return civic_alert(**{"category": "waste", **overrides})


def emergency_contact(**overrides):
    return {
        "id": "contact-1",
        "name": "Test ambulance directory entry",
        "service": "ambulance",
        "phone": "108",
        "details": "Emergency ambulance assistance, 24 hours.",
        "sourceUrl": "https://example.com/contacts/1",
        "verifiedAt": "2026-01-01",
        **overrides,
    }


EMPTY_UPDATES = {"shutdowns": [], "chargingStations": [], "civicAlerts": [], "emergencyContacts": []}
RESOURCES = [
    ("/api/shutdowns", "shutdowns", shutdown),
    ("/api/charging-stations", "chargingStations", charging_station),
    ("/api/civic-alerts", "civicAlerts", civic_alert),
    ("/api/civic-alerts", "civicAlerts", traffic_alert),
    ("/api/civic-alerts", "civicAlerts", waste_alert),
    ("/api/emergency-contacts", "emergencyContacts", emergency_contact),
]


def test_updates_start_empty_without_changing_state(client):
    assert client.get("/api/updates").json() == EMPTY_UPDATES
    state = client.get("/api/state").json()
    assert set(state) == {"services", "providerCatalog", "reviewsByProvider", "newsItems", "feedPosts", "askedFor"}
    client.post("/api/shutdowns", json=shutdown())
    client.post("/api/charging-stations", json=charging_station())
    client.post("/api/civic-alerts", json=civic_alert())
    client.post("/api/emergency-contacts", json=emergency_contact())
    assert client.get("/api/state").json() == state


@pytest.mark.parametrize("path,key,factory", RESOURCES)
def test_updates_lifecycle(client, path, key, factory):
    original = factory()
    response = client.post(path, json=original)
    assert response.status_code == 201
    assert response.json() == original
    assert client.post(path, json=factory(sourceUrl="http://example.com/duplicate")).status_code == 409
    assert client.get("/api/updates").json()[key] == [original]

    second = factory(id="second")
    assert client.post(path, json=second).status_code == 201
    modified = factory(sourceUrl="http://example.com/reverified", verifiedAt="2026-01-02")
    if key == "shutdowns":
        modified.update(title="Revised notice", areas=["Hosur"], reason="Repairs",
                        startsAt="2026-01-11T10:00:00+05:30", endsAt="2026-01-11T11:00:00+05:30")
    elif key == "chargingStations":
        modified.update(name="Revised station", area="Bagalur", address="2 Test Road",
                        connectors="CCS2", hours="09:00–18:00")
    elif key == "civicAlerts":
        modified.update(title="Revised notice", category="traffic", areas=[], route="Bagalur Road",
                        message="Follow the signed diversion.",
                        startsAt="2026-01-11T10:00:00+05:30", expiresAt="2026-01-11T11:00:00+05:30")
    else:
        modified.update(name="Revised contact", service="fire", phone="+91 (4344) 222-222",
                        details="Call for fire emergencies.")
    url = f"{path}/{original['id']}"
    response = client.put(url, json=modified)
    assert response.status_code == 200
    assert response.json() == modified
    assert client.put(url, json=modified).status_code == 200
    assert client.get("/api/updates").json()[key] == [modified, second]
    assert client.put(url, json=factory(id="second")).status_code == 422
    assert client.put(f"{path}/missing", json=factory(id="missing")).status_code == 404
    assert client.get("/api/updates").json()[key] == [modified, second]
    response = client.delete(url)
    assert response.status_code == 204
    assert response.content == b""
    assert client.delete(url).status_code == 404
    assert client.get("/api/updates").json()[key] == [second]


@pytest.mark.parametrize("path,key,factory", RESOURCES)
@pytest.mark.parametrize("value", ["", "   ", None, 123])
def test_update_strings_must_be_nonempty_strings(client, path, key, factory, value):
    for field in factory():
        if field in {"areas", "startsAt", "endsAt", "expiresAt", "verifiedAt"}:
            continue
        if field == "route" and factory()["category"] != "traffic":
            continue
        assert client.post(path, json=factory(**{field: value})).status_code == 422, field
    assert client.get("/api/updates").json()[key] == []


@pytest.mark.parametrize("path,key,factory", RESOURCES)
def test_update_fields_are_required_on_create_and_replace(client, path, key, factory):
    original = factory()
    assert client.post(path, json=original).status_code == 201
    for field in original:
        if field == "route" and original["category"] != "traffic":
            continue
        incomplete = {name: value for name, value in original.items() if name != field}
        assert client.post(path, json=incomplete).status_code == 422, field
        assert client.put(f"{path}/{original['id']}", json=incomplete).status_code == 422, field
    assert client.get("/api/updates").json()[key] == [original]


@pytest.mark.parametrize("path,key,factory", RESOURCES)
@pytest.mark.parametrize("field,value", [
    ("sourceUrl", "ftp://example.com/source"),
    ("sourceUrl", "javascript:alert(1)"),
    ("sourceUrl", "/relative/path"),
    ("sourceUrl", "https://"),
    ("sourceUrl", "not a url"),
    ("verifiedAt", "2026-02-30"),
    ("verifiedAt", "20260101"),
    ("verifiedAt", "2026-1-1"),
    ("verifiedAt", "2026-01-01T00:00:00Z"),
    ("verifiedAt", "9999-12-31"),
    ("verifiedAt", 1767225600),
    ("verifiedAt", None),
])
def test_invalid_verification_rejected_on_create_and_replace(client, path, key, factory, field, value):
    original = factory()
    assert client.post(path, json=original).status_code == 201
    invalid = factory(**{field: value})
    assert client.post(path, json=invalid).status_code == 422
    assert client.put(f"{path}/{original['id']}", json=invalid).status_code == 422
    assert client.get("/api/updates").json()[key] == [original]


@pytest.mark.parametrize("field,value", [
    ("areas", []), ("areas", [""]), ("areas", ["SIPCOT", " "]),
    ("areas", "SIPCOT"), ("areas", [123]), ("areas", None),
    ("startsAt", "2026-01-10T09:00:00"),
    ("endsAt", "2026-01-10T17:00:00"),
    ("startsAt", "2026-01-10"),
    ("startsAt", "not a timestamp"),
    ("startsAt", "2026-02-30T09:00:00Z"),
    ("startsAt", 1767225600), ("endsAt", "1767225600"),
    ("endsAt", None),
    ("endsAt", "2026-01-10T09:00:00+05:30"),
    ("endsAt", "2026-01-10T08:59:59+05:30"),
    ("endsAt", "2026-01-10T10:00:00+07:00"),
])
def test_invalid_shutdown_rejected_on_create_and_replace(client, field, value):
    assert client.post("/api/shutdowns", json=shutdown()).status_code == 201
    invalid = shutdown(**{field: value})
    assert client.post("/api/shutdowns", json=invalid).status_code == 422
    assert client.put("/api/shutdowns/shutdown-1", json=invalid).status_code == 422
    assert client.get("/api/updates").json()["shutdowns"] == [shutdown()]


def test_shutdown_supports_utc_and_compares_absolute_times(client):
    entry = shutdown(startsAt="2026-01-10T03:30:00Z", endsAt="2026-01-10T04:00:00+00:00")
    response = client.post("/api/shutdowns", json=entry)
    assert response.status_code == 201
    assert response.json()["startsAt"] == "2026-01-10T03:30:00Z"
    assert response.json()["endsAt"] == "2026-01-10T04:00:00Z"
    assert client.get("/api/updates").json()["shutdowns"] == [response.json()]


@pytest.mark.parametrize("path,key,factory", RESOURCES)
def test_verified_date_uses_india_midnight(client, monkeypatch, path, key, factory):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 1, 1, 20, 0, tzinfo=timezone.utc).astimezone(tz)

    monkeypatch.setattr(api, "datetime", FrozenDatetime)
    assert client.post(path, json=factory(verifiedAt="2026-01-02")).status_code == 201
    assert client.post(path, json=factory(id="future", verifiedAt="2026-01-03")).status_code == 422
    assert client.get("/api/updates").json()[key][0]["verifiedAt"] == "2026-01-02"


@pytest.mark.parametrize("path,key,factory", RESOURCES)
def test_verification_tomorrow_in_india_is_rejected(client, path, key, factory):
    tomorrow = (datetime.now(api.INDIA_TIMEZONE).date() + timedelta(days=1)).isoformat()
    assert client.post(path, json=factory(verifiedAt=tomorrow)).status_code == 422
    assert client.get("/api/updates").json()[key] == []


def test_updates_persist_across_store_reopens(tmp_path):
    db_path = tmp_path / "updates.db"
    original = Store(db_path)
    original.add_shutdown(shutdown(areas=["SIPCOT", "ஓசூர்"]))
    original.add_charging_station(charging_station())
    original.add_civic_alert(civic_alert())
    original.add_emergency_contact(emergency_contact())
    reopened = Store(db_path)
    assert reopened.get_updates() == original.get_updates()
    revised_shutdown = shutdown(title="Revised")
    revised_station = charging_station(hours="Daytime")
    revised_alert = traffic_alert(message="Use the diversion.")
    revised_contact = emergency_contact(phone="1-1-2", details="Revised coverage.")
    assert reopened.update_shutdown(revised_shutdown) == revised_shutdown
    assert reopened.update_charging_station(revised_station) == revised_station
    assert reopened.update_civic_alert(revised_alert) == revised_alert
    assert reopened.update_emergency_contact(revised_contact) == revised_contact
    reopened = Store(db_path)
    assert reopened.get_updates() == {
        "shutdowns": [revised_shutdown], "chargingStations": [revised_station],
        "civicAlerts": [revised_alert], "emergencyContacts": [revised_contact],
    }
    assert reopened.delete_shutdown("shutdown-1")
    assert reopened.delete_charging_station("station-1")
    assert reopened.delete_civic_alert("alert-1")
    assert reopened.delete_emergency_contact("contact-1")
    assert Store(db_path).get_updates() == EMPTY_UPDATES


@pytest.mark.parametrize("has_existing_updates", [False, True])
def test_updates_migration_preserves_existing_database(tmp_path, has_existing_updates):
    db_path = tmp_path / "legacy.db"
    store = Store(db_path)
    store.add_service({"id": "custom", "name": "Custom", "tamil": "Custom", "category": "Custom"})
    store.add_provider(provider())
    store.add_review({"id": "review", "providerId": "p1", "userName": "Ravi", "rating": 5, "comment": "Good"})
    store.like_post("feed-1", "test-user")
    store.add_asked_for("Custom request")
    store.add_shutdown(shutdown())
    store.add_charging_station(charging_station())
    with sqlite3.connect(db_path) as conn:
        # Simulate the on-disk schema before the additive updates migration.
        if not has_existing_updates:
            conn.execute("DROP TABLE power_shutdowns")
            conn.execute("DROP TABLE charging_stations")
        conn.execute("DROP TABLE civic_alerts")
        conn.execute("DROP TABLE emergency_contacts")
        conn.execute("CREATE TABLE unrelated_data (value TEXT)")
        conn.execute("INSERT INTO unrelated_data VALUES ('keep me')")
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
        before = {table: conn.execute(f'SELECT * FROM "{table}"').fetchall() for table in tables}
    previous_state = store.get_state()

    migrated = Store(db_path)
    expected = {**EMPTY_UPDATES}
    if has_existing_updates:
        expected.update(shutdowns=[shutdown()], chargingStations=[charging_station()])
    assert migrated.get_updates() == expected
    assert migrated.get_state() == previous_state
    migrated.add_shutdown(shutdown())
    migrated.add_charging_station(charging_station())
    migrated.add_civic_alert(civic_alert())
    migrated.add_emergency_contact(emergency_contact())
    assert Store(db_path).get_updates() == {
        "shutdowns": [shutdown()], "chargingStations": [charging_station()],
        "civicAlerts": [civic_alert()], "emergencyContacts": [emergency_contact()],
    }
    assert Store(db_path).get_state() == previous_state
    with sqlite3.connect(db_path) as conn:
        after = {table: conn.execute(f'SELECT * FROM "{table}"').fetchall() for table in tables}
    assert after == before


@pytest.mark.parametrize("field,value", [
    ("category", "power"), ("category", "Water"), ("category", None),
    ("areas", []), ("areas", [""]), ("areas", ["Hosur", " "]),
    ("areas", "Hosur"), ("areas", [123]), ("areas", None),
    ("route", None), ("route", 123),
    ("startsAt", "2026-01-10T09:00:00"),
    ("expiresAt", "2026-01-10T17:00:00"),
    ("startsAt", "2026-01-10"), ("startsAt", "invalid"),
    ("expiresAt", "2026-02-30T09:00:00Z"),
    ("startsAt", 1767225600), ("expiresAt", "1767225600"),
    ("expiresAt", None),
    ("expiresAt", "2026-01-10T09:00:00+05:30"),
    ("expiresAt", "2026-01-10T08:59:59+05:30"),
    ("expiresAt", "2026-01-10T10:00:00+07:00"),
])
@pytest.mark.parametrize("factory", [civic_alert, waste_alert])
def test_invalid_civic_alert_rejected_on_create_and_replace(client, factory, field, value):
    original = factory()
    assert client.post("/api/civic-alerts", json=original).status_code == 201
    invalid = factory(**{field: value})
    assert client.post("/api/civic-alerts", json=invalid).status_code == 422
    assert client.put("/api/civic-alerts/alert-1", json=invalid).status_code == 422
    assert client.get("/api/updates").json()["civicAlerts"] == [original]


@pytest.mark.parametrize("category", ["water", "waste"])
def test_civic_alert_optional_route_defaults_to_empty(client, category):
    entry = civic_alert(category=category)
    del entry["route"]
    response = client.post("/api/civic-alerts", json=entry)
    assert response.status_code == 201
    assert response.json() == {**entry, "route": ""}
    assert client.put("/api/civic-alerts/alert-1", json=entry).json() == response.json()


def test_civic_alert_supports_utc_and_compares_absolute_times(client):
    entry = traffic_alert(startsAt="2026-01-10T03:30:00Z", expiresAt="2026-01-10T04:00:00+00:00")
    response = client.post("/api/civic-alerts", json=entry)
    assert response.status_code == 201
    assert response.json() == {**entry, "expiresAt": "2026-01-10T04:00:00Z"}
    assert client.get("/api/updates").json()["civicAlerts"] == [response.json()]


@pytest.mark.parametrize("phone", [
    "12", "1234567890123456", "++91108", "91+108", "tel:108", "108;ext=1",
    "108?body=test", "108/112", "1e3", "CALL108", "१०८", "１０８",
    "108\n", "108\t", "( - )", "+", "108<script>",
])
def test_invalid_emergency_phone_rejected_on_create_and_replace(client, phone):
    original = emergency_contact()
    assert client.post("/api/emergency-contacts", json=original).status_code == 201
    invalid = emergency_contact(phone=phone)
    assert client.post("/api/emergency-contacts", json=invalid).status_code == 422
    assert client.put("/api/emergency-contacts/contact-1", json=invalid).status_code == 422
    assert client.get("/api/updates").json()["emergencyContacts"] == [original]


@pytest.mark.parametrize("phone", ["100", "112", "1098", "1800 123 4567", "+91 (4344) 222-222", "123456789012345"])
def test_valid_emergency_phone_preserves_display(client, phone):
    entry = emergency_contact(phone=phone)
    response = client.post("/api/emergency-contacts", json=entry)
    assert response.status_code == 201
    assert response.json() == entry
    assert client.put("/api/emergency-contacts/contact-1", json=entry).json() == entry
    assert client.get("/api/updates").json()["emergencyContacts"] == [entry]
