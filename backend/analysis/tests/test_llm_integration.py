"""
Tests for LLM Integration

Unit tests for LLM client, threat generator, caching, and prompt templates.
"""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from llm.llm_client import LLMClient, LLMProvider, LLMError, RateLimitError
from llm.threat_generator import ThreatGenerator
from llm.prompt_templates import PromptTemplates, get_system_prompt
from utils.cache import ResponseCache, get_cache


class TestResponseCache:
    """Test response cache"""
    
    def test_cache_initialization(self):
        """Test cache initialization"""
        cache = ResponseCache(max_size=100, ttl=60)
        assert cache.max_size == 100
        assert cache.ttl == 60
        assert len(cache.cache) == 0
    
    def test_cache_set_and_get(self):
        """Test setting and getting from cache"""
        cache = ResponseCache()
        
        prompt = "Test prompt"
        response = "Test response"
        
        cache.set(prompt, response)
        retrieved = cache.get(prompt)
        
        assert retrieved == response
        assert cache.hits == 1
        assert cache.misses == 0
    
    def test_cache_miss(self):
        """Test cache miss"""
        cache = ResponseCache()
        
        retrieved = cache.get("nonexistent prompt")
        
        assert retrieved is None
        assert cache.misses == 1
    
    def test_cache_expiration(self):
        """Test cache entry expiration"""
        cache = ResponseCache(ttl=1)  # 1 second TTL
        
        cache.set("prompt", "response")
        
        # Should be cached
        assert cache.get("prompt") == "response"
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should be expired
        assert cache.get("prompt") is None
    
    def test_cache_lru_eviction(self):
        """Test LRU eviction when cache is full"""
        cache = ResponseCache(max_size=2)
        
        cache.set("prompt1", "response1")
        cache.set("prompt2", "response2")
        cache.set("prompt3", "response3")  # Should evict prompt1
        
        assert cache.get("prompt1") is None  # Evicted
        assert cache.get("prompt2") == "response2"
        assert cache.get("prompt3") == "response3"
    
    def test_cache_statistics(self):
        """Test cache statistics"""
        cache = ResponseCache(max_size=10)
        
        cache.set("prompt1", "response1")
        cache.get("prompt1")  # Hit
        cache.get("prompt2")  # Miss
        
        stats = cache.get_statistics()
        
        assert stats['size'] == 1
        assert stats['hits'] == 1
        assert stats['misses'] == 1
        assert stats['hit_rate'] == 50.0
    
    def test_cache_clear(self):
        """Test clearing cache"""
        cache = ResponseCache()
        
        cache.set("prompt1", "response1")
        cache.set("prompt2", "response2")
        
        cache.clear()
        
        assert len(cache.cache) == 0
        assert cache.hits == 0
        assert cache.misses == 0
    
    def test_cache_with_system_prompt(self):
        """Test caching with different system prompts"""
        cache = ResponseCache()
        
        prompt = "Test prompt"
        response1 = "Response with system prompt 1"
        response2 = "Response with system prompt 2"
        
        cache.set(prompt, response1, system_prompt="System 1")
        cache.set(prompt, response2, system_prompt="System 2")
        
        # Different system prompts should have different cache keys
        assert cache.get(prompt, system_prompt="System 1") == response1
        assert cache.get(prompt, system_prompt="System 2") == response2


