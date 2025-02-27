import os
import json
import logging
import re

from datetime import datetime, timezone
from dateutil.parser import isoparse
from defusedxml.ElementTree import fromstring
from bs4 import BeautifulSoup
import requests
from playwright.async_api import async_playwright
from celery import Celery, current_task
from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import asyncio
from time import sleep

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Celery
app = Celery('scraper_tasks', broker=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'))



class Scraper:
    def __init__(self, browser):
        self.browser = browser
        self.failed_urls = []

    async def scrape_page(self, url):
        try:
            page = await self.browser.new_page()
            await page.goto(url, timeout=100000, wait_until="networkidle")
            content = await page.content()
            await page.close()
            soup = BeautifulSoup(content, "lxml")
            cleaned_html = self._clean_content(soup)

            extracted = self._extract_content(cleaned_html)
       
            # combined_content = self._combine_content(extracted, scrape_options)
            # # if keywords and not self._contains_keywords(combined_content, keywords):
            # #     return None
            return {
                "url": url,
                "content": extracted,
            }
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            self.failed_urls.append(url)
            return None

    def _clean_content(self, soup):
        for tag in ['script', 'style', 'nav', 'footer', 'aside', 'header', 'iframe', 'form']:
            for element in soup(tag):
                element.decompose()
        return soup

    def _get_tile(self, soup):
        return soup.title.text.strip() if soup.title else ""

    def _extract_content(self, soup, options=None):
        extracted = {}
        default_options = {'title': True, 'meta_description': True, 'heading': True, 'body_text': True}
        
        # Use provided options or default to True for missing keys
        options = options or default_options  # If options is None, use defaults

        if options.get('title', False):
            extracted['title'] = soup.title.text.strip() if soup.title else ""
        if options.get('meta_description', False):
            meta = soup.find("meta", attrs={"name": "description"})
            extracted['meta_description'] = meta["content"] if meta else ""
        if options.get('heading', False):
            extracted['heading'] = " ".join([h.text for h in soup.find_all(["h1", "h2", "h3", "h4", "h5"])])
        if options.get('body_text', False):
            extracted['body'] = soup.get_text(separator=" ", strip=True)
        
        return extracted




    def _contains_keywords(self, content, keywords):
        content_lower = content.lower()
        return any(kw.lower() in content_lower for kw in keywords)

def fetch_sitemap(url):
    try:
        response = requests.get(url, timeout=10)
        return response.text if response.status_code == 200 else None
    except requests.RequestException as e:
        logger.error(f"Error fetching sitemap: {e}")
        return None

def parse_sitemap(xml_content):
    try:
        root = fromstring(xml_content)
        namespace = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        return [{
            "loc": url.find("ns:loc", namespace).text,
            "lastmod": url.find("ns:lastmod", namespace).text if url.find("ns:lastmod", namespace) is not None else None,
            "priority": float(url.find("ns:priority", namespace).text) if url.find("ns:priority", namespace) is not None else None,
            "changefreq": url.find("ns:changefreq", namespace).text if url.find("ns:changefreq", namespace) is not None else None
        } for url in root.findall("ns:url", namespace)]
    except Exception as e:
        logger.error(f"Error parsing sitemap: {e}")
        return []

def calculate_avg_priority(filtered_urls):
    priorities = [
        entry["priority"] for entry in filtered_urls 
        if entry.get("priority") is not None
    ]
    
    if priorities:
        avg_priority = sum(priorities) / len(priorities)
    else:
        avg_priority = 0  # Default if no priorities are found

    return round(avg_priority, 2)  # Round to match UI display

def filter_urls(urls, filters):
    filtered = []
    for entry in urls:
        if not _pass_date_filter(entry, filters):
            continue
        if not _pass_priority_filter(entry, filters):
            continue
        if not _pass_changefreq_filter(entry, filters):
            continue
        if not _pass_url_pattern_filter(entry, filters):
            continue
        filtered.append(entry)
    return filtered

def _pass_date_filter(entry, filters):
    date_range = filters.get('date_range', {})
    start = date_range.get('start')
    end = date_range.get('end')

    if not entry.get('lastmod'):
        return False

    try:
        lastmod_date = isoparse(entry['lastmod']).date()
        if start and end:
            return start <= lastmod_date <= end
        elif start:
            return start <= lastmod_date
        elif end:
            return lastmod_date <= end
        return True
    except Exception:
        return False


def _pass_priority_filter(entry, filters):
    if 'priority_range' not in filters:
        return True
    if 'priority' not in entry or entry['priority'] is None:
        return True
    priority = entry['priority']
    min_priority = filters['priority_range'].get('min')
    max_priority = filters['priority_range'].get('max')
    if min_priority is not None and priority < min_priority:
        return False
    if max_priority is not None and priority > max_priority:
        return False
    return True

def _pass_url_pattern_filter(entry, filters):
    if 'url_pattern' not in filters:
        return True
    if not filters['url_pattern']:
        return True
    return any(pattern in entry['loc'] for pattern in filters['url_pattern'])

def _pass_changefreq_filter(entry, filters):
    if 'changefreq' not in filters:
        return True
    if 'changefreq' not in entry or not entry['changefreq']:
        return True
    return entry['changefreq'] in filters['changefreq']

@shared_task(bind=True , max_retries=3)
def sitemap_scrape(self, url: str, filters: dict):
    sleep(10)  
    try:
        # Fetch and parse sitemap
        print(filters)
        xml_content = fetch_sitemap(url)
        if not xml_content:
            return {"error": "Failed to fetch sitemap"}
        
        all_urls = parse_sitemap(xml_content)
        if not all_urls:
            return {"error": "No URLs found in sitemap"}
        logger.info(f"Found {len(all_urls)} URLs in sitemap")
        total_urls = len(all_urls)
        filtered_urls = filter_urls(all_urls, filters)
        logger.info(f"Filtered {len(filtered_urls)} URLs")
        # Notify frontend before scraping starts
        send_websocket_update.delay({
            "task_id": self.request.id,
            "type": "init",
            "task": "scraper",
            "total_urls": total_urls,
            "filtered_urls": len(filtered_urls),
            "message": f"Found {total_urls} URLs. Processing will start now."
        })

    
        results = []
        stats = {
            "total_urls": len(all_urls),
            "filtered": len(filtered_urls),
            "selected": 0,
            "avg_priority": calculate_avg_priority(filtered_urls),
        }
        
      
        
    
        async def run_scraper():
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                scraper = Scraper(browser)

                # Process filtered URLs
                for i, url_entry in enumerate(filtered_urls):
                    url = url_entry['loc']
                    try:
                        scraped = await scraper.scrape_page(url)
                        if scraped:
                            print(scraped["content"])
                            result = {
                                "url": url,
                                "date": url_entry['lastmod'],
                                "priority": url_entry['priority'],
                                "changefreq": url_entry['changefreq'],
                                "content": scraped["content"]
                            }
                            results.append(result)
                            # saved_path = save_page_to_file(result, output_dir)
                            # logger.info(f"Saved {saved_path}")
                        
                        # Update progress
                        progress = (i + 1) / len(filtered_urls) * 100
                        send_websocket_update.delay({
                        "task_id": self.request.id,
                        "type": "progress",
                        "task": "scraper",
                        "progress": progress,
                        "current_url": url,
                        "message": f"Processing {i+1}/{len(filtered_urls)} URLs..."
                    })
                    except Exception as e:
                        logger.error(f"Error processing {url}: {e}")

                await browser.close()


        asyncio.run(run_scraper())
        # Serialize the date_range before sending the response
        if 'date_range' in filters:
            filters['date_range'] = {
            'start': filters['date_range'].get('start').isoformat() if filters['date_range'].get('start') else None,
            'end': filters['date_range'].get('end').isoformat() if filters['date_range'].get('end') else None
            }

        response = {
            "filters": filters,
            "stats": stats,
            "results": results
        }
        send_websocket_update.delay({
            "task_id": self.request.id,
            "task" : "scraper",
            "type": "done",
            "message": "Scraping completed successfully!",
            "processed_urls": len(filtered_urls),
            "data" : response
        })
        return response
        
    except Exception as e:
        logger.error(f"Error in scrape_task: {e}")
        return {"error": str(e)}
    

@shared_task(bind=True, max_retries=3)
def process_and_save_pages(self, data):
    """
    Celery task to process all entries in the data list and save them to a single directory.
    Sends WebSocket notifications for task progress.
    """
    
    sleep(20)
    try:
        # Step 1: Create a unique output directory for this task
        output_dir = create_unique_output_dir()
        logger.info(f"Created output directory: {output_dir}")
        
        # Step 2: Notify frontend that the task has started
        send_websocket_update.delay({
            "task_id": self.request.id,
            "type": "init",
            "task": "save_pages",
            "total_entries": len(data),
            "message": f"Found {len(data)} entries. Processing will start now."
        })
        
        # Step 3: Process each entry in the data list
        results = []
        for i, entry in enumerate(data):
            try:
                # Combine content
                combined_content = _combine_content(entry.get('content', {}))
                
                # Add metadata to the content
                content_to_save = f"Title: {entry.get('title', 'N/A')}\n"
                content_to_save += f"URL: {entry.get('url', 'N/A')}\n"
                content_to_save += f"Last Modified: {entry.get('date', 'N/A')}\n"
                content_to_save += f"Priority: {entry.get('priority', 'N/A')}\n"
                content_to_save += f"Change Frequency: {entry.get('changefreq', 'N/A')}\n"
                content_to_save += "\n--- CONTENT ---\n\n"
                content_to_save += combined_content
                
                # Save to file
                filepath = save_page_to_file(entry, content_to_save, output_dir)
                
                if filepath:
                    results.append({
                        "url": entry.get('url'),
                        "filepath": filepath
                    })
                    logger.info(f"Successfully saved content to {filepath}")
                else:
                    logger.error(f"Failed to save content for URL: {entry.get('url')}")
                
                # Step 4: Notify frontend of progress
                progress = (i + 1) / len(data) * 100
                send_websocket_update.delay({
                    "task_id": self.request.id,
                    "type": "progress",
                    "task": "save_pages",
                    "progress": progress,
                    "current_url": entry.get('url'),
                    "message": f"Processing {i+1}/{len(data)} entries..."
                })
            
            except Exception as e:
                logger.error(f"Error processing entry {entry.get('url')}: {e}")
                continue
        
        # Step 5: Notify frontend that the task is complete
        send_websocket_update.delay({
            "task_id": self.request.id,
            "type": "done",
            "task": "save_pages",
            "message": "Task completed successfully!",
            "processed_entries": len(results),
            "output_dir": output_dir,
            "results": results
        })
        
        return {
            "output_dir": output_dir,
            "results": results
        }
    
    except Exception as e:
        logger.error(f"Error in process_and_save_pages: {e}")
        # Notify frontend of failure
        send_websocket_update.delay({
            "task_id": self.request.id,
            "type": "error",
            "task": "save_pages",
            "message": f"Task failed: {str(e)}"
        })
        raise

def _combine_content(extracted, options=None):
    parts = []
    for key in ['title', 'meta_description', 'heading', 'body']:
        if (options is None or options.get(key)) and extracted.get(key):
                parts.append(extracted[key])
    return "\n".join(parts)

def create_unique_output_dir():
    """
    Create a unique output directory based on the current timestamp.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join("scraped_pages", f"scraped_{timestamp}")
    os.makedirs(output_dir, exist_ok=True)
    return output_dir

def save_page_to_file(entry, content_to_save, output_dir):
    """
    Save the combined content to a file.
    """
    try:
        filename = create_filename_from_url(entry.get('url'))
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content_to_save)
        
        return filepath
    except Exception as e:
        logger.error(f"Failed to save content to {filepath}: {e}")
        return None

def create_filename_from_url(url, prefix="page"):
    """
    Create a filename from a URL.
    """
    if not url:
        return f"{prefix}_unknown.txt"
    
    filename = re.sub(r'^https?://', '', url)
    filename = re.sub(r'[^a-zA-Z0-9]', '_', filename)
    if len(filename) > 50:
        filename = filename[:50]
    return f"{prefix}_{filename}.txt"
  

@shared_task(bind=True , max_retries=2)
def send_websocket_update(self, data):
    task_id = data.get("task_id")
    if not task_id:
        print("Warning: task_id is missing, skipping WebSocket update")
        return  # Exit early
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'task_{task_id}',
        {"type": "scraper.update", "data": data}
    )