"""
LLM Package

Tools for generating threat descriptions, remediations, and compliance explanations
using Large Language Models (Claude, GPT-4).
"""

from .llm_client import LLMClient
from .threat_generator import ThreatGenerator

__all__ = ['LLMClient', 'ThreatGenerator']
