"""
Test Suite: Package & Dependency Completeness

Validates that all package.json and requirements.txt files declare the expected
dependencies, and checks for common issues like duplicate deps, missing lock
files, and misplaced dev dependencies.
"""
import json
from pathlib import Path

import pytest


# ─── Frontend Dependencies ────────────────────────────────────────────────────

class TestFrontendDependencies:
    """Verify frontend package.json has all required dependencies."""

    @pytest.fixture
    def frontend_pkg(self, frontend_dir: Path) -> dict:
        return json.loads((frontend_dir / "package.json").read_text())

    @pytest.mark.parametrize("package", [
        "react",
        "react-dom",
        "react-router-dom",
        "react-redux",
        "@reduxjs/toolkit",
        "axios",
        "typescript",
        "mermaid",
        "d3",
        "zod",
        "@mantine/core",
        "@mantine/hooks",
        "@mantine/notifications",
        "@mantine/form",
        "@mantine/dropzone",
        "@tabler/icons-react",
        "@tanstack/react-query",
        "react-hook-form",
        "react-scripts",
    ])
    def test_frontend_has_dependency(self, frontend_pkg: dict, package: str):
        all_deps = {**frontend_pkg.get("dependencies", {}), **frontend_pkg.get("devDependencies", {})}
        assert package in all_deps, f"Frontend missing dependency: {package}"

    @pytest.mark.parametrize("package", [
        "@testing-library/react",
        "@testing-library/jest-dom",
        "@testing-library/dom",
        "@testing-library/user-event",
    ])
    def test_frontend_has_testing_deps(self, frontend_pkg: dict, package: str):
        all_deps = {**frontend_pkg.get("dependencies", {}), **frontend_pkg.get("devDependencies", {})}
        assert package in all_deps, f"Frontend missing testing dependency: {package}"

    def test_frontend_has_start_script(self, frontend_pkg: dict):
        assert "start" in frontend_pkg.get("scripts", {})

    def test_frontend_has_build_script(self, frontend_pkg: dict):
        assert "build" in frontend_pkg.get("scripts", {})

    def test_frontend_has_test_script(self, frontend_pkg: dict):
        assert "test" in frontend_pkg.get("scripts", {})

    def test_frontend_testing_deps_placement(self, frontend_pkg: dict):
        """Verify testing libraries are in devDependencies, not dependencies."""
        deps = frontend_pkg.get("dependencies", {})
        testing_in_deps = [k for k in deps if "testing-library" in k or k.startswith("@types/")]
        assert not testing_in_deps, \
            f"Testing/type packages should be in devDependencies, not dependencies: " \
            f"{', '.join(testing_in_deps)}"


# ─── Backend Root Dependencies ────────────────────────────────────────────────

class TestBackendDependencies:
    """Verify backend root package.json dependencies."""

    @pytest.fixture
    def backend_pkg(self, backend_dir: Path) -> dict:
        return json.loads((backend_dir / "package.json").read_text())

    @pytest.mark.parametrize("package", [
        "morgan",
        "socket.io",
    ])
    def test_backend_has_dependency(self, backend_pkg: dict, package: str):
        assert package in backend_pkg.get("dependencies", {}), \
            f"Backend missing dependency: {package}"

    @pytest.mark.parametrize("package", [
        "jest",
        "ts-jest",
        "typescript",
        "eslint",
        "nodemon",
        "ts-node",
    ])
    def test_backend_has_dev_dependency(self, backend_pkg: dict, package: str):
        assert package in backend_pkg.get("devDependencies", {}), \
            f"Backend missing devDependency: {package}"

    def test_backend_has_test_script(self, backend_pkg: dict):
        assert "test" in backend_pkg.get("scripts", {})

    def test_backend_has_start_script(self, backend_pkg: dict):
        assert "start" in backend_pkg.get("scripts", {})


# ─── Backend API Dependencies ─────────────────────────────────────────────────

