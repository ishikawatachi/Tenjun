"""
Pytest configuration for completeness tests.
Provides fixtures for project root and sub-project paths.
"""
import os
import pytest
from pathlib import Path


@pytest.fixture(scope="session")
def project_root() -> Path:
    """Return the project root directory."""
    # Walk up from this test file to find the project root (contains docker-compose.yml)
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / "docker-compose.yml").exists():
            return parent
    # Fallback
    return Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[2]))


@pytest.fixture(scope="session")
def frontend_dir(project_root: Path) -> Path:
    return project_root / "frontend"


@pytest.fixture(scope="session")
def backend_dir(project_root: Path) -> Path:
    return project_root / "backend"


@pytest.fixture(scope="session")
def backend_api_dir(project_root: Path) -> Path:
    return project_root / "backend" / "api"


@pytest.fixture(scope="session")
def analysis_dir(project_root: Path) -> Path:
    return project_root / "backend" / "analysis"


@pytest.fixture(scope="session")
def infra_dir(project_root: Path) -> Path:
    return project_root / "infra"


@pytest.fixture(scope="session")
def docs_dir(project_root: Path) -> Path:
    return project_root / "docs"
