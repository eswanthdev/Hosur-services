"""SQLite persistence for Hosur Services.

Each method opens its own connection so the store is safe to share across
FastAPI's worker threads. Lists come back in the order the frontend shows
them: catalogue items oldest-first, news/feed/reviews newest-first.
"""

import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

SEED_PATH = Path(__file__).with_name("seed_data.json")

SCHEMA = """
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tamil TEXT NOT NULL,
    category TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    rating REAL NOT NULL,
    experience TEXT NOT NULL,
    area TEXT
);
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating REAL NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_ids TEXT NOT NULL,
    area TEXT NOT NULL,
    experience TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('en', 'ta', 'te', 'kn')),
    consent INTEGER NOT NULL CHECK (consent = 1),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS provider_applications_phone_status
    ON provider_applications (phone, status);
CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    badge TEXT NOT NULL,
    area TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feed_posts (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    handle TEXT NOT NULL,
    location TEXT NOT NULL,
    title TEXT NOT NULL,
    caption TEXT NOT NULL,
    accent TEXT NOT NULL,
    tag TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_likes (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS asked_for (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS power_shutdowns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    areas TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    reason TEXT NOT NULL,
    source_url TEXT NOT NULL,
    verified_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS charging_stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT NOT NULL,
    connectors TEXT NOT NULL,
    hours TEXT NOT NULL,
    source_url TEXT NOT NULL,
    verified_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS civic_alerts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    areas TEXT NOT NULL,
    route TEXT NOT NULL,
    message TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    source_url TEXT NOT NULL,
    verified_at TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_india_mobile(phone: str) -> str:
    compact = re.sub(r"[ -]", "", phone)
    if not re.fullmatch(r"(?:\+91|91)?[6-9][0-9]{9}", compact):
        raise ValueError("Phone must be a valid Indian mobile number.")
    return "+91" + compact[-10:]


class ApplicationError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class Store:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            if conn.execute("SELECT COUNT(*) FROM services").fetchone()[0] == 0:
                self._seed(conn)

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _seed(self, conn: sqlite3.Connection) -> None:
        seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        conn.executemany(
            "INSERT INTO services (id, name, tamil, category) VALUES (:id, :name, :tamil, :category)",
            seed["services"],
        )
        # News and feed are listed newest-first, so insert the seed in reverse.
        conn.executemany(
            "INSERT INTO news_items (id, badge, area, title, summary) VALUES (:id, :badge, :area, :title, :summary)",
            list(reversed(seed["newsItems"])),
        )
        created_at = _now()
        conn.executemany(
            "INSERT INTO feed_posts (id, author, handle, location, title, caption, accent, tag, likes, comments, created_at)"
            " VALUES (:id, :author, :handle, :location, :title, :caption, :accent, :tag, :likes, :comments, :created_at)",
            [{**post, "created_at": created_at} for post in reversed(seed["feedPosts"])],
        )

    # ---- reads -------------------------------------------------------------

    def get_state(self) -> dict:
        with self._connect() as conn:
            services = [dict(row) for row in conn.execute("SELECT id, name, tamil, category FROM services ORDER BY rowid")]

            provider_catalog: dict[str, list[dict]] = {}
            for row in conn.execute("SELECT * FROM providers ORDER BY rowid"):
                provider = self._provider(conn, row)
                provider_catalog.setdefault(provider["serviceId"], []).append(provider)

            reviews_by_provider: dict[str, list[dict]] = {}
            for row in conn.execute("SELECT * FROM reviews ORDER BY rowid DESC"):
                review = self._review(row)
                reviews_by_provider.setdefault(review["providerId"], []).append(review)

            news_items = [dict(row) for row in conn.execute("SELECT id, badge, area, title, summary FROM news_items ORDER BY rowid DESC")]
            feed_posts = [self._post(conn, row) for row in conn.execute("SELECT * FROM feed_posts ORDER BY rowid DESC")]
            asked_for = [row[0] for row in conn.execute("SELECT query FROM asked_for ORDER BY id")]

        return {
            "services": services,
            "providerCatalog": provider_catalog,
            "reviewsByProvider": reviews_by_provider,
            "newsItems": news_items,
            "feedPosts": feed_posts,
            "askedFor": asked_for,
        }

    def get_updates(self) -> dict:
        with self._connect() as conn:
            return {
                "shutdowns": [self._shutdown(row) for row in conn.execute("SELECT * FROM power_shutdowns ORDER BY rowid")],
                "chargingStations": [self._charging_station(row) for row in conn.execute("SELECT * FROM charging_stations ORDER BY rowid")],
                "civicAlerts": [self._civic_alert(row) for row in conn.execute("SELECT * FROM civic_alerts ORDER BY rowid")],
            }

    @staticmethod
    def _shutdown(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "title": row["title"],
            "areas": json.loads(row["areas"]),
            "startsAt": row["starts_at"],
            "endsAt": row["ends_at"],
            "reason": row["reason"],
            "sourceUrl": row["source_url"],
            "verifiedAt": row["verified_at"],
        }

    @staticmethod
    def _charging_station(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "name": row["name"],
            "area": row["area"],
            "address": row["address"],
            "connectors": row["connectors"],
            "hours": row["hours"],
            "sourceUrl": row["source_url"],
            "verifiedAt": row["verified_at"],
        }

    @staticmethod
    def _civic_alert(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "title": row["title"],
            "category": row["category"],
            "areas": json.loads(row["areas"]),
            "route": row["route"],
            "message": row["message"],
            "startsAt": row["starts_at"],
            "expiresAt": row["expires_at"],
            "sourceUrl": row["source_url"],
            "verifiedAt": row["verified_at"],
        }

    @staticmethod
    def _provider(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
        average = conn.execute(
            "SELECT AVG(rating) FROM reviews WHERE provider_id = ?", (row["id"],)
        ).fetchone()[0]
        provider = {
            "id": row["id"],
            "name": row["name"],
            "phone": row["phone"],
            "rating": average if average is not None else row["rating"] or None,
            "experience": row["experience"],
            "serviceId": row["service_id"],
        }
        if row["area"]:
            provider["area"] = row["area"]
        return provider

    @staticmethod
    def _application(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "name": row["name"],
            "phone": row["phone"],
            "serviceIds": json.loads(row["service_ids"]),
            "area": row["area"],
            "experience": row["experience"],
            "language": row["language"],
            "consent": bool(row["consent"]),
            "status": row["status"],
            "createdAt": row["created_at"],
            "reviewedAt": row["reviewed_at"],
        }

    @staticmethod
    def _provider_phone_conflict(conn: sqlite3.Connection, phone: str, service_ids: list[str]) -> bool:
        placeholders = ",".join("?" for _ in service_ids)
        for row in conn.execute(
            f"SELECT phone FROM providers WHERE service_id IN ({placeholders})", service_ids
        ):
            try:
                if normalize_india_mobile(row["phone"]) == phone:
                    return True
            except ValueError:
                # Legacy manual listings may contain non-mobile contact numbers.
                continue
        return False

    @staticmethod
    def _services_exist(conn: sqlite3.Connection, service_ids: list[str]) -> bool:
        return all(conn.execute("SELECT 1 FROM services WHERE id = ?", (sid,)).fetchone() for sid in service_ids)

    def get_provider_applications(self) -> list[dict]:
        with self._connect() as conn:
            return [self._application(row) for row in conn.execute(
                "SELECT * FROM provider_applications ORDER BY rowid DESC"
            )]

    def add_provider_application(self, application: dict) -> dict:
        phone = normalize_india_mobile(application["phone"])
        service_ids = application["serviceIds"]
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if not self._services_exist(conn, service_ids):
                raise ApplicationError(422, "One or more selected services do not exist.")
            existing = conn.execute(
                "SELECT service_ids FROM provider_applications WHERE phone = ? AND status IN ('pending', 'approved')",
                (phone,),
            )
            if any(set(service_ids).intersection(json.loads(row["service_ids"])) for row in existing):
                raise ApplicationError(409, "An application for this phone and a selected service is already pending or approved.")
            if self._provider_phone_conflict(conn, phone, service_ids):
                raise ApplicationError(409, "A provider with this phone is already listed for a selected service.")
            receipt = {"id": str(uuid4()), "status": "pending", "createdAt": _now()}
            conn.execute(
                "INSERT INTO provider_applications"
                " (id, name, phone, service_ids, area, experience, language, consent, status, created_at)"
                " VALUES (:id, :name, :phone, :service_ids, :area, :experience, :language, 1, :status, :createdAt)",
                {**application, **receipt, "phone": phone, "service_ids": json.dumps(service_ids)},
            )
            return receipt

    @staticmethod
    def _pending_application(conn: sqlite3.Connection, application_id: str) -> dict:
        row = conn.execute("SELECT * FROM provider_applications WHERE id = ?", (application_id,)).fetchone()
        if row is None:
            raise ApplicationError(404, "Provider application not found.")
        if row["status"] != "pending":
            raise ApplicationError(409, f"Provider application is already {row['status']}.")
        return Store._application(row)

    def approve_provider_application(self, application_id: str) -> dict:
        try:
            with self._connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                application = self._pending_application(conn, application_id)
                if not self._services_exist(conn, application["serviceIds"]):
                    raise ApplicationError(409, "Cannot approve: one or more selected services no longer exist.")
                if self._provider_phone_conflict(conn, application["phone"], application["serviceIds"]):
                    raise ApplicationError(409, "Cannot approve: a provider with this phone is already listed for a selected service.")
                providers = []
                for service_id in application["serviceIds"]:
                    provider_id = str(uuid4())
                    conn.execute(
                        "INSERT INTO providers (id, service_id, name, phone, rating, experience, area)"
                        " VALUES (?, ?, ?, ?, 0, ?, ?)",
                        (provider_id, service_id, application["name"], application["phone"],
                         application["experience"], application["area"]),
                    )
                    providers.append(self._provider(conn, conn.execute(
                        "SELECT * FROM providers WHERE id = ?", (provider_id,)
                    ).fetchone()))
                application.update(status="approved", reviewedAt=_now())
                conn.execute(
                    "UPDATE provider_applications SET status = 'approved', reviewed_at = ? WHERE id = ?",
                    (application["reviewedAt"], application_id),
                )
                return {"application": application, "providers": providers}
        except sqlite3.IntegrityError as exc:
            raise ApplicationError(409, "Cannot approve: provider creation failed; no changes were saved.") from exc

    def reject_provider_application(self, application_id: str) -> dict:
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            application = self._pending_application(conn, application_id)
            application.update(status="rejected", reviewedAt=_now())
            conn.execute(
                "UPDATE provider_applications SET status = 'rejected', reviewed_at = ? WHERE id = ?",
                (application["reviewedAt"], application_id),
            )
            return application

    @staticmethod
    def _review(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "providerId": row["provider_id"],
            "userName": row["user_name"],
            "rating": row["rating"],
            "comment": row["comment"],
            "createdAt": row["created_at"],
        }

    @staticmethod
    def _post(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
        liked_by = [r[0] for r in conn.execute("SELECT user_id FROM post_likes WHERE post_id = ? ORDER BY rowid", (row["id"],))]
        return {
            "id": row["id"],
            "author": row["author"],
            "handle": row["handle"],
            "location": row["location"],
            "title": row["title"],
            "caption": row["caption"],
            "accent": row["accent"],
            "tag": row["tag"],
            "likes": row["likes"],
            "likedBy": liked_by,
            "comments": row["comments"],
            "createdAt": row["created_at"],
        }

    # ---- writes ------------------------------------------------------------
    # Each write returns None when the change conflicts with existing data
    # (duplicate id, missing parent) so the API can map it to an HTTP error.

    def add_shutdown(self, shutdown: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO power_shutdowns (id, title, areas, starts_at, ends_at, reason, source_url, verified_at)"
                    " VALUES (:id, :title, :areas, :startsAt, :endsAt, :reason, :sourceUrl, :verifiedAt)",
                    {**shutdown, "areas": json.dumps(shutdown["areas"])},
                )
            except sqlite3.IntegrityError:
                return None
        return shutdown

    def update_shutdown(self, shutdown: dict) -> dict | None:
        with self._connect() as conn:
            updated = conn.execute(
                "UPDATE power_shutdowns SET title = :title, areas = :areas, starts_at = :startsAt,"
                " ends_at = :endsAt, reason = :reason, source_url = :sourceUrl, verified_at = :verifiedAt WHERE id = :id",
                {**shutdown, "areas": json.dumps(shutdown["areas"])},
            ).rowcount
        return shutdown if updated else None

    def delete_shutdown(self, shutdown_id: str) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM power_shutdowns WHERE id = ?", (shutdown_id,)).rowcount > 0

    def add_charging_station(self, station: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO charging_stations (id, name, area, address, connectors, hours, source_url, verified_at)"
                    " VALUES (:id, :name, :area, :address, :connectors, :hours, :sourceUrl, :verifiedAt)",
                    station,
                )
            except sqlite3.IntegrityError:
                return None
        return station

    def update_charging_station(self, station: dict) -> dict | None:
        with self._connect() as conn:
            updated = conn.execute(
                "UPDATE charging_stations SET name = :name, area = :area, address = :address, connectors = :connectors,"
                " hours = :hours, source_url = :sourceUrl, verified_at = :verifiedAt WHERE id = :id",
                station,
            ).rowcount
        return station if updated else None

    def delete_charging_station(self, station_id: str) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM charging_stations WHERE id = ?", (station_id,)).rowcount > 0

    def add_civic_alert(self, alert: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO civic_alerts (id, title, category, areas, route, message, starts_at, expires_at, source_url, verified_at)"
                    " VALUES (:id, :title, :category, :areas, :route, :message, :startsAt, :expiresAt, :sourceUrl, :verifiedAt)",
                    {**alert, "areas": json.dumps(alert["areas"])},
                )
            except sqlite3.IntegrityError:
                return None
        return alert

    def update_civic_alert(self, alert: dict) -> dict | None:
        with self._connect() as conn:
            updated = conn.execute(
                "UPDATE civic_alerts SET title = :title, category = :category, areas = :areas, route = :route,"
                " message = :message, starts_at = :startsAt, expires_at = :expiresAt,"
                " source_url = :sourceUrl, verified_at = :verifiedAt WHERE id = :id",
                {**alert, "areas": json.dumps(alert["areas"])},
            ).rowcount
        return alert if updated else None

    def delete_civic_alert(self, alert_id: str) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM civic_alerts WHERE id = ?", (alert_id,)).rowcount > 0

    def add_service(self, service: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute("INSERT INTO services (id, name, tamil, category) VALUES (:id, :name, :tamil, :category)", service)
            except sqlite3.IntegrityError:
                return None
        return service

    def add_provider(self, provider: dict) -> dict | None:
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if not conn.execute("SELECT 1 FROM services WHERE id = ?", (provider["serviceId"],)).fetchone():
                return None
            duplicate = conn.execute(
                "SELECT 1 FROM providers WHERE id = ? OR (service_id = ? AND lower(name) = lower(?))",
                (provider["id"], provider["serviceId"], provider["name"]),
            ).fetchone()
            if duplicate:
                return None
            try:
                phone = normalize_india_mobile(provider["phone"])
            except ValueError:
                phone = None
            if phone and self._provider_phone_conflict(conn, phone, [provider["serviceId"]]):
                return None
            conn.execute(
                "INSERT INTO providers (id, service_id, name, phone, rating, experience, area) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (provider["id"], provider["serviceId"], provider["name"], provider["phone"], provider.get("rating") or 0, provider["experience"], provider.get("area")),
            )
            return self._provider(conn, conn.execute("SELECT * FROM providers WHERE id = ?", (provider["id"],)).fetchone())

    def update_provider_area(self, provider_id: str, area: str | None) -> dict | None:
        with self._connect() as conn:
            conn.execute("UPDATE providers SET area = ? WHERE id = ?", (area or None, provider_id))
            row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
            return self._provider(conn, row) if row else None

    def delete_provider(self, provider_id: str) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM providers WHERE id = ?", (provider_id,)).rowcount > 0

    def add_review(self, review: dict) -> dict | None:
        with self._connect() as conn:
            if not conn.execute("SELECT 1 FROM providers WHERE id = ?", (review["providerId"],)).fetchone():
                return None
            try:
                conn.execute(
                    "INSERT INTO reviews (id, provider_id, user_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (review["id"], review["providerId"], review["userName"], review["rating"], review["comment"], review.get("createdAt") or _now()),
                )
            except sqlite3.IntegrityError:
                return None
            return self._review(conn.execute("SELECT * FROM reviews WHERE id = ?", (review["id"],)).fetchone())

    def add_news_item(self, item: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute("INSERT INTO news_items (id, badge, area, title, summary) VALUES (:id, :badge, :area, :title, :summary)", item)
            except sqlite3.IntegrityError:
                return None
        return item

    def add_feed_post(self, post: dict) -> dict | None:
        with self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO feed_posts (id, author, handle, location, title, caption, accent, tag, likes, comments, created_at)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)",
                    (post["id"], post["author"], post["handle"], post["location"], post["title"], post["caption"], post["accent"], post["tag"], post.get("createdAt") or _now()),
                )
            except sqlite3.IntegrityError:
                return None
            return self._post(conn, conn.execute("SELECT * FROM feed_posts WHERE id = ?", (post["id"],)).fetchone())

    def like_post(self, post_id: str, user_id: str) -> dict | None:
        """Records one like per user; liking twice leaves the count unchanged."""
        with self._connect() as conn:
            if not conn.execute("SELECT 1 FROM feed_posts WHERE id = ?", (post_id,)).fetchone():
                return None
            inserted = conn.execute("INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)", (post_id, user_id)).rowcount
            if inserted:
                conn.execute("UPDATE feed_posts SET likes = likes + 1 WHERE id = ?", (post_id,))
            return self._post(conn, conn.execute("SELECT * FROM feed_posts WHERE id = ?", (post_id,)).fetchone())

    def add_asked_for(self, query: str) -> list[str]:
        with self._connect() as conn:
            conn.execute("INSERT INTO asked_for (query, created_at) VALUES (?, ?)", (query, _now()))
            return [row[0] for row in conn.execute("SELECT query FROM asked_for ORDER BY id")]
