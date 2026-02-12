"""
Test Suite: Project Structure Completeness

Validates that all essential files and directories referenced in the README,
docker-compose files, and Dockerfiles actually exist in the project.
"""
import json
from pathlib import Path

import pytest
import yaml


# ─── Root-level files expected by README & release workflow ────────────────────

class TestRootFiles:
    """Verify all root-level files referenced in README exist."""

    @pytest.mark.parametrize("filename", [
        "docker-compose.yml",
        "docker-compose.dev.yml",
        ".env.example",
        "install.sh",
        "install.bat",
        "install.ps1",
        "setup.sh",
        "validate-config.sh",
        "verify-installation.sh",
        "LICENSE",
        "README.md",
        "QUICKSTART.md",
    ])
    def test_root_file_exists(self, project_root: Path, filename: str):
        filepath = project_root / filename
        assert filepath.exists(), f"Missing root file: {filename}"

    def test_env_example_has_content(self, project_root: Path):
        env_example = project_root / ".env.example"
        assert env_example.exists(), ".env.example missing"
        content = env_example.read_text()
        assert len(content) > 50, ".env.example appears empty or too short"


# ─── Frontend structure ───────────────────────────────────────────────────────

class TestFrontendStructure:
    """Verify frontend project completeness."""

    def test_package_json_exists(self, frontend_dir: Path):
        assert (frontend_dir / "package.json").exists()

    def test_package_json_valid(self, frontend_dir: Path):
        pkg = json.loads((frontend_dir / "package.json").read_text())
        assert "name" in pkg
        assert "dependencies" in pkg

    def test_dockerfile_exists(self, frontend_dir: Path):
        assert (frontend_dir / "Dockerfile").exists()

    def test_tsconfig_exists(self, frontend_dir: Path):
        assert (frontend_dir / "tsconfig.json").exists()

    def test_public_index_html(self, frontend_dir: Path):
        assert (frontend_dir / "public" / "index.html").exists()

    def test_src_entry_point(self, frontend_dir: Path):
        assert (frontend_dir / "src" / "index.tsx").exists()

    def test_app_component(self, frontend_dir: Path):
        assert (frontend_dir / "src" / "App.tsx").exists()

    @pytest.mark.parametrize("directory", [
        "src/components",
        "src/hooks",
        "src/services",
        "src/store",
        "src/types",
        "src/views",
    ])
    def test_src_directories_exist(self, frontend_dir: Path, directory: str):
        assert (frontend_dir / directory).is_dir(), f"Missing frontend directory: {directory}"

    @pytest.mark.parametrize("component_dir", [
        "src/components/DFDVisualizer",
        "src/components/ThreatMatrix",
        "src/components/ComplianceMapper",
    ])
    def test_component_directories(self, frontend_dir: Path, component_dir: str):
        d = frontend_dir / component_dir
        assert d.is_dir(), f"Missing component directory: {component_dir}"

    @pytest.mark.parametrize("component,files", [
        ("DFDVisualizer", ["DFDVisualizer.tsx", "index.ts"]),
        ("ThreatMatrix", ["ThreatMatrix.tsx", "index.ts"]),
        ("ComplianceMapper", ["ComplianceMapper.tsx", "index.ts"]),
    ])
    def test_component_has_required_files(self, frontend_dir: Path, component: str, files: list):
        for f in files:
            path = frontend_dir / "src" / "components" / component / f
            assert path.exists(), f"Missing component file: {component}/{f}"

    @pytest.mark.parametrize("test_file", [
        "src/App.test.tsx",
        "src/components/DFDVisualizer/__tests__/DFDVisualizer.test.tsx",
        "src/components/ThreatMatrix/__tests__/ThreatMatrix.test.tsx",
        "src/components/ComplianceMapper/__tests__/ComplianceMapper.test.tsx",
    ])
    def test_frontend_test_files_exist(self, frontend_dir: Path, test_file: str):
        assert (frontend_dir / test_file).exists(), f"Missing test file: {test_file}"


# ─── Backend structure ────────────────────────────────────────────────────────

class TestBackendStructure:
    """Verify backend project completeness."""

    def test_package_json_exists(self, backend_dir: Path):
        assert (backend_dir / "package.json").exists()

    def test_package_json_valid(self, backend_dir: Path):
        pkg = json.loads((backend_dir / "package.json").read_text())
        assert "dependencies" in pkg
        assert "scripts" in pkg

    def test_dockerfile_exists(self, backend_dir: Path):
        assert (backend_dir / "Dockerfile").exists()

    def test_tsconfig_exists(self, backend_dir: Path):
        assert (backend_dir / "tsconfig.json").exists()

    @pytest.mark.parametrize("service_file", [
        "services/jira.service.ts",
        "controllers/jiraIntegration.controller.ts",
        "routes/jira.routes.ts",
    ])
    def test_jira_module_files(self, backend_dir: Path, service_file: str):
        assert (backend_dir / service_file).exists(), f"Missing backend file: {service_file}"


# ─── Backend API structure ────────────────────────────────────────────────────

