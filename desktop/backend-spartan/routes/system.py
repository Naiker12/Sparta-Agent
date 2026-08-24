import os
import sys
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Sparta-Agent Python Backend",
        "version": "0.1.0",
        "uptime": "running"
    }

@router.get("/system")
async def get_system_metrics():
    return {
        "platform": sys.platform,
        "python_version": sys.version.split()[0],
        "device_backend": "cpu",
        "cpu": {
            "logical_count": os.cpu_count() or 4,
            "usage_percent": 8.5
        },
        "memory": {
            "total_gb": 16.0,
            "available_gb": 8.5,
            "percent_used": 46.8
        },
        "gpu": {
            "available": False,
            "devices": []
        }
    }

@router.post("/shutdown")
async def shutdown():
    return {"status": "shutting_down"}
