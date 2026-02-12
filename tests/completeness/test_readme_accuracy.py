"""
Test Suite: README Accuracy

Validates that claims and instructions in the README are accurate — endpoints
exist in code, referenced commands work, and documented features have
corresponding code.
"""
import json
import re
from pathlib import Path

import pytest


class TestReadmeFeatureClaims:
    """Verify README feature claims have corresponding code."""

    @pytest.fixture
    def readme_content(self, project_root: Path) -> str:
        return (project_root / "README.md").read_text()

    def test_jwt_auth_referenced_in_code(self, backend_api_dir: Path):
        """README claims JWT auth — verify jsonwebtoken is a dependency."""
        pkg = json.loads((backend_api_dir / "package.json").read_text())
        assert "jsonwebtoken" in pkg.get("dependencies", {}), \
            "README claims JWT auth but jsonwebtoken not in API dependencies"

    def test_auth_middleware_exists(self, backend_api_dir: Path):
        """Verify auth middleware exists for JWT claims."""
        assert (backend_api_dir / "src" / "middleware" / "auth.middleware.ts").exists()

    def test_helmet_security_referenced(self, backend_api_dir: Path):
        """README claims helmet security."""
        pkg = json.loads((backend_api_dir / "package.json").read_text())
        assert "helmet" in pkg.get("dependencies", {}), \
            "README claims helmet security but package not found"

    def test_cors_referenced(self, backend_api_dir: Path):
        """README claims CORS support."""
        pkg = json.loads((backend_api_dir / "package.json").read_text())
        assert "cors" in pkg.get("dependencies", {}), \
            "README claims CORS but package not found"

    def test_llm_openai_dependency(self, analysis_dir: Path):
        """README claims OpenAI integration."""
        reqs = (analysis_dir / "requirements.txt").read_text().lower()
        assert "openai" in reqs, "README claims OpenAI integration but not in requirements"

    def test_llm_anthropic_dependency(self, analysis_dir: Path):
        """README claims Anthropic integration."""
        reqs = (analysis_dir / "requirements.txt").read_text().lower()
        assert "anthropic" in reqs, "README claims Anthropic integration but not in requirements"

    def test_llm_client_module_exists(self, analysis_dir: Path):
        """Verify LLM client implementation exists."""
        assert (analysis_dir / "llm" / "llm_client.py").exists()

    def test_flask_analysis_app(self, analysis_dir: Path):
        """README claims Flask analysis service."""
        reqs = (analysis_dir / "requirements.txt").read_text().lower()
        assert "flask" in reqs

    def test_sqlite_database(self, backend_api_dir: Path):
        """README claims SQLite database."""
        pkg = json.loads((backend_api_dir / "package.json").read_text())
        assert "better-sqlite3" in pkg.get("dependencies", {}), \
            "README claims SQLite but better-sqlite3 not in dependencies"

    def test_database_schema_exists(self, backend_api_dir: Path):
        """Verify database schema file exists for SQLite claims."""
        assert (backend_api_dir / "src" / "database" / "schema.sql").exists()


class TestReadmeEndpoints:
    """Verify endpoints mentioned in README have corresponding route definitions."""

    def test_health_endpoint_in_api(self, backend_api_dir: Path):
        """README documents GET /health for API."""
        # Check server.js or src/ for health route
        found = False
        for f in [
            backend_api_dir / "server.js",
            backend_api_dir / "src" / "index.ts",
        ]:
            if f.exists() and "health" in f.read_text().lower():
                found = True
                break
        # Also check route files
        routes_dir = backend_api_dir / "src" / "routes"
        if routes_dir.is_dir():
            for rf in routes_dir.glob("*.ts"):
                if "health" in rf.read_text().lower():
                    found = True
                    break
        assert found, "README documents /health endpoint but not found in API code"

    def test_analyze_endpoint_in_analysis(self, analysis_dir: Path):
        """README documents POST /analyze for analysis service."""
        app_content = (analysis_dir / "app.py").read_text()
        assert "analyze" in app_content.lower(), \
            "README documents /analyze endpoint but not found in app.py"

    def test_health_endpoint_in_analysis(self, analysis_dir: Path):
        """README documents GET /health for analysis service."""
        app_content = (analysis_dir / "app.py").read_text()
        assert "health" in app_content.lower(), \
            "README documents /health endpoint but not found in app.py"


class TestReadmeInstructions:
    """Verify README setup instructions reference real files/commands."""

    def test_env_example_copy_source(self, project_root: Path):
        """README says 'cp .env.example .env' — verify .env.example exists."""
        assert (project_root / ".env.example").exists()

    def test_npm_install_possible(self, frontend_dir: Path, backend_dir: Path):
        """README says 'npm install' — verify package.json exists in both dirs."""
        assert (frontend_dir / "package.json").exists()
        assert (backend_dir / "package.json").exists()

    def test_pip_install_possible(self, analysis_dir: Path):
        """README says 'pip install -r requirements.txt'."""
        assert (analysis_dir / "requirements.txt").exists()

    def test_docker_compose_file_valid(self, project_root: Path):
        """README references docker-compose commands — verify file is valid."""
        import yaml
        content = (project_root / "docker-compose.yml").read_text()
        config = yaml.safe_load(content)
        assert config is not None
        assert "services" in config