class TestPromptTemplates:
    """Test prompt templates"""
    
    def test_threat_description_prompt(self):
        """Test threat description prompt generation"""
        prompt = PromptTemplates.threat_description(
            service_type="Cloud SQL",
            service_name="main-db",
            properties={"publicly_accessible": True, "encrypted": False},
            threat_name="Database Exposed",
            threat_category="Data Exposure"
        )
        
        assert "Cloud SQL" in prompt
        assert "main-db" in prompt
        assert "publicly_accessible" in prompt
        assert "Database Exposed" in prompt
        assert "Data Exposure" in prompt
    
    def test_remediation_prompt(self):
        """Test remediation prompt generation"""
        prompt = PromptTemplates.remediation(
            threat_name="Public S3 Bucket",
            threat_description="Bucket allows public read access",
            cloud_provider="AWS",
            service_type="S3 Bucket",
            resource_name="data-bucket",
            current_config={"acl": "public-read"}
        )
        
        assert "AWS" in prompt
        assert "Public S3 Bucket" in prompt
        assert "data-bucket" in prompt
        assert "acl" in prompt
        assert "Terraform" in prompt or "CLI" in prompt
    
    def test_compliance_explanation_prompt(self):
        """Test compliance explanation prompt generation"""
        prompt = PromptTemplates.compliance_explanation(
            threat_name="Unencrypted Database",
            threat_description="Database does not use encryption at rest",
            compliance_framework="ISO27001",
            control_id="A.10.1.1",
            control_description="Cryptographic controls"
        )
        
        assert "ISO27001" in prompt
        assert "A.10.1.1" in prompt
        assert "Unencrypted Database" in prompt
        assert "Cryptographic controls" in prompt
    
    def test_get_system_prompt(self):
        """Test getting system prompts"""
        prompt = get_system_prompt('threat_description')
        assert len(prompt) > 0
        assert "security" in prompt.lower()
        
        prompt = get_system_prompt('remediation')
        assert "remediation" in prompt.lower() or "fix" in prompt.lower()


class TestLLMClient:
    """Test LLM client"""
    
    @patch('anthropic.Anthropic')
    def test_call_claude_success(self, mock_anthropic):
        """Test successful Claude API call"""
        # Mock Claude response
        mock_response = Mock()
        mock_response.content = [Mock(text="Generated threat description")]
        mock_response.usage = Mock(input_tokens=100, output_tokens=50)
        
        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client
        
        client = LLMClient(claude_api_key="test_key")
        client.claude_client = mock_client
        
        result = client.call_claude("Test prompt")
        
        assert result == "Generated threat description"
        assert client.request_count == 1
    
    @patch('openai.chat.completions.create')
    def test_call_openai_success(self, mock_create):
        """Test successful OpenAI API call"""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock(message=Mock(content="Generated remediation"))]
        mock_response.usage = Mock(total_tokens=150)
        mock_create.return_value = mock_response
        
        client = LLMClient(openai_api_key="test_key")
        client.openai_client = Mock()
        client.openai_client.chat = Mock()
        client.openai_client.chat.completions = Mock()
        client.openai_client.chat.completions.create = mock_create
        
        result = client.call_openai("Test prompt")
        
        assert result == "Generated remediation"
        assert client.request_count == 1
    
    @patch('anthropic.Anthropic')
    def test_fallback_to_openai(self, mock_anthropic):
        """Test fallback from Claude to OpenAI"""
        # Mock Claude failure
        mock_client = Mock()
        mock_client.messages.create.side_effect = Exception("Claude unavailable")
        mock_anthropic.return_value = mock_client
        
        # Mock OpenAI success
        mock_openai_response = Mock()
        mock_openai_response.choices = [Mock(message=Mock(content="Fallback response"))]
        mock_openai_response.usage = Mock(total_tokens=100)
        
        client = LLMClient(claude_api_key="test_key", openai_api_key="test_key2")
        client.claude_client = mock_client
        client.openai_client = Mock()
        client.openai_client.chat = Mock()
        client.openai_client.chat.completions = Mock()
        client.openai_client.chat.completions.create = Mock(return_value=mock_openai_response)
        
        result = client.generate("Test prompt", enable_fallback=True)
        
        assert result == "Fallback response"
    
    def test_statistics(self):
        """Test statistics tracking"""
        client = LLMClient()
        
        stats = client.get_statistics()
        
        assert 'total_requests' in stats
        assert 'active_requests' in stats


