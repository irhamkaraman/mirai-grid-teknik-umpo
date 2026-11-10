from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str
    must_change_password: bool
    role: str
    username: str
    name: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)

# User & Cohorts
class CohortCreate(BaseModel):
    year: int
    description: Optional[str] = None

class ClassCreate(BaseModel):
    cohort_id: int
    name: str

class BulkAccountGenerateRequest(BaseModel):
    cohort_id: int
    class_id: int
    nim_prefix: str = Field(description="e.g., 23533")
    start_number: int = Field(default=1)
    count: int = Field(default=30)
    name_prefix: str = Field(default="Mahasiswa")

class BulkCsvStudentItem(BaseModel):
    nim: str
    name: str
    email: Optional[str] = None

class BulkCsvImportRequest(BaseModel):
    cohort_id: int
    class_id: int
    students: List[BulkCsvStudentItem]

class BulkDeleteUsersRequest(BaseModel):
    user_ids: List[int]

class UserQuotaUpdateRequest(BaseModel):
    max_disk_mb: int = Field(default=1000, ge=50, le=100000, description="Storage limit in MB")
    max_memory_mb: int = Field(default=512, ge=64, le=64000, description="RAM limit in MB")
    max_cpu_cores: float = Field(default=1.0, ge=0.1, le=32.0, description="CPU cores limit")
    max_projects: Optional[int] = Field(default=None, ge=1, le=100)
    max_databases: Optional[int] = Field(default=None, ge=1, le=100)

class BulkQuotaUpdateRequest(BaseModel):
    user_ids: List[int]
    max_disk_mb: int = Field(default=1000, ge=50, le=100000)
    max_memory_mb: int = Field(default=512, ge=64, le=64000)
    max_cpu_cores: float = Field(default=1.0, ge=0.1, le=32.0)

class UserCreateManual(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6)
    email: Optional[str] = None
    role: str = Field(default="student", pattern="^(student|admin)$")
    class_id: Optional[int] = None
    must_change_password: bool = True

class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    email: Optional[str] = None
    role: str
    class_id: Optional[int] = None
    class_name: Optional[str] = None
    cohort_year: Optional[int] = None
    must_change_password: bool
    is_active: bool
    max_disk_mb: Optional[int] = None
    max_memory_mb: Optional[int] = None
    max_cpu_cores: Optional[float] = None
    max_projects: Optional[int] = None
    max_databases: Optional[int] = None

# Databases
class StudentDatabaseCreate(BaseModel):
    engine: str = Field(pattern="^(postgres|mariadb)$")
    db_name: str = Field(min_length=2, max_length=20, pattern="^[a-zA-Z0-9_]+$")

class StudentDatabaseResponse(BaseModel):
    id: int
    engine: str
    db_name: str
    db_username: str
    db_password: Optional[str] = None
    host: str
    port: int
    connection_uri: str
    created_at: str

class ExternalDatabaseCreate(BaseModel):
    alias_name: str
    engine: str
    host: str
    port: int
    db_name: str
    username: str
    password: str

class ExternalDatabaseResponse(BaseModel):
    id: int
    alias_name: str
    engine: str
    host: str
    port: int
    db_name: str
    username: str
    created_at: str

# Projects & Deployments
class ProjectCreate(BaseModel):
    name: str = Field(min_length=3, max_length=30, pattern="^[a-z0-9-]+$")
    language: str = Field(default="php", pattern="^(php|python|node)$")
    version: str = Field(default="8.2")
    app_config: Optional[Dict[str, Any]] = None
    env_vars: Optional[Dict[str, str]] = None
    git_url: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    subdomain: str
    template_type: str
    language: str
    version: str
    app_config: Optional[Dict[str, Any]] = None
    portainer_stack_id: Optional[int] = None
    allocated_port: Optional[int] = None
    status: str
    env_vars: Optional[Dict[str, str]] = None
    source_type: str
    git_url: Optional[str] = None
    access_url: str
    last_deployed_at: Optional[str] = None
    created_at: str

# Quota
class QuotaResponse(BaseModel):
    max_projects: int
    max_databases: int
    max_memory_mb: int
    max_cpu_cores: float
    max_disk_mb: int
    used_projects: int
    used_databases: int

# Audit Log
class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int]
    actor_name: Optional[str]
    action: str
    target_resource: Optional[str]
    ip_address: Optional[str]
    details: Optional[str]
    created_at: str
