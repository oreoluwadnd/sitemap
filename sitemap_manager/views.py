from task import sitemap_scrape,process_and_save_pages
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
import requests
from urllib.parse import urlparse
from defusedxml import ElementTree as DET
from datetime import datetime, timezone
from dateutil.parser import isoparse
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
import json
from django.shortcuts import render


def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme in ('http', 'https'), result.netloc])
    except:
        return False

def validate_sitemap(url):
    if not is_valid_url(url):
        return False
    print("url")
    try:
        response = requests.get(url, timeout=1)
        print("done check")
        if response.status_code != 200:
            return False
        # Check if the response is XML
        content_type = response.headers.get('Content-Type', '')
        if 'xml' not in content_type.lower() and not response.text.strip().startswith('<?xml'):
            return False
            
        # Try parsing the XML safely using defusedxml
        try:
            sitemap = DET.fromstring(response.text.encode('utf-8'))
            # Check for sitemap namespace
            ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            # Check if it has proper sitemap elements
            urls = sitemap.findall('.//sm:url', ns) or sitemap.findall('.//url')
            sitemaps = sitemap.findall('.//sm:sitemap', ns) or sitemap.findall('.//sitemap')
            
            return len(urls) > 0 or len(sitemaps) > 0
        except DET.ParseError:
            return False
            
    except requests.RequestException:
        return False



@require_GET
@csrf_exempt  # Disable CSRF for simplicity; remove in production
def check_sitemap(request):
    url = request.GET.get('url')
    if not url:
        return JsonResponse({'error': 'Missing URL parameter'}, status=400)
    
    is_valid = validate_sitemap(url)
    return JsonResponse({'url': url, 'is_valid_sitemap': is_valid})

@require_POST
@csrf_exempt
def process_sitemap(request):
    """
    Django view to handle incoming sitemap data, validate it, and send it to a Celery task.
    """
    try:
        # Parse the incoming JSON data
        data = json.loads(request.body)
        print(data)
        
        # Validate the input structure
        if not isinstance(data, dict) or 'data' not in data:
            return JsonResponse({'error': 'Invalid input format. Expected a dictionary with a "data" key.'}, status=400)
        
        sitemap_entries = data.get('data', [])
        
        # Validate each entry in the 'data' list
        for entry in sitemap_entries:
            if not isinstance(entry, dict):
                return JsonResponse({'error': 'Each entry in "data" must be a dictionary.'}, status=400)
            
            # Check for required fields
            if 'url' not in entry:
                return JsonResponse({'error': 'Missing "url" field in one or more entries.'}, status=400)
            
            # Optional: Validate other fields if needed
            if 'date' in entry and not isinstance(entry['date'], str):
                return JsonResponse({'error': 'The "date" field must be a string.'}, status=400)
            
            if 'content' in entry and not isinstance(entry['content'], dict):
                return JsonResponse({'error': 'The "content" field must be a dictionary.'}, status=400)
        
        # If validation passes, send the data to the Celery task
        task = process_and_save_pages.delay(sitemap_entries)
        
        # Return a success response with the task ID
        return JsonResponse({
            'message': 'Sitemap data validated and sent for processing.',
            'task_id': task.id
        })
    
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON input.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'An error occurred: {str(e)}'}, status=500)




@require_POST
@csrf_exempt
def scrape_sitemaps(request):
    try:
        data = json.loads(request.body)
        print(data)
        if not isinstance(data, dict):
            return JsonResponse({'error': 'Invalid input format'}, status=400)
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        url = data.get('url')
        if not url:
            return JsonResponse({'error': 'Missing URL parameter'}, status=400)
        
        if start_date:
            try:
                start_date = datetime.fromisoformat(start_date).date()
            except ValueError:
                return JsonResponse({'error': 'Invalid start_date format'}, status=400)
        
        if end_date:
            try:
                end_date = datetime.fromisoformat(end_date).date()
            except ValueError:
                return JsonResponse({'error': 'Invalid end_date format'}, status=400)
        
        filters = {
            'date_range': {
                'start': start_date,
                'end': end_date
            },
            'priority_range': data.get('priority_range', {}),
            'changefreq': data.get('changefreq', []),
            'url_pattern': data.get('url_pattern', []),
            'keywords': data.get('keywords', []),
        }
        
        task = sitemap_scrape.delay(
            url=url,
            filters=filters
            )  # Assume scrape_task can handle filter dict
        return JsonResponse({'task_id': task.id, 'message': 'Task started successfully'})
    
    except (json.JSONDecodeError, TypeError) as e:
        return JsonResponse({'error': 'Invalid JSON input'}, status=400)




def home(request):
    return render(request, 'sitemap.html')
