"""
LLM Client

Unified client for interacting with Claude and OpenAI APIs with fallback,
retry logic, and request queuing.
"""

import os
import time
import logging
import asyncio
from typing import Optional, Dict, Any, List
from enum import Enum
import anthropic
import openai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers"""
    CLAUDE = "claude"
    OPENAI = "openai"


class LLMError(Exception):
    """Base exception for LLM errors"""
    pass


class RateLimitError(LLMError):
    """Rate limit exceeded"""
    pass


class TimeoutError(LLMError):
    """Request timeout"""
    pass


class LLMClient:
    """
    Unified LLM client with fallback support
    
    Supports:
    - Claude 3.5 Sonnet (primary)
    - OpenAI GPT-4o (fallback)
    - Retry logic with exponential backoff
    - Request queuing
    - Request/response logging
    """
    
    def __init__(
        self,
        claude_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        max_concurrent: int = 50,
        default_provider: LLMProvider = LLMProvider.CLAUDE
    ):
        """
        Initialize LLM client
        
        Args:
            claude_api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            openai_api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            max_concurrent: Maximum concurrent requests
            default_provider: Default LLM provider to use
        """
        self.claude_api_key = claude_api_key or os.getenv('ANTHROPIC_API_KEY')
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.max_concurrent = max_concurrent
        self.default_provider = default_provider
        
        # Initialize clients
        self.claude_client = None
        if self.claude_api_key:
            self.claude_client = anthropic.Anthropic(api_key=self.claude_api_key)
        
        self.openai_client = None
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
            self.openai_client = openai
        
        # Request tracking
        self.request_count = 0
        self.active_requests = 0
        self.request_semaphore = asyncio.Semaphore(max_concurrent)
        
        # Logging
        self.enable_logging = True
        self.request_log: List[Dict[str, Any]] = []
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((RateLimitError, TimeoutError))
    )
    def call_claude(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        model: str = "claude-3-5-sonnet-20241022"
    ) -> str:
        """
        Call Claude API with retry logic
        
        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model: Claude model to use
        
        Returns:
            Generated text response
        
        Raises:
            LLMError: If API call fails
        """
        if not self.claude_client:
            raise LLMError("Claude API key not configured")
        
        start_time = time.time()
        self.active_requests += 1
        self.request_count += 1
        
        try:
            logger.info(f"Calling Claude API (model: {model})")
            
            # Build messages
            messages = [{"role": "user", "content": prompt}]
            
            # Call API
            response = self.claude_client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt if system_prompt else None,
                messages=messages
            )
            
            # Extract text from response
            text = response.content[0].text
            
            elapsed = time.time() - start_time
            
            # Log request
            if self.enable_logging:
                self._log_request(
                    provider=LLMProvider.CLAUDE.value,
                    model=model,
                    prompt=prompt,
                    response=text,
                    elapsed=elapsed,
                    tokens=response.usage.input_tokens + response.usage.output_tokens
                )
            
            logger.info(f"Claude API call completed in {elapsed:.2f}s")
            return text
            
        except anthropic.RateLimitError as e:
            logger.warning(f"Claude rate limit exceeded: {e}")
            raise RateLimitError(f"Claude rate limit: {e}")
        
        except anthropic.APITimeoutError as e:
            logger.warning(f"Claude API timeout: {e}")
            raise TimeoutError(f"Claude timeout: {e}")
        
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise LLMError(f"Claude error: {e}")
        
        finally:
            self.active_requests -= 1
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((RateLimitError, TimeoutError))
    )
    def call_openai(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        model: str = "gpt-4o"
    ) -> str:
        """
        Call OpenAI API with retry logic
        
        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            model: OpenAI model to use
        
        Returns:
            Generated text response
        
        Raises:
            LLMError: If API call fails
        """
        if not self.openai_client:
            raise LLMError("OpenAI API key not configured")
        
        start_time = time.time()
        self.active_requests += 1
        self.request_count += 1
        
        try:
            logger.info(f"Calling OpenAI API (model: {model})")
            
            # Build messages
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            # Call API
            response = self.openai_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            # Extract text from response
            text = response.choices[0].message.content
            
            elapsed = time.time() - start_time
            
            # Log request
            if self.enable_logging:
                self._log_request(
                    provider=LLMProvider.OPENAI.value,
                    model=model,
                    prompt=prompt,
                    response=text,
                    elapsed=elapsed,
                    tokens=response.usage.total_tokens
                )
            
            logger.info(f"OpenAI API call completed in {elapsed:.2f}s")
            return text
            
        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit exceeded: {e}")
            raise RateLimitError(f"OpenAI rate limit: {e}")
        
        except openai.APITimeoutError as e:
            logger.warning(f"OpenAI API timeout: {e}")
            raise TimeoutError(f"OpenAI timeout: {e}")
        
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise LLMError(f"OpenAI error: {e}")
        
        finally:
            self.active_requests -= 1
    
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        provider: Optional[LLMProvider] = None,
        enable_fallback: bool = True
    ) -> str:
        """
        Generate text with automatic fallback
        
        Tries primary provider first, falls back to secondary if it fails.
        
        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            provider: LLM provider to use (defaults to default_provider)
            enable_fallback: Enable fallback to alternative provider
        
        Returns:
            Generated text response
        
        Raises:
            LLMError: If all providers fail
        """
        target_provider = provider or self.default_provider
        
        # Try primary provider
        try:
            if target_provider == LLMProvider.CLAUDE:
                return self.call_claude(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
            else:
                return self.call_openai(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
        
        except LLMError as e:
            logger.warning(f"Primary provider {target_provider.value} failed: {e}")
            
            if not enable_fallback:
                raise
            
            # Try fallback provider
            fallback_provider = (
                LLMProvider.OPENAI if target_provider == LLMProvider.CLAUDE 
                else LLMProvider.CLAUDE
            )
            
            logger.info(f"Falling back to {fallback_provider.value}")
            
            try:
                if fallback_provider == LLMProvider.CLAUDE:
                    return self.call_claude(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature
                    )
                else:
                    return self.call_openai(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature
                    )
            
            except LLMError as fallback_error:
                logger.error(f"Fallback provider also failed: {fallback_error}")
                raise LLMError(
                    f"All providers failed. Primary: {e}, Fallback: {fallback_error}"
                )
    
    def _log_request(
        self,
        provider: str,
        model: str,
        prompt: str,
        response: str,
        elapsed: float,
        tokens: int
    ):
        """Log API request for audit"""
        log_entry = {
            'timestamp': time.time(),
            'provider': provider,
            'model': model,
            'prompt_length': len(prompt),
            'response_length': len(response),
            'elapsed': elapsed,
            'tokens': tokens,
            'request_id': self.request_count
        }
        
        self.request_log.append(log_entry)
        
        # Keep only last 1000 requests in memory
        if len(self.request_log) > 1000:
            self.request_log = self.request_log[-1000:]
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get usage statistics"""
        if not self.request_log:
            return {
                'total_requests': 0,
                'active_requests': self.active_requests
            }
        
        total_elapsed = sum(entry['elapsed'] for entry in self.request_log)
        total_tokens = sum(entry['tokens'] for entry in self.request_log)
        
        provider_counts = {}
        for entry in self.request_log:
            provider = entry['provider']
            provider_counts[provider] = provider_counts.get(provider, 0) + 1
        
        return {
            'total_requests': len(self.request_log),
            'active_requests': self.active_requests,
            'total_elapsed': total_elapsed,
            'average_elapsed': total_elapsed / len(self.request_log),
            'total_tokens': total_tokens,
            'average_tokens': total_tokens / len(self.request_log),
            'provider_distribution': provider_counts
        }
    
    def clear_logs(self):
        """Clear request logs"""
        self.request_log.clear()
