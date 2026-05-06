"""
业务逻辑服务层

将复杂的业务逻辑从 routes 层抽离，提高可测试性和可维护性。
"""
from .matching import (
    compute_match,
    compute_final_match,
    compute_employer_fit,
    compute_candidate_fit,
    compute_legacy_match,
    extract_exp_min,
)

__all__ = [
    'compute_match',
    'compute_final_match',
    'compute_employer_fit',
    'compute_candidate_fit',
    'compute_legacy_match',
    'extract_exp_min',
]
