from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"), 
    path("scrape_sitemaps/", views.scrape_sitemaps, name="scrape_sitemaps"),
    path("check_sitemap/", views.check_sitemap, name="check_sitemap"),
    path("process_sitemap/", views.process_sitemap, name="process_sitemap"),
]