import os
from celery import Celery
from dotenv import load_dotenv
from redis import Redis




load_dotenv(".env")

redis_client = Redis(host=os.environ.get("REDIS_IP"), port=os.environ.get("REDIS_PORT"),password=os.environ.get("REDIS_PASSWORD") , db=0)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_xml.settings")
celery_app = Celery(
    "process",  
    broker=os.environ.get("CELERY_BROKER_URL"),  
    backend=os.environ.get("CELERY_RESULT_BACKEND"),
    include=["task"],
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'], 
    result_serializer='json',
    broker_connection_retry_on_startup=True,
    result_expires=3600, 
    worker_log_format='[%(asctime)s: %(levelname)s/%(processName)s] %(message)s',
    
)

celery_app.config_from_object("django.conf:settings", namespace="CELERY")
celery_app.autodiscover_tasks()
if __name__ == "__main__":
    celery_app.start()