class TestThreatGenerator:
    """Test threat generator"""
    
    def test_initialization(self):
        """Test threat generator initialization"""
        generator = ThreatGenerator()
        
        assert generator.llm_client is not None
        assert generator.cache is not None
        assert generator.enable_cache is True
    
    @patch.object(LLMClient, 'generate')
    def test_generate_threat_description(self, mock_generate):
        """Test threat description generation"""
        mock_generate.return_value = "This database is publicly accessible, allowing unauthorized access."
        
        generator = ThreatGenerator()
        
        config = {
            'resource_type': 'google_sql_database_instance',
            'name': 'main-db',
            'properties': {'publicly_accessible': True}
        }
        
        threat_rule = {
            'id': 'GCP-SQL-001',
            'name': 'Public Database',
            'category': 'Data Exposure'
        }
        
        description = generator.generate_threat_description(config, threat_rule, use_cache=False)
        
        assert len(description) > 0
        assert mock_generate.called
    
    @patch.object(LLMClient, 'generate')
    def test_generate_remediation(self, mock_generate):
        """Test remediation generation"""
        mock_generate.return_value = "1. Disable public access\n2. Enable VPC peering\n3. Update firewall rules"
        
        generator = ThreatGenerator()
        
        threat = {
            'name': 'Public Database',
            'description': 'Database is publicly accessible',
            'severity': 'high'
        }
        
        context = {
            'cloud_provider': 'gcp',
            'service_type': 'google_sql_database_instance',
            'resource_name': 'main-db',
            'current_config': {'publicly_accessible': True}
        }
        
        remediation = generator.generate_remediation(threat, context, use_cache=False)
        
        assert len(remediation) > 0
        assert mock_generate.called
    
    @patch.object(LLMClient, 'generate')
    def test_generate_compliance_explanation(self, mock_generate):
        """Test compliance explanation generation"""
        mock_generate.return_value = "ISO27001 A.10.1.1 requires encryption at rest. This threat violates..."
        
        generator = ThreatGenerator()
        
        threat = {
            'name': 'Unencrypted Database',
            'description': 'Database lacks encryption at rest'
        }
        
        explanation = generator.generate_compliance_explanation(
            threat, 
            framework="ISO27001",
            control_id="A.10.1.1",
            use_cache=False
        )
        
        assert len(explanation) > 0
        assert mock_generate.called
    
    @patch.object(LLMClient, 'generate')
    def test_caching_works(self, mock_generate):
        """Test that caching prevents redundant API calls"""
        mock_generate.return_value = "Cached response"
        
        generator = ThreatGenerator()
        
        threat = {
            'name': 'Test Threat',
            'description': 'Test description'
        }
        
        context = {
            'cloud_provider': 'aws',
            'service_type': 's3_bucket',
            'resource_name': 'test-bucket',
            'current_config': {}
        }
        
        # First call - should hit LLM
        result1 = generator.generate_remediation(threat, context)
        assert mock_generate.call_count == 1
        
        # Second call - should use cache
        result2 = generator.generate_remediation(threat, context)
        assert mock_generate.call_count == 1  # Still 1, not 2
        
        assert result1 == result2
    
    def test_get_statistics(self):
        """Test statistics retrieval"""
        generator = ThreatGenerator()
        
        stats = generator.get_statistics()
        
        assert 'llm' in stats
        assert 'cache' in stats


class TestIntegration:
    """Integration tests"""
    
    @patch.object(LLMClient, 'generate')
    def test_end_to_end_threat_generation(self, mock_generate):
        """Test complete workflow"""
        mock_generate.side_effect = [
            "Generated threat description",
            "Generated remediation steps",
            "Generated compliance explanation"
        ]
        
        generator = ThreatGenerator()
        
        # Sample data
        config = {
            'resource_type': 'aws_s3_bucket',
            'name': 'data-bucket',
            'properties': {'acl': 'public-read'}
        }
        
        threat_rule = {
            'id': 'AWS-S3-001',
            'name': 'Public S3 Bucket',
            'category': 'Data Exposure'
        }
        
        threat = {
            'name': 'Public S3 Bucket',
            'description': 'Bucket allows public access'
        }
        
        context = {
            'cloud_provider': 'aws',
            'service_type': 'aws_s3_bucket',
            'resource_name': 'data-bucket',
            'current_config': {'acl': 'public-read'}
        }
        
        # Generate all three
        description = generator.generate_threat_description(config, threat_rule, use_cache=False)
        remediation = generator.generate_remediation(threat, context, use_cache=False)
        compliance = generator.generate_compliance_explanation(threat, "GDPR", use_cache=False)
        
        assert len(description) > 0
        assert len(remediation) > 0
        assert len(compliance) > 0
        assert mock_generate.call_count == 3


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
