"""Runtime settings. Everything is overridable through environment variables
(prefix DRIFTSIGHT_) so the container and the dev server share one code path."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
APP_DIR = BACKEND_DIR / "app"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DRIFTSIGHT_", env_file=".env", extra="ignore")

    app_name: str = "DriftSight API"
    version: str = "1.0.0"
    # Demo prototype: the JWT secret is a throwaway dev value. Set DRIFTSIGHT_JWT_SECRET
    # in any real deployment; nothing here is a credential for a live system.
    jwt_secret: str = "driftsight-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 12 * 60

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"

    database_url: str = f"sqlite:///{BACKEND_DIR / 'driftsight.db'}"
    geo_path: Path = APP_DIR / "data" / "geo.json"
    model_path: Path = BACKEND_DIR / "models" / "detector.joblib"

    ocean_provider: str = "synthetic"  # synthetic | cmems | era5
    # Spill mass is not observable from imagery or drift, so it is an operator
    # assumption. 0 means "not set": mass figures stay hidden rather than being
    # invented.
    assumed_release_tonnes: float = 0.0
    train_on_startup: bool = True
    run_on_startup: bool = True
    max_cached_runs: int = 6

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
