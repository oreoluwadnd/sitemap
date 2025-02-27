from task import scrape_task
from datetime import datetime, timezone
from dateutil.parser import isoparse

filters = {
    'date_range': {
        'start': datetime(2024, 8, 28, tzinfo=timezone.utc).date(),
        'end': datetime(2024, 8, 28, tzinfo=timezone.utc).date()
    },
    'priority_range': {},
    'changefreq': [],
    'url_pattern': [],
    'keywords': [],
    'scrape_options': {
        'title': True,
        'meta_description': True,
        'h1_h5': True,
        'body_text': True
    }
}

url = "https://vercel.com/crawled-sitemap.xml"


def send_task(url: str):
    task = scrape_task.apply_async(args=[url , filters])
    return JsonResponse({'task_id': task.id})


if __name__ == "__main__":
    send_task(url)