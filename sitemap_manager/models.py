from django.db import models
from django.utils import timezone


class ScraperTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    url = models.URLField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    progress = models.FloatField(default=0)
    filters = models.JSONField()
    stats = models.JSONField(null=True, blank=True)
    
    def __str__(self):
        return f"Task {self.id}: {self.url} ({self.status})"


class ScrapedPage(models.Model):
    task = models.ForeignKey(ScraperTask, on_delete=models.CASCADE, related_name='pages')
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=500, unique=True)
    date = models.DateTimeField()
    priority = models.FloatField(null=True, blank=True)
    changefreq = models.CharField(max_length=20, null=True, blank=True)
    content = models.TextField()
    file_path = models.CharField(max_length=500, null=True, blank=True)
    
    def __str__(self):
        return self.title