class TestBackendApiStructure:
    """Verify backend/api sub-project completeness."""

    def test_package_json_exists(self, backend_api_dir: Path):
        assert (backend_api_dir / "package.json").exists()

    def test_package_json_valid(self, backend_api_dir: Path):
        pkg = json.loads((backend_api_dir / "package.json").read_text())
        assert "dependencies" in pkg
        assert "scripts" in pkg

    def test_entry_point_exists(self, backend_api_dir: Path):
        assert (backend_api_dir / "src" / "index.ts").exists()

    def test_legacy_server_exists(self, backend_api_dir: Path):
        assert (backend_api_dir / "server.js").exists()

    @pytest.mark.parametrize("directory", [
        "src/config",
        "src/controllers",
        "src/database",
        "src/middleware",
        "src/routes",
        "src/services",
        "src/utils",
    ])
    def test_api_src_directories(self, backend_api_dir: Path, directory: str):
        assert (backend_api_dir / directory).is_dir(), f"Missing API directory: {directory}"

    @pytest.mark.parametrize("controller", [
        "analysisController.ts",
        "authController.ts",
        "threatModelController.ts",
    ])
    def test_api_controllers_exist(self, backend_api_dir: Path, controller: str):
        assert (backend_api_dir / "src" / "controllers" / controller).exists()

    @pytest.mark.parametrize("route", [
        "analysis.routes.ts",
        "auth.routes.ts",
        "threatModels.routes.ts",
    ])
    def test_api_routes_exist(self, backend_api_dir: Path, route: str):
        assert (backend_api_dir / "src" / "routes" / route).exists()

    @pytest.mark.parametrize("service", [
        "analysisService.ts",
        "jiraService.ts",
        "threatModelService.ts",
    ])
    def test_api_services_exist(self, backend_api_dir: Path, service: str):
        assert (backend_api_dir / "src" / "services" / service).exists()

    def test_database_schema_exists(self, backend_api_dir: Path):
        assert (backend_api_dir / "src" / "database" / "schema.sql").exists()

    def test_database_module_exists(self, backend_api_dir: Path):
        assert (backend_api_dir / "src" / "database" / "db.ts").exists()


# ─── Python Analysis Service ─────────────────────────────────────────────────

class TestAnalysisServiceStructure:
    """Verify Python analysis service completeness."""

    def test_app_entry_point(self, analysis_dir: Path):
        assert (analysis_dir / "app.py").exists()

    def test_requirements_txt(self, analysis_dir: Path):
        assert (analysis_dir / "requirements.txt").exists()

    def test_dockerfile(self, analysis_dir: Path):
        assert (analysis_dir / "Dockerfile").exists()

    @pytest.mark.parametrize("module_dir", [
        "dfd",
        "llm",
        "models",
        "parsers",
        "threatdb",
        "tests",
    ])
    def test_analysis_modules_exist(self, analysis_dir: Path, module_dir: str):
        assert (analysis_dir / module_dir).is_dir(), f"Missing analysis module: {module_dir}"

    @pytest.mark.parametrize("module,files", [
        ("dfd", ["__init__.py", "dfd_generator.py", "mermaid_exporter.py"]),
        ("llm", ["__init__.py", "llm_client.py", "threat_generator.py", "prompt_templates.py"]),
        ("models", ["__init__.py", "dfd.py", "terraform.py", "threat.py"]),
        ("parsers", ["__init__.py", "terraform_parser.py"]),
        ("threatdb", ["__init__.py", "threat_loader.py", "threat_matcher.py"]),
    ])
    def test_analysis_module_files(self, analysis_dir: Path, module: str, files: list):
        for f in files:
            path = analysis_dir / module / f
            assert path.exists(), f"Missing analysis file: {module}/{f}"

    @pytest.mark.parametrize("test_file", [
        "tests/test_dfd_generator.py",
        "tests/test_terraform_parser.py",
        "tests/test_threat_matcher.py",
    ])
    def test_analysis_test_files(self, analysis_dir: Path, test_file: str):
        assert (analysis_dir / test_file).exists(), f"Missing test: {test_file}"

    def test_threat_db_yaml_files(self, analysis_dir: Path):
        yaml_files = list((analysis_dir / "threatdb").glob("*.yaml"))
        assert len(yaml_files) > 0, "No threat database YAML files found"


# ─── Infrastructure ──────────────────────────────────────────────────────────

class TestInfrastructureStructure:
    """Verify infrastructure files completeness."""

    @pytest.mark.parametrize("filepath", [
        "docker/nginx.conf",
        "docker/init-db.sh",
        "docker/backup-db.sh",
        "docker/generate-ssl.sh",
    ])
    def test_docker_infra_files(self, infra_dir: Path, filepath: str):
        assert (infra_dir / filepath).exists(), f"Missing infra file: {filepath}"

    def test_ssl_cert_exists(self, infra_dir: Path):
        assert (infra_dir / "docker" / "ssl" / "cert.pem").exists(), "Missing SSL cert"

    def test_ssl_key_exists(self, infra_dir: Path):
        assert (infra_dir / "docker" / "ssl" / "key.pem").exists(), "Missing SSL key"


# ─── GitHub Actions Workflows ────────────────────────────────────────────────

class TestWorkflows:
    """Verify CI/CD workflow files exist."""

    @pytest.mark.parametrize("workflow", [
        "release.yml",
        "threat-analysis.yml",
    ])
    def test_workflow_exists(self, project_root: Path, workflow: str):
        assert (project_root / ".github" / "workflows" / workflow).exists()


# ─── Documentation ───────────────────────────────────────────────────────────

class TestDocumentation:
    """Verify documentation completeness."""

    @pytest.mark.parametrize("doc_file", [
        "index.html",
        "architecture.html",
        "api-reference.html",
        "walkthrough.html",
        "demo.html",
        "styles.css",
    ])
    def test_docs_files(self, docs_dir: Path, doc_file: str):
        assert (docs_dir / doc_file).exists(), f"Missing doc: {doc_file}"

    @pytest.mark.parametrize("doc_file", [
        "deployment/DOCKER.md",
    ])
    def test_deployment_docs(self, docs_dir: Path, doc_file: str):
        assert (docs_dir / doc_file).exists(), f"Missing deployment doc: {doc_file}"
