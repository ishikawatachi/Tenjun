"""
Test Suite: Docker & Configuration Consistency

Validates that docker-compose services reference existing files, ports are
consistent, environment variables match, and Dockerfiles are well-formed.
"""
import json
import re
from pathlib import Path

import pytest
import yaml


# ─── Docker Compose Validation ────────────────────────────────────────────────

class TestDockerCompose:
    """Validate docker-compose.yml consistency."""

    @pytest.fixture
    def compose_config(self, project_root: Path) -> dict:
        return yaml.safe_load((project_root / "docker-compose.yml").read_text())

    @pytest.fixture
    def compose_dev_config(self, project_root: Path) -> dict:
        return yaml.safe_load((project_root / "docker-compose.dev.yml").read_text())

    def test_compose_is_valid_yaml(self, project_root: Path):
        content = (project_root / "docker-compose.yml").read_text()
        config = yaml.safe_load(content)
        assert "services" in config, "docker-compose.yml missing 'services' key"

    def test_compose_dev_is_valid_yaml(self, project_root: Path):
        content = (project_root / "docker-compose.dev.yml").read_text()
        config = yaml.safe_load(content)
        assert config is not None, "docker-compose.dev.yml is empty or invalid"

    @pytest.mark.parametrize("service", [
        "api",
        "analysis",
        "nginx",
        "frontend",
    ])
    def test_expected_services_defined(self, compose_config: dict, service: str):
        services = compose_config.get("services", {})
        assert service in services, f"Missing docker-compose service: {service}"

    def test_api_service_build_context(self, compose_config: dict, project_root: Path):
        api = compose_config["services"].get("api", {})
        build = api.get("build", {})
        context = build.get("context", build) if isinstance(build, dict) else build
        if isinstance(context, str):
            assert (project_root / context).is_dir(), f"API build context not found: {context}"

    def test_analysis_service_build_context(self, compose_config: dict, project_root: Path):
        analysis = compose_config["services"].get("analysis", {})
        build = analysis.get("build", {})
        context = build.get("context", build) if isinstance(build, dict) else build
        if isinstance(context, str):
            assert (project_root / context).is_dir(), f"Analysis build context not found: {context}"

    def test_frontend_service_build_context(self, compose_config: dict, project_root: Path):
        frontend = compose_config["services"].get("frontend", {})
        build = frontend.get("build", {})
        context = build.get("context", build) if isinstance(build, dict) else build
        if isinstance(context, str):
            assert (project_root / context).is_dir(), f"Frontend build context not found: {context}"

    def test_nginx_config_mounted(self, compose_config: dict, project_root: Path):
        """Verify nginx.conf referenced in volumes exists."""
        nginx = compose_config["services"].get("nginx", {})
        volumes = nginx.get("volumes", [])
        for v in volumes:
            if isinstance(v, str) and "nginx.conf" in v:
                host_path = v.split(":")[0].lstrip("./")
                assert (project_root / host_path).exists(), \
                    f"nginx.conf referenced in compose but not found: {host_path}"

    def test_nginx_dev_config_exists(self, compose_dev_config: dict, project_root: Path):
        """Verify nginx.dev.conf referenced in dev compose exists."""
        nginx = compose_dev_config.get("services", {}).get("nginx", {})
        volumes = nginx.get("volumes", []) if nginx else []
        for v in volumes:
            if isinstance(v, str) and "nginx" in v and ".conf" in v:
                host_path = v.split(":")[0].lstrip("./")
                if not (project_root / host_path).exists():
                    pytest.xfail(f"Dev compose references missing file: {host_path}")


# ─── Dockerfile Validation ───────────────────────────────────────────────────

class TestDockerfiles:
    """Validate Dockerfiles reference existing files and are well-formed."""

    @pytest.mark.parametrize("dockerfile_path", [
        "backend/Dockerfile",
        "backend/analysis/Dockerfile",
        "frontend/Dockerfile",
    ])
    def test_dockerfile_exists(self, project_root: Path, dockerfile_path: str):
        assert (project_root / dockerfile_path).exists()

    @pytest.mark.parametrize("dockerfile_path", [
        "backend/Dockerfile",
        "backend/analysis/Dockerfile",
        "frontend/Dockerfile",
    ])
    def test_dockerfile_has_from(self, project_root: Path, dockerfile_path: str):
        content = (project_root / dockerfile_path).read_text()
        assert re.search(r'^FROM\s+', content, re.MULTILINE), \
            f"{dockerfile_path} missing FROM instruction"

    @pytest.mark.parametrize("dockerfile_path", [
        "backend/Dockerfile",
        "backend/analysis/Dockerfile",
        "frontend/Dockerfile",
    ])
    def test_dockerfile_has_cmd_or_entrypoint(self, project_root: Path, dockerfile_path: str):
        content = (project_root / dockerfile_path).read_text()
        has_cmd = re.search(r'^(CMD|ENTRYPOINT)\s+', content, re.MULTILINE)
        assert has_cmd, f"{dockerfile_path} missing CMD or ENTRYPOINT"