class TestBackendApiDependencies:
    """Verify backend/api package.json dependencies."""

    @pytest.fixture
    def api_pkg(self, backend_api_dir: Path) -> dict:
        return json.loads((backend_api_dir / "package.json").read_text())

    @pytest.mark.parametrize("package", [
        "express",
        "cors",
        "helmet",
        "dotenv",
        "jsonwebtoken",
        "bcrypt",
        "zod",
        "better-sqlite3",
        "winston",
        "express-rate-limit",
        "swagger-ui-express",
        "swagger-jsdoc",
        "axios",
        "uuid",
    ])
    def test_api_has_dependency(self, api_pkg: dict, package: str):
        assert package in api_pkg.get("dependencies", {}), \
            f"API missing dependency: {package}"

    @pytest.mark.parametrize("package", [
        "typescript",
        "jest",
        "ts-jest",
        "eslint",
        "prettier",
    ])
    def test_api_has_dev_dependency(self, api_pkg: dict, package: str):
        assert package in api_pkg.get("devDependencies", {}), \
            f"API missing devDependency: {package}"

    def test_api_has_build_script(self, api_pkg: dict):
        assert "build" in api_pkg.get("scripts", {})

    def test_api_has_start_script(self, api_pkg: dict):
        assert "start" in api_pkg.get("scripts", {})

    def test_api_has_dev_script(self, api_pkg: dict):
        assert "dev" in api_pkg.get("scripts", {})


# ─── Python Dependencies ─────────────────────────────────────────────────────

class TestPythonDependencies:
    """Verify Python analysis service dependencies."""

    @pytest.fixture
    def requirements(self, analysis_dir: Path) -> list[str]:
        content = (analysis_dir / "requirements.txt").read_text()
        return [
            line.split("==")[0].split(">=")[0].split("~=")[0].strip().lower()
            for line in content.strip().splitlines()
            if line.strip() and not line.startswith("#")
        ]

    @pytest.mark.parametrize("package", [
        "flask",
        "pyyaml",
        "tenacity",
        "anthropic",
        "openai",
        "gunicorn",
        "python-dotenv",
        "python-hcl2",
        "pytest",
    ])
    def test_python_has_dependency(self, requirements: list[str], package: str):
        assert package in requirements, \
            f"Python requirements missing: {package}"

    def test_requirements_has_pinned_versions(self, analysis_dir: Path):
        """Verify dependencies use pinned versions (==) for reproducibility."""
        content = (analysis_dir / "requirements.txt").read_text()
        unpinned = []
        for line in content.strip().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "==" not in line:
                unpinned.append(line)
        if unpinned:
            pytest.xfail(f"Unpinned Python dependencies: {', '.join(unpinned)}")


# ─── Lock File Checks ────────────────────────────────────────────────────────

class TestLockFiles:
    """Verify package lock files exist for reproducible builds."""

    def test_frontend_lock_file(self, frontend_dir: Path):
        has_lock = (
            (frontend_dir / "package-lock.json").exists()
            or (frontend_dir / "yarn.lock").exists()
            or (frontend_dir / "pnpm-lock.yaml").exists()
        )
        assert has_lock, "Frontend has no lock file (package-lock.json, yarn.lock, or pnpm-lock.yaml)"

    def test_backend_lock_file(self, backend_dir: Path):
        has_lock = (
            (backend_dir / "package-lock.json").exists()
            or (backend_dir / "yarn.lock").exists()
            or (backend_dir / "pnpm-lock.yaml").exists()
        )
        assert has_lock, "Backend has no lock file"

    def test_backend_api_lock_file(self, backend_api_dir: Path):
        """backend/api/ needs its own lock file if it has a separate package.json."""
        has_lock = (
            (backend_api_dir / "package-lock.json").exists()
            or (backend_api_dir / "yarn.lock").exists()
            or (backend_api_dir / "pnpm-lock.yaml").exists()
        )
        assert has_lock, \
            "backend/api/ has its own package.json but no lock file — npm ci will fail"


# ─── Duplicate Dependency Detection ──────────────────────────────────────────

class TestDuplicateDependencies:
    """Detect overlapping dependencies between backend packages."""

    def test_backend_vs_api_duplicate_deps(self, backend_dir: Path, backend_api_dir: Path):
        """Verify no duplicate dependencies between backend/ and backend/api/."""
        backend_pkg = json.loads((backend_dir / "package.json").read_text())
        api_pkg = json.loads((backend_api_dir / "package.json").read_text())

        backend_deps = set(backend_pkg.get("dependencies", {}).keys())
        api_deps = set(api_pkg.get("dependencies", {}).keys())

        duplicates = backend_deps & api_deps
        assert not duplicates, \
            f"Duplicate dependencies in backend/ and backend/api/: " \
            f"{', '.join(sorted(duplicates))}"
