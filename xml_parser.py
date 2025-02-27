import asyncio
import json
from datetime import datetime, timezone
from dateutil.parser import isoparse
from defusedxml.ElementTree import fromstring
from bs4 import BeautifulSoup
import requests
from playwright.async_api import async_playwright
import logging
import re
import os


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

class Scraper:
    def __init__(self, browser):
        self.browser = browser
        self.failed_urls = []

    async def scrape_page(self, url, keywords, scrape_options):
        try:
            page = await self.browser.new_page()
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            content = await page.content()
            await page.close()

            soup = BeautifulSoup(content, "lxml")
            soup = self._clean_content(soup)

            extracted = self._extract_content(soup, scrape_options)
            combined_content = self._combine_content(extracted, scrape_options)

            if keywords and not self._contains_keywords(combined_content, keywords):
                return None

            return {
                "title": extracted.get("title", ""),
                "content": combined_content
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

    def _extract_content(self, soup, options):
        extracted = {}
        if options['title']:
            extracted['title'] = soup.title.text.strip() if soup.title else ""
        if options['meta_description']:
            meta = soup.find("meta", attrs={"name": "description"})
            extracted['meta_description'] = meta["content"] if meta else ""
        if options['h1_h5']:
            extracted['h1_h5'] = " ".join([h.text for h in soup.find_all(["h1", "h2", "h3", "h4", "h5"])])
        if options['body_text']:
            extracted['body_text'] = soup.get_text(separator=" ", strip=True)
        return extracted

    def _combine_content(self, extracted, options):
        parts = []
        for key in ['title', 'meta_description', 'h1_h5', 'body_text']:
            if options.get(key) and extracted.get(key):
                parts.append(extracted[key])
        return "\n".join(parts)

    def _contains_keywords(self, content, keywords):
        content_lower = content.lower()
        return any(kw.lower() in content_lower for kw in keywords)

def fetch_sitemap(url="https://vercel.com/crawled-sitemap.xml"):
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

def filter_urls(urls, filters):
    filtered = []
    print(filters)
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
    if not entry['lastmod']:
        return False
    try:
        lastmod_date = isoparse(entry['lastmod']).date()
        return filters['date_range']['start'] <= lastmod_date <= filters['date_range']['end']
    except Exception:
        return False


def _pass_priority_filter(entry, filters):
    """Check priority filter if provided and entry has priority."""
    if 'priority_range' not in filters:
        return True  # Skip if no priority filter
    
    if 'priority' not in entry or entry['priority'] is None:
        return True  # Skip if entry has no priority
    
    priority = entry['priority']
    min_priority = filters['priority_range'].get('min')
    max_priority = filters['priority_range'].get('max')
    
    # If min or max priority is not provided, skip that part of the filter
    if min_priority is not None and priority < min_priority:
        return False
    if max_priority is not None and priority > max_priority:
        return False
    return True

def create_filename_from_url(url, prefix="page"):
    """Create a valid filename from a URL."""
    # Remove protocol (http:// or https://)
    filename = re.sub(r'^https?://', '', url)
    # Replace non-alphanumeric characters with underscores
    filename = re.sub(r'[^a-zA-Z0-9]', '_', filename)
    # Limit length to avoid excessively long filenames
    if len(filename) > 50:
        filename = filename[:50]
    return f"{prefix}_{filename}.txt"

def _pass_changefreq_filter(entry, filters):
    """Check changefreq filter if provided and entry has changefreq."""
    if 'changefreq' not in filters:
        return True  # Skip if no changefreq filter
    
    if 'changefreq' not in entry or not entry['changefreq']:
        return True  # Skip if entry has no changefreq
    
    return entry['changefreq'] in filters['changefreq']

def _pass_url_pattern_filter(entry, filters):
    """Check URL pattern filter if provided."""
    if 'url_pattern' not in filters:
        return True  # Skip if no URL pattern filter
    
    if not filters['url_pattern']:
        return True  # Skip if URL pattern is empty
    
    return any(pattern in entry['loc'] for pattern in filters['url_pattern'])

def save_page_to_file(result, output_dir="scraped_pages"):
    """Save a scraped page's content to a file."""
    # Create the output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Create a filename based on the URL
    filename = create_filename_from_url(result["url"])
    filepath = os.path.join(output_dir, filename)
    
    # Prepare content to save
    content_to_save = f"Title: {result['title']}\n"
    content_to_save += f"URL: {result['url']}\n"
    content_to_save += f"Last Modified: {result['date']}\n"
    content_to_save += f"Priority: {result['priority']}\n"
    content_to_save += f"Change Frequency: {result['changefreq']}\n"
    content_to_save += "\n--- CONTENT ---\n\n"
    content_to_save += result['content']
    
    # Write to file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content_to_save)
        logger.info(f"Saved content to {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Failed to save content to {filepath}: {e}")
        return None

async def main():
    # Fetch and parse sitemap
    xml_content = fetch_sitemap()
    if not xml_content:
        return {"error": "Failed to fetch sitemap"}
    
    all_urls = parse_sitemap(xml_content)
    if not all_urls:
        return {"error": "No URLs found in sitemap"}


    # Filter URLs
    filtered_urls = filter_urls(all_urls, filters)
    
    logger.info(f"Filtered {len(filtered_urls)} URLs")

    # Prepare results
    results = []
    stats = {
        "total_urls": len(all_urls),
        "filtered": len(filtered_urls),
        "selected": 0,
        "avg_priority": 0.0
    }
    
        # Create output directory
    output_dir = "scraped_pages"
    os.makedirs(output_dir, exist_ok=True)


    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        scraper = Scraper(browser)

        # Process filtered URLs
        for url_entry in filtered_urls:
            url = url_entry['loc']
            try:
                scraped = await scraper.scrape_page(url, filters['keywords'], filters['scrape_options'])
                if scraped:
                    
                    
                    result = {
                        "title": scraped["title"],
                        "url": url,
                        "date": url_entry['lastmod'],
                        "priority": url_entry['priority'],
                        "changefreq": url_entry['changefreq'],
                        "content": scraped["content"]
                    }
                    results.append(result)
                  
                    saved_path = save_page_to_file(result, output_dir)
                    print(saved_path)
            except Exception as e:
                logger.error(f"Error processing {url}: {e}")

        await browser.close()

    # Calculate stats
    stats["selected"] = len(results)
    if results:
        valid_priorities = [r["priority"] for r in results if r["priority"] is not None]
        stats["avg_priority"] = sum(valid_priorities) / len(valid_priorities) if valid_priorities else 0

    # Format filters for output
    formatted_filters = {
        'date_range': {
            'start': filters['date_range'].get('start').isoformat(),
            'end': filters['date_range'].get('end').isoformat()
        },
        'priority_range': filters.get('priority_range', {}),
        'changefreq': filters.get('changefreq', []),
        'url_pattern': filters.get('url_pattern', []),
        'keywords': filters.get('keywords', []),
        'scrape_options': filters.get('scrape_options', {})
    }

    return {
        "filters": formatted_filters,
        "stats": stats,
        "results": results
    }

if __name__ == "__main__":
    result = asyncio.run(main())
    print(json.dumps(result, indent=2))