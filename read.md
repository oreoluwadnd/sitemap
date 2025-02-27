Web Scraper Documentation
This documentation provides a detailed explanation of the web scraper application, which is designed to scrape content from websites based on sitemaps. The application is built using Python, Celery for task management, Playwright for browser automation, and Django for handling HTTP requests. The scraper supports filtering URLs based on various criteria such as date range, priority, change frequency, and URL patterns.

Table of Contents
Overview

Dependencies

Configuration

Scraper Class

Sitemap Handling

Celery Tasks

Django Views

WebSocket Updates

File Handling

Error Handling

Usage Examples

Overview
The web scraper application is designed to:

Fetch and parse sitemaps.

Filter URLs based on various criteria.

Scrape content from the filtered URLs.

Save the scraped content to files.

Send real-time updates to the frontend using WebSockets.

Dependencies
The application relies on several Python libraries for its functionality, including os, json, logging, re, datetime, dateutil.parser, defusedxml.ElementTree, bs4 (BeautifulSoup), requests, playwright, celery, channels, asgiref.sync, asyncio, and django.

Configuration
Logging
Logging is configured to output information at the INFO level, ensuring that important events and errors are logged for debugging and monitoring.

Celery
Celery is initialized with a Redis broker, allowing for distributed task management and background processing.

Scraper Class
The Scraper class is responsible for scraping content from web pages. It includes methods for initializing the scraper, navigating to URLs, cleaning HTML content, and extracting specific parts of the page content.

Initialization
The scraper is initialized with a browser instance and a list to track failed URLs.

Scraping a Page
The scrape_page method navigates to a URL, retrieves the page content, and extracts relevant information. It handles exceptions by logging errors and adding failed URLs to a list.

Cleaning Content
The _clean_content method removes unnecessary HTML tags such as scripts, styles, navigation, footers, and iframes to focus on the main content.

Extracting Content
The _extract_content method extracts specific parts of the page content, such as the title, meta description, headings, and body text, based on provided options.

Sitemap Handling
Fetching a Sitemap
The fetch_sitemap function retrieves the sitemap content from a given URL using an HTTP GET request.

Parsing a Sitemap
The parse_sitemap function parses the sitemap XML content and extracts URL entries, including their location, last modification date, priority, and change frequency.

Filtering URLs
The filter_urls function filters URLs based on various criteria, including date range, priority, change frequency, and URL patterns.

Celery Tasks
Sitemap Scraping Task
The sitemap_scrape task fetches and parses a sitemap, filters URLs, and scrapes content from the filtered URLs. It sends real-time updates to the frontend via WebSockets.

Process and Save Pages Task
The process_and_save_pages task processes scraped content and saves it to files. It also sends progress updates to the frontend.

Django Views
Check Sitemap
The check_sitemap view validates a sitemap URL by checking its content type and structure.

Process Sitemap
The process_sitemap view processes sitemap data and sends it to a Celery task for further processing.

Scrape Sitemaps
The scrape_sitemaps view initiates the sitemap scraping process by validating input data and starting a Celery task.

WebSocket Updates
The send_websocket_update task sends real-time updates to the frontend via WebSockets, including task initialization, progress updates, and completion notifications.

File Handling
Create Unique Output Directory
The create_unique_output_dir function creates a unique directory for storing scraped content based on the current timestamp.

Save Page to File
The save_page_to_file function saves the scraped content to a file, ensuring that the content is properly formatted and encoded.

Create Filename from URL
The create_filename_from_url function generates a filename from a URL by removing unnecessary characters and truncating it if necessary.

Error Handling
The application includes comprehensive error handling to ensure robustness. Errors are logged and, where appropriate, reported back to the frontend via WebSocket updates.

Usage Examples
Starting a Scraping Task
To start a scraping task, send a POST request to the scrape_sitemaps endpoint with the necessary parameters, such as the sitemap URL, date range, priority range, change frequency, URL patterns, and keywords.

Checking Sitemap Validity
To check if a URL is a valid sitemap, send a GET request to the check_sitemap endpoint with the sitemap URL as a query parameter.

Processing Sitemap Data
To process sitemap data, send a POST request to the process_sitemap endpoint with the sitemap entries in the request body. Each entry should include the URL, date, priority, change frequency, and content.

This documentation provides a comprehensive guide to the web scraper application, covering its structure, functionality, and usage. For further details, refer to the source code and inline comments.

