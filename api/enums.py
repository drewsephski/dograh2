from enum import Enum


class IntegrationAction(Enum):
    ALL_CALLS = "All Calls"
    QUALIFIED_CALLS = "Qualified Calls"


class Environment(Enum):
    LOCAL = "local"
    PRODUCTION = "production"
    TEST = "test"


class WorkflowRunMode(Enum):
    TWILIO = "twilio"
    VONAGE = "vonage"
    VOBIZ = "vobiz"
    STASIS = "stasis"
    WEBRTC = "webrtc"
    SMALLWEBRTC = "smallwebrtc"

    # Historical, not used anymore. Don't
    # use and don't remove
    VOICE = "VOICE"
    CHAT = "CHAT"


class StorageBackend(Enum):
    """Storage backend enumeration.

    Currently supported backends:
    - S3: Amazon S3
    - MINIO: MinIO

    Future extensibility: Additional backends like GCS, Azure can be added by:
    1. Adding new enum values as strings
    2. Implementing storage logic in services/storage.py
    3. Database will automatically support new values via SQLAlchemy Enum type
    """

    # Currently implemented backends
    S3 = "s3"  # AWS S3 for cloud deployments
    MINIO = "minio"  # MinIO for local/OSS deployments

    @classmethod
    def get_current_backend(cls):
        """Get current backend based on ENABLE_AWS_S3 flag and actual configuration."""
        from api.constants import ENABLE_AWS_S3, S3_BUCKET
        from loguru import logger
        
        # Log the actual value for debugging
        import os
        raw_value = os.getenv("ENABLE_AWS_S3", "false")
        logger.info(f"Storage backend selection: ENABLE_AWS_S3 raw='{raw_value}', parsed={ENABLE_AWS_S3}")
        
        # Additional validation: even if ENABLE_AWS_S3 is true, ensure S3_BUCKET is configured
        if ENABLE_AWS_S3:
            if not S3_BUCKET:
                logger.warning("ENABLE_AWS_S3 is true but S3_BUCKET is not configured. Falling back to MinIO.")
                return cls.MINIO
            logger.info(f"S3 storage selected with bucket: {S3_BUCKET}")
            return cls.S3
        else:
            logger.info("MinIO storage selected")
            return cls.MINIO


class WorkflowRunState(Enum):
    INITIALIZED = "initialized"  # Workflow run created, ready for connection
    RUNNING = "running"  # Websocket connected and pipeline active
    COMPLETED = "completed"  # Workflow run finished


class WorkflowRunStatus(Enum):
    # historical modes
    VOICE = "VOICE"
    CHAT = "CHAT"


class OrganizationConfigurationKey(Enum):
    DISPOSITION_CODE_MAPPING = "DISPOSITION_CODE_MAPPING"
    DISPOSITION_MESSAGE_TEMPLATE = "DISPOSITION_MESSAGE_TEMPLATE"
    CONCURRENT_CALL_LIMIT = "CONCURRENT_CALL_LIMIT"
    TELEPHONY_CONFIGURATION = (
        "TELEPHONY_CONFIGURATION"  # Stores all providers + active one
    )
    TWILIO_CONFIGURATION = (
        "TWILIO_CONFIGURATION"  # Deprecated - for backward compatibility
    )


class WorkflowStatus(Enum):
    """Workflow status values"""

    ACTIVE = "active"
    ARCHIVED = "archived"
    # Future statuses can be added here like:
    # DRAFT = "draft"
    # PAUSED = "paused"


class RedisChannel(Enum):
    """Redis pub/sub channel names"""

    CAMPAIGN_EVENTS = "campaign_events"


class TriggerState(Enum):
    """Agent trigger state values"""

    ACTIVE = "active"
    ARCHIVED = "archived"


class WebhookCredentialType(Enum):
    """Webhook credential authentication types"""

    NONE = "none"  # No authentication
    API_KEY = "api_key"  # API key in header
    BEARER_TOKEN = "bearer_token"  # Bearer token auth
    BASIC_AUTH = "basic_auth"  # Username/password
    CUSTOM_HEADER = "custom_header"  # Custom header key-value