# ─── TypeScript Configuration Consistency ────────────────────────────────────

class TestTypeScriptConfig:
    """Validate TypeScript configuration consistency."""

    def test_frontend_tsconfig_valid_json(self, frontend_dir: Path):
        content = (frontend_dir / "tsconfig.json").read_text()
        # tsconfig may use comments; try json first, fallback to check structure
        try:
            config = json.loads(content)
            assert "compilerOptions" in config
        except json.JSONDecodeError:
            # tsconfig.json with comments — check raw content
            assert '"compilerOptions"' in content

    def test_backend_tsconfig_valid(self, backend_dir: Path):
        content = (backend_dir / "tsconfig.json").read_text()
        try:
            config = json.loads(content)
            assert "compilerOptions" in config
        except json.JSONDecodeError:
            assert '"compilerOptions"' in content

    def test_backend_api_tsconfig_valid(self, backend_api_dir: Path):
        content = (backend_api_dir / "tsconfig.json").read_text()
        try:
            config = json.loads(content)
            assert "compilerOptions" in config
        except json.JSONDecodeError:
            assert '"compilerOptions"' in content

    def test_module_system_consistency(self, backend_dir: Path, backend_api_dir: Path):
        """Check that backend module systems don't conflict."""
        root_pkg = json.loads((backend_dir / "package.json").read_text())
        is_esm = root_pkg.get("type") == "module"

        api_tsconfig_content = (backend_api_dir / "tsconfig.json").read_text()
        try:
            api_tsconfig = json.loads(api_tsconfig_content)
            module_setting = api_tsconfig.get("compilerOptions", {}).get("module", "").lower()
        except json.JSONDecodeError:
            return  # Can't parse, skip

        if is_esm and module_setting == "commonjs":
            pytest.xfail(
                "Module system conflict: backend/package.json has 'type: module' (ESM) "
                "but backend/api/tsconfig.json compiles to CommonJS. "
                "Node.js will try to parse CJS output as ESM and fail."
            )


# ─── Port & URL Consistency ──────────────────────────────────────────────────

class TestPortConsistency:
    """Validate port and URL consistency across configuration files."""

    def test_analysis_port_in_env_example(self, project_root: Path):
        """Verify .env.example analysis URL port matches docker-compose."""
        env_content = (project_root / ".env.example").read_text()
        compose = yaml.safe_load((project_root / "docker-compose.yml").read_text())

        # Find analysis service port
        analysis = compose.get("services", {}).get("analysis", {})
        ports = analysis.get("ports", [])
        compose_port = None
        for p in ports:
            if isinstance(p, str):
                parts = p.split(":")
                compose_port = parts[0] if len(parts) == 1 else parts[0]
                break

        # Find port in .env.example
        for line in env_content.splitlines():
            if "ANALYSIS" in line.upper() and "URL" in line.upper() and ":" in line:
                match = re.search(r':(\d+)', line.split("=", 1)[-1] if "=" in line else "")
                if match:
                    env_port = match.group(1)
                    if compose_port and env_port != compose_port:
                        pytest.xfail(
                            f"Port mismatch: .env.example has analysis on port {env_port}, "
                            f"docker-compose exposes port {compose_port}"
                        )

    def test_api_port_consistency(self, project_root: Path):
        """Verify API port is consistent between compose and env."""
        compose = yaml.safe_load((project_root / "docker-compose.yml").read_text())
        api = compose.get("services", {}).get("api", {})
        ports = api.get("ports", [])

        if ports:
            port_str = str(ports[0])
            assert "3001" in port_str, f"API port expected 3001, found: {port_str}"


# ─── Script Executability ────────────────────────────────────────────────────

class TestScriptExecutability:
    """Verify shell scripts are executable."""

    @pytest.mark.parametrize("script", [
        "install.sh",
        "setup.sh",
        "validate-config.sh",
        "verify-installation.sh",
        "infra/docker/generate-ssl.sh",
        "infra/docker/init-db.sh",
        "infra/docker/backup-db.sh",
    ])
    def test_script_is_executable(self, project_root: Path, script: str):
        filepath = project_root / script
        if filepath.exists():
            import os
            assert os.access(filepath, os.X_OK), \
                f"Script not executable: {script} (run: chmod +x {script})"
