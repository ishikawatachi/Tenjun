"""
Terraform Parser for Threat Modeling
Parse Terraform HCL2 configurations and extract security-relevant information
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
import hcl2
import lark

from models.terraform import (
    Resource, Variable, Provider, DataSource, Module, Output,
    TerraformConfiguration
)

logger = logging.getLogger(__name__)


class TerraformParserError(Exception):
    """Custom exception for Terraform parsing errors"""
    pass


class TerraformParser:
    """
    Parse Terraform HCL2 configurations for threat modeling
    
    Supports:
    - Multi-file projects
    - HCL2 syntax with string interpolation
    - Resource properties extraction
    - Variable and provider detection
    - Module references
    """
    
    def __init__(self):
        """Initialize the Terraform parser"""
        self.logger = logging.getLogger(__name__)
        self.supported_extensions = {'.tf', '.hcl'}
        
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a single Terraform file
        
        Args:
            file_path: Path to the .tf file
            
        Returns:
            Dictionary containing parsed configuration
            
        Raises:
            TerraformParserError: If parsing fails
        """
        file_path = Path(file_path).resolve()
        
        if not file_path.exists():
            raise TerraformParserError(f"File not found: {file_path}")
        
        if file_path.suffix not in self.supported_extensions:
            raise TerraformParserError(
                f"Unsupported file extension: {file_path.suffix}. "
                f"Supported: {', '.join(self.supported_extensions)}"
            )
        
        self.logger.info(f"Parsing file: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse HCL2 content
            hcl_dict = hcl2.loads(content)
            
            # Create configuration object
            config = TerraformConfiguration(source_files=[str(file_path)])
            
            # Extract all components
            config.resources = self.extract_resources(hcl_dict, str(file_path))
            config.data_sources = self.extract_data_sources(hcl_dict, str(file_path))
            config.variables = self.extract_variables(hcl_dict, str(file_path))
            config.outputs = self.extract_outputs(hcl_dict, str(file_path))
            config.providers = self.extract_providers(hcl_dict, str(file_path))
            config.modules = self.extract_modules(hcl_dict, str(file_path))
            config.terraform_version = self.extract_terraform_version(hcl_dict)
            config.backend_config = self.extract_backend_config(hcl_dict)
            
            return config.to_dict()
            
        except lark.exceptions.LarkError as e:
            raise TerraformParserError(f"HCL2 parsing error in {file_path}: {str(e)}")
        except Exception as e:
            raise TerraformParserError(f"Error parsing {file_path}: {str(e)}")
    
    def parse_directory(self, dir_path: str) -> Dict[str, Any]:
        """
        Parse all Terraform files in a directory
        
        Args:
            dir_path: Path to directory containing .tf files
            
        Returns:
            Dictionary containing merged configuration from all files
            
        Raises:
            TerraformParserError: If parsing fails
        """
        dir_path = Path(dir_path).resolve()
        
        if not dir_path.exists():
            raise TerraformParserError(f"Directory not found: {dir_path}")
        
        if not dir_path.is_dir():
            raise TerraformParserError(f"Not a directory: {dir_path}")
        
        self.logger.info(f"Parsing directory: {dir_path}")
        
        # Find all .tf files
        tf_files = []
        for ext in self.supported_extensions:
            tf_files.extend(dir_path.glob(f"*{ext}"))
        
        if not tf_files:
            self.logger.warning(f"No Terraform files found in {dir_path}")
            return TerraformConfiguration().to_dict()
        
        self.logger.info(f"Found {len(tf_files)} Terraform files")
        
        # Parse all files and merge configurations
        merged_config = TerraformConfiguration()
        errors = []
        
        for tf_file in sorted(tf_files):
            try:
                file_config = self.parse_file(str(tf_file))
                
                # Merge configurations
                merged_config.resources.extend(
                    [self._dict_to_resource(r) for r in file_config['resources']]
                )
                merged_config.data_sources.extend(
                    [self._dict_to_data_source(d) for d in file_config['data_sources']]
                )
                merged_config.variables.extend(
                    [self._dict_to_variable(v) for v in file_config['variables']]
                )
                merged_config.outputs.extend(
                    [self._dict_to_output(o) for o in file_config['outputs']]
                )
                merged_config.providers.extend(
                    [self._dict_to_provider(p) for p in file_config['providers']]
                )
                merged_config.modules.extend(
                    [self._dict_to_module(m) for m in file_config['modules']]
                )
                merged_config.source_files.append(str(tf_file))
                
                # Use first terraform version found
                if not merged_config.terraform_version and file_config.get('terraform_version'):
                    merged_config.terraform_version = file_config['terraform_version']
                
                # Use first backend config found
                if not merged_config.backend_config and file_config.get('backend_config'):
                    merged_config.backend_config = file_config['backend_config']
                    
            except TerraformParserError as e:
                error_msg = f"Error parsing {tf_file.name}: {str(e)}"
                self.logger.error(error_msg)
                errors.append(error_msg)
        
        result = merged_config.to_dict()
        if errors:
            result['parsing_errors'] = errors
        
        return result
    
    def extract_resources(self, hcl_dict: Dict, location: str = None) -> List[Resource]:
        """Extract resource blocks from HCL AST"""
        resources = []
        
        resource_blocks = hcl_dict.get('resource', [])
        if not resource_blocks:
            return resources
        
        for resource_block in resource_blocks:
            for resource_type, resource_configs in resource_block.items():
                for resource_name, properties in resource_configs.items():
                    # Handle depends_on
                    depends_on = properties.get('depends_on', [])
                    if depends_on and not isinstance(depends_on, list):
                        depends_on = [depends_on]
                    
                    # Extract provider if specified
                    provider = properties.get('provider')
                    
                    resource = Resource(
                        resource_type=resource_type,
                        name=resource_name,
                        properties=self._sanitize_properties(properties),
                        location=location,
                        depends_on=depends_on,
                        provider=provider
                    )
                    resources.append(resource)
        
        self.logger.debug(f"Extracted {len(resources)} resources")
        return resources
    
    def extract_data_sources(self, hcl_dict: Dict, location: str = None) -> List[DataSource]:
        """Extract data source blocks from HCL AST"""
        data_sources = []
        
        data_blocks = hcl_dict.get('data', [])
        if not data_blocks:
            return data_sources
        
        for data_block in data_blocks:
            for data_type, data_configs in data_block.items():
                for data_name, properties in data_configs.items():
                    provider = properties.get('provider')
                    
                    data_source = DataSource(
                        data_type=data_type,
                        name=data_name,
                        properties=self._sanitize_properties(properties),
                        location=location,
                        provider=provider
                    )
                    data_sources.append(data_source)
        
        self.logger.debug(f"Extracted {len(data_sources)} data sources")
        return data_sources
    
    def extract_variables(self, hcl_dict: Dict, location: str = None) -> List[Variable]:
        """Extract variable definitions from HCL AST"""
        variables = []
        
        variable_blocks = hcl_dict.get('variable', [])
        if not variable_blocks:
            return variables
        
        for variable_block in variable_blocks:
            for var_name, var_config in variable_block.items():
                # Extract validation rules if present
                validation_rules = []
                if 'validation' in var_config:
                    validations = var_config['validation']
                    if not isinstance(validations, list):
                        validations = [validations]
                    validation_rules = validations
                
                variable = Variable(
                    name=var_name,
                    type=var_config.get('type'),
                    default=var_config.get('default'),
                    description=var_config.get('description'),
                    sensitive=var_config.get('sensitive', False),
                    validation_rules=validation_rules,
                    location=location
                )
                variables.append(variable)
        
        self.logger.debug(f"Extracted {len(variables)} variables")
        return variables
    
    def extract_outputs(self, hcl_dict: Dict, location: str = None) -> List[Output]:
        """Extract output definitions from HCL AST"""
        outputs = []
        
        output_blocks = hcl_dict.get('output', [])
        if not output_blocks:
            return outputs
        
        for output_block in output_blocks:
            for output_name, output_config in output_block.items():
                output = Output(
                    name=output_name,
                    value=output_config.get('value'),
                    description=output_config.get('description'),
                    sensitive=output_config.get('sensitive', False),
                    location=location
                )
                outputs.append(output)
        
        self.logger.debug(f"Extracted {len(outputs)} outputs")
        return outputs
    
    def extract_providers(self, hcl_dict: Dict, location: str = None) -> List[Provider]:
        """Extract provider configurations from HCL AST"""
        providers = []
        
        provider_blocks = hcl_dict.get('provider', [])
        if not provider_blocks:
            return providers
        
        for provider_block in provider_blocks:
            for provider_name, provider_configs in provider_block.items():
                # Handle both single and multiple provider configs
                if not isinstance(provider_configs, list):
                    provider_configs = [provider_configs]
                
                for config in provider_configs:
                    provider = Provider(
                        name=provider_name,
                        alias=config.get('alias'),
                        version=config.get('version'),
                        region=config.get('region'),
                        configuration=self._sanitize_properties(config),
                        location=location
                    )
                    providers.append(provider)
        
        self.logger.debug(f"Extracted {len(providers)} providers")
        return providers
    
    def extract_modules(self, hcl_dict: Dict, location: str = None) -> List[Module]:
        """Extract module references from HCL AST"""
        modules = []
        
        module_blocks = hcl_dict.get('module', [])
        if not module_blocks:
            return modules
        
        for module_block in module_blocks:
            for module_name, module_config in module_block.items():
                # Separate source/version from inputs
                source = module_config.get('source')
                version = module_config.get('version')
                
                # All other keys are inputs
                inputs = {
                    k: v for k, v in module_config.items()
                    if k not in ['source', 'version']
                }
                
                module = Module(
                    name=module_name,
                    source=source,
                    version=version,
                    inputs=inputs,
                    location=location
                )
                modules.append(module)
        
        self.logger.debug(f"Extracted {len(modules)} modules")
        return modules
    
    def extract_terraform_version(self, hcl_dict: Dict) -> Optional[str]:
        """Extract Terraform version requirement"""
        terraform_blocks = hcl_dict.get('terraform', [])
        if not terraform_blocks:
            return None
        
        for terraform_block in terraform_blocks:
            version = terraform_block.get('required_version')
            if version:
                return version
        
        return None
    
    def extract_backend_config(self, hcl_dict: Dict) -> Optional[Dict[str, Any]]:
        """Extract backend configuration"""
        terraform_blocks = hcl_dict.get('terraform', [])
        if not terraform_blocks:
            return None
        
        for terraform_block in terraform_blocks:
            backend = terraform_block.get('backend')
            if backend:
                return backend
        
        return None
    
    def _sanitize_properties(self, properties: Dict) -> Dict:
        """
        Remove meta-arguments and sanitize properties for JSON serialization
        """
        meta_args = {'depends_on', 'provider', 'lifecycle', 'provisioner', 'connection', 'count', 'for_each'}
        sanitized = {}
        
        for key, value in properties.items():
            if key not in meta_args:
                # Handle nested structures
                if isinstance(value, dict):
                    sanitized[key] = self._sanitize_properties(value)
                elif isinstance(value, list):
                    sanitized[key] = [
                        self._sanitize_properties(item) if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    sanitized[key] = value
        
        return sanitized
    
    # Helper methods to convert dicts back to dataclass instances
    def _dict_to_resource(self, d: Dict) -> Resource:
        return Resource(
            resource_type=d['resource_type'],
            name=d['name'],
            properties=d['properties'],
            location=d.get('location'),
            depends_on=d.get('depends_on', []),
            provider=d.get('provider')
        )
    
    def _dict_to_data_source(self, d: Dict) -> DataSource:
        return DataSource(
            data_type=d['data_type'],
            name=d['name'],
            properties=d['properties'],
            location=d.get('location'),
            provider=d.get('provider')
        )
    
    def _dict_to_variable(self, d: Dict) -> Variable:
        return Variable(
            name=d['name'],
            type=d.get('type'),
            default=d.get('default'),
            description=d.get('description'),
            sensitive=d.get('sensitive', False),
            validation_rules=d.get('validation_rules', []),
            location=d.get('location')
        )
    
    def _dict_to_output(self, d: Dict) -> Output:
        return Output(
            name=d['name'],
            value=d['value'],
            description=d.get('description'),
            sensitive=d.get('sensitive', False),
            location=d.get('location')
        )
    
    def _dict_to_provider(self, d: Dict) -> Provider:
        return Provider(
            name=d['name'],
            alias=d.get('alias'),
            version=d.get('version'),
            region=d.get('region'),
            configuration=d.get('configuration', {}),
            location=d.get('location')
        )
    
    def _dict_to_module(self, d: Dict) -> Module:
        return Module(
            name=d['name'],
            source=d['source'],
            version=d.get('version'),
            inputs=d.get('inputs', {}),
            location=d.get('location')
        )


def parse_terraform_file(file_path: str) -> Dict[str, Any]:
    """
    Convenience function to parse a single Terraform file
    
    Args:
        file_path: Path to .tf file
        
    Returns:
        Parsed configuration as dictionary
    """
    parser = TerraformParser()
    return parser.parse_file(file_path)


def parse_terraform_directory(dir_path: str) -> Dict[str, Any]:
    """
    Convenience function to parse a directory of Terraform files
    
    Args:
        dir_path: Path to directory containing .tf files
        
    Returns:
        Merged configuration as dictionary
    """
    parser = TerraformParser()
    return parser.parse_directory(dir_path)
